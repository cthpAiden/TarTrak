export interface LoadedSvg {
  element: SVGSVGElement;
  groupIds: string[];
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Elements that can run script or smuggle HTML into the SVG. */
const FORBIDDEN_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "set",
  "animate",
  "animatemotion",
  "animatetransform",
]);

/**
 * Map SVGs are fetched from the network, so drop anything that could execute: script-bearing
 * elements, inline handlers, and any link target that is not a same-document fragment.
 * Note the SVG's own <style> block survives and lands in the document stylesheet scope.
 */
function sanitize(root: SVGSVGElement): void {
  for (const el of root.querySelectorAll("*")) {
    if (FORBIDDEN_ELEMENTS.has(el.nodeName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if ((name === "href" || name === "xlink:href") && !attr.value.trim().startsWith("#")) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

/** Wrap fetched SVG text in a fresh <svg>, copying its viewBox; top-level <g id> are floor groups. */
export function buildSvgElement(svgText: string): LoadedSvg {
  const element = document.createElementNS(SVG_NS, "svg");
  element.setAttribute("xmlns", SVG_NS);
  element.innerHTML = svgText;
  sanitize(element);
  const inner = element.children[0];
  const viewBox = inner?.getAttribute("viewBox");
  if (viewBox) element.setAttribute("viewBox", viewBox);
  const groupIds = inner
    ? [...inner.children].filter((c) => c.nodeName === "g" && !!c.id).map((c) => c.id)
    : [];
  return { element, groupIds };
}

/**
 * Base group is always shown (dimmed when a floor is up); the chosen floor is shown; the other
 * known floors are hidden. Groups the map definition does not mention (Customs' `First_Floor`
 * holds ground-floor interiors) are left alone — hiding them would drop real map content.
 */
export function showFloor(
  svg: LoadedSvg,
  baseGroup: string | undefined,
  floorGroup: string | null,
  knownFloorGroups: string[],
): void {
  const inner = svg.element.children[0];
  if (!inner) return;
  const known = new Set(knownFloorGroups);
  // Matched by id rather than by selector: ids like "4th_Floor" are not valid CSS selectors.
  for (const g of inner.children) {
    if (g.nodeName !== "g" || !g.id) continue;
    const isBase = g.id === baseGroup;
    if (!isBase && !known.has(g.id)) continue;
    const isFloor = g.id === floorGroup;
    g.classList.toggle("hidden-layer", !isBase && !isFloor);
    g.classList.toggle("off-level", isBase && floorGroup !== null);
  }
}
