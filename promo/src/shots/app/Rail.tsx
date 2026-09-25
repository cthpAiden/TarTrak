import type { ReactNode } from "react";
import { spring, useCurrentFrame } from "remotion";
import { MONO } from "../../fonts.ts";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeOutCubic, prog } from "../../lib/ease.ts";
import { RAIL_W } from "./motion.ts";

/** app.css `.rail` background, one step darker than the panel. */
const RAIL_BG = "#0f1216";

const pop = (frame: number, at: number) => (frame < at ? 0 : spring({ frame: frame - at, fps: 60, config: SPRING_POP }));

/** The app's inline 16-unit icons (App.svelte), in currentColor. */
const Glyph = ({ size, sw, children }: { size: number; sw: number; children: ReactNode }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={sw} style={{ display: "block", flex: "none" }} aria-hidden>
    {children}
  </svg>
);

const TABS: ReadonlyArray<{ id: string; label: string; glyph: ReactNode }> = [
  {
    id: "filters",
    label: "Filters",
    glyph: (
      <>
        <path d="M8 2l6 3-6 3-6-3z" />
        <path d="M2 8l6 3 6-3" />
        <path d="M2 11l6 3 6-3" />
      </>
    ),
  },
  {
    id: "squad",
    label: "Squad",
    glyph: (
      <>
        <circle cx="6" cy="5.5" r="2.5" />
        <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
        <circle cx="11.5" cy="6" r="2" />
        <path d="M11 10c2 0 3.5 1.2 3.5 3.5" />
      </>
    ),
  },
  {
    id: "quests",
    label: "Quests",
    glyph: (
      <>
        <path d="M6 4h8M6 8h8M6 12h8" />
        <path d="M2 3.5l1 1 1.5-2M2 7.5l1 1 1.5-2M2 11.5l1 1 1.5-2" />
      </>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    glyph: (
      <>
        <path d="M2 4h7M12 4h2M2 12h2M7 12h7" />
        <circle cx="10.5" cy="4" r="1.5" />
        <circle cx="5.5" cy="12" r="1.5" />
        <path d="M2 8h2M7 8h7" />
        <circle cx="5.5" cy="8" r="1.5" />
      </>
    ),
  },
];

/** Fades and slides a rail item in from the left, `at` onwards. */
const enter = (frame: number, at: number) => {
  const t = easeOutCubic(prog(frame, at, at + 7));
  return { opacity: t, transform: `translateX(${(1 - t) * -10}px)` };
};

/**
 * The icon rail (`.rail`): logo tile, the Filters / Squad / Quests / Settings tabs with Squad selected
 * (its dot says the room is connected, Quests carries the to-do count), and the Overlay and Opacity
 * actions at the bottom. `x` = left edge (it slides in from -64), `height` = down to the status bar.
 */
export const Rail = ({ x, height }: { x: number; height: number }) => {
  const frame = useCurrentFrame();
  const logo = pop(frame, 361);
  const selected = easeOutCubic(prog(frame, 365, 372));
  const dot = pop(frame, 368);
  const badge = pop(frame, 370);
  return (
    <nav
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: RAIL_W,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "12px 0 10px",
        background: RAIL_BG,
        borderRight: `1px solid ${C.raised2}`,
        // a soft edge while it slides over the map
        boxShadow: `6px 0 18px rgba(0, 0, 0, ${0.35 * (1 - prog(frame, 364, 376))})`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          marginBottom: 10,
          borderRadius: 9,
          display: "grid",
          placeItems: "center",
          flex: "none",
          background: C.amber,
          color: C.onAmber,
          transform: `scale(${logo})`,
          boxShadow: `0 0 ${14 * clamp(1 - prog(frame, 364, 380))}px rgba(240, 180, 41, 0.55)`,
        }}
      >
        <Glyph size={18} sw={1.8}>
          <circle cx="8" cy="8" r="4" />
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
        </Glyph>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {TABS.map((t, i) => {
          const on = t.id === "squad";
          return (
            <div
              key={t.id}
              style={{
                position: "relative",
                width: 54,
                height: 54,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                borderRadius: 10,
                fontSize: 11,
                fontWeight: on ? 600 : 500,
                lineHeight: "normal",
                color: on ? `color-mix(in srgb, ${C.amber} ${Math.round(100 * selected)}%, ${C.muted})` : C.muted,
                ...enter(frame, 362 + i),
              }}
            >
              {on && (
                <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: C.amberSoft, opacity: selected, transform: `scale(${0.85 + 0.15 * selected})` }} />
              )}
              <div style={{ position: "relative" }}>
                <Glyph size={18} sw={1.4}>
                  {t.glyph}
                </Glyph>
              </div>
              <span style={{ position: "relative" }}>{t.label}</span>
              {on && dot > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 12,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: `2px solid ${RAIL_BG}`,
                    background: C.ok,
                    transform: `scale(${dot})`,
                  }}
                />
              )}
              {t.id === "quests" && badge > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 5,
                    right: 7,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 8,
                    background: C.amber,
                    color: C.onAmber,
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: "16px",
                    textAlign: "center",
                    transform: `scale(${badge})`,
                  }}
                >
                  3
                </span>
              )}
            </div>
          );
        })}
      </div>
      <span style={{ flex: 1 }} />
      <RailAction label="F5" style={enter(frame, 367)}>
        <Glyph size={15} sw={1.5}>
          <rect x="1.5" y="4.5" width="9" height="9" />
          <path d="M5.5 4.5v-3h9v9h-3" />
        </Glyph>
      </RailAction>
      <RailAction label="100%" style={enter(frame, 368)}>
        <svg viewBox="0 0 16 16" width={14} height={14} style={{ display: "block", flex: "none" }} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth={1.5} />
          <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
        </svg>
      </RailAction>
    </nav>
  );
};

/** `.rail-action`: the outlined buttons at the foot of the rail, with the hotkey (or value) under the icon. */
const RailAction = ({ label, style, children }: { label: string; style: { opacity: number; transform: string }; children: ReactNode }) => (
  <div
    style={{
      width: 54,
      height: 44,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      flex: "none",
      color: C.fg2,
      border: `1px solid ${C.line2}`,
      borderRadius: 10,
      ...style,
    }}
  >
    {children}
    <span style={{ fontFamily: MONO, fontSize: 10, lineHeight: "normal" }}>{label}</span>
  </div>
);
