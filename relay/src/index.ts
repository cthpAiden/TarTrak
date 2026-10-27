import { isValidRoomCode } from "./protocol";
export { RoomDO } from "./room";

export interface Env {
  ROOMS: DurableObjectNamespace;
  /** Room requests per client IP (wrangler.toml); absent where nothing binds it. */
  JOIN_LIMIT?: RateLimit;
}

/**
 * The app's own pages: the Windows webview, the macOS/Linux one, and `npm run dev`. A browser always
 * sends Origin on a WebSocket, so this keeps every web page (a sandboxed one says "null") from opening
 * rooms in its visitors' browsers. A client outside a browser sends none and is let through.
 */
const APP_ORIGINS = new Set(["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost", "http://localhost:1420"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");

    const match = /^\/room\/([^/]+)$/.exec(url.pathname);
    if (!match) return new Response("not found", { status: 404 });

    // A valid code never needs percent-decoding, and decodeURIComponent throws on a
    // malformed escape such as /room/%zz.
    const code = match[1].toUpperCase();
    if (!isValidRoomCode(code)) return new Response("bad room code", { status: 400 });
    const origin = request.headers.get("Origin");
    if (origin !== null && !APP_ORIGINS.has(origin)) return new Response("forbidden", { status: 403 });
    // Makes guessing room codes slow and keeps one client from waking rooms without end. Cloudflare
    // always sets the client IP; `wrangler dev` does not, and goes unlimited.
    const ip = request.headers.get("CF-Connecting-IP");
    if (env.JOIN_LIMIT && ip && !(await env.JOIN_LIMIT.limit({ key: ip })).success) {
      return new Response("too many requests", { status: 429, headers: { "Retry-After": "60" } });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
