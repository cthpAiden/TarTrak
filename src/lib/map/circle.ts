/**
 * Geometry of the round minimap overlay: the map disc, the compass bezel around it, and the buttons and
 * chips that sit just outside the bezel. The disc is anchored to the window's top-right corner; the
 * window is sized so the buttons (lower left) and the chips (lower right) fit around it.
 */

/** Width of the compass bezel ring around the map disc. */
export const RING = 26;
/** Gap between the bezel and the window's top and right edges. */
export const EDGE = 14;
/** Rim buttons: centre distance beyond the bezel, diameter, and their angles (clockwise from 12 o'clock). */
export const RIM_BUTTON_GAP = 18;
export const RIM_BUTTON_SIZE = 30;
export const RIM_BUTTON_ANGLES = [190, 212, 234, 256, 278] as const;
/** Chips (raid timer, teammate distances) step up the lower-right arc from this angle, this far apart. */
export const CHIP_GAP = 16;
const CHIP_START = 170;
const CHIP_STEP_PX = 66;
/** Half the widest chip ("149 m" in 12px mono plus its padding), to keep chips off the window's right edge. */
export const CHIP_HALF_W = 36;
/** The floor chip hangs this far below the bezel, centred under the disc. */
export const FLOOR_GAP = 36;
const FLOOR_H = 24;
/** Room left of the leftmost rim button and under the floor chip. */
const PAD = 8;
const LEFT = RIM_BUTTON_GAP + RIM_BUTTON_SIZE / 2 + PAD + 3;
const BOTTOM = FLOOR_GAP + FLOOR_H + PAD;
/** Smallest disc radius the layout shrinks to in a window too small for the chosen size. */
const MIN_R = 60;

export interface CircleLayout {
  /** Map disc radius. */
  r: number;
  /** Outer bezel radius. */
  ro: number;
  /** Disc centre, in window pixels. */
  cx: number;
  cy: number;
}

/** Window size (CSS px) that fits a disc of the given diameter with its bezel, buttons and chips. */
export function circleWindowSize(size: number): { width: number; height: number } {
  const ro = size / 2 + RING;
  return { width: Math.ceil(LEFT + 2 * ro + EDGE), height: Math.ceil(EDGE + 2 * ro + BOTTOM) };
}

/** The disc for a window of this size: the chosen diameter, shrunk only when the window cannot hold it. */
export function circleLayout(winW: number, winH: number, size: number): CircleLayout {
  const roFit = Math.min((winW - LEFT - EDGE) / 2, (winH - EDGE - BOTTOM) / 2);
  const r = Math.max(MIN_R, Math.min(size / 2, roFit - RING));
  const ro = r + RING;
  return { r, ro, cx: winW - EDGE - ro, cy: EDGE + ro };
}

/** A point at `radius` from the centre, `deg` clockwise from 12 o'clock (screen y grows down). */
export function polar(cx: number, cy: number, radius: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: cx + radius * Math.sin(a), y: cy - radius * Math.cos(a) };
}

/**
 * Angles of the chip slots for a bezel of outer radius `ro`: a fixed spacing along the arc, as many as
 * fit before a chip would cross the window's right edge. A bigger disc has room for more.
 */
export function chipAngles(ro: number): number[] {
  const radius = ro + CHIP_GAP;
  const step = (CHIP_STEP_PX / radius) * (180 / Math.PI);
  const out: number[] = [];
  for (let a = CHIP_START; a > 90; a -= step) {
    if (polar(0, 0, radius, a).x + CHIP_HALF_W > ro + EDGE - 2) break;
    out.push(a);
  }
  return out;
}

/**
 * Where on the ring a bearing sits. On a fixed map: where it points on the drawn map, which is the bearing turned
 * by `offset` (where bearing 0 points on screen; tarkov.dev draws some maps turned). On a map that turns with me:
 * relative to my heading.
 */
export function ringAngle(bearing: number, heading: number | null, northUp: boolean, offset = 0): number {
  return northUp || heading === null ? bearing + offset : bearing - heading;
}

/** Smallest absolute difference between two angles, in degrees (0..180). */
export function angleGap(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * A screen offset from the disc centre, turned back into the unrotated map's frame. The map element is
 * drawn rotated by -`rotation` degrees, so a point the mouse is over sits `rotation` degrees further round.
 */
export function unrotate(dx: number, dy: number, rotation: number): { x: number; y: number } {
  const a = (rotation * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

export interface Chip {
  id: string;
  kind: "timer" | "mate" | "more";
  text: string;
  color?: string;
  title?: string;
}

/**
 * The chips along the rim, closest teammates first. Chips beyond the `slots` that fit fold into one
 * "+N" chip in the last slot, which names them in its tooltip.
 */
export function rimChips(
  timer: string | null,
  mates: { id: string; name: string; color: string; distanceM: number | null }[],
  slots: number,
): Chip[] {
  const chips: Chip[] = [];
  if (timer) chips.push({ id: "timer", kind: "timer", text: timer, title: "Time left in raid" });
  const sorted = [...mates].sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  for (const m of sorted) {
    chips.push({ id: `mate:${m.id}`, kind: "mate", text: `${m.distanceM ?? "?"} m`, color: m.color, title: m.name });
  }
  if (chips.length <= slots) return chips;
  const keep = chips.slice(0, Math.max(0, slots - 1));
  const rest = chips.slice(keep.length);
  keep.push({
    id: "more",
    kind: "more",
    text: `+${rest.length}`,
    title: rest.map((c) => `${c.title} ${c.text}`).join(" · "),
  });
  return keep;
}
