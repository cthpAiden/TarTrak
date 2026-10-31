import L from "leaflet";
import { toLatLng } from "./crs";
import { OWN_PANE, PositionMarker } from "./markers";
import { trailAt } from "../raids/replay";
import type { TrailPoint } from "../raids/record";

/** One player's trail in a raid replay. */
export interface ReplayTrail {
  key: string;
  name: string;
  color: string;
  /** Mine: drawn thicker, in my own pane, without a name or age. */
  mine: boolean;
  points: TrailPoint[];
}

/** Above the point markers (600), under drawings (610) and players (620). */
const REPLAY_PANE = "replay";
const OLD_OPACITY = 0.3;

interface Part {
  color: string;
  old: L.Polyline;
  tail: L.Polyline;
  marker: PositionMarker | null;
}

/** Draws a replay at the playhead: each trail faint, its last few minutes bright, a marker where each player stood. */
export class ReplayLayer {
  private parts = new Map<string, Part>();

  constructor(
    private readonly map: L.Map,
    private readonly lineLengthM: number,
  ) {
    if (!map.getPane(REPLAY_PANE)) map.createPane(REPLAY_PANE).style.zIndex = "605";
  }

  update(trails: ReplayTrail[], at: number): void {
    const keys = new Set(trails.map((t) => t.key));
    for (const [key, part] of this.parts) {
      if (!keys.has(key)) this.drop(key, part);
    }
    for (const t of trails) {
      let part = this.parts.get(t.key);
      if (part && part.color !== t.color) {
        this.drop(t.key, part);
        part = undefined;
      }
      if (!part) part = this.add(t);
      const cut = trailAt(t.points, at);
      part.old.setLatLngs(cut.old.map((p) => toLatLng(p.x, p.z)));
      part.tail.setLatLngs(cut.tail.map((p) => toLatLng(p.x, p.z)));
      if (!cut.last) {
        part.marker?.remove();
        part.marker = null;
        continue;
      }
      if (!part.marker) {
        part.marker = new PositionMarker(this.map, {
          color: t.color,
          radius: 6,
          lineLengthM: this.lineLengthM,
          label: t.mine ? undefined : t.name,
          pane: t.mine ? OWN_PANE : undefined,
          age: !t.mine,
        });
      }
      part.marker.update(cut.last.x, cut.last.z, cut.last.yaw);
      // A teammate's capsule counts the seconds since their last position, as on the live map.
      if (!t.mine) part.marker.setAge((at - cut.last.t) / 1000);
    }
  }

  remove(): void {
    for (const [key, part] of this.parts) this.drop(key, part);
  }

  private add(t: ReplayTrail): Part {
    const style = { pane: REPLAY_PANE, color: t.color, lineJoin: "round" as const, lineCap: "round" as const, interactive: false };
    const part: Part = {
      color: t.color,
      old: L.polyline([], { ...style, weight: t.mine ? 3 : 2, opacity: OLD_OPACITY }).addTo(this.map),
      tail: L.polyline([], { ...style, weight: t.mine ? 4 : 3, opacity: 1 }).addTo(this.map),
      marker: null,
    };
    this.parts.set(t.key, part);
    return part;
  }

  private drop(key: string, part: Part): void {
    part.old.remove();
    part.tail.remove();
    part.marker?.remove();
    this.parts.delete(key);
  }
}
