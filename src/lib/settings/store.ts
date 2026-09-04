import { load } from "@tauri-apps/plugin-store";

export interface Settings {
  screenshotsDir: string | null;
  logsDir: string | null;
  deleteScreenshots: boolean;
  relayUrl: string;
  name: string;
  color: string;
  playerLevel: number;
  hotkeyOverlay: string;
  hotkeyOpacity: string;
  lastMap: string | null;
  lastRoom: string;
  lineLengthPx: number;
}

/** Placeholder until the relay is deployed; see README "Relay". */
export const DEFAULT_RELAY_URL = "wss://tartrak-relay.example.workers.dev";

export const DEFAULT_SETTINGS: Settings = {
  screenshotsDir: null,
  logsDir: null,
  deleteScreenshots: true,
  relayUrl: DEFAULT_RELAY_URL,
  name: "PMC",
  color: "#3aa0ff",
  playerLevel: 0,
  hotkeyOverlay: "F5",
  hotkeyOpacity: "F6",
  lastMap: null,
  lastRoom: "",
  lineLengthPx: 28,
};

type Kind = "string" | "number" | "boolean" | "string?";
const SHAPE: Record<keyof Settings, Kind> = {
  screenshotsDir: "string?",
  logsDir: "string?",
  deleteScreenshots: "boolean",
  relayUrl: "string",
  name: "string",
  color: "string",
  playerLevel: "number",
  hotkeyOverlay: "string",
  hotkeyOpacity: "string",
  lastMap: "string?",
  lastRoom: "string",
  lineLengthPx: "number",
};

function accepts(kind: Kind, v: unknown): boolean {
  if (kind === "string?") return v === null || typeof v === "string";
  if (kind === "number") return typeof v === "number" && Number.isFinite(v);
  return typeof v === kind;
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
