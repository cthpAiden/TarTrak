import { useCurrentFrame } from "remotion";
import { SANS } from "../../fonts.ts";
import { C } from "../../theme.ts";
import { World } from "../../world/World.tsx";
import { WIN_H, WIN_W, mapBox, mapCam, panelX, railX, statusTop } from "./motion.ts";
import { Rail } from "./Rail.tsx";
import { SquadPanel } from "./SquadPanel.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { Toolbar } from "./Toolbar.tsx";

/**
 * TarTrak's window, "UI 02" layout, at 1920 x 1080: icon rail | Squad panel | map with its toolbar, and
 * the status bar underneath. Builds itself round the map from f360; the map is the World with flat roofs.
 * Shot 3 ends with the measure lines and metre pills on, so they stay on here: the cut at f360 cannot pop.
 */
export const AppWindow = () => {
  const frame = useCurrentFrame();
  const box = mapBox(frame);
  const top = statusTop(frame);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: WIN_W,
        height: WIN_H,
        overflow: "hidden",
        background: C.bg,
        fontFamily: SANS,
        fontSize: 13,
        color: C.fg,
      }}
    >
      <section style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", background: C.ground }}>
        <World cam={mapCam(frame)} width={box.w} height={box.h} extrude={0} show={{ measures: true }} />
        <Toolbar />
      </section>
      <SquadPanel x={panelX(frame)} height={top} />
      <Rail x={railX(frame)} height={top} />
      <StatusBar top={top} />
    </div>
  );
};
