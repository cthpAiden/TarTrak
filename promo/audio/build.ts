import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dbToGain, limit, wav24 } from "./dsp.ts";
import { renderScore } from "./score.ts";

const OUT = "public/score.wav";
const TARGET_LUFS = -14;

/** Integrated loudness and true peak from ffmpeg's ebur128 summary (printed on stderr). */
function loudness(file: string): { lufs: number; peak: number } {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const log = r.stderr.slice(r.stderr.lastIndexOf("Summary"));
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(log)?.[1]);
  const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(log)?.[1]);
  if (!Number.isFinite(lufs) || !Number.isFinite(peak)) throw new Error(`could not read loudness:\n${log}`);
  return { lufs, peak };
}

mkdirSync("public", { recursive: true });
const st = renderScore();
writeFileSync(OUT, wav24(st));
const g = dbToGain(TARGET_LUFS - loudness(OUT).lufs);
for (let i = 0; i < st.L.length; i++) {
  st.L[i] *= g;
  st.R[i] *= g;
}
limit(st, -1.2);
writeFileSync(OUT, wav24(st));
const final = loudness(OUT);
console.log(`score.wav  ${st.L.length} samples  ${final.lufs} LUFS  true peak ${final.peak} dBFS`);
