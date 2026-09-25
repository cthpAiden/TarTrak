import type { ComponentType } from "react";
import { Audio, staticFile, useCurrentFrame } from "remotion";
import { Frame } from "./components/Frame.tsx";
import { Glitch } from "./components/Glitch.tsx";
import { glitchAt, shotAt, type ShotId } from "./timeline.ts";
import { Shot1Snap } from "./shots/Shot1Snap.tsx";
import { Shot2Map } from "./shots/Shot2Map.tsx";
import { Shot3Squad } from "./shots/Shot3Squad.tsx";
import { Shot4App } from "./shots/Shot4App.tsx";
import { Shot5Montage } from "./shots/Shot5Montage.tsx";
import { Shot6Overlay } from "./shots/Shot6Overlay.tsx";
import { Shot7End } from "./shots/Shot7End.tsx";

const SHOT: Record<ShotId, ComponentType> = {
  snap: Shot1Snap,
  map: Shot2Map,
  squad: Shot3Squad,
  app: Shot4App,
  montage: Shot5Montage,
  overlay: Shot6Overlay,
  end: Shot7End,
};

export const Showreel = () => {
  const frame = useCurrentFrame();
  const Shot = SHOT[shotAt(frame)];
  return (
    <Frame>
      <Glitch amount={glitchAt(frame)}>
        <Shot />
      </Glitch>
      <Audio src={staticFile("score.wav")} />
    </Frame>
  );
};
