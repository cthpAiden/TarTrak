export type LogEvent =
  | { kind: "preset"; name: string }
  | { kind: "location"; name: string }
  | { kind: "gameStarted" };

const PRESET_RE = /scene preset path:maps\/([A-Za-z0-9_]+?)_preset\.bundle/;
const LOCATION_RE = /profileStatus:.*\bLocation: ([A-Za-z0-9_]+),/;
const GAME_STARTED_RE = /\|GameStarted:/;

export function parseLogLine(line: string): LogEvent | null {
  if (!line) return null;
  const preset = PRESET_RE.exec(line);
  if (preset) return { kind: "preset", name: preset[1] };
  const loc = LOCATION_RE.exec(line);
  if (loc) return { kind: "location", name: loc[1] };
  if (GAME_STARTED_RE.test(line)) return { kind: "gameStarted" };
  return null;
}
