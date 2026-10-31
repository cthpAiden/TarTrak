import { load } from "@tauri-apps/plugin-store";
import { addMate, addOwn, coerceRaid, keepRaid, startRaid, type MateUpdate, type RaidRecord, type TrailPoint } from "./record";

/** Raids kept on this PC; the oldest goes when an 11th is saved. */
export const MAX_RAIDS = 10;
/** Positions arrive every few seconds; the file is written once they have settled for this long. */
const SAVE_DELAY_MS = 10_000;
const FILE = "raids.json";
const KEY = "raids";

export async function loadRaids(): Promise<RaidRecord[]> {
  const store = await load(FILE, { defaults: {}, autoSave: false });
  const v = await store.get<unknown>(KEY);
  if (!Array.isArray(v)) return [];
  const raids = v.map(coerceRaid).filter((r): r is RaidRecord => r !== null);
  return raids.sort((a, b) => b.startedAt - a.startedAt).slice(0, MAX_RAIDS);
}

export async function saveRaids(raids: RaidRecord[]): Promise<void> {
  const store = await load(FILE, { defaults: {}, autoSave: false });
  await store.set(KEY, raids);
  await store.save();
}

/**
 * Records the raid I am in (my screenshots, my teammates' positions) and keeps the last MAX_RAIDS.
 * Teammates are followed after I leave, up to the raid's end, until my next raid starts.
 */
export class RaidLog {
  /** Kept raids, newest first; the one being recorded joins once it has a screenshot of mine. */
  raids = $state.raw<RaidRecord[]>([]);
  private current: RaidRecord | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private save: (raids: RaidRecord[]) => Promise<void> = saveRaids,
    private onSaveError: (e: unknown) => void = () => {},
  ) {}

  /** The raids read from disk at startup. A raid recorded meanwhile stays on top. */
  loaded(list: RaidRecord[]): void {
    const ids = new Set(this.raids.map((r) => r.startedAt));
    this.raids = [...this.raids, ...list.filter((r) => !ids.has(r.startedAt))]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_RAIDS);
  }

  /**
   * I spawned at `at`. The log is replayed from its start when TarTrak opens, so a raid whose end has
   * already passed is an old one and is not recorded. A raid saved before a restart, still unfinished,
   * carries on where it was.
   */
  start(at: number, endsAt: number, map: string | null, now: number): void {
    if (endsAt <= now) {
      this.current = null;
      return;
    }
    const saved = this.raids.find((r) => r.startedAt === at && r.leftAt === null);
    this.current = saved ? { ...saved, endsAt } : startRaid(map, at, endsAt);
  }

  setEndsAt(endsAt: number): void {
    if (this.current && this.current.leftAt === null) this.current = { ...this.current, endsAt };
  }

  own(p: Omit<TrailPoint, "t">, map: string | null, at: number): void {
    const r = this.current && addOwn(this.current, map, p, at);
    if (r) this.update(r);
  }

  mate(m: MateUpdate): void {
    const r = this.current && addMate(this.current, m);
    if (r) this.update(r);
  }

  /** I left the raid at `at`. The finished raid when it is worth keeping (saved at once), else null. */
  over(at: number): RaidRecord | null {
    const c = this.current;
    if (!c || c.leftAt !== null) return null;
    const r = { ...c, leftAt: at };
    this.update(r);
    if (!keepRaid(r)) return null;
    this.flush();
    return r;
  }

  /** Writes any pending change now. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.save(this.raids).catch(this.onSaveError);
  }

  private update(r: RaidRecord): void {
    this.current = r;
    if (!keepRaid(r)) return;
    this.raids = [r, ...this.raids.filter((x) => x.startedAt !== r.startedAt)]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_RAIDS);
    if (!this.timer) this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }
}
