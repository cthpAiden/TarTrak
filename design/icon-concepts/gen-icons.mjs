// Generates the TarTrak icon concept SVGs (512 x 512) plus a local preview page.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Usage: node design/icon-concepts/gen-icons.mjs [outDir]  (default: this folder)
const out = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));
mkdirSync(out, { recursive: true });

const f = (n) => +n.toFixed(2);
const rad = (d) => (d * Math.PI) / 180;

// ---------- shared defs ----------
const AMBER = `<linearGradient id="a" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#ffd877"/><stop offset=".5" stop-color="#f0b429"/><stop offset="1" stop-color="#bd7c06"/></linearGradient>`;
const TILE = `<linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b323c"/><stop offset="1" stop-color="#0a0d11"/></linearGradient><linearGradient id="te" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="tc"><rect x="24" y="24" width="464" height="464" rx="104"/></clipPath>`;
const SHADOW = `<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity=".5"/></filter>`;
const BLUR = `<filter id="bl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="12"/></filter>`;
const halo = (id, c, o) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const grad = (id, stops, x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join("")}</linearGradient>`;
const CYAN = grad("c", [[0, "#8af5ff"], [0.5, "#00d2ea"], [1, "#00899c"]]);
const PURPLE = grad("pu", [[0, "#ddc8ff"], [0.5, "#b388ff"], [1, "#774fcc"]]);

const tile = (fill = "url(#t)") =>
  `<rect x="24" y="24" width="464" height="464" rx="104" fill="${fill}"/><rect x="25.5" y="25.5" width="461" height="461" rx="102.5" fill="none" stroke="url(#te)" stroke-width="3"/>`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${defs}</defs>${body}</svg>\n`;

// ---------- the drop: a position puck with a heading point ----------
// Circle radius R at the origin, point at 1.6 R along `deg` (SVG angle, -45 = north-east).
function dropPath(R, deg) {
  const d = 1.6 * R, a = Math.acos(1 / 1.6) * (180 / Math.PI);
  const tip = [d * Math.cos(rad(deg)), d * Math.sin(rad(deg))];
  const p1 = [R * Math.cos(rad(deg + a)), R * Math.sin(rad(deg + a))];
  const p2 = [R * Math.cos(rad(deg - a)), R * Math.sin(rad(deg - a))];
  return `M${f(tip[0])} ${f(tip[1])}L${f(p1[0])} ${f(p1[1])}A${R} ${R} 0 1 1 ${f(p2[0])} ${f(p2[1])}Z`;
}
// Specular arc on the upper-left of a circle.
const arc = (r, a0, a1) =>
  `M${f(r * Math.cos(rad(a0)))} ${f(r * Math.sin(rad(a0)))}A${r} ${r} 0 0 1 ${f(r * Math.cos(rad(a1)))} ${f(r * Math.sin(rad(a1)))}`;
// Visual centre of a NE drop sits (+0.066 R, -0.066 R) from the circle centre.
function drop({ x, y, R = 118, deg = -45, fill = "url(#a)", hole = "#12151a", hl = true, stroke = "", holeR = 0.39, centred = true }) {
  const off = centred && deg === -45 ? 0.0657 * R : 0;
  const tx = f(x - off), ty = f(y + off);
  return `<g transform="translate(${tx} ${ty})"><path d="${dropPath(R, deg)}" fill="${fill}"${stroke}/>${
    hl ? `<path d="${arc(R * 0.86, 192, 246)}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="${f(R * 0.075)}" stroke-linecap="round"/>` : ""
  }${hole ? `<circle r="${f(R * holeR + R * 0.035)}" fill="#000" opacity=".22"/><circle r="${f(R * holeR)}" fill="${hole}"/>` : ""}</g>`;
}

const icons = [];
const add = (file, name, defs, body) => icons.push({ file, name, svg: svg(defs, body) });

// 00 current, for reference
add("00-current.svg", "Current", "", `<rect width="512" height="512" fill="#12151a"/><circle cx="256" cy="256" r="170" fill="none" stroke="#f0b429" stroke-width="40"/><rect x="241.7" y="30" width="28.6" height="136" fill="#f0b429"/>`);

// ===== A. Signal =====
add("01-drop.svg", "Drop", TILE + AMBER + SHADOW + halo("g", "#f0b429", 0.32),
  tile() + `<circle cx="256" cy="262" r="215" fill="url(#g)"/><g filter="url(#s)">${drop({ x: 256, y: 262 })}</g>`);

add("02-beacon.svg", "Beacon",
  TILE + SHADOW + halo("g", "#f0b429", 0.34) +
  `<linearGradient id="b" gradientUnits="userSpaceOnUse" x1="196" y1="316" x2="390" y2="122"><stop offset="0" stop-color="#f0b429"/><stop offset="1" stop-color="#f0b429" stop-opacity=".08"/></linearGradient>` +
  `<radialGradient id="p" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#ffeab0"/><stop offset=".45" stop-color="#f0b429"/><stop offset="1" stop-color="#a26902"/></radialGradient>`,
  tile() +
  `<g clip-path="url(#tc)" fill="none" stroke="#fff" stroke-opacity=".055" stroke-width="4"><path d="M0 190C90 160 170 200 250 170S390 100 512 120"/><path d="M0 260C100 220 180 280 270 250S400 170 512 200"/><path d="M0 330C110 290 170 360 280 320S420 250 512 280"/><path d="M0 400C120 360 200 430 300 390S440 330 512 360"/><path d="M0 460C130 430 210 490 320 450S450 400 512 420"/></g>` +
  `<circle cx="196" cy="316" r="150" fill="url(#g)"/><polygon points="178,298 384,118 394,128 214,334" fill="url(#b)"/>` +
  `<g filter="url(#s)"><circle cx="196" cy="316" r="60" fill="url(#p)"/><circle cx="196" cy="316" r="58" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3"/><circle cx="196" cy="316" r="20" fill="#1a1405"/></g>`);

add("03-prism.svg", "Prism",
  TILE + BLUR + halo("g", "#f0b429", 0.26) + grad("l", [[0, "#ffe397"], [1, "#f0b429"]]) + grad("r", [[0, "#d4930f"], [1, "#895700"]]),
  tile() + `<circle cx="256" cy="262" r="210" fill="url(#g)"/>` +
  `<g transform="translate(298 246) rotate(45)"><polygon points="0,-180 128,150 0,84 -128,150" fill="#000" opacity=".6" filter="url(#bl)"/></g>` +
  `<g transform="translate(290 228) rotate(45)"><polygon points="0,-180 0,84 -128,150" fill="url(#l)"/><polygon points="0,-180 128,150 0,84" fill="url(#r)"/><path d="M-126 148L0 -178" stroke="#fff" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/></g>`);

add("04-waypoint.svg", "Waypoint", TILE + BLUR + halo("g", "#f0b429", 0.3),
  tile() + `<circle cx="256" cy="232" r="185" fill="url(#g)"/>` +
  `<ellipse cx="256" cy="424" rx="64" ry="13" fill="#000" opacity=".7" filter="url(#bl)"/>` +
  `<ellipse cx="256" cy="420" rx="112" ry="26" fill="none" stroke="#f0b429" stroke-opacity=".55" stroke-width="5"/><ellipse cx="256" cy="420" rx="54" ry="12" fill="#f0b429" opacity=".22"/>` +
  `<path d="M256 378V410" stroke="#f0b429" stroke-opacity=".5" stroke-width="4" stroke-dasharray="6 7"/>` +
  `<polygon points="256,88 172,234 236,238" fill="#ffe397"/><polygon points="256,88 236,238 340,234" fill="#f0b429"/><polygon points="172,234 256,372 236,238" fill="#d4930f"/><polygon points="236,238 256,372 340,234" fill="#965f00"/>` +
  `<path d="M172 234L256 88" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>`);

// ===== B. Field kit =====
add("05-lensatic.svg", "Lensatic",
  AMBER + SHADOW + halo("g", "#f0b429", 0.35) +
  grad("o", [[0, "#6c7a5f"], [1, "#283022"]]) + grad("st", [[0, "#eef1f4"], [1, "#8b95a1"]], 0, 1) + grad("gl", [[0, "#fff", 0.16], [0.5, "#fff", 0]]),
  `<g filter="url(#s)"><circle cx="256" cy="452" r="31" fill="none" stroke="#3d4634" stroke-width="13"/><rect x="206" y="36" width="100" height="62" rx="18" fill="#3d4634"/><rect x="92" y="78" width="328" height="372" rx="86" fill="url(#o)"/></g>` +
  `<rect x="236" y="54" width="40" height="9" rx="4.5" fill="#1d2219"/><rect x="94" y="80" width="324" height="368" rx="84" fill="none" stroke="#b2bf9f" stroke-opacity=".35" stroke-width="3"/>` +
  `<circle cx="256" cy="270" r="148" fill="#1d2219"/><circle cx="256" cy="270" r="148" fill="none" stroke="#8d9a7c" stroke-opacity=".45" stroke-width="3"/><circle cx="256" cy="270" r="129" fill="#0b0e0a"/>` +
  `<circle cx="256" cy="270" r="116" fill="none" stroke="#c9cfbf" stroke-opacity=".45" stroke-width="12" stroke-dasharray="2 8.12"/>` +
  `<circle cx="256" cy="270" r="113" fill="none" stroke="#e8eaed" stroke-opacity=".9" stroke-width="18" stroke-dasharray="5 54.17" stroke-dashoffset="2.5"/>` +
  `<polygon points="256,174 245,194 267,194" fill="#f0b429"/><circle cx="256" cy="270" r="105" fill="url(#g)"/>` +
  `<g transform="translate(256 270) rotate(28)"><polygon points="0,-92 17,0 -17,0" fill="url(#a)"/><polygon points="0,92 17,0 -17,0" fill="#5d6858"/><polygon points="0,-92 0,0 -17,0" fill="#fff" opacity=".2"/></g>` +
  `<circle cx="256" cy="270" r="14" fill="url(#st)"/><circle cx="256" cy="270" r="5" fill="#1d2219"/><circle cx="256" cy="270" r="129" fill="url(#gl)"/>`);

add("06-armband.svg", "Armband",
  TILE + AMBER + SHADOW +
  `<linearGradient id="bd" gradientUnits="userSpaceOnUse" x1="24" y1="0" x2="488" y2="0"><stop offset="0" stop-color="#7a5204"/><stop offset=".27" stop-color="#e0a31f"/><stop offset=".5" stop-color="#ffd673"/><stop offset=".73" stop-color="#e0a31f"/><stop offset="1" stop-color="#7a5204"/></linearGradient>` +
  `<pattern id="hk" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#2f3628"/><circle cx="2.5" cy="2.5" r="1.5" fill="#465040"/><circle cx="7" cy="7" r="1.5" fill="#465040"/></pattern>`,
  tile() +
  `<g clip-path="url(#tc)"><g filter="url(#s)"><path d="M0 168Q256 232 512 168V340Q256 404 0 340Z" fill="url(#bd)"/></g>` +
  `<path d="M0 168Q256 232 512 168" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>` +
  `<path d="M0 190Q256 254 512 190M0 318Q256 382 512 318" fill="none" stroke="#6b4703" stroke-opacity=".8" stroke-width="4" stroke-dasharray="14 10"/></g>` +
  `<g filter="url(#s)"><rect x="166" y="224" width="180" height="124" rx="22" fill="url(#hk)"/></g><rect x="168" y="226" width="176" height="120" rx="20" fill="none" stroke="#1a1f16" stroke-width="4"/>` +
  drop({ x: 256, y: 286, R: 42, hole: "#2f3628" }));

add("07-dogtags.svg", "Dogtags",
  AMBER + SHADOW +
  grad("fr", [[0, "#f6f8fa"], [0.55, "#c3cad3"], [1, "#7c8693"]]) + grad("bk", [[0, "#b7bfc9"], [1, "#555e6a"]]) +
  `<mask id="mb"><rect x="-200" y="-200" width="400" height="400" fill="#fff"/><circle cx="0" cy="-112" r="13" fill="#000"/></mask>`,
  `<g filter="url(#s)"><g transform="translate(300 250) rotate(14)" mask="url(#mb)"><rect x="-95" y="-150" width="190" height="300" rx="66" fill="url(#bk)"/><rect x="-81" y="-136" width="162" height="272" rx="54" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="4"/></g>` +
  `<g transform="translate(222 286) rotate(-9)" mask="url(#mb)"><rect x="-95" y="-150" width="190" height="300" rx="66" fill="url(#fr)"/><rect x="-81" y="-136" width="162" height="272" rx="54" fill="none" stroke="#5c6570" stroke-opacity=".35" stroke-width="4"/>` +
  drop({ x: 0, y: -14, R: 56, hole: "#bcc4cd" }) +
  `<rect x="-58" y="72" width="116" height="11" rx="5.5" fill="#4c5560" opacity=".45"/><rect x="-58" y="96" width="80" height="11" rx="5.5" fill="#4c5560" opacity=".45"/></g></g>` +
  `<path d="M204.5 175.4C168 58 332 18 327.1 141.3" fill="none" stroke="#dfe3e8" stroke-width="11" stroke-dasharray=".01 17" stroke-linecap="round"/>`);

add("08-patch.svg", "Patch",
  AMBER + SHADOW +
  `<pattern id="tw" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#3c4634"/><rect width="4" height="10" fill="#465140"/></pattern>` +
  `<pattern id="th" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="2.5" height="7" fill="#fff" opacity=".2"/></pattern>`,
  `<g filter="url(#s)"><rect x="52" y="52" width="408" height="408" rx="100" fill="url(#tw)"/></g>` +
  `<rect x="52" y="52" width="408" height="408" rx="100" fill="none" stroke="#1c2118" stroke-width="30"/><rect x="52" y="52" width="408" height="408" rx="100" fill="none" stroke="#3b4431" stroke-width="30" stroke-dasharray="2 4"/>` +
  `<rect x="92" y="92" width="328" height="328" rx="68" fill="none" stroke="#66735a" stroke-width="3" stroke-dasharray="10 7"/>` +
  `<g transform="translate(250.6 265.4)"><path d="${dropPath(108, -45)}" fill="url(#a)"/><path d="${dropPath(108, -45)}" fill="url(#th)"/><path d="${dropPath(108, -45)}" fill="none" stroke="#9a6303" stroke-width="7"/><circle r="42" fill="url(#tw)"/><circle r="42" fill="none" stroke="#9a6303" stroke-width="7"/></g>`);

// ===== C. Cartographer =====
const T0 = "104,104 408,104 408,216 312,216 312,416 200,416 200,216 104,216";
const T1 = "126,126 386,126 386,194 290,194 290,394 222,394 222,194 126,194";
const T2 = "148,148 364,148 364,172 268,172 268,372 244,372 244,172 148,172";
add("09-contour-t.svg", "Contour T", TILE + AMBER + halo("g", "#f0b429", 0.24),
  tile() + `<circle cx="256" cy="250" r="220" fill="url(#g)"/>` +
  `<path d="M80 86C200 62 330 70 432 86C446 140 442 204 424 242C384 246 344 238 334 256C330 326 340 386 330 438C282 452 230 450 182 438C172 386 182 306 176 256C166 238 116 246 86 242C70 194 72 132 80 86Z" fill="none" stroke="#f0b429" stroke-opacity=".14" stroke-width="7"/>` +
  `<polygon points="${T0}" fill="none" stroke="#f0b429" stroke-opacity=".32" stroke-width="10" stroke-linejoin="round"/>` +
  `<polygon points="${T1}" fill="none" stroke="#f0b429" stroke-opacity=".62" stroke-width="10" stroke-linejoin="round"/>` +
  `<polygon points="${T2}" fill="url(#a)" stroke="url(#a)" stroke-width="12" stroke-linejoin="round"/>`);

const PANELS = ["60,140 196,108 196,404 60,436", "196,108 316,140 316,436 196,404", "316,140 452,108 452,404 316,436"];
add("10-field-map.svg", "Field map",
  AMBER + SHADOW + grad("p1", [[0, "#f3eedf"], [1, "#ddd5bf"]], 1, 0) + grad("p2", [[0, "#b2aa92"], [1, "#d3cbb4"]], 1, 0) +
  `<clipPath id="mc">${PANELS.map((p) => `<polygon points="${p}"/>`).join("")}</clipPath>`,
  `<g filter="url(#s)"><polygon points="${PANELS[0]}" fill="url(#p1)"/><polygon points="${PANELS[1]}" fill="url(#p2)"/><polygon points="${PANELS[2]}" fill="url(#p1)"/></g>` +
  `<g clip-path="url(#mc)"><path d="M66 300C110 280 150 320 132 362C112 404 70 392 62 362Z" fill="#9dbabd" opacity=".75"/>` +
  `<g fill="none" stroke="#b0a68a" stroke-width="3"><path d="M40 180C140 140 250 210 350 170S460 140 480 150"/><path d="M40 222C140 182 240 262 340 212S470 182 480 202"/><path d="M40 262C150 232 230 302 340 252S460 232 480 242"/></g>` +
  `<path d="M40 410C160 370 260 390 480 310" fill="none" stroke="#c98d5a" stroke-opacity=".75" stroke-width="6"/></g>` +
  `<path d="M196 108V404" stroke="#fff" stroke-opacity=".55" stroke-width="2"/><path d="M316 140V436" stroke="#000" stroke-opacity=".12" stroke-width="2"/>` +
  `<polyline points="100,380 170,322 250,342 328,254 372,214" fill="none" stroke="#2a2f36" stroke-width="7" stroke-dasharray="16 11" stroke-linecap="round" stroke-linejoin="round"/><circle cx="100" cy="380" r="10" fill="none" stroke="#2a2f36" stroke-width="5"/>` +
  `<g filter="url(#s)">${drop({ x: 388, y: 170, R: 60, stroke: ` stroke="#12151a" stroke-width="9" stroke-linejoin="round"` })}</g>`);

const sheet = (cy, top, l, r) =>
  `<polygon points="66,${cy} 256,${cy + 108} 256,${cy + 122} 66,${cy + 14}" fill="${l}"/><polygon points="256,${cy + 108} 446,${cy} 446,${cy + 14} 256,${cy + 122}" fill="${r}"/><polygon points="256,${cy - 108} 446,${cy} 256,${cy + 108} 66,${cy}" fill="${top}"/>`;
add("11-floors.svg", "Floors", AMBER + SHADOW + grad("tp", [[0, "#414a56"], [1, "#2a313b"]]),
  `<g filter="url(#s)">${sheet(356, "#1d2229", "#0d1014", "#14181d")}</g><ellipse cx="256" cy="356" rx="22" ry="12" fill="#f0b429" opacity=".14"/>` +
  `<g filter="url(#s)">${sheet(286, "#272e37", "#12161b", "#1a1f25")}</g><ellipse cx="256" cy="286" rx="24" ry="13" fill="#f0b429" opacity=".3"/>` +
  `<g filter="url(#s)">${sheet(216, "url(#tp)", "#181c22", "#20262d")}</g>` +
  `<g stroke="#56606e" stroke-width="2"><path d="M129.3 252L319.3 144M192.7 288L382.7 180M129.3 180L319.3 288M192.7 144L382.7 252"/></g>` +
  `<path d="M66 216L256 108L446 216" fill="none" stroke="#6b7684" stroke-width="2.5" stroke-linejoin="round"/>` +
  `<ellipse cx="256" cy="216" rx="34" ry="12" fill="#000" opacity=".55"/>` +
  `<g filter="url(#s)">${drop({ x: 256, y: 126, R: 56, deg: 90, centred: false })}</g>`);

const pt = (tip, s1, s2, light, dark) =>
  `<polygon points="${tip} ${s1} 256,256" fill="${light}"/><polygon points="${tip} 256,256 ${s2}" fill="${dark}"/>`;
add("12-compass-rose.svg", "Compass rose", TILE + AMBER + `<radialGradient id="dk" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#262d36"/><stop offset="1" stop-color="#0c0f13"/></radialGradient>`,
  tile() + `<circle cx="256" cy="256" r="198" fill="url(#dk)"/><circle cx="256" cy="256" r="198" fill="none" stroke="#3d4652" stroke-width="5"/>` +
  `<circle cx="256" cy="256" r="182" fill="none" stroke="#8b95a1" stroke-opacity=".5" stroke-width="10" stroke-dasharray="2 13.88"/>` +
  pt("329.5,182.5", "256,232", "280,256", "#7d8794", "#4a525d") + pt("329.5,329.5", "280,256", "256,280", "#7d8794", "#4a525d") +
  pt("182.5,329.5", "256,280", "232,256", "#7d8794", "#4a525d") + pt("182.5,182.5", "232,256", "256,232", "#7d8794", "#4a525d") +
  pt("426,256", "280,232", "280,280", "#e8eaed", "#8b95a1") + pt("256,426", "280,280", "232,280", "#e8eaed", "#8b95a1") +
  pt("86,256", "232,280", "232,232", "#e8eaed", "#8b95a1") + pt("256,84", "232,232", "280,232", "#ffe08c", "#c27f06") +
  `<circle cx="256" cy="256" r="15" fill="#12151a" stroke="#c5ccd5" stroke-width="4"/>`);

// ===== D. Squad =====
add("13-formation.svg", "Formation", TILE + AMBER + CYAN + PURPLE + SHADOW + halo("g", "#f0b429", 0.22),
  tile() + `<circle cx="256" cy="240" r="200" fill="url(#g)"/>` +
  `<path d="M256 236L150 352M256 236L362 352" stroke="#fff" stroke-opacity=".14" stroke-width="5" stroke-dasharray="3 12" stroke-linecap="round"/>` +
  `<g filter="url(#s)">${drop({ x: 150, y: 352, R: 50, deg: -90, fill: "url(#c)", centred: false })}${drop({ x: 362, y: 352, R: 50, deg: -90, fill: "url(#pu)", centred: false })}${drop({ x: 256, y: 236, R: 68, deg: -90, centred: false })}</g>`);

add("14-callout.svg", "Callout", TILE + AMBER + SHADOW,
  tile() +
  `<g filter="url(#s)"><path d="M164 112H348A68 68 0 0 1 416 180V276A68 68 0 0 1 348 344H230L150 414L166 344H164A68 68 0 0 1 96 276V180A68 68 0 0 1 164 112Z" fill="url(#a)"/></g>` +
  `<path d="M120 150A68 68 0 0 1 164 114H348" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>` +
  drop({ x: 256, y: 228, R: 64, fill: "#1a1405", hole: "#f0b429", hl: false }));

add("15-flare.svg", "Flare",
  TILE + BLUR + halo("g", "#ffc94d", 0.55) + grad("sky", [[0, "#1d2533"], [1, "#0a0d11"]], 0, 1) +
  `<linearGradient id="tr" gradientUnits="userSpaceOnUse" x1="140" y1="480" x2="330" y2="170"><stop offset="0" stop-color="#f0b429" stop-opacity="0"/><stop offset="1" stop-color="#ffd877"/></linearGradient>`,
  tile("url(#sky)") +
  `<g clip-path="url(#tc)"><g fill="#fff"><circle cx="96" cy="92" r="2.5" opacity=".5"/><circle cx="168" cy="140" r="2" opacity=".35"/><circle cx="420" cy="96" r="2.5" opacity=".45"/><circle cx="448" cy="232" r="2" opacity=".3"/><circle cx="78" cy="214" r="2" opacity=".3"/></g>` +
  `<circle cx="330" cy="170" r="190" fill="url(#g)"/><path d="M140 480C162 330 226 232 330 170" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="22" filter="url(#bl)"/>` +
  `<path d="M140 480C162 330 226 232 330 170" fill="none" stroke="url(#tr)" stroke-width="9" stroke-linecap="round"/>` +
  `<path d="M0 424L44 356L64 388L96 312L130 382L156 342L184 398L226 322L260 392L290 350L318 400L352 306L388 384L414 348L444 394L476 334L512 372V512H0Z" fill="#06080b"/></g>` +
  `<path d="M330 128V212M288 170H372" stroke="#ffe7a6" stroke-opacity=".6" stroke-width="4" stroke-linecap="round"/><circle cx="330" cy="170" r="32" fill="#ffd877" opacity=".85"/><circle cx="330" cy="170" r="19" fill="#fff6dc"/>`);

add("16-room-key.svg", "Room key", TILE + AMBER + SHADOW,
  tile() +
  `<g filter="url(#s)"><g transform="translate(262 268) rotate(45) translate(-256 -256)">` +
  `<rect x="248" y="238" width="206" height="36" rx="9" fill="url(#a)"/><rect x="376" y="264" width="24" height="40" rx="5" fill="url(#a)"/><rect x="416" y="264" width="24" height="56" rx="5" fill="url(#a)"/><rect x="232" y="226" width="26" height="60" rx="7" fill="#d4930f"/>` +
  `${drop({ x: 168, y: 256, R: 84, deg: -90, hl: false, centred: false })}</g></g>`);

// ===== E. Monogram =====
add("17-drop-t.svg", "Drop T", TILE + AMBER + SHADOW + halo("g", "#f0b429", 0.3),
  tile() + `<circle cx="256" cy="262" r="215" fill="url(#g)"/>` +
  `<g filter="url(#s)"><g transform="translate(247.9 270.1)"><path d="${dropPath(124, -45)}" fill="url(#a)"/><path d="${arc(107, 192, 246)}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="9" stroke-linecap="round"/>` +
  `<rect x="-58" y="-56" width="116" height="34" rx="6" fill="#12151a"/><rect x="-17" y="-56" width="34" height="116" rx="6" fill="#12151a"/></g></g>`);

add("18-stencil-tt.svg", "Stencil TT",
  TILE + grad("at", [[0, "#ffd570"], [0.55, "#f0b429"], [1, "#b97806"]]) + `<linearGradient id="te2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
  `<rect x="24" y="24" width="464" height="464" rx="104" fill="url(#at)"/><rect x="25.5" y="25.5" width="461" height="461" rx="102.5" fill="none" stroke="url(#te2)" stroke-width="3"/>` +
  `<g fill="#9a6303" opacity=".55"><circle cx="76" cy="76" r="9"/><circle cx="436" cy="76" r="9"/><circle cx="76" cy="436" r="9"/><circle cx="436" cy="436" r="9"/></g>` +
  `<g fill="#1a1405"><rect x="88" y="144" width="156" height="60" rx="4"/><rect x="138" y="216" width="56" height="156" rx="4"/><rect x="268" y="144" width="156" height="60" rx="4"/><rect x="318" y="216" width="56" height="156" rx="4"/></g>`);

const torn = (x, y0, y1, dir) => {
  const pts = []; const n = 7;
  for (let i = 0; i <= n; i++) pts.push(`${x + (i % 2 ? dir * 11 : 0)},${f(y0 + ((y1 - y0) * i) / n)}`);
  return pts;
};
const hStrip = [...torn(424, 140, 222, -1), ...torn(88, 222, 140, 1)].join(" ");
const vStrip = (() => {
  const pts = ["216,190", "296,190", "296,404"];
  const n = 6;
  for (let i = 1; i < n; i++) pts.push(`${f(296 - (80 * i) / n)},${i % 2 ? 416 : 404}`);
  pts.push("216,404");
  return pts.join(" ");
})();
add("19-tape-t.svg", "Tape T",
  TILE + AMBER + SHADOW +
  `<pattern id="fh" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="2" fill="#fff" opacity=".1"/></pattern><pattern id="fv" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="2" height="6" fill="#fff" opacity=".1"/></pattern>`,
  tile() +
  `<g filter="url(#s)"><g transform="rotate(3 256 300)"><polygon points="${vStrip}" fill="url(#a)"/><polygon points="${vStrip}" fill="url(#fv)"/><rect x="216" y="190" width="80" height="214" fill="#000" opacity=".08"/></g></g>` +
  `<g filter="url(#s)"><g transform="rotate(-4 256 181)"><polygon points="${hStrip}" fill="url(#a)"/><polygon points="${hStrip}" fill="url(#fh)"/><polygon points="96,148 418,148 418,160 96,160" fill="#fff" opacity=".22"/></g></g>`);

add("20-arrow-t.svg", "Arrow T", TILE + AMBER + SHADOW + halo("g", "#f0b429", 0.26) + `<clipPath id="rh"><rect x="256" y="0" width="256" height="512"/></clipPath>`,
  tile() + `<circle cx="256" cy="250" r="210" fill="url(#g)"/>` +
  `<g filter="url(#s)"><path d="M256 116L436 190V248L284 186V420H228V186L76 248V190Z" fill="url(#a)" stroke="url(#a)" stroke-width="6" stroke-linejoin="round"/></g>` +
  `<path d="M256 116L436 190V248L284 186V420H256Z" fill="#000" opacity=".2"/><path d="M78 190L256 117" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>`);

// ---------- write ----------
for (const i of icons) writeFileSync(join(out, i.file), i.svg);
const uri = (i) => i.file;

const sizes = [64, 32, 24, 16];
const card = (i) => `<figure><img src="${uri(i)}" width="200" height="200"><figcaption>${i.file.slice(0, 2)} ${i.name}</figcaption>
<div class="row dark">${sizes.map((s) => `<img src="${uri(i)}" width="${s}" height="${s}">`).join("")}</div>
<div class="row light">${sizes.map((s) => `<img src="${uri(i)}" width="${s}" height="${s}">`).join("")}</div></figure>`;
writeFileSync(join(out, "preview.html"), `<!doctype html><meta charset="utf-8"><title>Icon preview</title>
<style>body{margin:0;padding:24px;background:#181b20;color:#cfd5dc;font:13px system-ui}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
figure{margin:0;background:#22262d;border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px}figcaption{align-self:flex-start}
.row{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:76px;border-radius:8px}.dark{background:#202020}.light{background:#f3f3f3}
.bar{display:flex;gap:14px;padding:12px 18px;border-radius:10px;margin:0 0 16px;align-items:center}</style>
<div class="bar dark">${icons.map((i) => `<img src="${uri(i)}" width="24" height="24">`).join("")}</div>
<div class="bar light">${icons.map((i) => `<img src="${uri(i)}" width="24" height="24">`).join("")}</div>
<main>${icons.map(card).join("")}</main>`);
console.log(`wrote ${icons.length} icons to ${out}`);
