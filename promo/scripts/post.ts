/** After the master render: web copy under 10 MB, poster, contact sheet, waveform. */
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { DURATION_FRAMES } from "../src/timeline.ts";

const MASTER = "out/tartrak-showreel.mp4";
const WEB = "out/tartrak-showreel-web.mp4";
const POSTER = "out/poster.png";
const LIMIT = 10 * 1024 * 1024;
const ff = (args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

for (const crf of [22, 24, 26, 28, 30]) {
  ff(["-i", MASTER, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", WEB]);
  const size = statSync(WEB).size;
  console.log(`web copy crf ${crf}: ${(size / 1048576).toFixed(2)} MB`);
  if (size < LIMIT) break;
}
if (statSync(WEB).size >= LIMIT) throw new Error(`web copy is ${(statSync(WEB).size / 1048576).toFixed(2)} MB at the last CRF, over the 10 MB limit`);
ff(["-i", MASTER, "-vf", `select=eq(n\\,${DURATION_FRAMES - 1})`, "-fps_mode", "passthrough", "-frames:v", "1", "-update", "1", POSTER]);
if (statSync(POSTER).size === 0) throw new Error("poster.png is empty");
ff(["-i", MASTER, "-vf", "fps=2,scale=480:-1,tile=6x5", "-frames:v", "1", "out/contact.png"]);
ff(["-i", "public/score.wav", "-filter_complex", "showwavespic=s=1920x300:split_channels=1:colors=#f0b429|#3ecf8e", "-frames:v", "1", "out/wave.png"]);
console.log("poster.png, contact.png, wave.png written to out/");
