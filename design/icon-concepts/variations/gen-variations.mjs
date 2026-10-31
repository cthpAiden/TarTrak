// Variations of concepts 10 (Field map) and 12 (Compass rose), 512 x 512 SVGs plus a preview page.
// Usage: node design/icon-concepts/variations/gen-variations.mjs [outDir]  (default: this folder)
// Shared helpers are copied from ../gen-icons.mjs, which writes files on import.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));
mkdirSync(out, { recursive: true });

const f = (n) => +n.toFixed(2);
const rad = (d) => (d * Math.PI) / 180;

// ---------- shared defs (same as gen-icons.mjs) ----------
const AMBER = `<linearGradient id="a" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#ffd877"/><stop offset=".5" stop-color="#f0b429"/><stop offset="1" stop-color="#bd7c06"/></linearGradient>`;
const TILE = `<linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b323c"/><stop offset="1" stop-color="#0a0d11"/></linearGradient><linearGradient id="te" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="tc"><rect x="24" y="24" width="464" height="464" rx="104"/></clipPath>`;
const SHADOW = `<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity=".5"/></filter>`;
const halo = (id, c, o) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const grad = (id, stops, x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join("")}</linearGradient>`;
const DIAL = `<radialGradient id="dk" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#262d36"/><stop offset="1" stop-color="#0c0f13"/></radialGradient>`;

const tile = (fill = "url(#t)") =>
  `<rect x="24" y="24" width="464" height="464" rx="104" fill="${fill}"/><rect x="25.5" y="25.5" width="461" height="461" rx="102.5" fill="none" stroke="url(#te)" stroke-width="3"/>`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${defs}</defs>${body}</svg>\n`;
const scaleAt = (s, cx = 256, cy = 256) => `translate(${cx} ${cy}) scale(${s}) translate(-256 -256)`;

function dropPath(R, deg) {
  const d = 1.6 * R, a = Math.acos(1 / 1.6) * (180 / Math.PI);
  const tip = [d * Math.cos(rad(deg)), d * Math.sin(rad(deg))];
  const p1 = [R * Math.cos(rad(deg + a)), R * Math.sin(rad(deg + a))];
  const p2 = [R * Math.cos(rad(deg - a)), R * Math.sin(rad(deg - a))];
  return `M${f(tip[0])} ${f(tip[1])}L${f(p1[0])} ${f(p1[1])}A${R} ${R} 0 1 1 ${f(p2[0])} ${f(p2[1])}Z`;
}
const arc = (r, a0, a1) =>
  `M${f(r * Math.cos(rad(a0)))} ${f(r * Math.sin(rad(a0)))}A${r} ${r} 0 0 1 ${f(r * Math.cos(rad(a1)))} ${f(r * Math.sin(rad(a1)))}`;
function drop({ x, y, R = 118, deg = -45, fill = "url(#a)", hole = "#12151a", hl = true, stroke = "", holeR = 0.39, centred = true }) {
  const off = centred && deg === -45 ? 0.0657 * R : 0;
  const tx = f(x - off), ty = f(y + off);
  return `<g transform="translate(${tx} ${ty})"><path d="${dropPath(R, deg)}" fill="${fill}"${stroke}/>${
    hl ? `<path d="${arc(R * 0.86, 192, 246)}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="${f(R * 0.075)}" stroke-linecap="round"/>` : ""
  }${hole ? `<circle r="${f(R * holeR + R * 0.035)}" fill="#000" opacity=".22"/><circle r="${f(R * holeR)}" fill="${hole}"/>` : ""}</g>`;
}

const icons = [];
const add = (file, name, note, defs, body) => icons.push({ file, name, note, svg: svg(defs, body) });

// ================= FIELD MAP =================
const PANELS = ["60,140 196,108 196,404 60,436", "196,108 316,140 316,436 196,404", "316,140 452,108 452,404 316,436"];
const PAPER = grad("p1", [[0, "#f3eedf"], [1, "#ddd5bf"]], 1, 0) + grad("p2", [[0, "#b2aa92"], [1, "#d3cbb4"]], 1, 0);
const DARKP = grad("p1", [[0, "#323a45"], [1, "#262d36"]], 1, 0) + grad("p2", [[0, "#161a20"], [1, "#222830"]], 1, 0);
const AMBERP = grad("p1", [[0, "#ffd877"], [1, "#f0b429"]], 1, 0) + grad("p2", [[0, "#a86c04"], [1, "#d89a14"]], 1, 0);
const clipPanels = `<clipPath id="mc">${PANELS.map((p) => `<polygon points="${p}"/>`).join("")}</clipPath>`;

// The folded map from concept 10, with every colour exposed. `pin` is drawn last.
function fieldMap({ water = "#9dbabd", contour = "#b0a68a", road = "#c98d5a", route = "#2a2f36", crease = [".55", ".12"], pin, routeOn = true, details = true }) {
  return `<g filter="url(#s)"><polygon points="${PANELS[0]}" fill="url(#p1)"/><polygon points="${PANELS[1]}" fill="url(#p2)"/><polygon points="${PANELS[2]}" fill="url(#p1)"/></g>` +
    `<g clip-path="url(#mc)">${details ? `<path d="M66 300C110 280 150 320 132 362C112 404 70 392 62 362Z" fill="${water}" opacity=".75"/>` : ""}` +
    `<g fill="none" stroke="${contour}" stroke-width="3"><path d="M40 180C140 140 250 210 350 170S460 140 480 150"/><path d="M40 222C140 182 240 262 340 212S470 182 480 202"/><path d="M40 262C150 232 230 302 340 252S460 232 480 242"/></g>` +
    `${details ? `<path d="M40 410C160 370 260 390 480 310" fill="none" stroke="${road}" stroke-opacity=".75" stroke-width="6"/>` : ""}</g>` +
    `<path d="M196 108V404" stroke="#fff" stroke-opacity="${crease[0]}" stroke-width="2"/><path d="M316 140V436" stroke="#000" stroke-opacity="${crease[1]}" stroke-width="2"/>` +
    (routeOn ? `<polyline points="100,380 170,322 250,342 328,254 372,214" fill="none" stroke="${route}" stroke-width="7" stroke-dasharray="16 11" stroke-linecap="round" stroke-linejoin="round"/><circle cx="100" cy="380" r="10" fill="none" stroke="${route}" stroke-width="5"/>` : "") +
    pin;
}
const mapPin = (o = {}) => `<g filter="url(#s)">${drop({ x: 388, y: 170, R: 60, stroke: ` stroke="#12151a" stroke-width="9" stroke-linejoin="round"`, ...o })}</g>`;

add("F1-map-tile.svg", "Map on tile", "Concept 10 placed on the dark app tile, so it sits with the rest of the set.",
  TILE + AMBER + SHADOW + PAPER + clipPanels + halo("g", "#f0b429", 0.22),
  tile() + `<circle cx="256" cy="262" r="215" fill="url(#g)"/><g transform="${scaleAt(0.8, 256, 268)}">${fieldMap({ pin: mapPin() })}</g>`);

add("F2-night-map.svg", "Night map", "Dark slate paper with amber contours and route. Reads as a tactical overlay.",
  TILE + AMBER + SHADOW + DARKP + clipPanels + halo("g", "#f0b429", 0.2),
  tile() + `<circle cx="256" cy="262" r="215" fill="url(#g)"/><g transform="${scaleAt(0.8, 256, 268)}">${fieldMap({
    water: "#2d5a63", contour: "#f0b429", road: "#7d8794", route: "#ffd877", crease: [".12", ".35"],
    pin: mapPin({ stroke: ` stroke="#0c0f13" stroke-width="9" stroke-linejoin="round"` }),
  }).replace('stroke="#f0b429" stroke-width="3"', 'stroke="#f0b429" stroke-opacity=".45" stroke-width="3"')}</g>`);

add("F3-amber-map.svg", "Amber map", "Map paper in the brand amber, dark route and pin. Strongest colour at small sizes.",
  TILE + SHADOW + AMBERP + clipPanels,
  tile() + `<g transform="${scaleAt(0.8, 256, 268)}">${fieldMap({
    water: "#bd7c06", contour: "#8a5a04", road: "#7a4f03", route: "#12151a", crease: [".45", ".2"],
    pin: mapPin({ fill: "#12151a", hole: "#f0b429", hl: false, stroke: ` stroke="#f0b429" stroke-width="9" stroke-linejoin="round"` }),
  })}</g>`);

add("F4-bold-map.svg", "Bold map", "Detail stripped down, bigger pin and thicker route, built to survive 16 to 32 px.",
  TILE + AMBER + SHADOW + PAPER + clipPanels,
  tile() + `<g transform="${scaleAt(0.8, 256, 268)}">${fieldMap({ details: false, routeOn: false, pin: "" })}` +
  `<polyline points="104,384 196,300 300,340 352,262" fill="none" stroke="#2a2f36" stroke-width="16" stroke-dasharray="26 18" stroke-linecap="round" stroke-linejoin="round"/>` +
  `${mapPin({ x: 372, y: 196, R: 82, stroke: ` stroke="#12151a" stroke-width="12" stroke-linejoin="round"` })}</g>`);

// Flat top-down sheet, no folds.
add("F5-grid-sheet.svg", "Grid sheet", "Flat, unfolded sheet with a map grid; route ends at the pin.",
  TILE + AMBER + SHADOW + grad("ps", [[0, "#f3eedf"], [1, "#d8cfb6"]]) + `<clipPath id="sh"><rect x="92" y="92" width="328" height="328" rx="18" transform="rotate(-6 256 256)"/></clipPath>`,
  tile() + `<g filter="url(#s)"><rect x="92" y="92" width="328" height="328" rx="18" fill="url(#ps)" transform="rotate(-6 256 256)"/></g>` +
  `<g clip-path="url(#sh)"><g transform="rotate(-6 256 256)" stroke="#b0a68a" stroke-width="2.5" fill="none"><path d="M174 92V420M256 92V420M338 92V420M92 174H420M92 256H420M92 338H420"/></g>` +
  `<path d="M70 300C130 270 200 330 260 300S360 230 440 250" fill="none" stroke="#9dbabd" stroke-width="22" opacity=".7"/></g>` +
  `<polyline points="140,372 206,318 262,346 330,258" fill="none" stroke="#2a2f36" stroke-width="9" stroke-dasharray="18 12" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<g filter="url(#s)">${drop({ x: 352, y: 196, R: 66, stroke: ` stroke="#12151a" stroke-width="9" stroke-linejoin="round"` })}</g>`);

// ================= COMPASS ROSE =================
const pt = (tip, s1, s2, light, dark) =>
  `<polygon points="${tip} ${s1} 256,256" fill="${light}"/><polygon points="${tip} 256,256 ${s2}" fill="${dark}"/>`;
const NORTH = ["#ffe08c", "#c27f06"], SILVER = ["#e8eaed", "#8b95a1"], STEEL = ["#7d8794", "#4a525d"];
// 8-point rose from concept 12. Colours per point group.
const rose8 = ({ n = NORTH, card = SILVER, ord = STEEL, hub = `<circle cx="256" cy="256" r="15" fill="#12151a" stroke="#c5ccd5" stroke-width="4"/>` } = {}) =>
  pt("329.5,182.5", "256,232", "280,256", ...ord) + pt("329.5,329.5", "280,256", "256,280", ...ord) +
  pt("182.5,329.5", "256,280", "232,256", ...ord) + pt("182.5,182.5", "232,256", "256,232", ...ord) +
  pt("426,256", "280,232", "280,280", ...card) + pt("256,426", "280,280", "232,280", ...card) +
  pt("86,256", "232,280", "232,232", ...card) + pt("256,84", "232,232", "280,232", ...n) + hub;
// 4-point rose, longer and wider.
const rose4 = ({ n = NORTH, card = SILVER } = {}) =>
  pt("256,62", "222,222", "290,222", ...n) + pt("450,256", "290,222", "290,290", ...card) +
  pt("256,450", "290,290", "222,290", ...card) + pt("62,256", "222,290", "222,222", ...card);
const dial = (r = 198) =>
  `<circle cx="256" cy="256" r="${r}" fill="url(#dk)"/><circle cx="256" cy="256" r="${r}" fill="none" stroke="#3d4652" stroke-width="5"/>`;
const ticks = (r, n, len, w, color, op = 1) =>
  `<circle cx="256" cy="256" r="${r}" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="${len}" stroke-dasharray="${w} ${f((2 * Math.PI * r) / n - w)}" transform="rotate(-90 256 256)"/>`;

add("C1-amber-rose.svg", "Amber rose", "Concept 12 with the whole rose in amber; north brightest, intercardinals darkest.",
  TILE + DIAL + halo("g", "#f0b429", 0.18),
  tile() + `<circle cx="256" cy="256" r="215" fill="url(#g)"/>` + dial() + ticks(182, 72, 10, 2, "#f0b429", 0.45) +
  rose8({ n: ["#fff1c4", "#e0a018"], card: ["#f0b429", "#a86c04"], ord: ["#8a5a04", "#5c3c02"], hub: `<circle cx="256" cy="256" r="15" fill="#12151a" stroke="#ffd877" stroke-width="4"/>` }));

add("C2-four-point.svg", "Four point", "Four long points only, no dial. Simplest silhouette, best at 16 px.",
  TILE + SHADOW + halo("g", "#f0b429", 0.22),
  tile() + `<circle cx="256" cy="256" r="215" fill="url(#g)"/><g filter="url(#s)">${rose4()}</g><circle cx="256" cy="256" r="18" fill="#12151a" stroke="#c5ccd5" stroke-width="5"/>`);

add("C3-drop-hub.svg", "Drop hub", "Rose with the brand drop as its centre; the drop's point is north.",
  TILE + AMBER + DIAL + SHADOW,
  tile() + dial() + ticks(182, 72, 10, 2, "#8b95a1", 0.5) +
  rose8({ n: SILVER, hub: "" }).replace(/<polygon points="256,84[^]*$/, "") +
  `<g filter="url(#s)">${drop({ x: 256, y: 270, R: 62, deg: -90, centred: false })}</g>`);

add("C4-heading-dial.svg", "Heading dial", "Bezel with N marker and degree ticks; an amber drop points the heading.",
  TILE + AMBER + DIAL + SHADOW,
  tile() + dial() + ticks(184, 72, 12, 2, "#8b95a1", 0.45) + ticks(181, 8, 18, 5, "#c5ccd5", 0.8) +
  `<polygon points="256,40 238,72 274,72" fill="url(#a)"/>` +
  `<text x="256" y="128" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="44" fill="#f0b429">N</text>` +
  `<g fill="#8b95a1" font-family="system-ui,sans-serif" font-weight="700" font-size="34" text-anchor="middle"><text x="400" y="268">E</text><text x="256" y="410">S</text><text x="112" y="268">W</text></g>` +
  `<g filter="url(#s)">${drop({ x: 256, y: 256, R: 74 })}</g>`);

add("C5-inverse.svg", "Inverse", "Amber tile with a dark rose; the counterpart to Stencil TT's colour scheme.",
  AMBER + SHADOW + grad("ti", [[0, "#ffd877"], [0.5, "#f0b429"], [1, "#bd7c06"]]) + `<linearGradient id="te" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
  tile("url(#ti)") + `<circle cx="256" cy="256" r="182" fill="none" stroke="#12151a" stroke-opacity=".35" stroke-width="10" stroke-dasharray="2 13.88"/>` +
  `<g filter="url(#s)">${rose8({ n: ["#ffffff", "#c5ccd5"], card: ["#2a313b", "#12151a"], ord: ["#5c3c02", "#3d2801"], hub: `<circle cx="256" cy="256" r="15" fill="#f0b429" stroke="#12151a" stroke-width="5"/>` })}</g>`);

// ================= HYBRIDS =================
add("H1-rose-on-map.svg", "Rose on map", "Night-map contours inside the dial, rose on top. Mixes both picks.",
  TILE + DIAL + `<clipPath id="dc"><circle cx="256" cy="256" r="196"/></clipPath>`,
  tile() + dial() +
  `<g clip-path="url(#dc)" fill="none" stroke="#f0b429" stroke-opacity=".22" stroke-width="4"><path d="M40 150C140 110 250 180 350 140S460 110 480 120"/><path d="M40 200C140 160 240 240 340 190S470 160 480 180"/><path d="M40 330C150 300 230 370 340 320S460 300 480 310"/><path d="M40 380C150 350 230 420 340 370S460 350 480 360"/></g>` +
  ticks(182, 72, 10, 2, "#8b95a1", 0.5) + rose8());

add("H2-map-rose.svg", "Map with rose", "The folded field map with a compass rose stamped in the corner instead of a pin.",
  TILE + AMBER + SHADOW + PAPER + clipPanels + DIAL,
  tile() + `<g transform="${scaleAt(0.8, 256, 268)}">${fieldMap({ pin: "" })}</g>` +
  `<g filter="url(#s)"><g transform="translate(360 168) scale(.42) translate(-256 -256)">${dial(206)}${rose8()}</g></g>`);

// ---------- write ----------
for (const i of icons) writeFileSync(join(out, i.file), i.svg);
const ref = [{ file: "../10-field-map.svg", name: "Field map (original 10)", note: "" }, { file: "../12-compass-rose.svg", name: "Compass rose (original 12)", note: "" }];
const all = [...ref, ...icons];
const sizes = [64, 32, 24, 16];
const card = (i) => `<figure><img src="${i.file}" width="200" height="200"><figcaption><b>${i.file.startsWith("..") ? "" : i.file.split("-")[0] + " "}${i.name}</b><br>${i.note}</figcaption>
<div class="row dark">${sizes.map((s) => `<img src="${i.file}" width="${s}" height="${s}">`).join("")}</div>
<div class="row light">${sizes.map((s) => `<img src="${i.file}" width="${s}" height="${s}">`).join("")}</div></figure>`;
writeFileSync(join(out, "preview.html"), `<!doctype html><meta charset="utf-8"><title>Icon variations</title>
<style>body{margin:0;padding:24px;background:#181b20;color:#cfd5dc;font:13px system-ui}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
figure{margin:0;background:#22262d;border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px}figcaption{align-self:flex-start;min-height:48px;line-height:1.35}
.row{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:76px;border-radius:8px}.dark{background:#202020}.light{background:#f3f3f3}</style>
<main>${all.map(card).join("")}</main>`);
console.log(`wrote ${icons.length} icons to ${out}`);
