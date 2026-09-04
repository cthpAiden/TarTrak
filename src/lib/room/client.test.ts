import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RoomClient, roomUrl, type WebSocketLike } from "./client";
import type { ServerMsg } from "./protocol";

class FakeWs implements WebSocketLike {
  static instances: FakeWs[] = [];
  sent: string[] = [];
  readyState = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeWs.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.({});
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({});
  }
}

function make(overrides: Partial<ConstructorParameters<typeof RoomClient>[0]> = {}) {
  const messages: ServerMsg[] = [];
  const statuses: string[] = [];
  const client = new RoomClient({
    relayUrl: "wss://relay.test",
    code: "ABC123",
    name: "Bob",
    color: "#f00",
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    wsFactory: (url) => new FakeWs(url),
    ...overrides,
  });
  return { client, messages, statuses };
}

describe("roomUrl", () => {
  it("normalizes scheme and path", () => {
    expect(roomUrl("wss://relay.test", "ABC123")).toBe("wss://relay.test/room/ABC123");
    expect(roomUrl("https://relay.test/", "ABC123")).toBe("wss://relay.test/room/ABC123");
    expect(roomUrl("http://localhost:8787", "abc123")).toBe("ws://localhost:8787/room/ABC123");
  });
});

describe("RoomClient", () => {
  beforeEach(() => {
    FakeWs.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("connects, sends hello on open, and forwards parsed server messages", () => {
    const { client, messages, statuses } = make();
    client.connect();
    const ws = FakeWs.instances[0];
    expect(ws.url).toBe("wss://relay.test/room/ABC123");
    expect(statuses).toEqual(["connecting"]);
    ws.open();
    expect(statuses).toEqual(["connecting", "open"]);
    expect(JSON.parse(ws.sent[0])).toEqual({ type: "hello", name: "Bob", color: "#f00" });
    ws.receive({ type: "pos", id: "x1", name: "Al", color: "#0f0", map: "woods", x: 1, y: 2, z: 3, yaw: 4, ts: 5 });
    ws.receive({ garbage: true });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "pos", id: "x1" });
  });

  it("throttles positions to one per 500 ms, sending the latest trailing one", () => {
    const { client } = make();
    client.connect();
    const ws = FakeWs.instances[0];
    ws.open();
    ws.sent.length = 0;
    client.sendPosition("customs", { x: 1, y: 0, z: 0, yaw: 0 });
    client.sendPosition("customs", { x: 2, y: 0, z: 0, yaw: 0 });
    client.sendPosition("customs", { x: 3, y: 0, z: 0, yaw: 0 });
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toMatchObject({ type: "pos", x: 1, map: "customs", name: "Bob", color: "#f00" });
    vi.advanceTimersByTime(499);
    expect(ws.sent).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(ws.sent).toHaveLength(2);
    expect(JSON.parse(ws.sent[1])).toMatchObject({ x: 3 });
    vi.advanceTimersByTime(1000);
    expect(ws.sent).toHaveLength(2);
  });

  it("queues a position sent before open and flushes it on open", () => {
    const { client } = make();
    client.connect();
    client.sendPosition(null, { x: 9, y: 0, z: 0, yaw: 0 });
    const ws = FakeWs.instances[0];
    expect(ws.sent).toHaveLength(0);
    ws.open();
    expect(ws.sent.map((s) => JSON.parse(s).type)).toEqual(["hello", "pos"]);
  });

  it("reconnects with doubling backoff capped at 30 s and stops after close()", () => {
    const { client, statuses } = make();
    client.connect();
    FakeWs.instances[0].open();
    FakeWs.instances[0].drop();
    expect(statuses.at(-1)).toBe("closed");
    expect(FakeWs.instances).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(FakeWs.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWs.instances).toHaveLength(2); // 1 s
    FakeWs.instances[1].drop();
    vi.advanceTimersByTime(2000);
    expect(FakeWs.instances).toHaveLength(3); // 2 s
    FakeWs.instances[2].drop();
    vi.advanceTimersByTime(4000);
    expect(FakeWs.instances).toHaveLength(4); // 4 s
    for (let i = 4; i <= 8; i++) {
      FakeWs.instances[i - 1].drop();
      vi.advanceTimersByTime(30_000);
      expect(FakeWs.instances).toHaveLength(i + 1);
    }
    // a successful open resets the backoff to 1 s
    FakeWs.instances.at(-1)!.open();
    FakeWs.instances.at(-1)!.drop();
    const before = FakeWs.instances.length;
    vi.advanceTimersByTime(1000);
    expect(FakeWs.instances).toHaveLength(before + 1);
    client.close();
    FakeWs.instances.at(-1)!.drop();
    vi.advanceTimersByTime(60_000);
    expect(FakeWs.instances).toHaveLength(before + 1);
    expect(FakeWs.instances.at(-1)!.closed).toBe(true);
  });
});
