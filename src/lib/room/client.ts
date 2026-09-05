import type { Position } from "../parse/screenshot";
import {
  parseServerMessage,
  type ClearDrawMsg,
  type DrawMsg,
  type HelloMsg,
  type PinMsg,
  type PosMsg,
  type ServerMsg,
  type UndrawMsg,
  type UnpinMsg,
} from "./protocol";

/** Everything a client sends besides its own identity and position. */
export type ActionMsg = PinMsg | UnpinMsg | DrawMsg | UndrawMsg | ClearDrawMsg;

export type RoomStatus = "connecting" | "open" | "closed";

export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  readyState: number;
}

export interface RoomClientOptions {
  relayUrl: string;
  code: string;
  name: string;
  color: string;
  /** Sent with hello and every pos so teammates can tell an older build apart. */
  version?: string;
  onMessage: (m: ServerMsg) => void;
  onStatus: (s: RoomStatus) => void;
  /** Called when the socket could not even be constructed (an unusable relay URL). */
  onError?: (e: unknown) => void;
  wsFactory?: (url: string) => WebSocketLike;
  now?: () => number;
}

export const SEND_INTERVAL_MS = 500;
/** Keepalive: a silent socket is indistinguishable from a dead one, so we probe it. */
export const PING_INTERVAL_MS = 20_000;
export const PONG_TIMEOUT_MS = 10_000;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const WS_OPEN = 1;

export function roomUrl(relayUrl: string, code: string): string {
  // A pasted host without a scheme is the common case; `new WebSocket` would throw on it.
  const withScheme = relayUrl.includes("://") ? relayUrl : `wss://${relayUrl}`;
  const base = withScheme
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:")
    .replace(/\/+$/, "");
  return `${base}/room/${code.toUpperCase()}`;
}

export class RoomClient {
  private ws: WebSocketLike | null = null;
  private backoff = BACKOFF_MIN_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  /** True once this socket has answered a ping; until then a missing pong means an older relay. */
  private pongSeen = false;
  private pending: PosMsg | null = null;
  private lastPos: PosMsg | null = null;
  private lastSentAt = -Infinity;
  private stopped = false;
  private currentStatus: RoomStatus = "closed";

  constructor(private readonly opts: RoomClientOptions) {}

  get status(): RoomStatus {
    return this.currentStatus;
  }

  connect(): void {
    this.stopped = false;
    this.open();
  }

  close(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    this.reconnectTimer = null;
    this.throttleTimer = null;
    this.stopHeartbeat();
    this.pending = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.setStatus("closed");
  }

  /** Throttled: at most one send per 500 ms; the newest position wins and is sent at the window end. */
  sendPosition(map: string | null, p: Position): void {
    this.pending = {
      type: "pos",
      name: this.opts.name,
      color: this.opts.color,
      ...(this.opts.version ? { version: this.opts.version } : {}),
      map,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      ts: this.now(),
    };
    this.lastPos = this.pending;
    this.flush();
  }

  /** Sent at once, unthrottled; false while the socket is down so the caller can say so. */
  send(msg: ActionMsg): boolean {
    if (!this.ws || this.ws.readyState !== WS_OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  private flush(): void {
    if (!this.pending || !this.ws || this.ws.readyState !== WS_OPEN) return;
    const elapsed = this.now() - this.lastSentAt;
    if (elapsed >= SEND_INTERVAL_MS) {
      this.ws.send(JSON.stringify(this.pending));
      this.pending = null;
      this.lastSentAt = this.now();
      return;
    }
    if (!this.throttleTimer) {
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null;
        this.flush();
      }, SEND_INTERVAL_MS - elapsed);
    }
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pingTimer = null;
    this.pongTimer = null;
  }

  /** A half-open socket never fires onclose, so an unanswered ping is what tells us to reconnect. */
  private startHeartbeat(ws: WebSocketLike): void {
    this.stopHeartbeat();
    this.pongSeen = false;
    this.pingTimer = setInterval(() => {
      if (this.ws !== ws) return;
      ws.send("ping");
      if (this.pongTimer) return;
      this.pongTimer = setTimeout(() => {
        this.pongTimer = null;
        if (this.ws !== ws) return;
        // A relay that has never answered does not speak ping; keep the socket and stop asking.
        if (!this.pongSeen) {
          this.stopHeartbeat();
          return;
        }
        this.ws = null;
        this.stopHeartbeat();
        ws.close();
        this.setStatus("closed");
        this.scheduleReconnect();
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }

  private setStatus(s: RoomStatus): void {
    if (this.currentStatus === s) return;
    this.currentStatus = s;
    this.opts.onStatus(s);
  }

  /** Shared by onclose and by a failed socket construction, so a bad URL cannot kill the loop. */
  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped) this.open();
    }, this.backoff);
    this.backoff = Math.min(BACKOFF_MAX_MS, this.backoff * 2);
  }

  private open(): void {
    const factory = this.opts.wsFactory ?? ((url: string) => new WebSocket(url) as unknown as WebSocketLike);
    let ws: WebSocketLike;
    try {
      ws = factory(roomUrl(this.opts.relayUrl, this.opts.code));
    } catch (e) {
      this.ws = null;
      this.setStatus("closed");
      this.opts.onError?.(e);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    this.setStatus("connecting");

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.backoff = BACKOFF_MIN_MS;
      this.setStatus("open");
      this.startHeartbeat(ws);
      const hello: HelloMsg = { type: "hello", name: this.opts.name, color: this.opts.color };
      if (this.opts.version) hello.version = this.opts.version;
      ws.send(JSON.stringify(hello));
      // The reconnect got a fresh relay id, so the room only knows the new us once we say where
      // we are; waiting for the next screenshot would leave a gap in everyone else's map.
      this.pending ??= this.lastPos;
      this.flush();
    };
    ws.onmessage = (ev) => {
      if (this.ws !== ws || typeof ev.data !== "string") return;
      if (ev.data === "pong") {
        this.pongSeen = true;
        if (this.pongTimer) clearTimeout(this.pongTimer);
        this.pongTimer = null;
        return;
      }
      const msg = parseServerMessage(ev.data);
      if (msg) this.opts.onMessage(msg);
    };
    ws.onerror = () => {
      // onclose follows; nothing to do here
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.stopHeartbeat();
      this.setStatus("closed");
      this.scheduleReconnect();
    };
  }
}
