import { COND, SANS } from "../../fonts.ts";
import { C } from "../../theme.ts";
import { easeOutExpo, prog } from "../../lib/ease.ts";
import { Checkbox, Icon } from "../../components/ui.tsx";

/** Made-up quests; the avatar is a trader-style square with made-up initials (no real trader art). */
const ROWS = [
  { name: "Supply Run", trader: "QM", tick: 514 },
  { name: "Signal Lost", trader: "SP", tick: 520 },
  { name: "Cold Storage", trader: "DR", tick: 526 },
] as const;
const TICK = 8;
export const CARD_W = 420;

const amber = (a: number) => `rgba(240, 180, 41, ${a})`;

/**
 * The app's Quests panel as a floating card (C.panel, 420 px): "Quests" + the to-do count, three rows
 * with the app's checkbox, a trader-style avatar and the quest name. Rows tick at 514 / 520 / 526 with
 * an amber sweep across the row. It rises in on the cut and drifts up while it floats.
 */
export const QuestCard = ({ frame, x, y }: { frame: number; x: number; y: number }) => {
  const enter = prog(frame, 510, 518, easeOutExpo);
  const drift = -10 * prog(frame, 510, 539);
  const done = ROWS.filter((r) => frame >= r.tick).length;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: CARD_W,
        padding: "18px 20px 6px",
        background: C.panel,
        border: `1px solid ${C.line2}`,
        borderRadius: 14,
        boxShadow: `0 44px 90px rgba(0, 0, 0, 0.55), 0 12px 26px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04)`,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 40 + drift}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 34, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, font: `700 24px ${SANS}`, color: C.fg }}>
          <span style={{ color: C.amber }}>
            <Icon name="quests" size={20} />
          </span>
          Quests
        </div>
        <div style={{ font: `600 13px ${SANS}`, letterSpacing: "0.08em", color: C.muted }}>
          TO-DO <span style={{ color: done ? C.amber : C.muted, marginLeft: 4 }}>{done}</span>
        </div>
      </div>
      {ROWS.map((r, i) => {
        const inP = prog(frame, 511 + 2 * i, 519 + 2 * i, easeOutExpo);
        const checked = prog(frame, r.tick, r.tick + TICK);
        const sweep = prog(frame, r.tick, r.tick + 5, easeOutExpo);
        const fade = 1 - prog(frame, r.tick + 5, r.tick + 20);
        const on = checked > 0.3;
        return (
          <div
            key={r.name}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 14,
              height: 64,
              borderTop: `1px solid ${C.line}`,
              opacity: inP,
              transform: `translateY(${(1 - inP) * 14}px)`,
            }}
          >
            {sweep > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: -20,
                  top: 0,
                  bottom: 0,
                  width: `calc(${sweep * 100}% + 40px)`,
                  background: `linear-gradient(90deg, ${amber(0.16 * fade + 0.04)}, ${amber(0)})`,
                }}
              />
            ) : null}
            <div style={{ position: "relative", margin: "0 4px", transform: "scale(1.5)" }}>
              <Checkbox checked={checked} />
            </div>
            <div
              style={{
                position: "relative",
                width: 38,
                height: 38,
                borderRadius: 8,
                background: C.raised2,
                border: `1px solid ${C.line2}`,
                display: "grid",
                placeItems: "center",
                font: `700 15px ${COND}`,
                letterSpacing: "0.06em",
                color: C.muted,
              }}
            >
              {r.trader}
            </div>
            <div style={{ position: "relative", font: `${on ? 600 : 500} 21px ${SANS}`, color: on ? C.fg : C.fg2 }}>{r.name}</div>
          </div>
        );
      })}
    </div>
  );
};
