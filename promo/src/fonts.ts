import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadCond } from "@remotion/google-fonts/IBMPlexSansCondensed";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

export const SANS = loadSans("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const COND = loadCond("normal", { weights: ["500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const MONO = loadMono("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
