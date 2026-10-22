import type { ComponentType } from "react";
import { Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Frame } from "../components/Frame.tsx";
import { Glitch } from "../components/Glitch.tsx";
import type { HudSpec } from "../components/Hud.tsx";
import { Shot1Snap } from "../shots/Shot1Snap.tsx";
import { Shot2Map } from "../shots/Shot2Map.tsx";
import { Shot3Squad } from "../shots/Shot3Squad.tsx";
import { Shot4App } from "../shots/Shot4App.tsx";
import { Shot5Montage } from "../shots/Shot5Montage.tsx";
import { Shot6Overlay } from "../shots/Shot6Overlay.tsx";
import { Shot7End } from "../shots/Shot7End.tsx";
import { SCENES, SHIFT, glitchAt, sceneAt, type SceneId } from "./timeline.ts";
import { Safe } from "./scenes/Safe.tsx";
import { Maps } from "./scenes/Maps.tsx";
import { Exits } from "./scenes/Exits.tsx";
import { Clock } from "./scenes/Clock.tsx";
import { Share } from "./scenes/Share.tsx";
import { Keys } from "./scenes/Keys.tsx";
import { PORTRAIT, Reframe } from "./Reframe.tsx";
import { useLayout } from "./kit.tsx";

/** Showreel shots on the showreel's own frames (`shift` later), or new scenes on local frames. */
const SCENE: Record<SceneId, { C: ComponentType; shift?: number }> = {
  snap: { C: Shot1Snap, shift: 0 },
  map: { C: Shot2Map, shift: 0 },
  squad: { C: Shot3Squad, shift: 0 },
  app: { C: Shot4App, shift: 0 },
  safe: { C: Safe },
  maps: { C: Maps },
  exits: { C: Exits },
  clock: { C: Clock },
  share: { C: Share },
  keys: { C: Keys },
  montage: { C: Shot5Montage, shift: SHIFT },
  overlay: { C: Shot6Overlay, shift: SHIFT },
  end: { C: Shot7End, shift: SHIFT },
};

const HUD: HudSpec = { title: "TARTRAK // REEL", total: 13, shotAt: (f) => SCENES[sceneAt(f)], endAt: SCENES.end.from };

/**
 * The 45 s reel: one scene at a time inside the shared frame, glitch on the hard cuts, the 45 s score.
 * In the vertical cut the showreel's 16:9 shots are reframed (Reframe.tsx); the new scenes lay
 * themselves out for either shape.
 */
export const Reel45 = () => {
  const frame = useCurrentFrame();
  const { W, portrait } = useLayout();
  const id = sceneAt(frame);
  const { C: Scene, shift } = SCENE[id];
  const spec = portrait ? PORTRAIT[id] : undefined;
  return (
    <Frame hudSpec={HUD}>
      <Glitch amount={glitchAt(frame)} width={W}>
        <Sequence key={id} from={shift ?? SCENES[id].from}>
          {spec ? (
            <Reframe spec={spec}>
              <Scene />
            </Reframe>
          ) : (
            <Scene />
          )}
        </Sequence>
      </Glitch>
      <Audio src={staticFile("score45.wav")} />
    </Frame>
  );
};
