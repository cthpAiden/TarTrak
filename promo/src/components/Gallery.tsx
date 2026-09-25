import type { ReactNode } from "react";
import { spring, useCurrentFrame } from "remotion";
import { COND, MONO } from "../fonts.ts";
import { C, SPRING_POP } from "../theme.ts";
import { easeInOutCubic, easeOutCubic, prog } from "../lib/ease.ts";
import { Callout } from "./Callout.tsx";
import { Chip } from "./Chip.tsx";
import { Frame } from "./Frame.tsx";
import { Glitch } from "./Glitch.tsx";
import { Headline } from "./Headline.tsx";
import { Keycap } from "./Keycap.tsx";
import { LogoMark } from "./Logo.tsx";
import { ExtractBadge, HeadingLine, MateDot, PinGlyph, PlayerDot } from "./Markers.tsx";
import { Ping } from "./Ping.tsx";
import { ScrambleText } from "./ScrambleText.tsx";
import { ShutterIris } from "./ShutterIris.tsx";
import { Checkbox, Icon, IconButton, type IconName } from "./ui.tsx";

/*
 * Review board for the shared components. Test frames: 20 (HUD drawing in, keycap rising, headline
 * rising), 60 (key pressed), 66 (iris: closing / flash / opening), 80 (key springing back, scramble
 * mid-decode, centred headline), 160 / 400 / 760 (two-line headlines rising), 400 (callout), 760 (logo).
 */

const caption = { fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: C.muted, whiteSpace: "pre" } as const;

const Tile = ({ x, y, w, h, label, children }: { x: number; y: number; w: number; h: number; label: string; children?: ReactNode }) => (
  <div
    style={{
      position: "absolute", left: x, top: y, width: w, height: h, boxSizing: "border-box", borderRadius: 12,
      background: "rgba(22, 26, 32, 0.55)", border: "1px solid rgba(46, 54, 64, 0.75)",
    }}
  >
    {children}
    <div style={{ ...caption, position: "absolute", left: 14, top: 10 }}>{label}</div>
  </div>
);

/** A point in a tile that its markers are drawn round. */
const At = ({ x, y, children }: { x: number; y: number; children?: ReactNode }) => (
  <div style={{ position: "absolute", left: x, top: y }}>{children}</div>
);

/** What the iris thumbnails see through the aperture (full-frame coordinates). */
const IrisScene = () => (
  <div style={{ position: "absolute", inset: 0, background: C.ground }}>
    {[160, 320, 480, 640].map((r) => (
      <div
        key={r}
        style={{ position: "absolute", left: 960 - r, top: 540 - r, width: 2 * r, height: 2 * r, borderRadius: "50%", border: `6px solid ${C.contourMajor}` }}
      />
    ))}
    <At x={960} y={540}>
      <HeadingLine length={300} angle={48} color={C.amber} width={20} dash="36 44" />
      <PlayerDot size={64} />
    </At>
  </div>
);

const FILENAME = "2026-09-25[14-32]_-182.40, 2.10, -71.03_0.00000, 0.40674, 0.00000, 0.91355 (0).png";
const range = (s: string) => ({ start: FILENAME.indexOf(s), end: FILENAME.indexOf(s) + s.length, color: C.amber });
const HIGHLIGHTS = [range("-182.40"), range("-71.03"), range("0.00000, 0.40674, 0.00000, 0.91355")];

const ICONS: IconName[] = ["filters", "squad", "quests", "settings", "overlay", "follow", "route", "draw", "centre", "fit", "layers", "clock", "check", "exit", "rotation"];

export const Gallery = () => {
  const frame = useCurrentFrame();
  const logoRing = prog(frame, 748, 778, easeInOutCubic);
  const logoTick = frame >= 756 ? spring({ frame: frame - 756, fps: 60, config: SPRING_POP }) : 0;
  const tickCheck = frame >= 52 ? spring({ frame: frame - 52, fps: 60, config: SPRING_POP, durationInFrames: 16 }) : 0;
  const pingAt = Math.floor(frame / 30) * 30;
  return (
    <Frame>
      {/* Row 1: keycap, iris, logo, glitch */}
      <Tile x={100} y={96} w={260} h={276} label="KEYCAP  12 / 60 / 72">
        <Keycap label="PRT SC" sub="SCREENSHOT" x={130} y={150} size={140} appearAt={12} pressAt={60} releaseAt={72} />
      </Tile>
      <Tile x={376} y={96} w={792} h={276} label="SHUTTER IRIS  AT 65 / 64 / 60">
        {[65, 64, 60].map((at, i) => (
          <div key={at}>
            <div style={{ position: "absolute", left: 20 + i * 256, top: 44, width: 240, height: 135, overflow: "hidden", borderRadius: 4, outline: `1px solid ${C.line}` }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: "scale(0.125)", transformOrigin: "0 0" }}>
                <IrisScene />
                <ShutterIris at={at} />
              </div>
            </div>
            <div style={{ ...caption, position: "absolute", left: 20 + i * 256, top: 190 }}>{`at ${at}: ${["closing", "flash", "opening"][i]} at f66`}</div>
          </div>
        ))}
      </Tile>
      <Tile x={1184} y={96} w={380} h={276} label="LOGOMARK  ANIMATED / STATIC">
        <div style={{ position: "absolute", left: 30, top: 92 }}>
          <LogoMark size={140} ring={logoRing} tick={logoTick} glow={logoRing} />
        </div>
        <div style={{ position: "absolute", left: 210, top: 92 }}>
          <LogoMark size={140} />
        </div>
      </Tile>
      <Tile x={1580} y={96} w={240} h={276} label="GLITCH  0.8">
        <div style={{ position: "absolute", left: 1, top: 30, width: 238, height: 244, overflow: "hidden" }}>
          <Glitch amount={0.8} width={238}>
            <div style={{ position: "absolute", left: 22, top: 40, fontFamily: COND, fontWeight: 700, fontSize: 64, lineHeight: 1, color: C.fg }}>
              ONE
              <br />
              <span style={{ color: C.amber }}>KEY.</span>
            </div>
            <At x={176} y={190}>
              <PlayerDot size={22} />
            </At>
          </Glitch>
        </div>
      </Tile>

      {/* Row 2: headline, callouts */}
      <Tile x={100} y={388} w={1068} h={300} label="HEADLINE  y = LAST BASELINE (DASHED)">
        <div style={{ position: "absolute", left: 20, right: 20, top: 250, borderTop: "1px dashed rgba(240, 180, 41, 0.35)" }} />
        <Headline lines={[{ text: "ONE KEY.", accent: "KEY." }]} at={[14]} out={60} x={40} y={250} size={104} />
        <Headline lines={[{ text: "ONE KEY.", accent: "KEY." }]} at={[74]} out={120} x={534} y={250} size={104} align="center" />
        <Headline lines={[{ text: "YOU'RE ON" }, { text: "THE MAP.", accent: "MAP." }]} at={[148, 156]} out={222} x={40} y={250} size={104} />
        <Headline lines={[{ text: "SO IS" }, { text: "YOUR SQUAD.", accent: "SQUAD." }]} at={[388, 396]} out={440} x={40} y={250} size={104} />
        <Headline lines={[{ text: "ALWAYS" }, { text: "ON TOP.", accent: "ON TOP." }]} at={[748, 756]} out={800} x={1028} y={250} size={104} align="right" />
      </Tile>
      <Tile x={1184} y={388} w={636} h={300} label="CALLOUTS  56 / 392 / 752   PING EVERY BEAT">
        <div style={{ position: "absolute", left: 14, top: 34, right: 14, bottom: 14, borderRadius: 8, background: C.ground, overflow: "hidden" }}>
          <Ping at={pingAt} cx={106} cy={196} maxR={110} />
          <Ping at={pingAt - 30} cx={106} cy={196} maxR={110} />
        </div>
        <At x={120} y={230}>
          <HeadingLine length={130} angle={48} color={C.amber} width={5} />
          <PlayerDot />
        </At>
        <At x={470} y={120}>
          <HeadingLine length={90} angle={250} color={C.nomad} width={4} />
          <MateDot color={C.nomad} />
        </At>
        <At x={570} y={246}>
          <ExtractBadge kind="pmc" />
        </At>
        <Callout anchor={{ x: 570, y: 246 }} label="Extracts & quests" at={56} side="left" length={96} />
        <Callout anchor={{ x: 470, y: 120 }} label="Live squad positions" at={392} side="left" length={120} />
        <Callout anchor={{ x: 172, y: 183 }} label="Heading lines" at={752} length={120} />
      </Tile>

      {/* Row 3: scramble, chips + checkboxes + buttons, icons, markers */}
      <Tile x={100} y={704} w={1068} h={88} label="SCRAMBLE  70-96">
        <div style={{ position: "absolute", left: 24, top: 40 }}>
          <ScrambleText text={FILENAME} from={70} to={96} seed={3} style={{ fontSize: 18, color: C.muted }} highlights={HIGHLIGHTS} />
        </div>
      </Tile>
      <Tile x={100} y={808} w={1068} h={176} label="CHIP / CHECKBOX / ICONBUTTON">
        <div style={{ position: "absolute", left: 24, top: 40, display: "flex", gap: 10 }}>
          <Chip>
            <Icon name="clock" size={13} />
            31:47
          </Chip>
          <Chip color={C.ghost}>GHOST 47 m</Chip>
          <Chip color={C.nomad}>NOMAD 84 m</Chip>
          <Chip color={C.vex}>VEX 132 m</Chip>
          <Chip>NORTH GATE · 412 m</Chip>
          <Chip mono={false}>1F</Chip>
        </div>
        <div style={{ position: "absolute", left: 24, top: 96, display: "flex", gap: 22, alignItems: "flex-start" }}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((c) => (
            <div key={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Checkbox checked={c} />
              <span style={{ ...caption, fontSize: 10 }}>{c.toFixed(1)}</span>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Checkbox checked={tickCheck} />
            <span style={{ ...caption, fontSize: 10 }}>f52</span>
          </div>
        </div>
        <div style={{ position: "absolute", left: 470, top: 90, display: "flex", gap: 6, alignItems: "center" }}>
          {(["overlay", "follow", "route", "draw", "centre", "fit"] as const).map((n) => (
            <IconButton key={n} icon={n} active={n === "follow"} />
          ))}
          <span style={{ width: 18 }} />
          {(["fit", "follow", "route", "rotation"] as const).map((n) => (
            <IconButton key={n} icon={n} round size={30} active={n === "follow"} />
          ))}
        </div>
      </Tile>
      <Tile x={1184} y={704} w={636} h={132} label="ICON">
        <div style={{ position: "absolute", left: 20, top: 34, width: 600, display: "flex", flexWrap: "wrap", rowGap: 10 }}>
          {ICONS.map((n) => (
            <div key={n} style={{ width: 75, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, color: C.fg2 }}>
              <Icon name={n} size={20} />
              <span style={{ ...caption, fontSize: 9, letterSpacing: "0.06em" }}>{n}</span>
            </div>
          ))}
        </div>
      </Tile>
      <Tile x={1184} y={852} w={636} h={132} label="MARKERS">
        <At x={60} y={96}>
          <HeadingLine length={80} angle={48} color={C.amber} width={5} draw={prog(frame, 20, 50, easeOutCubic)} />
          <PlayerDot />
        </At>
        {[C.ghost, C.nomad, C.vex].map((c, i) => (
          <At key={c} x={180 + i * 56} y={92}>
            <HeadingLine length={46} angle={20 + 60 * i} color={c} width={4} />
            <MateDot color={c} />
          </At>
        ))}
        {(["pmc", "scav", "shared"] as const).map((k, i) => (
          <At key={k} x={390 + i * 44} y={92}>
            <ExtractBadge kind={k} />
          </At>
        ))}
        <At x={560} y={110}>
          <PinGlyph color={C.amber} size={34} />
        </At>
      </Tile>
    </Frame>
  );
};
