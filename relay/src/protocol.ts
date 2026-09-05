// Shared between the app (src/lib/room) and the relay (relay/src). Keep this file import-free
// and copy it verbatim to relay/src/protocol.ts whenever it changes.

export const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;
export const MAX_MESSAGE_BYTES = 512;
export const MAX_STRING = 32;

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export interface HelloMsg {
  type: "hello";
  name: string;
  color: string;
}

export interface PosMsg {
  type: "pos";
  name: string;
  color: string;
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

export type ClientMsg = HelloMsg | PosMsg | PinMsg | UnpinMsg;

/** `id` is relay-assigned, 1..32 chars: the socket that sent the message. */
export type ServerMsg =
  | (HelloMsg & { id: string })
  | (PosMsg & { id: string })
  | (PinMsg & { id: string })
  | (UnpinMsg & { id: string })
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
  if (byteLength(raw) >= MAX_MESSAGE_BYTES) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return isRecord(v) ? v : null;
  } catch {
    return null;
  }
}

function readHello(o: Record<string, unknown>): HelloMsg | null {
  const name = str(o.name);
  const color = str(o.color);
  if (name === null || color === null) return null;
  return { type: "hello", name, color };
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
  if (name === null || color === null) return null;
  if (x === null || y === null || z === null || yaw === null || ts === null) return null;
  return { type: "pos", name, color, map, x, y, z, yaw, ts };
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

function readBody(o: Record<string, unknown>): ClientMsg | null {
  if (o.type === "hello") return readHello(o);
  if (o.type === "pos") return readPos(o);
  if (o.type === "pin") return readPin(o);
  if (o.type === "unpin") return readUnpin(o);
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
