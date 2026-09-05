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

/** A player: filled circle plus a heading line with a fixed on-screen length. */
export class PositionMarker {
  readonly circle: L.CircleMarker;
  readonly line: L.Polyline;
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
    // Dotted and thin: a line of sight that hides as little of the map as it can.
    this.line = L.polyline([], { pane, color: style.color, weight: 2, opacity: 0.85, dashArray: "1 6", lineCap: "round" });
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
    this.circle.addTo(map);
    map.on("zoomend", this.onZoom);
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
    const tt = this.circle.getTooltip();
    if (tt) tt.setOpacity(o);
  }

  setColor(color: string): void {
    this.circle.setStyle({ fillColor: color });
    this.line.setStyle({ color });
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
  }
}
