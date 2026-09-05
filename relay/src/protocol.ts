// Shared between the app (src/lib/room) and the relay (relay/src). Keep this file import-free
// and copy it verbatim to relay/src/protocol.ts whenever it changes.

export const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;
export const MAX_MESSAGE_BYTES = 512;
/** Only a drawing may be this long: a stroke carries many points, every other message is tiny. */
export const MAX_DRAW_MESSAGE_BYTES = 8192;
export const MAX_DRAW_POINTS = 300;
export const MAX_STRING = 32;

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export interface HelloMsg {
  type: "hello";
  name: string;
  color: string;
  /** App version of the sender; absent from clients older than 0.3.1. */
  version?: string;
}

export interface PosMsg {
  type: "pos";
  name: string;
  color: string;
  version?: string;
  map: string | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  ts: number;
}

/** A marker placed by hand and shared with the room. `pin` is the client-chosen marker id. */
export interface PinMsg {
  type: "pin";
  pin: string;
  map: string;
  x: number;
  z: number;
  label: string;
  color: string;
}

export interface UnpinMsg {
  type: "unpin";
  pin: string;
}

/** A freehand stroke shared with the room, as game-coordinate [x, z] pairs. `draw` is the client-chosen id. */
export interface DrawMsg {
  type: "draw";
  draw: string;
  map: string;
  color: string;
  points: [number, number][];
}

export interface UndrawMsg {
  type: "undraw";
  draw: string;
}

/** Wipes every shared stroke on one map, for everyone in the room. */
export interface ClearDrawMsg {
  type: "cleardraw";
  map: string;
}

export type ClientMsg = HelloMsg | PosMsg | PinMsg | UnpinMsg | DrawMsg | UndrawMsg | ClearDrawMsg;

/** `id` is relay-assigned, 1..32 chars: the socket that sent the message. */
export type ServerMsg =
  | (HelloMsg & { id: string })
  | (PosMsg & { id: string })
  | (PinMsg & { id: string })
  | (UnpinMsg & { id: string })
  | (DrawMsg & { id: string })
  | (UndrawMsg & { id: string })
  | (ClearDrawMsg & { id: string })
  | { type: "leave"; id: string };

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_RE.test(code);
}

export function generateRoomCode(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    const idx = Math.min(CODE_ALPHABET.length - 1, Math.floor(rand() * CODE_ALPHABET.length));
    out += CODE_ALPHABET[idx];
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length <= MAX_STRING ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function parseJson(raw: string): Record<string, unknown> | null {
  const bytes = byteLength(raw);
  if (bytes >= MAX_DRAW_MESSAGE_BYTES) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(v)) return null;
  // Only strokes may be long; everything else keeps the small cap.
  if (v.type !== "draw" && bytes >= MAX_MESSAGE_BYTES) return null;
  return v;
}

/** Optional short string: absent stays absent, present must be a string within bounds. */
function optStr(v: unknown): string | undefined | null {
  if (v === undefined) return undefined;
  return str(v);
}

function readHello(o: Record<string, unknown>): HelloMsg | null {
  const name = str(o.name);
  const color = str(o.color);
  const version = optStr(o.version);
  if (name === null || color === null || version === null) return null;
  return version === undefined ? { type: "hello", name, color } : { type: "hello", name, color, version };
}

function readPos(o: Record<string, unknown>): PosMsg | null {
  const name = str(o.name);
  const color = str(o.color);
  const map = o.map === null ? null : str(o.map);
  if (map === null && o.map !== null) return null;
  const x = num(o.x);
  const y = num(o.y);
  const z = num(o.z);
  const yaw = num(o.yaw);
  const ts = num(o.ts);
  const version = optStr(o.version);
  if (name === null || color === null || version === null) return null;
  if (x === null || y === null || z === null || yaw === null || ts === null) return null;
  const out: PosMsg = { type: "pos", name, color, map, x, y, z, yaw, ts };
  if (version !== undefined) out.version = version;
  return out;
}

function readPin(o: Record<string, unknown>): PinMsg | null {
  const pin = str(o.pin);
  const map = str(o.map);
  const label = str(o.label);
  const color = str(o.color);
  const x = num(o.x);
  const z = num(o.z);
  if (pin === null || pin.length === 0 || map === null || map.length === 0) return null;
  if (label === null || color === null || x === null || z === null) return null;
  return { type: "pin", pin, map, x, z, label, color };
}

function readUnpin(o: Record<string, unknown>): UnpinMsg | null {
  const pin = str(o.pin);
  if (pin === null || pin.length === 0) return null;
  return { type: "unpin", pin };
}

/** At least two finite [x, z] pairs and no more than MAX_DRAW_POINTS. */
function readPoints(v: unknown): [number, number][] | null {
  if (!Array.isArray(v) || v.length < 2 || v.length > MAX_DRAW_POINTS) return null;
  const out: [number, number][] = [];
  for (const p of v) {
    if (!Array.isArray(p) || p.length !== 2) return null;
    const x = num(p[0]);
    const z = num(p[1]);
    if (x === null || z === null) return null;
    out.push([x, z]);
  }
  return out;
}

function readDraw(o: Record<string, unknown>): DrawMsg | null {
  const draw = str(o.draw);
  const map = str(o.map);
  const color = str(o.color);
  const points = readPoints(o.points);
  if (draw === null || draw.length === 0 || map === null || map.length === 0) return null;
  if (color === null || points === null) return null;
  return { type: "draw", draw, map, color, points };
}

function readUndraw(o: Record<string, unknown>): UndrawMsg | null {
  const draw = str(o.draw);
  if (draw === null || draw.length === 0) return null;
  return { type: "undraw", draw };
}

function readClearDraw(o: Record<string, unknown>): ClearDrawMsg | null {
  const map = str(o.map);
  if (map === null || map.length === 0) return null;
  return { type: "cleardraw", map };
}

function readBody(o: Record<string, unknown>): ClientMsg | null {
  if (o.type === "hello") return readHello(o);
  if (o.type === "pos") return readPos(o);
  if (o.type === "pin") return readPin(o);
  if (o.type === "unpin") return readUnpin(o);
  if (o.type === "draw") return readDraw(o);
  if (o.type === "undraw") return readUndraw(o);
  if (o.type === "cleardraw") return readClearDraw(o);
  return null;
}

export function parseClientMessage(raw: string): ClientMsg | null {
  const o = parseJson(raw);
  return o ? readBody(o) : null;
}

export function parseServerMessage(raw: string): ServerMsg | null {
  const o = parseJson(raw);
  if (!o) return null;
  const id = str(o.id);
  if (id === null || id.length === 0) return null;
  if (o.type === "leave") return { type: "leave", id };
  const body = readBody(o);
  return body ? { ...body, id } : null;
}
