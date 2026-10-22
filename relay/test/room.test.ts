import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const BASE = "https://relay.test";

interface Conn {
  ws: WebSocket;
  next: (timeoutMs?: number) => Promise<string>;
  quiet: (ms: number) => Promise<boolean>;
  /** Everything received until 200 ms pass with nothing new, parsed. */
  all: () => Promise<Record<string, unknown>[]>;
  /** Resolves with the close code once the relay closes the socket. */
  closed: Promise<number>;
  clear: () => void;
}

const rooms = new Map<string, Conn[]>();

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
  const closed = new Promise<number>((resolve) => ws.addEventListener("close", (e) => resolve(e.code)));
  ws.accept();
  const conn: Conn = {
    ws,
    closed,
    clear: () => {
      queue.length = 0;
    },
    all: async () => {
      const out: Record<string, unknown>[] = [];
      while (!(await conn.quiet(200))) out.push(JSON.parse(await conn.next()));
      return out;
    },
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
        const w = (s: string) => {
          clearTimeout(t);
          // Put it back so next() still sees it.
          queue.unshift(s);
          resolve(false);
        };
        waiters.push(w);
      }),
  };
  const key = code.toUpperCase();
  rooms.set(key, [...(rooms.get(key) ?? []), conn]);
  return conn;
}

const hello = (name: string) => JSON.stringify({ type: "hello", name, color: "#abc" });

/** Connects and says hello, the way the app does; the others' copy of that hello is cleared. */
async function join(code: string, name: string): Promise<Conn> {
  const conn = await connect(code);
  conn.ws.send(hello(name));
  await new Promise((r) => setTimeout(r, 100));
  for (const other of rooms.get(code.toUpperCase()) ?? []) if (other !== conn) other.clear();
  return conn;
}

/** Everyone joins, then every queue is emptied, so a test starts from a quiet room. */
async function room(code: string, ...names: string[]): Promise<Conn[]> {
  const out: Conn[] = [];
  for (const name of names) out.push(await join(code, name));
  for (const c of out) c.clear();
  return out;
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
    const [a] = await room("ROOMAA", "A");
    const b = await join("roomaa", "B");
    a.ws.send(pos("A", 1));
    const got = JSON.parse(await b.next());
    expect(got.name).toBe("A");
  });
});

describe("room relay", () => {
  it("broadcasts pos with an id, replays last pos to newcomers, announces leave", async () => {
    const [a, b] = await room("ROOM01", "A", "B");

    a.ws.send(pos("A", 10));
    const seenByB = JSON.parse(await b.next());
    expect(seenByB).toMatchObject({ type: "pos", name: "A", x: 10 });
    expect(typeof seenByB.id).toBe("string");
    expect(seenByB.id.length).toBeGreaterThan(0);

    a.ws.send(pos("A", 11)); // newer position replaces the replay state
    await b.next();

    const c = await join("ROOM01", "C");
    const replay = await c.all();
    // A's latest pos, and B's hello since B never sent a pos.
    expect(replay).toHaveLength(2);
    expect(replay).toContainEqual(expect.objectContaining({ type: "pos", name: "A", x: 11, id: seenByB.id }));
    expect(replay).toContainEqual(expect.objectContaining({ type: "hello", name: "B" }));

    a.ws.close(1000, "done");
    const leave = JSON.parse(await b.next());
    expect(leave).toEqual({ type: "leave", id: seenByB.id });
    const leaveC = JSON.parse(await c.next());
    expect(leaveC).toEqual({ type: "leave", id: seenByB.id });
    expect(await b.quiet(200)).toBe(true); // leave is announced once, not repeated
  });

  it("does not echo to the sender and drops invalid messages", async () => {
    const [a, b] = await room("ROOM02", "A", "B");
    a.ws.send("{not json");
    a.ws.send(JSON.stringify({ type: "leave", id: "spoof" }));
    a.ws.send(JSON.stringify({ type: "pos", name: "A", pad: "x".repeat(600) }));
    expect(await b.quiet(300)).toBe(true);
    a.ws.send(JSON.stringify({ type: "hello", name: "A2", color: "#abc" }));
    expect(JSON.parse(await b.next())).toMatchObject({ type: "hello", name: "A2", color: "#abc" });
    expect(await a.quiet(200)).toBe(true);
  });

  it("replays a hello to newcomers until that socket has a pos", async () => {
    const a = await join("ROOM06", "A");
    const b = await join("ROOM06", "B");
    const replay = JSON.parse(await b.next());
    expect(replay).toMatchObject({ type: "hello", name: "A", color: "#abc" });
    expect(typeof replay.id).toBe("string");
    a.ws.send(pos("A", 5));
    await b.next();
    const c = await join("ROOM06", "C");
    expect(await c.all()).toContainEqual(expect.objectContaining({ type: "pos", name: "A", x: 5, id: replay.id }));
  });

  it("tells a socket nothing, and relays nothing from it, until it says hello", async () => {
    const [a] = await room("ROOM11", "A");
    a.ws.send(pos("A", 1));
    await new Promise((r) => setTimeout(r, 100));

    const lurker = await connect("ROOM11");
    a.ws.send(pos("A", 2));
    expect(await lurker.quiet(300)).toBe(true);
    lurker.ws.send(pos("L", 9));
    expect(await a.quiet(300)).toBe(true);

    lurker.ws.send(hello("L"));
    expect(JSON.parse(await a.next())).toMatchObject({ type: "hello", name: "L" });
    expect(await lurker.all()).toEqual([expect.objectContaining({ type: "pos", name: "A", x: 2 })]);
  });

  it("auto-responds to ping without disturbing the other sockets", async () => {
    const [a, b] = await room("ROOM05", "A", "B");
    a.ws.send("ping");
    expect(await a.next()).toBe("pong");
    expect(await b.quiet(300)).toBe(true);
  });

  it("stores shared pins, replays them to newcomers and forgets them on unpin", async () => {
    const [a, b] = await room("ROOM07", "A", "B");
    const pin = { type: "pin", pin: "abcd1234", map: "customs", x: 1, z: 2, label: "loot", color: "#f00" };
    a.ws.send(JSON.stringify(pin));
    const seen = JSON.parse(await b.next());
    expect(seen).toMatchObject(pin);
    expect(typeof seen.id).toBe("string");
    await new Promise((r) => setTimeout(r, 100));

    const c = await join("ROOM07", "C");
    expect((await c.all()).filter((m) => m.type === "pin")).toEqual([expect.objectContaining({ ...pin, id: seen.id })]);

    b.ws.send(JSON.stringify({ type: "unpin", pin: "abcd1234" }));
    expect(JSON.parse(await a.next())).toMatchObject({ type: "unpin", pin: "abcd1234" });
    expect(JSON.parse(await c.next())).toMatchObject({ type: "unpin", pin: "abcd1234" });
    await new Promise((r) => setTimeout(r, 100));
    const d = await join("ROOM07", "D");
    expect((await d.all()).filter((m) => m.type === "pin")).toEqual([]);
  });

  it("stores shared strokes, replays them, forgets them on undraw and wipes a map on cleardraw", async () => {
    const [a, b] = await room("ROOM08", "A", "B");
    const draw = { type: "draw", draw: "abcd1234", map: "customs", color: "#f00", points: [[1, 2], [3.5, -4]] };
    const other = { ...draw, draw: "abcd5678", map: "woods" };
    a.ws.send(JSON.stringify(draw));
    a.ws.send(JSON.stringify(other));
    expect(JSON.parse(await b.next())).toMatchObject(draw);
    expect(JSON.parse(await b.next())).toMatchObject(other);
    await new Promise((r) => setTimeout(r, 100));

    const c = await join("ROOM08", "C");
    const strokes = (await c.all()).filter((m) => m.type === "draw");
    expect(strokes).toEqual([expect.objectContaining(draw), expect.objectContaining(other)]);

    b.ws.send(JSON.stringify({ type: "undraw", draw: "abcd5678" }));
    expect(JSON.parse(await a.next())).toMatchObject({ type: "undraw", draw: "abcd5678" });
    expect(JSON.parse(await c.next())).toMatchObject({ type: "undraw", draw: "abcd5678" });
    b.ws.send(JSON.stringify({ type: "cleardraw", map: "customs" }));
    expect(JSON.parse(await a.next())).toMatchObject({ type: "cleardraw", map: "customs" });
    await new Promise((r) => setTimeout(r, 100));
    const d = await join("ROOM08", "D");
    expect((await d.all()).filter((m) => m.type === "draw")).toEqual([]);
  });

  it("replays the latest to-do list per socket and forgets it when that socket leaves", async () => {
    const [a, b] = await room("ROOM09", "A", "B");
    a.ws.send(JSON.stringify({ type: "todo", tasks: ["t1", "t2"] }));
    const seen = JSON.parse(await b.next());
    expect(seen).toMatchObject({ type: "todo", tasks: ["t1", "t2"] });
    a.ws.send(JSON.stringify({ type: "todo", tasks: ["t2"] }));
    await b.next();
    await new Promise((r) => setTimeout(r, 100));

    const c = await join("ROOM09", "C");
    expect((await c.all()).filter((m) => m.type === "todo")).toEqual([
      expect.objectContaining({ type: "todo", tasks: ["t2"], id: seen.id }),
    ]);

    a.ws.close(1000, "bye");
    expect(JSON.parse(await c.next())).toMatchObject({ type: "leave", id: seen.id });
    await new Promise((r) => setTimeout(r, 100));
    const d = await join("ROOM09", "D");
    expect((await d.all()).filter((m) => m.type === "todo")).toEqual([]);
  });

  it("flags a leave as dropped unless the socket closed with 1000", async () => {
    const [a, b, c] = await room("ROOM10", "A", "B", "C");
    a.ws.close(4000, "gone");
    expect(JSON.parse(await b.next())).toMatchObject({ type: "leave", dropped: true });
    // c heard about a as well; the next thing it hears is b leaving on purpose.
    expect(JSON.parse(await c.next())).toMatchObject({ type: "leave", dropped: true });
    b.ws.close(1000, "leave");
    const seen = JSON.parse(await c.next());
    expect(seen.type).toBe("leave");
    expect(seen.dropped).toBeUndefined();
  });

  it("isolates rooms", async () => {
    const [a] = await room("ROOM03", "A");
    const [b] = await room("ROOM04", "B");
    a.ws.send(pos("A", 1));
    expect(await b.quiet(300)).toBe(true);
  });
});

describe("limits", () => {
  it("turns away a socket once the room is full", async () => {
    for (let i = 0; i < 12; i++) await connect("ROOM12");
    const res = await SELF.fetch(`${BASE}/room/ROOM12`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(429);
    expect(await res.text()).toBe("room full");
  });

  it("closes a socket that floods the room with 1008 and tells the others it dropped", async () => {
    const [a, b] = await room("ROOM13", "A", "B");
    for (let i = 0; i < 200; i++) a.ws.send(pos("A", i));
    expect(await a.closed).toBe(1008);
    const got = await b.all();
    expect(got.filter((m) => m.type === "pos").length).toBeLessThan(200);
    expect(got.at(-1)).toMatchObject({ type: "leave", dropped: true });
  });

  it("drops shared-marker writes past the burst instead of storing every one", async () => {
    const [a] = await room("ROOM14", "A");
    for (let i = 0; i < 30; i++) {
      const id = `pin${String(i).padStart(5, "0")}`;
      a.ws.send(JSON.stringify({ type: "pin", pin: id, map: "customs", x: i, z: 0, label: "", color: "#f00" }));
    }
    await new Promise((r) => setTimeout(r, 200));
    const c = await join("ROOM14", "C");
    expect((await c.all()).filter((m) => m.type === "pin").length).toBe(20);
  });
});
