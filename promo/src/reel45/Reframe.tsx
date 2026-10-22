import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { HeadlinePlace } from "../components/Headline.tsx";
import { easeInOutCubic, track, type Key } from "../lib/ease.ts";
import type { Pt } from "../world/data.ts";
import { stageAt } from "../shots/overlay/shot6.ts";
import type { SceneId } from "./timeline.ts";
import { useLayout } from "./kit.tsx";

/**
 * How a 16:9 showreel shot sits in the vertical frame: scale `s` and the shot-space x `fx` that lands
 * on the frame's centre line (numbers or tracks on the shot's own frames), the picture's centre `cy`,
 * and where its headline goes: shot-space anchor `A` to vertical-frame point `B`, type scaled by `k`.
 * `fade` softens the picture's top and bottom edges (shots with a full-bleed background), which sit at
 * shot-space y `extent` (default 0 and 1080; shot 6's game backdrop is drawn past the frame).
 */
type Track = number | Key[] | ((frame: number) => number);
type Spec = { s: Track; fx: Track; cy: number; A?: Pt; B?: Pt; k?: number; fade: boolean; extent?: readonly [number, number] };

/** Headline anchor of shots 2, 3 and 6 (left edge, last baseline), moved under the picture. */
const LEFT_HEADLINE = { B: { x: 80, y: 1690 }, k: 0.9 } as const;

export const PORTRAIT: Partial<Record<SceneId, Spec>> = {
  snap: { s: 0.62, fx: 960, cy: 900, A: { x: 960, y: 330 }, B: { x: 540, y: 520 }, k: 1.25, fade: false },
  map: { s: 1, fx: 960, cy: 860, A: { x: 120, y: 960 }, ...LEFT_HEADLINE, fade: true },
  squad: { s: 1, fx: 960, cy: 860, A: { x: 120, y: 960 }, ...LEFT_HEADLINE, fade: true },
  app: { s: 0.56, fx: 960, cy: 860, fade: true },
  montage: { s: 0.85, fx: 730, cy: 860, fade: true },
  // Keeps the minimap 250 px right of centre when it sits in its corner, centred on the iris and the logo;
  // scales up to the end card's size on the push.
  overlay: {
    s: [[696, 1], [719, 1.1, easeInOutCubic]],
    fx: (f) => {
      const x = stageAt(f).x;
      return x - (250 * (x - 960)) / (1640 - 960);
    },
    cy: 860,
    A: { x: 120, y: 948 },
    B: { x: 80, y: 1770 },
    k: LEFT_HEADLINE.k,
    fade: true,
    extent: [-172, 1214],
  },
  end: { s: 1.1, fx: 960, cy: 860, fade: false },
};

const val = (v: Track, frame: number) => (typeof v === "number" ? v : typeof v === "function" ? v(frame) : track(frame, v));
const EDGE = 140;
const BG = "rgba(14, 17, 21, 1)";

/** One showreel shot reframed for the vertical cut (see `Spec`). Reads the shot's own frames. */
export const Reframe = ({ spec, children }: { spec: Spec; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { W } = useLayout();
  const s = val(spec.s, frame);
  const ox = W / 2 - s * val(spec.fx, frame);
  const oy = spec.cy - s * 540;
  const { A, B } = spec;
  const k = spec.k ?? 1;
  const place = A && B ? { at: (p: Pt) => ({ x: (B.x + (p.x - A.x) * k - ox) / s, y: (B.y + (p.y - A.y) * k - oy) / s }), k: k / s } : null;
  const [top, bottom] = spec.extent ?? [0, 1080];
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: `translate(${ox}px, ${oy}px) scale(${s})` }}>
        <HeadlinePlace.Provider value={place}>{children}</HeadlinePlace.Provider>
      </div>
      {spec.fade ? (
        <>
          <div style={{ position: "absolute", left: 0, width: W, top: oy + s * top - 2, height: EDGE, background: `linear-gradient(to bottom, ${BG}, rgba(14, 17, 21, 0))`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: 0, width: W, top: oy + s * bottom - EDGE + 2, height: EDGE, background: `linear-gradient(to top, ${BG}, rgba(14, 17, 21, 0))`, pointerEvents: "none" }} />
        </>
      ) : null}
    </>
  );
};
