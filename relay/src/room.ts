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
/** A squad is at most five; the rest is room for reconnects whose old socket has not closed yet. */
const MAX_SOCKETS = 12;
/** Any message: the app sends at most 10 positions a second, so only a flood empties this. */
const MSG_BURST = 40;
const MSG_PER_SEC = 20;
/** Messages that touch storage (markers, strokes, to-dos), which is what the free plan's quota counts. */
const STORE_BURST = 20;
const STORE_PER_SEC = 2;
const STORE_TYPES = new Set(["pin", "unpin", "draw", "undraw", "cleardraw", "todo"]);

interface Bucket {
  tokens: number;
  at: number;
}

/** Refills at `perSec` up to `burst`, then takes one token; false when there is none to take. */
function take(b: Bucket, burst: number, perSec: number, now: number): boolean {
  b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 1000) * perSec);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

export class RoomDO extends DurableObject {
  /** In memory only: a hibernation wake starts every socket on a full bucket, which is fine. */
  private buckets = new WeakMap<WebSocket, { msg: Bucket; store: Bucket }>();
  /** Stored marker and stroke keys, read once per wake so a write does not list the whole set. */
  private keys: { pins: Set<string>; draws: Set<string> } | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Answered by the runtime, so a client keepalive never wakes a hibernating DO.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(_request: Request): Promise<Response> {
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return new Response("room full", { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id } satisfies Attachment);
    // Someone is here again: the pins stay.
    await this.ctx.storage.deleteAlarm();
    // The room is replayed on the newcomer's hello, not here: a socket that never says who it is
    // would otherwise see everyone's position without ever showing up in their squad list.
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Everyone else's identity and position, then the stored markers, strokes and to-dos. */
  private async welcome(server: WebSocket): Promise<void> {
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
  }

  private async storedKeys(): Promise<{ pins: Set<string>; draws: Set<string> }> {
    if (!this.keys) {
      const [pins, draws] = await Promise.all([
        this.ctx.storage.list({ prefix: PIN_PREFIX }),
        this.ctx.storage.list({ prefix: DRAW_PREFIX }),
      ]);
      this.keys = { pins: new Set(pins.keys()), draws: new Set(draws.keys()) };
    }
    return this.keys;
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const now = Date.now();
    let bucket = this.buckets.get(ws);
    if (!bucket) {
      bucket = { msg: { tokens: MSG_BURST, at: now }, store: { tokens: STORE_BURST, at: now } };
      this.buckets.set(ws, bucket);
    }
    if (!take(bucket.msg, MSG_BURST, MSG_PER_SEC, now)) {
      // Only a flood gets here; the app reconnects on its own after a backoff.
      this.announceLeave(ws, true);
      try {
        ws.close(1008, "rate limited");
      } catch {
        // already closed
      }
      return;
    }
    if (typeof message !== "string") return;
    const msg = parseClientMessage(message);
    if (!msg) return;
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    // Every app build says hello first; nothing else counts until it has.
    if (!att.hello && msg.type !== "hello") return;
    if (STORE_TYPES.has(msg.type) && !take(bucket.store, STORE_BURST, STORE_PER_SEC, now)) return;
    const out: ServerMsg = { ...msg, id: att.id };
    const text = JSON.stringify(out);
    if (msg.type === "pin") {
      const key = PIN_PREFIX + msg.pin;
      const { pins } = await this.storedKeys();
      if (pins.size >= MAX_PINS && !pins.has(key)) return;
      pins.add(key);
      await this.ctx.storage.put(key, text);
    } else if (msg.type === "unpin") {
      (await this.storedKeys()).pins.delete(PIN_PREFIX + msg.pin);
      await this.ctx.storage.delete(PIN_PREFIX + msg.pin);
    } else if (msg.type === "draw") {
      const key = DRAW_PREFIX + msg.draw;
      const { draws } = await this.storedKeys();
      if (draws.size >= MAX_DRAWS && !draws.has(key)) return;
      draws.add(key);
      await this.ctx.storage.put(key, text);
    } else if (msg.type === "todo") {
      if (msg.tasks.length === 0) await this.ctx.storage.delete(TODO_PREFIX + att.id);
      else await this.ctx.storage.put(TODO_PREFIX + att.id, text);
    } else if (msg.type === "undraw") {
      (await this.storedKeys()).draws.delete(DRAW_PREFIX + msg.draw);
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
      const { draws: known } = await this.storedKeys();
      for (const key of gone) known.delete(key);
      if (gone.length > 0) await this.ctx.storage.delete(gone);
    } else if (msg.type === "pos") {
      ws.serializeAttachment({ ...att, last: text } satisfies Attachment);
    } else {
      ws.serializeAttachment({ ...att, hello: text } satisfies Attachment);
      if (!att.hello) await this.welcome(ws);
    }
    this.broadcast(text, ws);
  }

  /** Fires only after the room has been empty for the TTL; a rejoin in between cancels it. */
  async alarm(): Promise<void> {
    if (this.ctx.getWebSockets().length > 0) return;
    await this.ctx.storage.deleteAll();
    this.keys = null;
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    // The app closes with 1000 when the user leaves; anything else is a dropped connection.
    this.announceLeave(ws, code !== 1000);
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.announceLeave(ws, true);
  }

  private announceLeave(ws: WebSocket, dropped: boolean): void {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    const leave: ServerMsg = dropped ? { type: "leave", id: att.id, dropped: true } : { type: "leave", id: att.id };
    this.broadcast(JSON.stringify(leave), ws);
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
      // Not yet said hello: it hears the room in its welcome, not before.
      if (!(ws.deserializeAttachment() as Attachment | null)?.hello) continue;
      try {
        ws.send(text);
      } catch {
        // A socket that cannot be written to is dead. Its close event may never come after
        // hibernation, and until the leave goes out the others keep a stale marker of it.
        this.announceLeave(ws, true);
      }
    }
  }
}
