/**
 * Renders stills of one composition with a single bundle and browser (fast iteration).
 * Usage: node scripts/still.ts <CompositionId> <frame> [frame...]  -> out/stills/<Id>-<frame>.png
 */
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const [id, ...frames] = process.argv.slice(2);
if (!id || frames.length === 0) {
  console.error("usage: node scripts/still.ts <CompositionId> <frame> [frame...]");
  process.exit(1);
}
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome");
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser });
for (const f of frames) {
  const output = path.resolve(`out/stills/${id}-${f}.png`);
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, output, frame: Number(f), puppeteerInstance: browser });
  console.log(`${output}  (${Date.now() - t0} ms)`);
}
await browser.close({ silent: true });
