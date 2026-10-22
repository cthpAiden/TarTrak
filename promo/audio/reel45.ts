/**
 * The 45 s reel's arrangement: the showreel's first four bars, a two-bar breakdown under "hands off"
 * (no drums; the struck rows are the rhythm), a muffled build, the drop at 840, Am-F-C-G grooves through
 * the feature scenes, the showreel's last groove bars under the montage and overlay, Am held to the end.
 */
import { CUES_45, DURATION_FRAMES } from "../src/reel45/timeline.ts";
import { AM9, CMAJ, FMAJ, GMAJ, type Arrangement, type Bar } from "./score.ts";

const CHORD_ROOT = [
  [AM9, "A1"],
  [FMAJ, "F1"],
  [CMAJ, "C2"],
  [GMAJ, "G1"],
] as const;
/** Bar i of the Am-F-C-G loop: claps, an open hat every other bar, 16th hats on the loop's third bar. */
const loop = (i: number): Bar => {
  const [chord, root] = CHORD_ROOT[i % 4];
  return { chord, root, drums: "groove", clap: true, openHat: i % 2 === 1, extraHat: i % 4 === 2 ? -6 : undefined };
};

export const REEL45: Arrangement = {
  durationFrames: DURATION_FRAMES,
  cues: CUES_45,
  bars: [
    { chord: AM9, drums: "muffled" },
    { chord: AM9, root: "A1", drums: "groove" },
    { chord: FMAJ, root: "F1", drums: "groove", clap: true, extraHat: -6 },
    { chord: CMAJ, root: "C2", drums: "groove", clap: true, openHat: true },
    { chord: FMAJ },
    { chord: GMAJ, root: "G1" },
    { chord: AM9, root: "A1", drums: "muffled" },
    ...Array.from({ length: 11 }, (_, i) => loop(i)),
    { chord: FMAJ, root: "F1", drums: "groove", clap: true, openHat: true, extraHat: -2 },
    { chord: GMAJ, root: "G1", drums: "groove", clap: true, extraHat: -2 },
    { chord: AM9, root: "A1", drums: "groove", clap: true, openHat: true, extraHat: -2 },
    { chord: AM9 },
  ],
};
