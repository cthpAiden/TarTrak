import L from "leaflet";
import type { MapDef } from "./mapsData";

function rotate(latLng: L.LatLng, degrees: number): L.LatLng {
  if (!degrees || (latLng.lat === 0 && latLng.lng === 0)) return latLng;
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const x = latLng.lng;
  const y = latLng.lat;
  return L.latLng(x * sin + y * cos, x * cos - y * sin);
}

/** Leaflet CRS for one map: game (x, z) -> pixel via maps.json transform and rotation. */
export function makeCrs(def: MapDef): L.CRS {
  const [scaleX, marginX, scaleYRaw, marginY] = def.transform;
  const rotation = def.coordinateRotation;
  const projection: L.Projection = {
    project: (latLng) => L.Projection.LonLat.project(rotate(L.latLng(latLng), rotation)),
    unproject: (point) => rotate(L.Projection.LonLat.unproject(point), -rotation),
    bounds: L.Projection.LonLat.bounds,
  };
  return L.extend({}, L.CRS.Simple, {
    projection,
    transformation: new L.Transformation(scaleX, marginX, -scaleYRaw, marginY),
  }) as L.CRS;
}

/** Game coordinates to Leaflet LatLng: lat = z, lng = x. */
export function toLatLng(x: number, z: number): L.LatLng {
  return L.latLng(z, x);
}

export function boundsOf(def: MapDef): L.LatLngBounds {
  const [[x1, z1], [x2, z2]] = def.bounds;
  return L.latLngBounds([z1, x1], [z2, x2]);
}
