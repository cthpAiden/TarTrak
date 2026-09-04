import type { Position } from "../parse/screenshot";
import { app } from "../state/app.svelte";
import { RoomClient, type RoomStatus } from "./client";
import type { ServerMsg } from "./protocol";

export class RoomController {
  code = $state<string | null>(null);
  status = $state<RoomStatus>("closed");
  private client: RoomClient | null = null;

  join(code: string, name: string, color: string, relayUrl: string): void {
    this.leave();
    this.code = code.toUpperCase();
    this.client = new RoomClient({
      relayUrl,
      code: this.code,
      name,
      color,
      onMessage: (m) => this.handle(m),
      onStatus: (s) => (this.status = s),
    });
    this.client.connect();
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

  private handle(m: ServerMsg): void {
    if (m.type === "leave") {
      // Keep the last known marker; the spec says markers never disappear on their own.
      const t = app.teammates[m.id];
      if (t) app.toast(`${t.name} left the room`);
      return;
    }
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
