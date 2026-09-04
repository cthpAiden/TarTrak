import L from "leaflet";
import { toLatLng } from "./crs";

export interface MarkerStyle {
  color: string;
  radius: number;
  lineLengthPx: number;
  label?: string;
}

/** A player: filled circle plus a heading line with a fixed on-screen length. */
export class PositionMarker {
  readonly circle: L.CircleMarker;
  readonly line: L.Polyline;
  private x = 0;
  private z = 0;
  private yaw = 0;
  private readonly onZoom = () => this.redraw();

  constructor(
    private readonly map: L.Map,
    private readonly style: MarkerStyle,
  ) {
    this.circle = L.circleMarker([0, 0], {
      radius: style.radius,
      color: "#000",
      weight: 1.5,
      fillColor: style.color,
      fillOpacity: 1,
      opacity: 1,
    });
    this.line = L.polyline([], { color: style.color, weight: 3, opacity: 1, lineCap: "round" });
    if (style.label) {
      this.circle.bindTooltip(style.label, {
        permanent: true,
        direction: "top",
        offset: [0, -8],
        className: "tt-label",
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

  remove(): void {
    this.map.off("zoomend", this.onZoom);
    this.circle.remove();
    this.line.remove();
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
  }
}
