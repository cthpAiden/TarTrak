export type LogEvent =
  | { kind: "preset"; name: string }
  | { kind: "location"; name: string }
  | { kind: "gameStarted" }
  /** The game's raid clock (output log): `endsAt` is when the raid ends, as epoch ms on this PC's clock. */
  | { kind: "raidClock"; endsAt: number }
  /** The game moved the raid's end mid-raid by `byMs` (negative: sooner). */
  | { kind: "raidEndMoved"; byMs: number }
  /** Back in the menu or the hideout: no raid clock. */
  | { kind: "raidOver" }
  /** The game's screenshot binding from its control-settings dump: Unity KeyCode names, e.g. ["V"]. */
  | { kind: "screenshotKey"; keys: string[] };

const PRESET_RE = /scene preset path:maps\/([A-Za-z0-9_]+?)_preset\.bundle/;
const LOCATION_RE = /profileStatus:.*\bLocation: ([A-Za-z0-9_]+),/;
const GAME_STARTED_RE = /\|GameStarted:/;
/**
 * The game's raid clock, logged as you spawn: PastTime is how far the raid already ran (minutes for a
 * Scav), sessionTime its length, empty in the hideout. utcNow is the server's clock, which this PC's can
 * trail by most of a minute, so only the two durations are used.
 */
const GAME_TIMER_RE = /\|GameTimer utcNow:.* PastTime:(\d+):(\d+):(\d+(?:\.\d+)?) .*sessionTime:(?:(\d+):(\d+):(\d+))?\)/;
/** A mid-raid change to the end, in UTC; the first setting has an empty from: and is skipped. */
const ESCAPE_MOVED_RE = /\|Escape dateTime update to:(\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+) from:(\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+)/;
/** Leaving the raid's server: death, extract, or the clock running out. */
const RAID_LEFT_RE = /\|Connection\.Disconnect\(\) .*Reason:Stop game/;
/** Inside the settings JSON the game logs at start: `"keyName":"MakeScreenshot","variants":[{"keyCode":["V"]},...`. */
const SCREENSHOT_KEY_RE = /"keyName":"MakeScreenshot","variants":\[\{"keyCode":\[([^\]]*)\]/;
/** The log's line prefix: local time, `2026-09-04 04:56:12.284|`. */
const STAMP_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})\|/;

/** Epoch ms of the line's timestamp, read as local time like the game wrote it; null without one. */
export function lineTime(line: string): number | null {
  const m = STAMP_RE.exec(line);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, ms] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, s, ms).getTime();
}

const hmsMs = (h: string, m: string, s: string) => Math.round(((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000);
/** MM/dd/yyyy HH:mm:ss as UTC epoch ms, from its six captured fields. */
const usUtc = ([mo, d, y, h, mi, s]: string[]) => Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);

export function parseLogLine(line: string): LogEvent | null {
  if (!line) return null;
  const preset = PRESET_RE.exec(line);
  if (preset) return { kind: "preset", name: preset[1] };
  const loc = LOCATION_RE.exec(line);
  if (loc) return { kind: "location", name: loc[1] };
  if (GAME_STARTED_RE.test(line)) return { kind: "gameStarted" };
  const timer = GAME_TIMER_RE.exec(line);
  if (timer) {
    const [, ph, pm, ps, sh, sm, ss] = timer;
    if (sh === undefined) return { kind: "raidOver" };
    const at = lineTime(line);
    return at === null ? null : { kind: "raidClock", endsAt: at + hmsMs(sh, sm, ss) - hmsMs(ph, pm, ps) };
  }
  const moved = ESCAPE_MOVED_RE.exec(line);
  if (moved) return { kind: "raidEndMoved", byMs: usUtc(moved.slice(1, 7)) - usUtc(moved.slice(7, 13)) };
  if (RAID_LEFT_RE.test(line)) return { kind: "raidOver" };
  const shot = SCREENSHOT_KEY_RE.exec(line);
  if (shot) {
    const keys = shot[1].split(",").map((k) => k.trim().replace(/^"|"$/g, "")).filter((k) => k !== "");
    return { kind: "screenshotKey", keys };
  }
  return null;
}
