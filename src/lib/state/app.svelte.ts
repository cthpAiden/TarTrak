import type { Position } from "../parse/screenshot";
import type { QuestSource } from "../quests/cache";
import type { QuestData } from "../quests/types";

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
  /** Set when the relay announced their leave; the marker stays, but a reconnect may replace it. */
  left?: boolean;
  /** Set for a teammate who has said hello but not yet reported a position; never drawn. */
  noPosition?: true;
}

/** A marker placed by hand with a right-click. Game coordinates, like a Position. */
export interface Pin {
  id: string;
  map: string;
  x: number;
  z: number;
  label: string;
  color: string;
  /** Sent to the room, so every teammate sees it; a private pin lives only in this app. */
  shared: boolean;
  /** Relay id of the teammate who placed a shared pin; unset for my own. */
  from?: string;
}

export type MapSource = "log" | "manual";

export class AppState {
  ownPos = $state<Position | null>(null);
  ownUpdatedAt = $state(0);
  currentMap = $state<string | null>(null);
  mapSource = $state<MapSource | null>(null);
  teammates = $state<Record<string, Teammate>>({});
  pins = $state<Record<string, Pin>>({});
  toasts = $state<{ id: number; text: string }[]>([]);
  // raw: both hold large, wholly-replaced values, so deep proxying would cost far more than it buys.
  questData = $state.raw<QuestData | null>(null);
  questSource = $state<QuestSource>("none");
  doneQuests = $state.raw<Record<string, true>>({});
  /** False until the stored done set has been read; saving before that would overwrite it. */
  doneLoaded = $state(false);
  private nextToastId = 1;

  setQuestData(d: QuestData, s: QuestSource): void {
    this.questData = d;
    this.questSource = s;
  }

  setDone(done: Record<string, true>): void {
    this.doneQuests = done;
  }

  setOwnPosition(p: Position, now: number = Date.now()): void {
    this.ownPos = p;
    this.ownUpdatedAt = now;
  }

  setMap(key: string, source: MapSource): void {
    this.currentMap = key;
    this.mapSource = source;
  }

  clearOwnPosition(): void {
    this.ownPos = null;
    this.ownUpdatedAt = 0;
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

  addPin(p: Pin): void {
    this.pins = { ...this.pins, [p.id]: p };
  }

  removePin(id: string): void {
    const { [id]: _removed, ...rest } = this.pins;
    this.pins = rest;
  }

  /** Leaving a room drops its shared pins, mine included; private pins stay. */
  clearSharedPins(): void {
    this.pins = Object.fromEntries(Object.entries(this.pins).filter(([, p]) => !p.shared));
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
