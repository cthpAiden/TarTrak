import { DurableObject } from "cloudflare:workers";
import { parseClientMessage, type ServerMsg } from "./protocol";
import type { Env } from "./index";

/** Per-socket state kept by the runtime across hibernation (limit 2 KiB). */
interface Attachment {
  id: string;
  /** Serialized `hello` ServerMsg from this socket, replayed to newcomers so they list us at once. */
  hello?: string;
  /** Serialized last `pos` ServerMsg from this socket, replayed to newcomers. */
  last?: string;
}

/** Shared markers per room; a spammer cannot grow the storage past this. */
const MAX_PINS = 50;
/** Shared strokes per room, same reasoning. */
const MAX_DRAWS = 200;
const DRAW_PREFIX = "draw:";
/** Latest to-do list per socket, keyed by its id; gone when the socket leaves. */
const TODO_PREFIX = "todo:";
/** An empty room keeps its pins this long, so a squad that all reconnect at once does not lose them. */
const EMPTY_ROOM_PIN_TTL_MS = 30 * 60_000;
const PIN_PREFIX = "pin:";

export class RoomDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Answered by the runtime, so a client keepalive never wakes a hibernating DO.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id } satisfies Attachment);
    // Someone is here again: the pins stay.
    await this.ctx.storage.deleteAlarm();

    for (const other of this.ctx.getWebSockets()) {
      if (other === server) continue;
      const att = other.deserializeAttachment() as Attachment | null;
      if (!att) continue;
      try {
        // A pos carries the identity too, so the hello is only needed while there is no pos yet.
        if (att.last) server.send(att.last);
        else if (att.hello) server.send(att.hello);
      } catch {
        // newcomer socket already gone; nothing to replay
      }
    }
    for (const prefix of [PIN_PREFIX, DRAW_PREFIX, TODO_PREFIX]) {
      for (const text of (await this.ctx.storage.list<string>({ prefix })).values()) {
        try {
          server.send(text);
        } catch {
          // newcomer socket already gone
        }
      }
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const msg = parseClientMessage(message);
    if (!msg) return;
    const att = (ws.deserializeAttachment() as Attachment | null) ?? { id: "unknown" };
    const out: ServerMsg = { ...msg, id: att.id };
    const text = JSON.stringify(out);
    if (msg.type === "pin") {
      const key = PIN_PREFIX + msg.pin;
      const pins = await this.ctx.storage.list<string>({ prefix: PIN_PREFIX });
      if (pins.size >= MAX_PINS && !pins.has(key)) return;
      await this.ctx.storage.put(key, text);
    } else if (msg.type === "unpin") {
      await this.ctx.storage.delete(PIN_PREFIX + msg.pin);
    } else if (msg.type === "draw") {
      const key = DRAW_PREFIX + msg.draw;
      const draws = await this.ctx.storage.list<string>({ prefix: DRAW_PREFIX });
      if (draws.size >= MAX_DRAWS && !draws.has(key)) return;
      await this.ctx.storage.put(key, text);
    } else if (msg.type === "todo") {
      if (msg.tasks.length === 0) await this.ctx.storage.delete(TODO_PREFIX + att.id);
      else await this.ctx.storage.put(TODO_PREFIX + att.id, text);
    } else if (msg.type === "undraw") {
      await this.ctx.storage.delete(DRAW_PREFIX + msg.draw);
    } else if (msg.type === "cleardraw") {
      // Stored strokes are ServerMsg JSON, so the map is read back from the text.
      const draws = await this.ctx.storage.list<string>({ prefix: DRAW_PREFIX });
      const gone: string[] = [];
      for (const [key, stored] of draws) {
        try {
          if ((JSON.parse(stored) as { map?: string }).map === msg.map) gone.push(key);
        } catch {
          gone.push(key);
        }
      }
      if (gone.length > 0) await this.ctx.storage.delete(gone);
    } else if (msg.type === "pos") {
      ws.serializeAttachment({ ...att, last: text } satisfies Attachment);
    } else {
      ws.serializeAttachment({ ...att, hello: text } satisfies Attachment);
    }
    this.broadcast(text, ws);
  }

  /** Fires only after the room has been empty for the TTL; a rejoin in between cancels it. */
  async alarm(): Promise<void> {
    if (this.ctx.getWebSockets().length === 0) await this.ctx.storage.deleteAll();
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    this.announceLeave(ws);
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.announceLeave(ws);
  }

  private announceLeave(ws: WebSocket): void {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    this.broadcast(JSON.stringify({ type: "leave", id: att.id } satisfies ServerMsg), ws);
    void this.ctx.storage.delete(TODO_PREFIX + att.id);
    if (this.ctx.getWebSockets().every((other) => other === ws)) {
      void this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_PIN_TTL_MS);
    }
    // Clearing the attachment makes the guard above swallow a second call, so a socket
    // that errors and then closes announces its leave once.
    try {
      ws.serializeAttachment(null);
    } catch {
      // already gone
    }
  }

  private broadcast(text: string, except: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(text);
      } catch {
        // socket already gone; its close handler announces the leave
      }
    }
  }
}
