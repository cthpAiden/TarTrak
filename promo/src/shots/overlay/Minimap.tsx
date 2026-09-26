import type { ReactNode } from "react";
import { spring, useCurrentFrame } from "remotion";
import { Chip } from "../../components/Chip.tsx";
import { Icon, IconButton, type IconName } from "../../components/ui.tsx";
import { C, SPRING_POP } from "../../theme.ts";
import { easeInCubic, easeOutCubic, prog } from "../../lib/ease.ts";
import { World } from "../../world/World.tsx";
import { CAM_MINIMAP } from "../../world/camera.ts";
import { MATES } from "../../world/data.ts";
import { raidClock } from "../app/motion.ts";
import { Bezel } from "./Bezel.tsx";
import { CHIP, HDG, MINI, RIM, chipSlots, polar, stageAt, upAt } from "./shot6.ts";

const D = 2 * MINI.r;
/** The rim tools round the lower left, as the app orders them: full window, follow me, route, draw, rotation. */
const RIM_ICONS: IconName[] = ["fit", "follow", "route", "draw", "rotation"];
/** Pressed as the app would be here: follow-me is on by default and a route to NORTH GATE is set. */
const PRESSED = [false, true, true, false, false];
/** The rotation button is clicked just before the heading-up turn: north-up icon out, amber heading-up arrow in. */
const PRESS = 681;
/** Closest teammate first, as the app sorts its chips. */
const BY_DISTANCE = [...MATES].sort((a, b) => a.metres - b.metres);
/**
 * Half widths of the chips as Chip lays them out (12 px IBM Plex Mono advances 7.2 px; 1 px borders):
 * the timer is 10 + 13 icon + 6 + 5 glyphs + 10, a teammate 9 + 7 dot + 6 + glyphs + 10.
 */
const CHIP_HALF = [(2 + 10 + 13 + 6 + 5 * 7.2 + 10) / 2, ...BY_DISTANCE.map((m) => (2 + 9 + 7 + 6 + `${m.metres} m`.length * 7.2 + 10) / 2)];
const CHIP_SLOTS = chipSlots(MINI.ro, CHIP_HALF, 13);

const spr = (frame: number, at: number) => (frame < at ? 0 : spring({ frame: frame - at, fps: 60, config: SPRING_POP }));

/** Centres its child on a stage point. */
const At = ({ x, y, scale = 1, opacity = 1, children }: { x: number; y: number; scale?: number; opacity?: number; children: ReactNode }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${scale})`, opacity }}>{children}</div>
);

/** The app's rim button in its heading-up state: amber ring, filled arrow. */
const HeadingUpButton = () => (
  <div
    style={{
      width: RIM.size,
      height: RIM.size,
      boxSizing: "border-box",
      display: "grid",
      placeItems: "center",
      borderRadius: "50%",
      background: "rgba(15, 19, 24, 0.94)",
      border: `1px solid ${C.amber}`,
      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.5)",
      color: C.amber,
    }}
  >
    <svg viewBox="0 0 16 16" width={16} height={16} style={{ display: "block" }}>
      <path d="M8 1.8l4.6 11.7L8 10.8l-4.6 2.7z" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  </div>
);

/**
 * The round minimap at its natural place on the stage (centre 1640/300, disc 165, the app's 26 px
 * bezel): the World seen through the disc (map scale follows the stage; markers go from full size on
 * the iris to 0.71 at natural size), the bezel, the raid timer and distance chips stepping up the lower-right
 * arc (658-670), and the rim buttons popping round the lower left (664-676). Heading-up turns the map
 * with the ring (684-704); chips and buttons tuck away as the camera pushes in.
 */
export const Minimap = () => {
  const frame = useCurrentFrame();
  const { s } = stageAt(frame);
  // The World draws its markers at a fixed pixel size. Laid out at resolution q and scaled into the disc,
  // they show at s / q of that size: full size on the iris (s 2, as shot 5 leaves them), 0.71 at the
  // minimap's natural size, where the app's own markers are that much smaller than the showreel's.
  const q = Math.sqrt(2 * s);
  const size = D * q;
  const away = prog(frame, 700, 711, easeInCubic);
  const shadow = prog(frame, 628, 660, easeOutCubic);

  const chipBodies: ReactNode[] = [
    <Chip key="timer">
      <span style={{ display: "flex", color: C.fg2 }}>
        <Icon name="clock" size={13} />
      </span>
      <span style={{ fontWeight: 700 }}>{raidClock(frame)}</span>
    </Chip>,
    ...BY_DISTANCE.map((m) => (
      <Chip key={m.id} color={m.color}>
        <span style={{ color: m.color }}>{`${m.metres} m`}</span>
      </Chip>
    )),
  ];

  const pressDip = frame < PRESS ? 0 : frame < PRESS + 2 ? prog(frame, PRESS, PRESS + 2) : 1 - spr(frame, PRESS + 2);
  const pulse = prog(frame, PRESS + 1, PRESS + 16);

  return (
    <>
      {/* A soft shadow lifts the overlay off the game. */}
      {shadow > 0 ? (
        <div
          style={{
            position: "absolute",
            left: MINI.x - MINI.ro - 60,
            top: MINI.y - MINI.ro - 60 + 10,
            width: 2 * (MINI.ro + 60),
            height: 2 * (MINI.ro + 60),
            borderRadius: "50%",
            opacity: shadow,
            background: "radial-gradient(circle closest-side, rgba(0, 0, 0, 0.6) 70%, rgba(0, 0, 0, 0.28) 84%, rgba(0, 0, 0, 0))",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: MINI.x - MINI.r,
          top: MINI.y - MINI.r,
          width: D,
          height: D,
          clipPath: "circle(50% at 50% 50%)",
          background: C.groundDeep,
        }}
      >
        <div style={{ width: size, height: size, transformOrigin: "0 0", transform: `scale(${1 / q})` }}>
          {/* area labels off, as shot 5 hands the map over (none falls inside the disc anyway) */}
          <World cam={{ ...CAM_MINIMAP, zoom: CAM_MINIMAP.zoom * q, turn: HDG * upAt(frame) }} width={size} height={size} show={{ labels: false }} extrude={0} />
        </div>
        {/* the bezel's soft inner shadow on the map (not on the iris frame shot 5 hands over) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: prog(frame, 602, 616),
            background: `radial-gradient(circle closest-side, rgba(11, 13, 16, 0) 84%, rgba(11, 13, 16, 0.18) 93%, rgba(11, 13, 16, 0.6) 100%)`,
          }}
        />
      </div>
      <Bezel />

      {chipBodies.map((body, i) => {
        const at = CHIP.at[i];
        if (frame < at) return null;
        const sp = spr(frame, at);
        // each chip steps up into its slot from just below it on the arc
        const slot = CHIP_SLOTS[i];
        const p = polar(MINI.x, MINI.y, slot.radius, slot.deg + 10 * (1 - sp));
        return (
          <At key={i} x={p.x} y={p.y} scale={0.55 + 0.45 * sp} opacity={prog(frame, at, at + 3) * (1 - away)}>
            {body}
          </At>
        );
      })}

      {RIM.angles.map((deg, i) => {
        const at = RIM.at[i];
        if (frame < at) return null;
        const sp = spr(frame, at);
        const p = polar(MINI.x, MINI.y, MINI.ro + RIM.gap - 16 * (1 - sp) + 10 * away, deg);
        const rotation = i === RIM.angles.length - 1;
        const up = rotation && frame >= PRESS + 1;
        return (
          <At key={deg} x={p.x} y={p.y} scale={sp * (1 - 0.16 * (rotation ? pressDip : 0))} opacity={prog(frame, at, at + 2) * (1 - away)}>
            {up ? <HeadingUpButton /> : <IconButton icon={RIM_ICONS[i]} round size={RIM.size} active={PRESSED[i]} />}
            {up && pulse < 1 ? (
              <div
                style={{
                  position: "absolute",
                  left: RIM.size / 2,
                  top: RIM.size / 2,
                  width: RIM.size,
                  height: RIM.size,
                  borderRadius: "50%",
                  border: `1.5px solid ${C.amber}`,
                  opacity: 0.8 * (1 - pulse),
                  transform: `translate(-50%, -50%) scale(${1 + 0.9 * easeOutCubic(pulse)})`,
                }}
              />
            ) : null}
          </At>
        );
      })}
    </>
  );
};
