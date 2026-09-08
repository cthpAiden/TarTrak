export type LogEvent =
  | { kind: "preset"; name: string }
  | { kind: "location"; name: string }
  /** `at`: the line's own timestamp as epoch ms, so a line replayed from an old log dates itself. */
  | { kind: "gameStarted"; at: number };

const PRESET_RE = /scene preset path:maps\/([A-Za-z0-9_]+?)_preset\.bundle/;
const LOCATION_RE = /profileStatus:.*\bLocation: ([A-Za-z0-9_]+),/;
const GAME_STARTED_RE = /\|GameStarted:/;
/** The log's line prefix: local time, `2026-09-04 04:56:12.284|`. */
const STAMP_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})\|/;

/** Epoch ms of the line's timestamp, read as local time like the game wrote it; null without one. */
export function lineTime(line: string): number | null {
  const m = STAMP_RE.exec(line);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, ms] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, s, ms).getTime();
}

export function parseLogLine(line: string): LogEvent | null {
  if (!line) return null;
  const preset = PRESET_RE.exec(line);
  if (preset) return { kind: "preset", name: preset[1] };
  const loc = LOCATION_RE.exec(line);
  if (loc) return { kind: "location", name: loc[1] };
  if (GAME_STARTED_RE.test(line)) {
    const at = lineTime(line);
    return at === null ? null : { kind: "gameStarted", at };
  }
  return null;
}
