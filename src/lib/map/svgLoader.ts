export interface LoadedSvg {
  element: SVGSVGElement;
  groupIds: string[];
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** jsdom has no CSS.escape. */
const esc = (s: string) =>
  typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, "\$&");

/** Wrap fetched SVG text in a fresh <svg>, copying its viewBox; top-level <g id> are floor groups. */
export function buildSvgElement(svgText: string): LoadedSvg {
  const element = document.createElementNS(SVG_NS, "svg");
  element.setAttribute("xmlns", SVG_NS);
  element.innerHTML = svgText;
  const inner = element.children[0];
  const viewBox = inner?.getAttribute("viewBox");
  if (viewBox) element.setAttribute("viewBox", viewBox);
  const groupIds = inner
    ? [...inner.children].filter((c) => c.nodeName === "g" && !!c.id).map((c) => c.id)
    : [];
  return { element, groupIds };
}

/** Base group is always shown (dimmed when a floor is up); the chosen floor is shown; the rest hidden. */
export function showFloor(svg: LoadedSvg, baseGroup: string | undefined, floorGroup: string | null): void {
  const inner = svg.element.children[0];
  if (!inner) return;
  for (const id of svg.groupIds) {
    const g = inner.querySelector<SVGGElement>(`#${esc(id)}`);
    if (!g) continue;
    const isBase = id === baseGroup;
    const isFloor = id === floorGroup;
    g.classList.toggle("hidden-layer", !isBase && !isFloor);
    g.classList.toggle("off-level", isBase && floorGroup !== null);
  }
}
