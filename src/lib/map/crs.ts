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

/**
 * Where a game heading points on the drawn map, in degrees clockwise from screen-up. Yaw 0 faces +z
 * (markers.ts), but a map's rotation and axes can turn that anywhere: on a 180° map it points down.
 */
export function screenBearing(def: MapDef, yaw: number): number {
  const crs = makeCrs(def);
  const rad = (yaw * Math.PI) / 180;
  const from = crs.latLngToPoint(toLatLng(0, 0), 0);
  const to = crs.latLngToPoint(toLatLng(Math.sin(rad), Math.cos(rad)), 0);
  return (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
}

export function boundsOf(def: MapDef): L.LatLngBounds {
  const [[x1, z1], [x2, z2]] = def.bounds;
  return L.latLngBounds([z1, x1], [z2, x2]);
}
