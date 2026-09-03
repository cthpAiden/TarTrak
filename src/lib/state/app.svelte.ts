import type { Position } from "../parse/screenshot";

export interface Teammate {
  id: string;
  name: string;
  color: string;
  map: string | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  ts: number;
  receivedAt: number;
}

export type MapSource = "log" | "manual";

export class AppState {
  ownPos = $state<Position | null>(null);
  ownUpdatedAt = $state(0);
  currentMap = $state<string | null>(null);
  mapSource = $state<MapSource | null>(null);
  teammates = $state<Record<string, Teammate>>({});
  toasts = $state<{ id: number; text: string }[]>([]);
  private nextToastId = 1;

  setOwnPosition(p: Position, now: number = Date.now()): void {
    this.ownPos = p;
    this.ownUpdatedAt = now;
  }

  setMap(key: string, source: MapSource): void {
    this.currentMap = key;
    this.mapSource = source;
  }

  upsertTeammate(t: Teammate): void {
    this.teammates = { ...this.teammates, [t.id]: t };
  }

  removeTeammate(id: string): void {
    const { [id]: _removed, ...rest } = this.teammates;
    this.teammates = rest;
  }

  clearTeammates(): void {
    this.teammates = {};
  }

  toast(text: string): void {
    const id = this.nextToastId++;
    this.toasts = [...this.toasts, { id, text }];
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, 6000);
  }
}

export const app = new AppState();
