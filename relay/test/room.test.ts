import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const BASE = "https://relay.test";

interface Conn {
  ws: WebSocket;
  next: (timeoutMs?: number) => Promise<string>;
  quiet: (ms: number) => Promise<boolean>;
}

async function connect(code: string): Promise<Conn> {
  const res = await SELF.fetch(`${BASE}/room/${code}`, { headers: { Upgrade: "websocket" } });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  const queue: string[] = [];
  const waiters: ((s: string) => void)[] = [];
  ws.addEventListener("message", (e) => {
    const s = String(e.data);
    const w = waiters.shift();
    if (w) w(s);
    else queue.push(s);
  });
  ws.accept();
  return {
    ws,
    next: (timeoutMs = 2000) =>
      new Promise<string>((resolve, reject) => {
        if (queue.length) return resolve(queue.shift()!);
        const t = setTimeout(() => reject(new Error("timeout waiting for message")), timeoutMs);
        waiters.push((s) => {
          clearTimeout(t);
          resolve(s);
        });
      }),
    quiet: (ms) =>
      new Promise<boolean>((resolve) => {
        if (queue.length) return resolve(false);
        const t = setTimeout(() => {
          const idx = waiters.indexOf(w);
          if (idx >= 0) waiters.splice(idx, 1);
          resolve(true);
        }, ms);
        const w = () => {
          clearTimeout(t);
          resolve(false);
        };
        waiters.push(w);
      }),
  };
}

const pos = (name: string, x: number) =>
  JSON.stringify({ type: "pos", name, color: "#fff", map: "customs", x, y: 0, z: 0, yaw: 0, ts: 1 });

describe("routing", () => {
  it("health", async () => {
    const res = await SELF.fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("rejects bad room codes with 400 and non-websocket with 426", async () => {
    expect((await SELF.fetch(`${BASE}/room/abc`, { headers: { Upgrade: "websocket" } })).status).toBe(400);
    expect((await SELF.fetch(`${BASE}/room/ABC123`)).status).toBe(426);
    expect((await SELF.fetch(`${BASE}/nope`)).status).toBe(404);
  });

  it("rejects a malformed percent escape with 400, not 500", async () => {
    const res = await SELF.fetch(`${BASE}/room/%zz`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(400);
  });

  it("lowercase codes are upgraded to the same room", async () => {
    const a = await connect("ROOMAA");
    const b = await connect("roomaa");
    a.ws.send(pos("A", 1));
    const got = JSON.parse(await b.next());
    expect(got.name).toBe("A");
  });
});

describe("room relay", () => {
  it("broadcasts pos with an id, replays last pos to newcomers, announces leave", async () => {
    const a = await connect("ROOM01");
    const b = await connect("ROOM01");

    a.ws.send(pos("A", 10));
    const seenByB = JSON.parse(await b.next());
    expect(seenByB).toMatchObject({ type: "pos", name: "A", x: 10 });
    expect(typeof seenByB.id).toBe("string");
    expect(seenByB.id.length).toBeGreaterThan(0);

    a.ws.send(pos("A", 11)); // newer position replaces the replay state
    await b.next();

    const c = await connect("ROOM01");
    const replay = JSON.parse(await c.next());
    expect(replay).toMatchObject({ type: "pos", name: "A", x: 11, id: seenByB.id });
    expect(await c.quiet(200)).toBe(true); // B never sent a pos, so nothing else to replay

    a.ws.close(1000, "done");
    const leave = JSON.parse(await b.next());
    expect(leave).toEqual({ type: "leave", id: seenByB.id });
    const leaveC = JSON.parse(await c.next());
    expect(leaveC).toEqual({ type: "leave", id: seenByB.id });
    expect(await b.quiet(200)).toBe(true); // leave is announced once, not repeated
  });

  it("does not echo to the sender and drops invalid messages", async () => {
    const a = await connect("ROOM02");
    const b = await connect("ROOM02");
    a.ws.send("{not json");
    a.ws.send(JSON.stringify({ type: "leave", id: "spoof" }));
    a.ws.send(JSON.stringify({ type: "pos", name: "A", pad: "x".repeat(600) }));
    expect(await b.quiet(300)).toBe(true);
    a.ws.send(JSON.stringify({ type: "hello", name: "A", color: "#abc" }));
    expect(JSON.parse(await b.next())).toMatchObject({ type: "hello", name: "A", color: "#abc" });
    expect(await a.quiet(200)).toBe(true);
  });

  it("replays a hello to newcomers until that socket has a pos", async () => {
    const a = await connect("ROOM06");
    a.ws.send(JSON.stringify({ type: "hello", name: "A", color: "#abc" }));
    await new Promise((r) => setTimeout(r, 100));
    const b = await connect("ROOM06");
    const replay = JSON.parse(await b.next());
    expect(replay).toMatchObject({ type: "hello", name: "A", color: "#abc" });
    expect(typeof replay.id).toBe("string");
    a.ws.send(pos("A", 5));
    await b.next();
    const c = await connect("ROOM06");
    expect(JSON.parse(await c.next())).toMatchObject({ type: "pos", name: "A", x: 5, id: replay.id });
    expect(await c.quiet(200)).toBe(true);
  });

  it("auto-responds to ping without disturbing the other sockets", async () => {
    const a = await connect("ROOM05");
    const b = await connect("ROOM05");
    a.ws.send("ping");
    expect(await a.next()).toBe("pong");
    expect(await b.quiet(300)).toBe(true);
  });

  it("stores shared pins, replays them to newcomers and forgets them on unpin", async () => {
    const a = await connect("ROOM07");
    const b = await connect("ROOM07");
    const pin = { type: "pin", pin: "abcd1234", map: "customs", x: 1, z: 2, label: "loot", color: "#f00" };
    a.ws.send(JSON.stringify(pin));
    const seen = JSON.parse(await b.next());
    expect(seen).toMatchObject(pin);
    expect(typeof seen.id).toBe("string");
    await new Promise((r) => setTimeout(r, 100));

    const c = await connect("ROOM07");
    expect(JSON.parse(await c.next())).toMatchObject({ ...pin, id: seen.id });
    expect(await c.quiet(200)).toBe(true);

    b.ws.send(JSON.stringify({ type: "unpin", pin: "abcd1234" }));
    expect(JSON.parse(await a.next())).toMatchObject({ type: "unpin", pin: "abcd1234" });
    expect(JSON.parse(await c.next())).toMatchObject({ type: "unpin", pin: "abcd1234" });
    await new Promise((r) => setTimeout(r, 100));
    const d = await connect("ROOM07");
    expect(await d.quiet(200)).toBe(true);
  });

  it("stores shared strokes, replays them, forgets them on undraw and wipes a map on cleardraw", async () => {
    const a = await connect("ROOM08");
    const b = await connect("ROOM08");
    const draw = { type: "draw", draw: "abcd1234", map: "customs", color: "#f00", points: [[1, 2], [3.5, -4]] };
    const other = { ...draw, draw: "abcd5678", map: "woods" };
    a.ws.send(JSON.stringify(draw));
    a.ws.send(JSON.stringify(other));
    expect(JSON.parse(await b.next())).toMatchObject(draw);
    expect(JSON.parse(await b.next())).toMatchObject(other);
    await new Promise((r) => setTimeout(r, 100));

    const c = await connect("ROOM08");
    expect(JSON.parse(await c.next())).toMatchObject(draw);
    expect(JSON.parse(await c.next())).toMatchObject(other);

    b.ws.send(JSON.stringify({ type: "undraw", draw: "abcd5678" }));
    expect(JSON.parse(await a.next())).toMatchObject({ type: "undraw", draw: "abcd5678" });
    expect(JSON.parse(await c.next())).toMatchObject({ type: "undraw", draw: "abcd5678" });
    b.ws.send(JSON.stringify({ type: "cleardraw", map: "customs" }));
    expect(JSON.parse(await a.next())).toMatchObject({ type: "cleardraw", map: "customs" });
    await new Promise((r) => setTimeout(r, 100));
    const d = await connect("ROOM08");
    expect(await d.quiet(200)).toBe(true);
  });

  it("isolates rooms", async () => {
    const a = await connect("ROOM03");
    const b = await connect("ROOM04");
    a.ws.send(pos("A", 1));
    expect(await b.quiet(300)).toBe(true);
  });
});
