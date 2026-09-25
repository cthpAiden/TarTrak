import { AbsoluteFill } from "remotion";
import { World } from "./World.tsx";
import { ME, WORLD_H, WORLD_W } from "./data.ts";

/** Whole map, tilted like shots 2-3. */
export const WorldTilt = () => (
  <AbsoluteFill>
    <World cam={{ x: WORLD_W / 2, y: WORLD_H / 2 + 150, zoom: 0.62, tilt: 52, turn: -12 }} width={1920} height={1080} show={{ measures: true }} />
  </AbsoluteFill>
);

/** Top-down close-up round me, like shot 4 and the minimap. */
export const WorldTop = () => (
  <AbsoluteFill>
    <World cam={{ x: ME.x + 100, y: ME.y - 50, zoom: 1.5, tilt: 0, turn: 0 }} width={1920} height={1080} extrude={0} />
  </AbsoluteFill>
);
