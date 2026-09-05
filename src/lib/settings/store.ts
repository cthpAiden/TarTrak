import { load } from "@tauri-apps/plugin-store";
import { FILTER_KEY_RE } from "../layers/filters";
import { GAME_MODES, type GameMode } from "../quests/jsonSource";

export interface Settings {
  screenshotsDir: string | null;
  logsDir: string | null;
  deleteScreenshots: boolean;
  relayUrl: string;
  name: string;
  color: string;
  playerLevel: number;
  /** Which tarkov.dev data set to load: PvP ("regular") or PvE. */
  gameMode: GameMode;
  hotkeyOverlay: string;
  hotkeyOpacity: string;
  lastMap: string | null;
  lastRoom: string;
  lineLengthPx: number;
  showViewCone: boolean;
  /** Pan the map to my marker on every screenshot. */
  followMe: boolean;
  /** Hide quests, in the list and on the map, whose prerequisite quests are not done yet. */
  questsAvailableOnly: boolean;
  layerFilters: Record<string, boolean>;
  hiddenQuests: Record<string, true>;
}

/** Default relay: the project-hosted Cloudflare Worker (relay/). Overridable in Settings. */
export const DEFAULT_RELAY_URL = "wss://tartrak-relay.aidenmileshp.workers.dev";
/** Placeholder written by builds before the relay was deployed; a store holding it can never connect. */
const STALE_RELAY_URL = "wss://tartrak-relay.example.workers.dev";

export const DEFAULT_SETTINGS: Settings = {
  screenshotsDir: null,
  logsDir: null,
  deleteScreenshots: true,
  relayUrl: DEFAULT_RELAY_URL,
  name: "PMC",
  color: "#3aa0ff",
  playerLevel: 0,
  gameMode: "regular",
  hotkeyOverlay: "F5",
  hotkeyOpacity: "F6",
  lastMap: null,
  lastRoom: "",
  lineLengthPx: 28,
  showViewCone: true,
  followMe: true,
  questsAvailableOnly: false,
  layerFilters: {},
  hiddenQuests: {},
};

type Kind = "string" | "number" | "boolean" | "string?" | "record";
const SHAPE: Record<keyof Settings, Kind> = {
  screenshotsDir: "string?",
  logsDir: "string?",
  deleteScreenshots: "boolean",
  relayUrl: "string",
  name: "string",
  color: "string",
  playerLevel: "number",
  gameMode: "string",
  hotkeyOverlay: "string",
  hotkeyOpacity: "string",
  lastMap: "string?",
  lastRoom: "string",
  lineLengthPx: "number",
  showViewCone: "boolean",
  followMe: "boolean",
  questsAvailableOnly: "boolean",
  layerFilters: "record",
  hiddenQuests: "record",
};

function accepts(kind: Kind, v: unknown): boolean {
  if (kind === "string?") return v === null || typeof v === "string";
  if (kind === "number") return typeof v === "number" && Number.isFinite(v);
  if (kind === "record") return typeof v === "object" && v !== null && !Array.isArray(v);
  return typeof v === kind;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const ROOM_CODE_RE = /^[A-Z0-9]{6}$|^$/;

const MAX_FILTERS = 500;
const MAX_HIDDEN_QUESTS = 2000;

/** Any bad key or value resets the whole record: a partial filter set is more confusing than none. */
function cleanRecord<T>(
  v: Record<string, unknown>,
  max: number,
  ok: (key: string, value: unknown) => boolean,
): Record<string, T> {
  const out: Record<string, T> = {};
  let n = 0;
  for (const [k, val] of Object.entries(v)) {
    if (!ok(k, val)) return {};
    if (n < max) {
      out[k] = val as T;
      n++;
    }
  }
  return out;
}

export function mergeSettings(partial: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (typeof partial !== "object" || partial === null || Array.isArray(partial)) return out;
  const src = partial as Record<string, unknown>;
  for (const key of Object.keys(SHAPE) as (keyof Settings)[]) {
    if (key in src && accepts(SHAPE[key], src[key])) {
      (out as unknown as Record<string, unknown>)[key] = src[key];
    }
  }
  // Bounds the UI enforces but a hand-edited store does not. An over-long name would make the
  // relay drop every message and leave the user invisible with a healthy-looking green dot.
  if (out.relayUrl.trim() === "" || out.relayUrl === STALE_RELAY_URL) out.relayUrl = DEFAULT_RELAY_URL;
  out.name = out.name.slice(0, 32);
  out.color = out.color.slice(0, 32);
  out.lineLengthPx = clamp(out.lineLengthPx, 8, 120);
  out.playerLevel = clamp(out.playerLevel, 0, 79);
  if (!GAME_MODES.includes(out.gameMode)) out.gameMode = DEFAULT_SETTINGS.gameMode;
  if (!ROOM_CODE_RE.test(out.lastRoom)) out.lastRoom = "";
  out.layerFilters = cleanRecord<boolean>(
    out.layerFilters,
    MAX_FILTERS,
    (k, v) => typeof v === "boolean" && FILTER_KEY_RE.test(k),
  );
  out.hiddenQuests = cleanRecord<true>(out.hiddenQuests, MAX_HIDDEN_QUESTS, (_k, v) => v === true);
  return out;
}

const FILE = "settings.json";
const KEY = "settings";

/** Never rejects: an unreadable or corrupt store falls back to the defaults. */
export async function loadSettings(): Promise<Settings> {
  try {
    const store = await load(FILE, { defaults: {}, autoSave: false });
    return mergeSettings(await store.get(KEY));
  } catch {
    return mergeSettings(undefined);
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  const store = await load(FILE, { defaults: {}, autoSave: false });
  await store.set(KEY, s);
  await store.save();
}
