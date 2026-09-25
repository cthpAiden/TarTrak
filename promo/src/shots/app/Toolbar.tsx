import type { CSSProperties, ReactNode } from "react";
import { spring, useCurrentFrame } from "remotion";
import { C, SPRING_POP } from "../../theme.ts";
import { clamp, easeOutCubic, prog } from "../../lib/ease.ts";
import { Icon, type IconName } from "../../components/ui.tsx";
import { BUILD, TOOLBAR } from "./motion.ts";

/** The route button fills amber as the push starts (riser from 450), after a short hover. */
const ROUTE_FILL_AT = 452;
const ROUTE_HOVER_AT = 448;

const pop = (frame: number, at: number) => (frame < at ? 0 : spring({ frame: frame - at, fps: 60, config: SPRING_POP }));

/** A toolbar item popping in at `at`: scale up from 0.4 with the spring's overshoot, dropping 6 px into place. */
const popStyle = (frame: number, at: number): CSSProperties => {
  const p = pop(frame, at);
  return { opacity: clamp(p * 2.5), transform: `translateY(${(1 - p) * -6}px) scale(${0.4 + 0.6 * p})` };
};

/** `.tool-btn`: 34 px, 7 px corners, `--fg-2` icon; pressed = amber-soft fill and amber icon. */
const ToolBtn = ({ pressed = false, style, children }: { pressed?: boolean; style?: CSSProperties; children: ReactNode }) => (
  <div
    style={{
      position: "relative",
      width: TOOLBAR.btn,
      height: TOOLBAR.btn,
      flex: "none",
      display: "grid",
      placeItems: "center",
      borderRadius: 7,
      background: pressed ? "rgba(240, 180, 41, 0.16)" : "transparent",
      color: pressed ? C.amber : C.fg2,
      ...style,
    }}
  >
    {children}
  </div>
);

const Tool = ({ icon, size = 15 }: { icon: IconName; size?: number }) => <Icon name={icon} size={size} />;

/**
 * The map toolbar (`.map-toolbar`) on the map's right edge: Overlay, Follow me (on), Route, Draw, Centre
 * on me, Fit map, a separator and the floor picker showing 1F. Its panel draws down while the buttons pop
 * in one after another (2 frames apart). Positioned in its map area: 12 px from the top-right corner.
 */
export const Toolbar = () => {
  const frame = useCurrentFrame();
  const at = (i: number) => BUILD.toolbar + 2 * i;
  // the panel unrolls at the buttons' pace (one 36 px row per 2 frames), just ahead of each pop
  const panel = prog(frame, BUILD.toolbar, BUILD.toolbar + 15);
  const hover = frame >= ROUTE_HOVER_AT && frame < ROUTE_FILL_AT;
  const filled = frame >= ROUTE_FILL_AT;
  // the click: pressed in to 86%, springing back with a little overshoot
  const press = 0.86 + 0.14 * pop(frame, ROUTE_FILL_AT);
  const glow = pop(frame, ROUTE_FILL_AT);
  const ring = prog(frame, ROUTE_FILL_AT, ROUTE_FILL_AT + 16);
  return (
    <div role="toolbar" style={{ position: "absolute", right: TOOLBAR.right, top: TOOLBAR.top, width: TOOLBAR.width }}>
      {/* the panel draws down behind the buttons */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(22, 26, 32, 0.92)",
          border: `1px solid ${C.line2}`,
          borderRadius: 10,
          clipPath: `inset(0 0 ${(1 - panel) * 100}% 0 round 10px)`,
          opacity: clamp(panel * 3),
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: TOOLBAR.gap,
          padding: TOOLBAR.pad,
          border: `${TOOLBAR.border}px solid transparent`,
        }}
      >
        <ToolBtn style={popStyle(frame, at(0))}>
          <Tool icon="overlay" />
        </ToolBtn>
        <ToolBtn pressed style={popStyle(frame, at(1))}>
          <Tool icon="follow" />
        </ToolBtn>
        {/* RoutePicker, toolbar variant (a 14 px icon); `.tool-btn:hover` for a moment, then the click */}
        <ToolBtn
          style={{
            ...popStyle(frame, at(2)),
            color: filled ? C.onAmber : hover ? C.amber : C.fg2,
            background: hover ? "rgba(255, 255, 255, 0.05)" : "transparent",
          }}
        >
          {filled && (
            <>
              {ring < 1 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 7,
                    border: `1.5px solid ${C.amber}`,
                    opacity: 0.85 * (1 - ring),
                    transform: `scale(${1 + 1.1 * easeOutCubic(ring)})`,
                    boxShadow: `0 0 8px rgba(240, 180, 41, ${0.5 * (1 - ring)})`,
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 7,
                  background: C.amber,
                  transform: `scale(${press})`,
                  boxShadow: `0 0 ${16 * glow}px ${3 * glow}px rgba(240, 180, 41, 0.45)`,
                }}
              />
            </>
          )}
          <div style={{ position: "relative", transform: filled ? `scale(${press})` : undefined }}>
            <Tool icon="route" size={14} />
          </div>
        </ToolBtn>
        <ToolBtn style={popStyle(frame, at(3))}>
          <Tool icon="draw" />
        </ToolBtn>
        <ToolBtn style={popStyle(frame, at(4))}>
          <Tool icon="centre" />
        </ToolBtn>
        <ToolBtn style={popStyle(frame, at(5))}>
          <Tool icon="fit" />
        </ToolBtn>
        <span style={{ width: 24, height: 1, margin: "4px 0", flex: "none", background: C.line2, ...popStyle(frame, at(6)) }} />
        {/* FloorPicker, toolbar variant: the layers icon over the floor's short name */}
        <div
          style={{
            width: 40,
            padding: "6px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            flex: "none",
            border: "1px solid transparent",
            borderRadius: 7,
            color: C.muted,
            ...popStyle(frame, at(6)),
          }}
        >
          <Tool icon="layers" />
          <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: "normal" }}>1F</span>
        </div>
      </div>
    </div>
  );
};
