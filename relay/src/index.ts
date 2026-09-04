import { isValidRoomCode } from "./protocol";
export { RoomDO } from "./room";

export interface Env {
  ROOMS: DurableObjectNamespace;
}

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
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
