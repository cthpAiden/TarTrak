import type { ReactNode } from "react";
import { C } from "../theme.ts";
import { clamp, easeOutCubic } from "../lib/ease.ts";

/** The app's 16x16 stroke icons (src/App.svelte, RoutePicker, FloorPicker), plus `exit` for extracts. */
export type IconName =
  | "filters" | "squad" | "quests" | "settings" | "overlay" | "follow" | "route" | "draw"
  | "centre" | "fit" | "layers" | "clock" | "check" | "exit" | "rotation";

const STACK = (
  <>
    <path d="M8 2l6 3-6 3-6-3z" />
    <path d="M2 8l6 3 6-3" />
    <path d="M2 11l6 3 6-3" />
  </>
);

/** Paths per icon; `round` icons use round caps and joins, as they do in the app. */
const ICONS: Record<IconName, { d: ReactNode; round?: boolean }> = {
  filters: { d: STACK },
  layers: { d: STACK },
  squad: {
    d: (
      <>
        <circle cx="6" cy="5.5" r="2.5" />
        <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
        <circle cx="11.5" cy="6" r="2" />
        <path d="M11 10c2 0 3.5 1.2 3.5 3.5" />
      </>
    ),
  },
  quests: {
    d: (
      <>
        <path d="M6 4h8M6 8h8M6 12h8" />
        <path d="M2 3.5l1 1 1.5-2M2 7.5l1 1 1.5-2M2 11.5l1 1 1.5-2" />
      </>
    ),
  },
  settings: {
    d: (
      <>
        <path d="M2 4h7M12 4h2M2 12h2M7 12h7" />
        <circle cx="10.5" cy="4" r="1.5" />
        <circle cx="5.5" cy="12" r="1.5" />
        <path d="M2 8h2M7 8h7" />
        <circle cx="5.5" cy="8" r="1.5" />
      </>
    ),
  },
  overlay: {
    d: (
      <>
        <rect x="2.5" y="2.5" width="11" height="11" />
        <path d="M2.5 5.5h11" />
      </>
    ),
  },
  follow: {
    d: (
      <>
        <circle cx="8" cy="8" r="4" />
        <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
      </>
    ),
  },
  route: {
    d: (
      <>
        <path d="M6.5 2.5H2.5v11h4" />
        <path d="M6 8h7.5M11 5.5L13.5 8 11 10.5" />
      </>
    ),
  },
  draw: {
    d: (
      <>
        <path d="M3 13l1-4 7.5-7.5 3 3L7 12z" />
        <path d="M10.5 3.5l2 2" />
      </>
    ),
  },
  centre: {
    d: (
      <>
        <circle cx="8" cy="8" r="2" />
        <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
      </>
    ),
  },
  fit: { d: <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /> },
  clock: {
    d: (
      <>
        <circle cx="8" cy="8.5" r="5.5" />
        <path d="M8 5.5v3.2l2 1.3M6.5 1.5h3" />
      </>
    ),
    round: true,
  },
  check: { d: <path d="M3.5 8.5l3 3 6-7" />, round: true },
  exit: {
    d: (
      <>
        <path d="M13.5 9.5v4h-11v-11h4" />
        <path d="M9.5 2.5h4v4M13.5 2.5L7.5 8.5" />
      </>
    ),
    round: true,
  },
  // The heading-up / north-up rim button: red north half, outlined south half.
  rotation: {
    d: (
      <>
        <path d="M8 1.5l3 6.5H5z" fill={C.north} stroke="none" />
        <path d="M8 14.5l-3-6.5h6z" strokeWidth={1.3} />
      </>
    ),
  },
};

/** One of the app's icons in `currentColor`, `size` px square. */
export const Icon = ({ name, size = 16 }: { name: IconName; size?: number }) => {
  const icon = ICONS[name];
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap={icon.round ? "round" : undefined}
      strokeLinejoin={icon.round ? "round" : undefined}
      style={{ display: "block", flex: "none", overflow: "visible" }}
      aria-hidden
    >
      {icon.d}
    </svg>
  );
};

/**
 * The map toolbar's button (`.tool-btn`): transparent, `C.fg2` icon; `active` fills it amber-soft with an
 * amber icon. `round` gives the minimap's rim button (`.rim-btn`): dark disc, light hairline, amber when active.
 */
export const IconButton = ({ icon, active = false, size = 36, round = false }: { icon: IconName; active?: boolean; size?: number; round?: boolean }) => (
  <div
    style={{
      width: size,
      height: size,
      boxSizing: "border-box",
      display: "grid",
      placeItems: "center",
      flex: "none",
      ...(round
        ? {
            borderRadius: "50%",
            background: "rgba(15, 19, 24, 0.94)",
            border: `1px solid ${active ? C.amber : "rgba(255, 255, 255, 0.24)"}`,
            boxShadow: "0 1px 4px rgba(0, 0, 0, 0.5)",
            color: active ? C.amber : C.fg,
          }
        : {
            borderRadius: (7 / 34) * size,
            background: active ? "rgba(240, 180, 41, 0.16)" : "transparent",
            color: active ? C.amber : C.fg2,
          }),
    }}
  >
    <Icon name={icon} size={Math.round(size * (round ? 0.53 : 0.44))} />
  </div>
);

/**
 * The app's 16 px checkbox. `checked` 0..1 animates it: an amber fill grows out from the centre (0 to
 * 0.4, with a small pop and a glow that fades once the tick is in), then the dark check draws (0.3 to 1).
 */
export const Checkbox = ({ checked }: { checked: number }) => {
  const c = clamp(checked);
  const fill = clamp(c / 0.4);
  const draw = clamp((c - 0.3) / 0.7);
  const pop = 1 + 0.16 * Math.sin(Math.PI * clamp(c / 0.55));
  const glow = fill * (1 - draw);
  const grow = 0.25 + 0.75 * easeOutCubic(fill);
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      style={{
        display: "block",
        flex: "none",
        overflow: "visible",
        transform: `scale(${pop})`,
        filter: glow > 0 ? `drop-shadow(0 0 5px rgba(240, 180, 41, ${0.7 * glow}))` : undefined,
      }}
      aria-hidden
    >
      <rect x={0.5} y={0.5} width={15} height={15} rx={3.5} fill="#0f1216" stroke="#4a5460" />
      {fill > 0 ? (
        <rect
          x={0.5}
          y={0.5}
          width={15}
          height={15}
          rx={3.5}
          fill={C.amber}
          stroke={C.amber}
          opacity={clamp(fill * 3)}
          transform={`translate(8 8) scale(${grow}) translate(-8 -8)`}
        />
      ) : null}
      {draw > 0 ? (
        <path
          d="M3.5 8.5l3 3 6-7"
          fill="none"
          stroke={C.onAmber}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - draw}
        />
      ) : null}
    </svg>
  );
};
