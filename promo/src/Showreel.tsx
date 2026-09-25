import { useCurrentFrame } from "remotion";
import { Frame } from "./components/Frame.tsx";
import { shotAt } from "./timeline.ts";

export const Showreel = () => {
  const frame = useCurrentFrame();
  return <Frame><div style={{ color: "white", fontSize: 60, padding: 80 }}>{shotAt(frame)}</div></Frame>;
};
