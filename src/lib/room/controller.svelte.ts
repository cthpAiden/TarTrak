import type { Position } from "../parse/screenshot";
import { app, type Drawing, type Pin, type Teammate } from "../state/app.svelte";
import { RoomClient, type ActionMsg, type RoomClientOptions, type RoomStatus } from "./client";
import type { ServerMsg } from "./protocol";

/** The part of RoomClient the controller drives; injectable so the message handling is testable. */
export interface RoomClientLike {
  connect(): void;
  close(): void;
  sendPosition(map: string | null, p: Position): void;
  send(msg: ActionMsg): boolean;
}

export class RoomController {
  code = $state<string | null>(null);
  status = $state<RoomStatus>("closed");
  private client: RoomClientLike | null = null;
  private errorToasted = false;
  private wasOpen = false;
  private outageToasted = false;

  constructor(
    private readonly makeClient: (opts: RoomClientOptions) => RoomClientLike = (opts) => new RoomClient(opts),
  ) {}

  /** True while we are in a room but the socket is not up: the map shows a pill for it. */
  get reconnecting(): boolean {
    return this.code !== null && this.status !== "open";
  }

  join(code: string, name: string, color: string, relayUrl: string): void {
    this.leave();
    this.code = code.toUpperCase();
    this.errorToasted = false;
    this.wasOpen = false;
    this.outageToasted = false;
    this.client = this.makeClient({
      relayUrl,
      code: this.code,
      name,
      color,
      onMessage: (m) => this.handle(m),
      onStatus: (s) => {
        this.status = s;
        if (s === "open") {
          this.errorToasted = false;
          if (!this.wasOpen && this.outageToasted) app.toast("Squad reconnected");
          this.wasOpen = true;
          this.outageToasted = false;
        } else if (s === "closed" && this.wasOpen && !this.outageToasted && this.code !== null) {
          // Only once per outage: the client retries forever behind this.
          this.outageToasted = true;
          this.wasOpen = false;
          app.toast("Squad connection lost, reconnecting…");
        }
      },
      // The client retries forever, so one toast per outage instead of one every backoff round.
      onError: (e) => {
        if (this.errorToasted) return;
        this.errorToasted = true;
        app.toast(`Relay connection failed: ${e}`);
      },
    });
    this.client.connect();
    // Without this the room only learns where we are on our next screenshot.
    if (app.ownPos) this.client.sendPosition(app.currentMap, app.ownPos);
  }

  leave(): void {
    // Reset first: close() reports "closed" synchronously, which must not read as an outage.
    this.wasOpen = false;
    this.outageToasted = false;
    this.client?.close();
    this.client = null;
    this.code = null;
    this.status = "closed";
    app.clearTeammates();
    app.clearSharedPins();
    app.clearSharedDrawings();
  }

  /** False when not connected: the caller keeps the pin private and tells the user. */
  sharePin(p: Pin): boolean {
    return this.client?.send({ type: "pin", pin: p.id, map: p.map, x: p.x, z: p.z, label: p.label, color: p.color }) ?? false;
  }

  unsharePin(id: string): void {
    this.client?.send({ type: "unpin", pin: id });
  }

  /** False when not connected: the stroke stays private. */
  shareDrawing(d: Drawing): boolean {
    return this.client?.send({ type: "draw", draw: d.id, map: d.map, color: d.color, points: d.points }) ?? false;
  }

  unshareDrawing(id: string): void {
    this.client?.send({ type: "undraw", draw: id });
  }

  /** Wipes the shared strokes on one map for the whole room. */
  clearSharedDrawings(map: string): void {
    this.client?.send({ type: "cleardraw", map });
  }

  onOwnPosition(map: string | null, p: Position): void {
    this.client?.sendPosition(map, p);
  }

  /** The relay hands out a fresh id per socket, so a reconnect would otherwise leave a frozen twin. */
  private dropGhost(id: string, name: string): void {
    for (const [oldId, t] of Object.entries(app.teammates)) {
      if (oldId !== id && t.left && t.name === name) app.removeTeammate(oldId);
    }
  }

  /** True when the same person is already here under a fresher id: the relay's leave lagged. */
  private isReplaced(id: string, t: Teammate): boolean {
    // `>=` and not `>`: the new id's first pos and the old id's last one often land in the same ms.
    return Object.entries(app.teammates).some(
      ([otherId, o]) => otherId !== id && o.name === t.name && o.receivedAt >= t.receivedAt,
    );
  }

  private handle(m: ServerMsg): void {
    if (m.type === "leave") {
      // Keep the last known marker; the spec says markers never disappear on their own.
      const t = app.teammates[m.id];
      if (t) {
        // Replaced means they are already back under a new id: a reconnect, not a departure.
        if (this.isReplaced(m.id, t)) app.removeTeammate(m.id);
        else {
          app.upsertTeammate({ ...t, left: true });
          app.toast(`${t.name} left the room`);
        }
      }
      return;
    }
    if (m.type === "pin") {
      app.addPin({ id: m.pin, map: m.map, x: m.x, z: m.z, label: m.label, color: m.color, shared: true, from: m.id });
      return;
    }
    if (m.type === "unpin") {
      app.removePin(m.pin);
      return;
    }
    if (m.type === "draw") {
      app.addDrawing({ id: m.draw, map: m.map, color: m.color, points: m.points, shared: true, mine: false, from: m.id });
      return;
    }
    if (m.type === "undraw") {
      app.removeDrawing(m.draw);
      return;
    }
    if (m.type === "cleardraw") {
      app.clearDrawings(m.map);
      return;
    }
    // Judged before the ghost is dropped: a same-name marker of any kind means this is a reconnect.
    const rejoin = Object.values(app.teammates).some((t) => t.id !== m.id && t.name === m.name);
    this.dropGhost(m.id, m.name);
    if (m.type === "hello") {
      if (app.teammates[m.id]) return;
      if (!rejoin) app.toast(`${m.name} joined the room`);
      // Listed at once, so a joiner who has not taken a screenshot yet still shows up as present.
      app.upsertTeammate({
        id: m.id,
        name: m.name,
        color: m.color,
        map: null,
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        ts: 0,
        receivedAt: Date.now(),
        noPosition: true,
      });
      return;
    }
    app.upsertTeammate({
      id: m.id,
      name: m.name,
      color: m.color,
      map: m.map,
      x: m.x,
      y: m.y,
      z: m.z,
      yaw: m.yaw,
      ts: m.ts,
      receivedAt: Date.now(),
    });
  }
}

export const room = new RoomController();
