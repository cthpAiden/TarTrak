import { continueRender, delayRender, staticFile } from "remotion";
import { loadFont as loadCond } from "@remotion/google-fonts/IBMPlexSansCondensed";

/** The app's own faces since 0.18.1 (Geist for text, Geist Mono for numbers), from public/fonts. */
function loadLocal(family: string, file: string): string {
  if (typeof document === "undefined") return family;
  const handle = delayRender(`font ${family}`);
  Promise.all(
    ["400", "500", "600", "700"].map(async (w) => {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}-latin-${w}-normal.woff2`)}) format("woff2")`, { weight: w });
      document.fonts.add(await face.load());
    }),
  ).then(
    () => continueRender(handle),
    (e) => {
      console.error(e);
      continueRender(handle);
    },
  );
  return family;
}

export const SANS = loadLocal("Geist", "geist");
export const MONO = loadLocal("Geist Mono", "geist-mono");
/** Headlines keep their condensed face. */
export const COND = loadCond("normal", { weights: ["500", "600", "700"], subsets: ["latin"] }).fontFamily;
