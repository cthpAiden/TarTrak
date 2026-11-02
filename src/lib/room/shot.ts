import { MAX_SHOT_MESSAGE_BYTES } from "./protocol";

/** Under the relay's cap with room to spare for the JSON around it and the relay's id. */
export const SHOT_MAX_CHARS = MAX_SHOT_MESSAGE_BYTES - 4096;
/** The relay lets two through at once, then one per 10 s; the app keeps to the steady rate. */
export const SHOT_GAP_MS = 10_000;
/** Tried in order until the JPEG fits: a 1440p shot fits at the first, a busy 4K one may need the last. */
const ATTEMPTS: [maxWidth: number, quality: number][] = [
  [1280, 0.8],
  [1280, 0.6],
  [960, 0.6],
  [640, 0.5],
];

/** `w` x `h` scaled down to at most `maxWidth` wide, never up. */
export function fitWidth(w: number, h: number, maxWidth: number): { w: number; h: number } {
  if (w <= maxWidth) return { w, h };
  return { w: maxWidth, h: Math.max(1, Math.round((h * maxWidth) / w)) };
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  // Chunked: spreading a whole screenshot into one call overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The game's PNG as a base64 JPEG small enough for the relay; rejects when nothing fits. */
export async function shrinkShot(png: ArrayBuffer): Promise<string> {
  const bmp = await createImageBitmap(new Blob([png], { type: "image/png" }));
  try {
    for (const [maxWidth, quality] of ATTEMPTS) {
      const { w, h } = fitWidth(bmp.width, bmp.height, maxWidth);
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
      const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality });
      const data = toBase64(new Uint8Array(await jpeg.arrayBuffer()));
      if (data.length <= SHOT_MAX_CHARS) return data;
    }
  } finally {
    bmp.close();
  }
  throw new Error("too large to send even when shrunk");
}
