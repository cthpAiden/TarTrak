import type { CSSProperties, ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { MONO } from "../../fonts.ts";
import { C } from "../../theme.ts";
import { easeOutCubic, easeOutExpo, prog } from "../../lib/ease.ts";
import { MATES, mateLabel } from "../../world/data.ts";
import { BUILD, PANEL_W } from "./motion.ts";

/** How long ago each teammate's last screenshot came in, as the Squad list shows it. */
const AGES: Record<string, string> = { ghost: "2s ago", nomad: "1s ago", vex: "3s ago" };

/** app.css `.side .panel h3`: small caps section heading. */
const h3: CSSProperties = { margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, lineHeight: "normal" };

/** Rises 8 px and fades in over 8 frames from `at`. */
const rise = (frame: number, at: number): CSSProperties => {
  const t = easeOutCubic(prog(frame, at, at + 8));
  return { opacity: t, transform: `translateY(${(1 - t) * 8}px)` };
};

/** `.side button`: the panel's shared button look. */
const Button = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      padding: "3px 10px",
      fontSize: 12.5,
      lineHeight: "normal",
      color: C.fg,
      background: C.raised2,
      border: `1px solid ${C.line2}`,
      borderRadius: 6,
      flex: "none",
    }}
  >
    {children}
  </div>
);

/**
 * The Squad tab (`.side`, 400 px): heading, the room card (code, connection, Leave) and the teammates in
 * the room, one row each: colour dot, name as the app writes it, metres from me (counting up as the row
 * lands), and the age of their last position.
 */
export const SquadPanel = ({ x, height }: { x: number; height: number }) => {
  const frame = useCurrentFrame();
  return (
    <aside
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: PANEL_W,
        height,
        overflow: "hidden",
        background: C.panel,
        borderRight: "1px solid #262d36",
      }}
    >
      <section style={{ padding: "14px 16px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, lineHeight: "normal", color: C.fg, ...rise(frame, 367) }}>Squad</h2>

        <div
          style={{
            padding: "12px 14px 14px",
            background: C.raised,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            ...rise(frame, 370),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={h3}>Room</h3>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.ok, boxShadow: "0 0 6px rgba(62, 207, 142, 0.6)" }} />
              Connected
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, letterSpacing: "0.12em", color: C.fg, lineHeight: "normal" }}>K7Q2XM</span>
            <Button>Leave</Button>
          </div>
        </div>

        <h3 style={{ ...h3, margin: "20px 0 8px", ...rise(frame, 374) }}>In the room</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {MATES.map((m, i) => {
            const at = BUILD.rows + 4 * i;
            const t = easeOutExpo(prog(frame, at, at + 8));
            const metres = Math.round(m.metres * easeOutCubic(prog(frame, at, at + 14)));
            return (
              <div
                key={m.id}
                style={{
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 12px",
                  background: C.raised2,
                  border: `1px solid ${C.line2}`,
                  borderRadius: 6,
                  opacity: t,
                  transform: `translateX(${(1 - t) * -24}px)`,
                }}
              >
                <span style={{ width: 10, height: 10, flex: "none", borderRadius: "50%", background: m.color, boxShadow: `0 0 0 1.5px #000, 0 0 8px ${m.color}66` }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, letterSpacing: "0.02em", color: C.fg }}>{mateLabel(m)}</span>
                <span style={{ minWidth: 60, textAlign: "right", fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: "tabular-nums", color: C.fg2 }}>{`${metres} m`}</span>
                <span style={{ minWidth: 50, textAlign: "right", fontSize: 12, color: C.muted }}>{AGES[m.id]}</span>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
};
