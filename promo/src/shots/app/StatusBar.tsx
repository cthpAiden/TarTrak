import { useCurrentFrame } from "remotion";
import { MONO } from "../../fonts.ts";
import { C } from "../../theme.ts";
import { easeOutCubic, prog } from "../../lib/ease.ts";
import { BUILD, STATUS_H, WIN_W, raidClock } from "./motion.ts";

/** app.css `.status` background. */
const STATUS_BG = "#0c0f13";

const Sep = () => <span style={{ width: 1, height: 14, flex: "none", background: C.line2 }} />;

/**
 * The status bar (`.status`) under the whole window: my coordinates and heading, the room and how many
 * are in it, the raid clock, the version. No map picker: the map is made up. `top` = its top edge.
 */
export const StatusBar = ({ top }: { top: number }) => {
  const frame = useCurrentFrame();
  const t = easeOutCubic(prog(frame, BUILD.status[0], BUILD.status[0] + 10));
  const b = { color: C.amber, fontWeight: 600, fontFamily: MONO } as const;
  return (
    <footer
      style={{
        position: "absolute",
        left: 0,
        top,
        width: WIN_W,
        height: STATUS_H,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 14px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        fontSize: 12,
        color: C.fg2,
        background: STATUS_BG,
        borderTop: `1px solid ${C.raised2}`,
      }}
    >
      <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", opacity: t }}>
        X -182.4 · Z -71.0 · <b style={b}>048°</b>
      </span>
      <Sep />
      <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: t }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.ok }} />
        <span style={{ fontFamily: MONO }}>K7Q2XM</span>
        <span style={{ color: C.muted }}>· 4 in room</span>
      </span>
      <Sep />
      <span style={{ opacity: t }}>
        Raid <b style={{ ...b, fontVariantNumeric: "tabular-nums" }}>{raidClock(frame)}</b> left
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ fontFamily: MONO, color: C.muted, opacity: t }}>v0.12.2</span>
    </footer>
  );
};
