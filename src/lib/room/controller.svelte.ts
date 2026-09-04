import type { Position } from "../parse/screenshot";
import { app, type Teammate } from "../state/app.svelte";
import { RoomClient, type RoomClientOptions, type RoomStatus } from "./client";
import type { ServerMsg } from "./protocol";

/** The part of RoomClient the controller drives; injectable so the message handling is testable. */
export interface RoomClientLike {
  connect(): void;
  close(): void;
  sendPosition(map: string | null, p: Position): void;
}

export class RoomController {
  code = $state<string | null>(null);
  status = $state<RoomStatus>("closed");
  private client: RoomClientLike | null = null;

  constructor(
    private readonly makeClient: (opts: RoomClientOptions) => RoomClientLike = (opts) => new RoomClient(opts),
  ) {}

  join(code: string, name: string, color: string, relayUrl: string): void {
    this.leave();
    this.code = code.toUpperCase();
    this.client = this.makeClient({
      relayUrl,
      code: this.code,
      name,
      color,
      onMessage: (m) => this.handle(m),
      onStatus: (s) => (this.status = s),
      onError: (e) => app.toast(`Relay connection failed: ${e}`),
    });
    this.client.connect();
    // Without this the room only learns where we are on our next screenshot.
    if (app.ownPos) this.client.sendPosition(app.currentMap, app.ownPos);
  }

  leave(): void {
    this.client?.close();
    this.client = null;
    this.code = null;
    this.status = "closed";
    app.clearTeammates();
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
        if (this.isReplaced(m.id, t)) app.removeTeammate(m.id);
        else app.upsertTeammate({ ...t, left: true });
        app.toast(`${t.name} left the room`);
      }
      return;
    }
    this.dropGhost(m.id, m.name);
    if (m.type === "hello") {
      if (!app.teammates[m.id]) app.toast(`${m.name} joined the room`);
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
