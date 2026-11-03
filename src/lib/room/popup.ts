/** What the screenshot popup shows: a teammate's screenshot, or the stand-in Settings opens to place it. */
export type PopupData = { kind: "shot"; from: string; color: string; url: string } | { kind: "preview" };

const JPEG_URL = "data:image/jpeg;base64,";

/** The popup's data from the JSON the app handed Rust; null for anything else. */
export function readPopupData(json: string): PopupData | null {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null) return null;
  const d = v as Record<string, unknown>;
  if (d.kind === "preview") return { kind: "preview" };
  if (d.kind !== "shot" || typeof d.from !== "string" || typeof d.color !== "string") return null;
  if (typeof d.url !== "string" || !d.url.startsWith(JPEG_URL)) return null;
  return { kind: "shot", from: d.from, color: d.color, url: d.url };
}

/** The popup's size in logical pixels (src-tauri/src/shotwin.rs): a 320 x 180 picture under a 28 px header, 1 px border. */
export const POPUP_W = 320;
export const POPUP_H = 210;
/** The enlarged popup at most this wide. */
const BIG_W = 960;
const BIG_MARGIN = 24;

/** The enlarged popup: as wide as fits in the screen's work area, up to 960, centred on it. */
export function bigRect(work: { x: number; y: number; width: number; height: number }) {
  const width = Math.max(POPUP_W, Math.min(BIG_W, work.width - 2 * BIG_MARGIN, ((work.height - 2 * BIG_MARGIN - 30) * 16) / 9));
  const height = Math.round((width * 9) / 16) + 30;
  return { x: work.x + (work.width - width) / 2, y: work.y + (work.height - height) / 2, width, height };
}
