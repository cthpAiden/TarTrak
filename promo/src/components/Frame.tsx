import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme.ts";

export const Frame = ({ children }: { children?: ReactNode }) => (
  <AbsoluteFill style={{ background: C.deep, overflow: "hidden" }}>{children}</AbsoluteFill>
);
