import type { ComponentType } from "react";
import { Composition } from "remotion";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline.ts";
import { Showreel } from "./Showreel.tsx";
import { Frame } from "./components/Frame.tsx";
import { Gallery } from "./components/Gallery.tsx";
import { WorldTilt, WorldTop } from "./world/WorldTest.tsx";
import { Shot1Snap } from "./shots/Shot1Snap.tsx";
import { Shot2Map } from "./shots/Shot2Map.tsx";
import { Shot3Squad } from "./shots/Shot3Squad.tsx";
import { Shot4App } from "./shots/Shot4App.tsx";
import { Shot5Montage } from "./shots/Shot5Montage.tsx";
import { Shot6Overlay } from "./shots/Shot6Overlay.tsx";
import { Shot7End } from "./shots/Shot7End.tsx";

const framed = (Shot: ComponentType) => () => (
  <Frame>
    <Shot />
  </Frame>
);
const SHOT_COMPS: Array<[string, ComponentType]> = [
  ["Shot1", framed(Shot1Snap)],
  ["Shot2", framed(Shot2Map)],
  ["Shot3", framed(Shot3Squad)],
  ["Shot4", framed(Shot4App)],
  ["Shot5", framed(Shot5Montage)],
  ["Shot6", framed(Shot6Overlay)],
  ["Shot7", framed(Shot7End)],
  ["WorldTilt", WorldTilt],
  ["WorldTop", WorldTop],
  ["Gallery", Gallery],
];

const common = { durationInFrames: DURATION_FRAMES, fps: FPS, width: WIDTH, height: HEIGHT } as const;

export const Root = () => (
  <>
    <Composition id="Showreel" component={Showreel} {...common} />
    {SHOT_COMPS.map(([id, c]) => (
      <Composition key={id} id={id} component={c} {...common} />
    ))}
  </>
);
