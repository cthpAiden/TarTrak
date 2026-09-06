// Refresh data/floorBounds.json: per-building rectangles for the floor layers whose extents tarkov.dev
// leaves unbounded, traced from the floor drawings in its map SVGs. Run when data/maps.json changes.
//
// Shoreline's "2nd Floor" is "anything between -1 and 2 m" over the whole map, which would put a
// hillside at that height on the resort's 2nd floor. The SVG's Second_Floor group only draws the
// buildings that have one, so the boxes of its shapes, merged where they touch, say where the floor is.
import { writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import maps from "../data/maps.json" with { type: "json" };

/** Shapes closer than this (metres) belong to one building. */
const GAP = 6;

/** Every coordinate a path names, control points included; their box contains the path. */
function pathPoints(d) {
  const pts = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let cmd = "";
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let i = 0;
  const take = (n) => {
    const out = [];
    for (let k = 0; k < n; k++) out.push(parseFloat(tokens[i++]));
    return out;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();
    if (c === "Z") {
      cx = sx;
      cy = sy;
      continue;
    }
    if (c === "M" || c === "L" || c === "T") {
      const [x, y] = take(2);
      cx = rel ? cx + x : x;
      cy = rel ? cy + y : y;
      if (c === "M") {
        sx = cx;
        sy = cy;
        cmd = rel ? "l" : "L";
      }
      pts.push([cx, cy]);
    } else if (c === "H") {
      const [x] = take(1);
      cx = rel ? cx + x : x;
      pts.push([cx, cy]);
    } else if (c === "V") {
      const [y] = take(1);
      cy = rel ? cy + y : y;
      pts.push([cx, cy]);
    } else if (c === "C" || c === "S" || c === "Q") {
      const v = take(c === "C" ? 6 : 4);
      for (let k = 0; k < v.length; k += 2) pts.push([rel ? cx + v[k] : v[k], rel ? cy + v[k + 1] : v[k + 1]]);
      [cx, cy] = pts[pts.length - 1];
    } else if (c === "A") {
      const v = take(7);
      cx = rel ? cx + v[5] : v[5];
      cy = rel ? cy + v[6] : v[6];
      pts.push([cx, cy]);
    } else {
      throw new Error(`unsupported path command ${cmd}`);
    }
  }
  return pts;
}

const multiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** translate / scale / matrix, the only transforms these files use. */
function parseTransform(t) {
  let m = [1, 0, 0, 1, 0, 0];
  for (const [, fn, args] of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = args.trim().split(/[\s,]+/).map(Number);
    if (fn === "translate") m = multiply(m, [1, 0, 0, 1, v[0], v[1] ?? 0]);
    else if (fn === "scale") m = multiply(m, [v[0], 0, 0, v[1] ?? v[0], 0, 0]);
    else if (fn === "matrix") m = multiply(m, v);
    else throw new Error(`unsupported transform ${fn}`);
  }
  return m;
}

function shapePoints(el) {
  const n = (a) => parseFloat(el.getAttribute(a) ?? "0");
  switch (el.tagName.toLowerCase()) {
    case "path":
      return pathPoints(el.getAttribute("d") ?? "");
    case "rect":
      return [[n("x"), n("y")], [n("x") + n("width"), n("y") + n("height")]];
    case "circle":
      return [[n("cx") - n("r"), n("cy") - n("r")], [n("cx") + n("r"), n("cy") + n("r")]];
    case "ellipse":
      return [[n("cx") - n("rx"), n("cy") - n("ry")], [n("cx") + n("rx"), n("cy") + n("ry")]];
    case "polygon":
    case "polyline": {
      const v = (el.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number);
      const p = [];
      for (let k = 0; k + 1 < v.length; k += 2) p.push([v[k], v[k + 1]]);
      return p;
    }
    default:
      return null;
  }
}

/** Boxes [minX, minY, maxX, maxY] of every shape drawn under `group`, in SVG units. */
function shapeBoxes(doc, group) {
  const boxes = [];
  const walk = (el, m) => {
    const t = el.getAttribute("transform");
    const mm = t ? multiply(m, parseTransform(t)) : m;
    if (el.tagName.toLowerCase() === "use") {
      const ref = (el.getAttribute("href") ?? el.getAttribute("xlink:href") ?? "").slice(1);
      const target = ref && doc.getElementById(ref);
      if (target) walk(target, multiply(mm, [1, 0, 0, 1, parseFloat(el.getAttribute("x") ?? "0"), parseFloat(el.getAttribute("y") ?? "0")]));
      return;
    }
    const pts = shapePoints(el);
    if (pts) {
      if (pts.length === 0) return;
      const tp = pts.map((p) => apply(mm, p));
      boxes.push([Math.min(...tp.map((p) => p[0])), Math.min(...tp.map((p) => p[1])), Math.max(...tp.map((p) => p[0])), Math.max(...tp.map((p) => p[1]))]);
      return;
    }
    for (const c of el.children) walk(c, mm);
  };
  walk(group, [1, 0, 0, 1, 0, 0]);
  return boxes;
}

/** SVG unit (u, v) -> game (x, z): L.svgOverlay stretches the viewBox over the map bounds in pixel space. */
function svgToGame(def, viewBox) {
  const [scaleX, marginX, scaleY, marginY] = def.transform;
  const a = ((def.coordinateRotation ?? 0) * Math.PI) / 180;
  const project = (x, z) => {
    const lat = x * Math.sin(a) + z * Math.cos(a);
    const lng = x * Math.cos(a) - z * Math.sin(a);
    return [scaleX * lng + marginX, -scaleY * lat + marginY];
  };
  const [[x1, z1], [x2, z2]] = def.bounds;
  const p1 = project(x1, z1);
  const p2 = project(x2, z2);
  const pxMin = Math.min(p1[0], p2[0]);
  const pxMax = Math.max(p1[0], p2[0]);
  const pyMin = Math.min(p1[1], p2[1]);
  const pyMax = Math.max(p1[1], p2[1]);
  const [vx, vy, vw, vh] = viewBox;
  return (u, v) => {
    const px = pxMin + ((u - vx) / vw) * (pxMax - pxMin);
    const py = pyMin + ((v - vy) / vh) * (pyMax - pyMin);
    const lng1 = (px - marginX) / scaleX;
    const lat1 = (py - marginY) / -scaleY;
    const lat = lng1 * Math.sin(-a) + lat1 * Math.cos(-a);
    const lng = lng1 * Math.cos(-a) - lat1 * Math.sin(-a);
    return [lng, lat];
  };
}

/** Union rectangles that overlap or come within `gap` of each other, until none do. */
function merge(rects, gap) {
  const out = rects.map((r) => [...r]);
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (a[0] - gap <= b[2] && b[0] - gap <= a[2] && a[1] - gap <= b[3] && b[1] - gap <= a[3]) {
          out[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
          out.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return out;
}

const result = {};
for (const group of maps) {
  for (const def of group.maps) {
    if (def.projection !== "interactive" || !def.svgPath) continue;
    const layers = (def.layers ?? []).filter((l) => l.svgLayer && (l.extents ?? []).some((e) => !e.bounds));
    if (layers.length === 0) continue;
    const res = await fetch(def.svgPath);
    if (!res.ok) {
      console.error(`GET ${def.svgPath} -> ${res.status}`);
      process.exit(1);
    }
    const doc = new JSDOM(await res.text(), { contentType: "image/svg+xml" }).window.document;
    const viewBox = doc.documentElement.getAttribute("viewBox").split(/[\s,]+/).map(Number);
    const toGame = svgToGame(def, viewBox);
    result[def.key] = {};
    for (const layer of layers) {
      const g = doc.getElementById(layer.svgLayer);
      if (!g) {
        console.error(`${def.key}: no <g id="${layer.svgLayer}"> in ${def.svgPath}`);
        process.exit(1);
      }
      const rects = shapeBoxes(doc, g).map((box) => {
        const [ax, az] = toGame(box[0], box[1]);
        const [bx, bz] = toGame(box[2], box[3]);
        return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)];
      });
      const merged = merge(rects, GAP);
      result[def.key][layer.name] = merged.map((r) => [
        [+r[0].toFixed(1), +r[1].toFixed(1)],
        [+r[2].toFixed(1), +r[3].toFixed(1)],
      ]);
      console.log(`${def.key} / ${layer.name}: ${rects.length} shapes -> ${merged.length} buildings`);
    }
  }
}
// One building per line, so a diff after a rerun reads.
const lines = ["{"];
const mapKeys = Object.keys(result);
mapKeys.forEach((k, i) => {
  lines.push(`  ${JSON.stringify(k)}: {`);
  const layers = Object.keys(result[k]);
  layers.forEach((l, j) => {
    const rects = result[k][l];
    lines.push(`    ${JSON.stringify(l)}: [`);
    rects.forEach((r, n) => lines.push(`      ${JSON.stringify(r)}${n < rects.length - 1 ? "," : ""}`));
    lines.push(`    ]${j < layers.length - 1 ? "," : ""}`);
  });
  lines.push(`  }${i < mapKeys.length - 1 ? "," : ""}`);
});
lines.push("}");
writeFileSync("data/floorBounds.json", lines.join("\n") + "\n");
