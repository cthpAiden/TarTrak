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

export type ClientMsg = HelloMsg | PosMsg;

/** `id` is relay-assigned, 1..32 chars. */
export type ServerMsg = (HelloMsg & { id: string }) | (PosMsg & { id: string }) | { type: "leave"; id: string };

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

export function parseClientMessage(raw: string): ClientMsg | null {
  const o = parseJson(raw);
  if (!o) return null;
  if (o.type === "hello") return readHello(o);
  if (o.type === "pos") return readPos(o);
  return null;
}

export function parseServerMessage(raw: string): ServerMsg | null {
  const o = parseJson(raw);
  if (!o) return null;
  const id = str(o.id);
  if (id === null || id.length === 0) return null;
  if (o.type === "leave") return { type: "leave", id };
  const body = o.type === "hello" ? readHello(o) : o.type === "pos" ? readPos(o) : null;
  return body ? { ...body, id } : null;
}
