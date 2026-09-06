import L from "leaflet";
import { toLatLng } from "./crs";
import { esc } from "../quests/questLayer";

export interface MarkerStyle {
  color: string;
  radius: number;
  /** Heading line length in metres (game units), so it scales with the map like a real distance. */
  lineLengthM: number;
  label?: string;
  /** Pane for every part; defaults to the shared players pane. */
  pane?: string;
}

/**
 * Players draw in their own pane above the marker pane (600) and far above the overlay pane (400)
 * that holds the map SVG. In the shared overlay pane the map, loaded later, sat on top of the
 * vector renderer and hid every player once a floor redrew.
 */
export const PLAYER_PANE = "players";
const PLAYER_PANE_Z = "620";
/**
 * My own marker sits in a pane above the teammates and their name labels, so a squadmate standing
 * next to me can never cover my indicator. The labels themselves are kept in the players pane rather
 * than Leaflet's tooltip pane (650), which would put them above everything.
 */
export const OWN_PANE = "players-own";
const OWN_PANE_Z = "630";

function ensurePlayerPanes(map: L.Map): void {
  if (!map.getPane(PLAYER_PANE)) map.createPane(PLAYER_PANE).style.zIndex = PLAYER_PANE_Z;
  if (!map.getPane(OWN_PANE)) map.createPane(OWN_PANE).style.zIndex = OWN_PANE_Z;
}

const SVG_NS = "http://www.w3.org/2000/svg";
let gradientSeq = 0;

/** One hidden SVG per map holds the fade gradients; url(#id) resolves anywhere in the document. */
function gradientDefs(map: L.Map): SVGDefsElement {
  const container = map.getContainer();
  let svg = container.querySelector<SVGSVGElement>("svg.tt-defs");
  if (!svg) {
    svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "tt-defs");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.appendChild(document.createElementNS(SVG_NS, "defs"));
    container.appendChild(svg);
  }
  return svg.querySelector("defs")!;
}

/** A player: filled circle plus a heading line that fades out towards its far end. */
export class PositionMarker {
  readonly circle: L.CircleMarker;
  readonly line: L.Polyline;
  /** Stroke gradient from full colour at the player to transparent at the tip, in layer pixels. */
  readonly gradient: SVGLinearGradientElement;
  private readonly gradientId = `tt-fade-${++gradientSeq}`;
  private x = 0;
  private z = 0;
  private yaw = 0;
  private label: string | undefined;
  private readonly onZoom = () => this.redraw();

  constructor(
    private readonly map: L.Map,
    private readonly style: MarkerStyle,
  ) {
    ensurePlayerPanes(map);
    this.label = style.label;
    const pane = style.pane ?? PLAYER_PANE;
    this.circle = L.circleMarker([0, 0], {
      pane,
      radius: style.radius,
      color: "#000",
      weight: 1.5,
      fillColor: style.color,
      fillOpacity: 1,
      opacity: 1,
    });
    // Dashed and fading: a line of sight that hides as little of the map as it can.
    this.line = L.polyline([], { pane, color: style.color, weight: 4, opacity: 0.85, dashArray: "5 10", lineCap: "round" });
    this.gradient = document.createElementNS(SVG_NS, "linearGradient");
    this.gradient.setAttribute("id", this.gradientId);
    this.gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    // Fades to a faint tip rather than nothing, so the far end still reads as a line.
    for (const [offset, opacity] of [["0", "1"], ["1", "0.3"]]) {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", style.color);
      stop.setAttribute("stop-opacity", opacity);
      this.gradient.appendChild(stop);
    }
    gradientDefs(map).appendChild(this.gradient);
    if (style.label) {
      this.circle.bindTooltip(esc(style.label), {
        permanent: true,
        direction: "top",
        offset: [0, -8],
        className: "tt-label",
        pane,
        interactive: false,
      });
    }
    this.line.addTo(map);
    this.applyGradient();
    this.circle.addTo(map);
    map.on("zoomend", this.onZoom);
  }

  /** Leaflet resets the stroke to a flat colour on every setStyle, so the gradient goes back on after each. */
  private applyGradient(): void {
    const path = (this.line as unknown as { _path?: SVGPathElement })._path;
    path?.setAttribute("stroke", `url(#${this.gradientId})`);
  }

  update(x: number, z: number, yaw: number): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.redraw();
  }

  center(): L.LatLng {
    return toLatLng(this.x, this.z);
  }

  linePoints(): [L.LatLng, L.LatLng] {
    const pts = this.line.getLatLngs() as L.LatLng[];
    return [pts[0], pts[1]];
  }

  setOpacity(o: number): void {
    this.circle.setStyle({ opacity: o, fillOpacity: o });
    this.line.setStyle({ opacity: o });
    this.applyGradient();
    const tt = this.circle.getTooltip();
    if (tt) tt.setOpacity(o);
  }

  setColor(color: string): void {
    this.circle.setStyle({ fillColor: color });
    this.line.setStyle({ color });
    this.applyGradient();
    for (const stop of Array.from(this.gradient.children)) stop.setAttribute("stop-color", color);
  }

  /** Replaces the name label, e.g. when the teammate changes floor. No-op for a marker made without one. */
  setLabel(text: string): void {
    if (text === this.label) return;
    this.label = text;
    this.circle.getTooltip()?.setContent(esc(text));
  }

  remove(): void {
    this.map.off("zoomend", this.onZoom);
    this.circle.remove();
    this.line.remove();
    this.gradient.remove();
  }

  private redraw(): void {
    const center = this.center();
    // Heading in game space: forward = (sin yaw, cos yaw) on (x, z), so the end is a real point
    // lineLengthM metres ahead and the CRS handles the map's rotation and scale.
    const rad = (this.yaw * Math.PI) / 180;
    const len = this.style.lineLengthM;
    const end = toLatLng(this.x + Math.sin(rad) * len, this.z + Math.cos(rad) * len);
    this.circle.setLatLng(center);
    this.line.setLatLngs([center, end]);
    // Gradient axis follows the line in layer pixels; those only change on zoom, which redraws too.
    const a = this.map.latLngToLayerPoint(center);
    const b = this.map.latLngToLayerPoint(end);
    this.gradient.setAttribute("x1", String(a.x));
    this.gradient.setAttribute("y1", String(a.y));
    this.gradient.setAttribute("x2", String(b.x));
    this.gradient.setAttribute("y2", String(b.y));
  }
}
