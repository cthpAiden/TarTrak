import type { ReactNode } from "react";
import { MONO, SANS } from "../fonts.ts";
import { C } from "../theme.ts";

/** The app's pill (`.rim-chip`): 26 px, dark glass, hairline border, 12 px tabular mono; `color` adds a leading dot. */
export const Chip = ({ children, color, mono = true }: { children?: ReactNode; color?: string; mono?: boolean }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 26,
      boxSizing: "border-box",
      padding: color ? "0 10px 0 9px" : "0 10px",
      borderRadius: 13,
      background: "rgba(15, 19, 24, 0.86)",
      border: `1px solid ${C.line2}`,
      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.5)",
      fontFamily: mono ? MONO : SANS,
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 1,
      fontVariantNumeric: "tabular-nums",
      color: C.fg,
      whiteSpace: "nowrap",
    }}
  >
    {color ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flex: "none" }} /> : null}
    {children}
  </div>
);
