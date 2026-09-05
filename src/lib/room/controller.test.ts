import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoomController, type RoomClientLike } from "./controller.svelte";
import type { RoomClientOptions } from "./client";
import { app } from "../state/app.svelte";
import type { Position } from "../parse/screenshot";
import type { ServerMsg } from "./protocol";
import { version as APP_VERSION } from "../../../package.json";

type Handler = (m: ServerMsg) => void;

class FakeClient implements RoomClientLike {
  static last: FakeClient | null = null;
  connected = false;
  closed = false;
  sent: { map: string | null; p: Position }[] = [];
  readonly onMessage: Handler;
  constructor(readonly opts: RoomClientOptions) {
    this.onMessage = opts.onMessage;
    FakeClient.last = this;
  }
  connect() {
    this.connected = true;
  }
  close() {
    this.closed = true;
  }
  sendPosition(map: string | null, p: Position) {
    this.sent.push({ map, p });
  }
  open = true;
  sentPins: unknown[] = [];
  send(msg: unknown) {
    if (!this.open) return false;
    this.sentPins.push(msg);
    return true;
  }
}

function makeController() {
  const c = new RoomController((opts) => new FakeClient(opts));
  c.join("abc123", "Me", "#fff", "wss://relay.test");
  return { room: c, client: FakeClient.last! };
}

const pos = (id: string, name: string): ServerMsg => ({
  type: "pos",
  id,
  name,
  version: APP_VERSION,
  color: "#f00",
  map: "customs",
  x: 1,
  y: 2,
  z: 3,
  yaw: 90,
  ts: 1,
});
const leave = (id: string): ServerMsg => ({ type: "leave", id });
const hello = (id: string, name: string): ServerMsg => ({ type: "hello", id, name, color: "#f00", version: APP_VERSION });

describe("RoomController", () => {
  beforeEach(() => {
    app.clearTeammates();
    app.pins = {};
    app.drawings = {};
    app.ownPos = null;
    app.toasts = [];
  });

  it("adds a teammate's shared pin, removes it on unpin, and drops shared pins on leave", () => {
    const { room, client } = makeController();
    app.addPin({ id: "mine0001", map: "customs", x: 0, z: 0, label: "", color: "#fff", shared: false });
    client.onMessage({ type: "pin", id: "aaaaaaaa", pin: "abcd1234", map: "customs", x: 1, z: 2, label: "loot", color: "#f00" });
    expect(app.pins["abcd1234"]).toEqual({
      id: "abcd1234",
      map: "customs",
      x: 1,
      z: 2,
      label: "loot",
      color: "#f00",
      shared: true,
      from: "aaaaaaaa",
    });
    client.onMessage({ type: "pin", id: "aaaaaaaa", pin: "abcd5678", map: "woods", x: 3, z: 4, label: "", color: "#f00" });
    client.onMessage({ type: "unpin", id: "bbbbbbbb", pin: "abcd1234" });
    expect(Object.keys(app.pins).sort()).toEqual(["abcd5678", "mine0001"]);
    room.leave();
    expect(Object.keys(app.pins)).toEqual(["mine0001"]);
  });

  it("sends my version and warns once per teammate on another or no version", () => {
    const { client } = makeController();
    expect(client.opts.version).toBe(APP_VERSION);
    client.onMessage({ type: "hello", id: "a", name: "Old", color: "#f00" });
    const { version: _v, ...noVersion } = pos("a", "Old") as ServerMsg & { version?: string };
    client.onMessage(noVersion as ServerMsg);
    client.onMessage({ type: "hello", id: "b", name: "Other", color: "#f00", version: "0.0.1" });
    client.onMessage(pos("c", "Same"));
    const texts = app.toasts.map((t) => t.text).filter((t) => t.includes("runs"));
    expect(texts).toEqual([
      `Old runs an older TarTrak, you run ${APP_VERSION}: shared markers and drawings need the same version`,
      `Other runs TarTrak 0.0.1, you run ${APP_VERSION}: shared markers and drawings need the same version`,
    ]);
  });

  it("adds a teammate's stroke, removes it on undraw, wipes a map on cleardraw, and drops shared strokes on leave", () => {
    const { room, client } = makeController();
    app.addDrawing({ id: "mine0001", map: "customs", color: "#fff", points: [[0, 0], [1, 1]], shared: false, mine: true });
    client.onMessage({ type: "draw", id: "aaaaaaaa", draw: "abcd1234", map: "customs", color: "#f00", points: [[1, 2], [3, 4]] });
    client.onMessage({ type: "draw", id: "aaaaaaaa", draw: "abcd5678", map: "woods", color: "#f00", points: [[1, 2], [3, 4]] });
    expect(app.drawings["abcd1234"]).toEqual({
      id: "abcd1234",
      map: "customs",
      color: "#f00",
      points: [[1, 2], [3, 4]],
      shared: true,
      mine: false,
      from: "aaaaaaaa",
    });
    client.onMessage({ type: "undraw", id: "aaaaaaaa", draw: "abcd5678" });
    expect(Object.keys(app.drawings).sort()).toEqual(["abcd1234", "mine0001"]);
    client.onMessage({ type: "cleardraw", id: "bbbbbbbb", map: "customs" });
    expect(Object.keys(app.drawings)).toEqual([]);
    client.onMessage({ type: "draw", id: "aaaaaaaa", draw: "abcd9999", map: "customs", color: "#f00", points: [[1, 2], [3, 4]] });
    app.addDrawing({ id: "mine0002", map: "customs", color: "#fff", points: [[0, 0], [1, 1]], shared: false, mine: true });
    room.leave();
    expect(Object.keys(app.drawings)).toEqual(["mine0002"]);
  });

  it("shares, unshares and clears strokes through the client, reporting when the socket is down", () => {
    const { room, client } = makeController();
    const d = { id: "abcd1234", map: "customs", color: "#0f0", points: [[1, 2], [3, 4]] as [number, number][], shared: true, mine: true };
    expect(room.shareDrawing(d)).toBe(true);
    room.unshareDrawing("abcd1234");
    room.clearSharedDrawings("customs");
    expect(client.sentPins).toEqual([
      { type: "draw", draw: "abcd1234", map: "customs", color: "#0f0", points: [[1, 2], [3, 4]] },
      { type: "undraw", draw: "abcd1234" },
      { type: "cleardraw", map: "customs" },
    ]);
    client.open = false;
    expect(room.shareDrawing(d)).toBe(false);
  });

  it("shares and unshares my pins through the client, reporting when the socket is down", () => {
    const { room, client } = makeController();
    const pin = { id: "abcd1234", map: "customs", x: 1, z: 2, label: "loot", color: "#0f0", shared: true };
    expect(room.sharePin(pin)).toBe(true);
    room.unsharePin("abcd1234");
    expect(client.sentPins).toEqual([
      { type: "pin", pin: "abcd1234", map: "customs", x: 1, z: 2, label: "loot", color: "#0f0" },
      { type: "unpin", pin: "abcd1234" },
    ]);
    client.open = false;
    expect(room.sharePin(pin)).toBe(false);
    room.leave();
    expect(room.sharePin(pin)).toBe(false);
  });

  it("replaces the ghost when the same name reconnects under a new id", () => {
    const { client } = makeController();
    client.onMessage(pos("aaaaaaaa", "Bob"));
    expect(Object.keys(app.teammates)).toEqual(["aaaaaaaa"]);

    client.onMessage(leave("aaaaaaaa"));
    // The marker stays put, but is now flagged as a leftover.
    expect(app.teammates["aaaaaaaa"].left).toBe(true);

    client.onMessage(pos("bbbbbbbb", "Bob"));
    expect(Object.keys(app.teammates)).toEqual(["bbbbbbbb"]);
    expect(app.teammates["bbbbbbbb"].name).toBe("Bob");
    expect(app.teammates["bbbbbbbb"].left).toBeFalsy();
  });

  it("drops the old marker when the new id's pos arrives before the leave", () => {
    const { client } = makeController();
    client.onMessage(pos("aaaaaaaa", "Bob"));
    client.onMessage(pos("bbbbbbbb", "Bob"));
    client.onMessage(leave("aaaaaaaa"));
    expect(Object.keys(app.teammates)).toEqual(["bbbbbbbb"]);
    expect(app.teammates["bbbbbbbb"].left).toBeFalsy();
  });

  it("drops a ghost the leave could not judge on the next pos", () => {
    vi.useFakeTimers();
    try {
      const { client } = makeController();
      client.onMessage(pos("bbbbbbbb", "Bob"));
      vi.advanceTimersByTime(10);
      // A last gasp from the old socket, so the leave sees the departing entry as the newest one.
      client.onMessage(pos("aaaaaaaa", "Bob"));
      client.onMessage(leave("aaaaaaaa"));
      expect(app.teammates["aaaaaaaa"].left).toBe(true);
      client.onMessage(pos("bbbbbbbb", "Bob"));
      expect(Object.keys(app.teammates)).toEqual(["bbbbbbbb"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a live teammate with the same name as a departed one", () => {
    const { client } = makeController();
    client.onMessage(pos("aaaaaaaa", "Bob"));
    client.onMessage(pos("cccccccc", "Ann"));
    client.onMessage(leave("cccccccc"));
    client.onMessage(pos("bbbbbbbb", "Bob"));
    // Only the departed Ann is a candidate ghost, and her name does not match.
    expect(Object.keys(app.teammates).sort()).toEqual(["aaaaaaaa", "bbbbbbbb", "cccccccc"]);
  });

  it("drops the ghost on a hello as well as on a pos", () => {
    const { client } = makeController();
    client.onMessage(pos("aaaaaaaa", "Bob"));
    client.onMessage(leave("aaaaaaaa"));
    client.onMessage(hello("bbbbbbbb", "Bob"));
    expect(Object.keys(app.teammates)).toEqual(["bbbbbbbb"]);
    expect(app.teammates.bbbbbbbb.noPosition).toBe(true);
  });

  it("lists a joiner on hello and upgrades the row when the first pos arrives", () => {
    const { client } = makeController();
    client.onMessage(hello("aaaaaaaa", "Ann"));
    expect(app.teammates.aaaaaaaa).toMatchObject({ name: "Ann", map: null, noPosition: true });
    expect(app.toasts.map((t) => t.text)).toEqual(["Ann joined the room"]);
    client.onMessage(pos("aaaaaaaa", "Ann"));
    expect(app.teammates.aaaaaaaa.noPosition).toBeUndefined();
    expect(app.teammates.aaaaaaaa).toMatchObject({ map: "customs", x: 1 });
    // A repeated hello from the same id is not a second arrival.
    client.onMessage(hello("aaaaaaaa", "Ann"));
    expect(app.toasts).toHaveLength(1);
    expect(app.teammates.aaaaaaaa.noPosition).toBeUndefined();
  });

  it("stays quiet when a teammate's socket flaps: no join or leave toast for a reconnect", () => {
    const { client } = makeController();
    client.onMessage(hello("aaaaaaaa", "Bob"));
    client.onMessage(pos("aaaaaaaa", "Bob"));
    expect(app.toasts.map((t) => t.text)).toEqual(["Bob joined the room"]);
    // New socket first, then the lagging leave for the old one.
    client.onMessage(hello("bbbbbbbb", "Bob"));
    client.onMessage(pos("bbbbbbbb", "Bob"));
    client.onMessage(leave("aaaaaaaa"));
    expect(app.toasts).toHaveLength(1);
    expect(Object.keys(app.teammates)).toEqual(["bbbbbbbb"]);
    // Leave first, then the new socket: the marker is kept as a ghost, one leave toast, no join toast.
    client.onMessage(leave("bbbbbbbb"));
    expect(app.toasts.map((t) => t.text)).toEqual(["Bob joined the room", "Bob left the room"]);
    client.onMessage(hello("cccccccc", "Bob"));
    expect(app.toasts).toHaveLength(2);
    expect(Object.keys(app.teammates)).toEqual(["cccccccc"]);
  });

  it("sends the known own position as soon as it joins", () => {
    app.setOwnPosition({ x: 5, y: 6, z: 7, yaw: 12 });
    app.setMap("customs", "manual");
    const { client } = makeController();
    expect(client.connected).toBe(true);
    expect(client.sent).toEqual([{ map: "customs", p: { x: 5, y: 6, z: 7, yaw: 12 } }]);
  });

  it("sends nothing on join when no position is known", () => {
    const { client } = makeController();
    expect(client.sent).toEqual([]);
  });

  it("toasts a connection failure once per outage", () => {
    const { room: controller, client } = makeController();
    client.opts.onError?.("bad url");
    client.opts.onError?.("bad url");
    expect(app.toasts.map((t) => t.text)).toEqual(["Relay connection failed: bad url"]);

    // A reconnect that got through makes the next failure news again.
    client.opts.onStatus("open");
    client.opts.onError?.("bad url");
    expect(app.toasts).toHaveLength(2);

    app.toasts = [];
    controller.join("abc123", "Me", "#fff", "wss://relay.test");
    FakeClient.last!.opts.onError?.("bad url");
    expect(app.toasts).toHaveLength(1);
  });

  it("toasts an outage once and the recovery once", () => {
    const { room: controller, client } = makeController();
    client.opts.onStatus("connecting");
    client.opts.onStatus("closed");
    // The first connect never got through, so there is no outage to report yet.
    expect(app.toasts).toHaveLength(0);

    client.opts.onStatus("open");
    client.opts.onStatus("closed");
    client.opts.onStatus("connecting");
    client.opts.onStatus("closed");
    expect(app.toasts.map((t) => t.text)).toEqual(["Squad connection lost, reconnecting…"]);
    expect(controller.reconnecting).toBe(true);

    client.opts.onStatus("open");
    expect(app.toasts.map((t) => t.text)).toEqual(["Squad connection lost, reconnecting…", "Squad reconnected"]);
    expect(controller.reconnecting).toBe(false);

    // A second open with no outage in between says nothing.
    client.opts.onStatus("open");
    expect(app.toasts).toHaveLength(2);
  });

  it("says nothing when the user leaves the room", () => {
    const { room: controller, client } = makeController();
    client.opts.onStatus("open");
    controller.leave();
    client.opts.onStatus("closed");
    expect(app.toasts).toHaveLength(0);
    expect(controller.reconnecting).toBe(false);
  });
});
