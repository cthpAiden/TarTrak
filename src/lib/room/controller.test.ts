import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoomController, type RoomClientLike } from "./controller.svelte";
import { app } from "../state/app.svelte";
import type { Position } from "../parse/screenshot";
import type { ServerMsg } from "./protocol";

type Handler = (m: ServerMsg) => void;

class FakeClient implements RoomClientLike {
  static last: FakeClient | null = null;
  connected = false;
  closed = false;
  sent: { map: string | null; p: Position }[] = [];
  constructor(readonly onMessage: Handler) {
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
}

function makeController() {
  const c = new RoomController((opts) => new FakeClient(opts.onMessage));
  c.join("abc123", "Me", "#fff", "wss://relay.test");
  return { room: c, client: FakeClient.last! };
}

const pos = (id: string, name: string): ServerMsg => ({
  type: "pos",
  id,
  name,
  color: "#f00",
  map: "customs",
  x: 1,
  y: 2,
  z: 3,
  yaw: 90,
  ts: 1,
});
const leave = (id: string): ServerMsg => ({ type: "leave", id });
const hello = (id: string, name: string): ServerMsg => ({ type: "hello", id, name, color: "#f00" });

describe("RoomController", () => {
  beforeEach(() => {
    app.clearTeammates();
    app.ownPos = null;
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
    expect(Object.keys(app.teammates)).toEqual([]);
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
});
