import L from "leaflet";
import { toLatLng } from "./crs";
import { esc } from "../quests/questLayer";

export interface MarkerStyle {
  color: string;
  radius: number;
  lineLengthPx: number;
  label?: string;
  /** Draw a translucent field-of-view sector behind the marker. */
  cone?: boolean;
  /** Full width of that sector in degrees. */
  coneDeg?: number;
  /** Pane for every part; defaults to the shared players pane. */
  pane?: string;
}

const CONE_DEG = 60;
/** Points sampled along the arc; the sector polygon is the centre plus these. */
const CONE_STEPS = 9;
/** Sector radius as a multiple of the heading line length. */
const CONE_RADIUS = 1.6;
const CONE_FILL = 0.18;

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
  /** Null when the style has no cone; the polygon is never created in that case. */
  readonly cone: L.Polygon | null;
  private x = 0;
  private z = 0;
  private yaw = 0;
  private readonly onZoom = () => this.redraw();

  constructor(
    private readonly map: L.Map,
    private readonly style: MarkerStyle,
  ) {
    ensurePlayerPanes(map);
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
    this.line = L.polyline([], { pane, color: style.color, weight: 3, opacity: 1, lineCap: "round" });
    this.cone = style.cone ? L.polygon([], { pane, fillColor: style.color, fillOpacity: CONE_FILL, stroke: false }) : null;
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
    // Added first so the sector sits below the line and the circle.
    this.cone?.addTo(map);
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
    this.cone?.setStyle({ fillOpacity: CONE_FILL * o });
    const tt = this.circle.getTooltip();
    if (tt) tt.setOpacity(o);
  }

  setColor(color: string): void {
    this.circle.setStyle({ fillColor: color });
    this.line.setStyle({ color });
    this.cone?.setStyle({ fillColor: color });
  }

  remove(): void {
    this.map.off("zoomend", this.onZoom);
    this.circle.remove();
    this.line.remove();
    this.cone?.remove();
  }

  /**
   * End of a ray of lengthPx pixels from p0 at deg, computed in projected space so the map
   * rotation and the CRS scale are honoured and the result keeps a fixed on-screen length.
   */
  private ray(p0: L.Point, zoom: number, deg: number, lengthPx: number): L.LatLng {
    const rad = (deg * Math.PI) / 180;
    const ahead = toLatLng(this.x + Math.sin(rad), this.z + Math.cos(rad));
    const d = this.map.project(ahead, zoom).subtract(p0);
    const len = Math.hypot(d.x, d.y) || 1;
    return this.map.unproject(p0.add(d.multiplyBy(lengthPx / len)), zoom);
  }

  private redraw(): void {
    const center = this.center();
    // Heading in game space: forward = (sin yaw, cos yaw) on (x, z). Project both ends to
    // pixels so the map's rotation is honored, then fix the on-screen length. project() is used
    // rather than latLngToLayerPoint() because the latter rounds to whole pixels, which collapses
    // the one-unit lookahead at low zoom.
    const zoom = this.map.getZoom();
    const rad = (this.yaw * Math.PI) / 180;
    const ahead = toLatLng(this.x + Math.sin(rad), this.z + Math.cos(rad));
    const p0 = this.map.project(center, zoom);
    const p1 = this.map.project(ahead, zoom);
    const d = p1.subtract(p0);
    const len = Math.hypot(d.x, d.y) || 1;
    const end = p0.add(d.multiplyBy(this.style.lineLengthPx / len));
    this.circle.setLatLng(center);
    this.line.setLatLngs([center, this.map.unproject(end, zoom)]);
    if (this.cone) {
      const span = this.style.coneDeg ?? CONE_DEG;
      const radius = this.style.lineLengthPx * CONE_RADIUS;
      const arc = Array.from({ length: CONE_STEPS }, (_, i) =>
        this.ray(p0, zoom, this.yaw - span / 2 + (span * i) / (CONE_STEPS - 1), radius),
      );
      this.cone.setLatLngs([center, ...arc]);
    }
  }
}
