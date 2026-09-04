import { DurableObject } from "cloudflare:workers";
import { parseClientMessage, type ServerMsg } from "./protocol";

/** Per-socket state kept by the runtime across hibernation (limit 2 KiB). */
interface Attachment {
  id: string;
  /** Serialized last `pos` ServerMsg from this socket, replayed to newcomers. */
  last?: string;
}

export class RoomDO extends DurableObject {
  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id } satisfies Attachment);

    for (const other of this.ctx.getWebSockets()) {
      if (other === server) continue;
      const att = other.deserializeAttachment() as Attachment | null;
      if (!att?.last) continue;
      try {
        server.send(att.last);
      } catch {
        // newcomer socket already gone; nothing to replay
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
    if (msg.type === "pos") ws.serializeAttachment({ ...att, last: text } satisfies Attachment);
    this.broadcast(text, ws);
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
