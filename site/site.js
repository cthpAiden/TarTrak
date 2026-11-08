// TarTrak site: the playable hero, the scrolled raid story, the sections below it, and the latest version from GitHub.
// Needs map.js (window.TT). Styles are only set through CSSOM (el.style.x), which the CSP allows.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];

  // ---------- latest release ----------
  // The page ships with the current version filled in; this only updates it.
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  function applyRelease(r) {
    const ver = String(r.tag_name || "").replace(/^v/, "");
    if (!/^\d+\.\d+\.\d+$/.test(ver)) return;
    $$("[data-ver]").forEach((el) => (el.textContent = ver));
    if (r.published_at) $$("[data-date]").forEach((el) => (el.textContent = fmtDate(r.published_at)));
    const exe = (r.assets || []).find((a) => /-setup\.exe$/i.test(a.name));
    if (exe && /^https:\/\/github\.com\/cthpAiden\/TarTrak\/releases\/download\//.test(exe.browser_download_url)) {
      $$("[data-dl]").forEach((a) => (a.href = exe.browser_download_url));
    }
  }
  const KEY = "tartrak-release";
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
  if (cached && Date.now() - cached.at < 3600e3) applyRelease(cached.r);
  else fetch("https://api.github.com/repos/cthpAiden/TarTrak/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((r) => {
      const slim = { tag_name: r.tag_name, published_at: r.published_at, assets: (r.assets || []).map((a) => ({ name: a.name, browser_download_url: a.browser_download_url })) };
      applyRelease(slim);
      try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), r: slim })); } catch {}
    })
    .catch(() => {});

  // ---------- filename anatomy: light the two groups in turn ----------
  const groups = $$("#fname .grp[data-g]");
  let gi = 0;
  if (!reduce) setInterval(() => { groups.forEach((g, i) => g.classList.toggle("hot", i === gi % 2)); gi++; }, 1800);
  else groups.forEach((g) => g.classList.add("hot"));

  const C = TT.COL, pad = TT.pad;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const mobile = () => innerWidth <= 760;
  const U = 7; // scroll units: 0 = play + dive, 1..6 = the raid

  // ======================= HERO: the playable scene =======================
  const stage = $("#stage"), world = $("#world"), ov = $("#ov"), flash = $("#flash"), toasts = $("#toasts"), shot = $("#shot"), hero = $("#hero"), deck = $("#deck");
  const layers = $$(".layer");
  let mx = 0, my = 0, tx = 0, ty = 0;
  stage.addEventListener("pointermove", (e) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; });

  // compass tape on the overlay
  const tape = $("#tape"), hdgEl = $("#hdg");
  const names = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };
  for (let d = -360; d < 720; d += 5) {
    const s = document.createElement("span"), a = ((d % 360) + 360) % 360;
    if (a % 15 === 0) { s.className = "m5"; const b = document.createElement("b"); b.textContent = names[a] ?? a; if (names[a]) b.className = "card"; s.append(b); }
    tape.append(s);
  }

  const mini = TT.map($("#mini"), { seed: 23, scale: 520 });
  const MS = mini.scene;
  const me = { id: "you", color: C.you, x: 0.5, y: 0.55, h: 48, len: 80 };
  const mates = [
    { id: "ghost", label: "GHOST", color: C.ghost, x: 0.38, y: 0.38, h: 70, len: 70 },
    { id: "nomad", label: "NOMAD", color: C.nomad, x: 0.66, y: 0.7, h: 310, floor: "2F", len: 70 },
    { id: "vex", label: "VEX", color: C.vex, x: 0.62, y: 0.32, h: 20, len: 70 },
  ];
  // circle mode: the compass bezel the app draws round the disc (north up, the heading box rides round it)
  const bezel = $("#bezel"), NS = "http://www.w3.org/2000/svg", BC = 100, BR = 86; // 200-unit box; the ring is the outer 14
  const svgEl = (tag, attrs, parent = bezel) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.append(n); return n; };
  const polar = (R, a) => [BC + R * Math.sin((a * Math.PI) / 180), BC - R * Math.cos((a * Math.PI) / 180)];
  const ring = (r, stroke, more) => svgEl("circle", { cx: BC, cy: BC, r, fill: "none", stroke, ...more });
  ring(93, "#0f1318", { "stroke-opacity": 0.92, "stroke-width": 14 });
  ring(99.5, "#fff", { "stroke-opacity": 0.3 });
  ring(BR, "#fff", { "stroke-opacity": 0.22 });
  for (const [r, w, n, len, col] of [[98.5, 3, 72, 0.8, "#8b95a1"], [97.5, 5, 12, 1.4, "#d9dee4"]]) {
    ring(r, col, { "stroke-width": w, "stroke-dasharray": `${len} ${(2 * Math.PI * r) / n - len}`, "stroke-dashoffset": len / 2 });
  }
  const bLabels = ["N", 30, 60, "E", 120, 150, "S", 210, 240, "W", 300, 330].map((t, i) => {
    const d = i * 30, [x, y] = polar(90.5, d);
    const n = svgEl("text", { x: x.toFixed(1), y: y.toFixed(1), "text-anchor": "middle", "dominant-baseline": "central" });
    if (typeof t === "string") n.classList.add("l"); if (d === 0) n.classList.add("n");
    n.textContent = t; return { d, n };
  });
  const hb = svgEl("g", { class: "hb" });
  svgEl("rect", { x: -12, y: -5.5, width: 24, height: 11, rx: 2.5 }, hb);
  const hbText = svgEl("text", { y: 0.5, "text-anchor": "middle", "dominant-baseline": "central" }, hb);
  const gap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

  MS.players = [me, ...mates]; MS.zoom = 1.5; MS.markScale = 1 / MS.zoom; MS.route = { from: "you", to: 0 }; MS.labels = false;
  const bMarks = mates.map((p) => { const g = svgEl("g", {}); svgEl("path", { d: `M${BC - 4} ${BC - BR - 0.5}h8l-4 6.5z`, fill: p.color, stroke: "#000", "stroke-width": 1 }, g); return { p, g }; });
  function drawBezel() {
    const [x, y] = polar(93, me.h);
    hb.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    hbText.textContent = String(Math.round(me.h) % 360).padStart(3, "0");
    bLabels.forEach((l) => l.n.classList.toggle("off", gap(l.d, me.h) < 13));
    const W = mini.W(), H = mini.H();
    bMarks.forEach(({ p, g }) => g.setAttribute("transform", `rotate(${((Math.atan2((p.x - me.x) * W, -(p.y - me.y) * H) * 180) / Math.PI).toFixed(1)} ${BC} ${BC})`));
  }
  const shapeEl = $("#shape"), shapes = $$(".shape button");
  shapes.forEach((b) => b.addEventListener("click", () => {
    ov.classList.toggle("circle", b.dataset.shape === "circle");
    shapes.forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
  }));
  const rnd = TT.rng(5);
  let lastAuto = performance.now();
  let cur = 0; // eased scroll progress through the track, 0..1
  const atTop = () => cur * U < 0.12;

  MS.beforeFrame = (now) => {
    mx += (tx - mx) * 0.08; my += (ty - my) * 0.08;
    layers.forEach((l) => { const d = +l.dataset.d; l.style.transform = `translate3d(${-mx * d}px, ${-my * d * 0.5}px, 0)`; });
    me.h = (48 + mx * 120 + 360) % 360;
    tape.style.transform = `translateX(${-(me.h + 360) * 2 - 1}px)`;
    hdgEl.textContent = String(Math.round(me.h)).padStart(3, "0") + "°";
    if (ov.classList.contains("circle")) drawBezel();
    MS.cx = me.x; MS.cy = me.y; // player-centred, like the app's follow-me
    for (const p of mates) {
      if (!p.next) p.next = now + 800 + rnd() * 2400;
      if (now > p.next) { p.tx = clamp(p.x + (rnd() - 0.5) * 0.12, 0.15, 0.85); p.ty = clamp(p.y + (rnd() - 0.5) * 0.12, 0.15, 0.85); p.h = (p.h + (rnd() - 0.5) * 90 + 360) % 360; p.ping = now; p.next = now + 1800 + rnd() * 2600; }
    }
    if (now - lastAuto > 7000 && atTop()) screenshot(true);
  };

  function toast(html, cls) {
    const t = document.createElement("div"); t.className = "toast " + (cls || ""); t.innerHTML = html; toasts.prepend(t);
    setTimeout(() => t.remove(), 3300); while (toasts.children.length > 3) toasts.lastChild.remove();
  }
  function screenshot(auto) {
    lastAuto = performance.now();
    const a = ((me.h - 90) * Math.PI) / 180, d = 0.05 + rnd() * 0.05;
    me.tx = clamp(me.x + Math.cos(a) * d, 0.34, 0.66); me.ty = clamp(me.y + Math.sin(a) * d * 1.6, 0.34, 0.66);
    me.ping = performance.now();
    const w = mini.toWorld(me.tx, me.ty), f = TT.filename(w.X, 2.1, w.Z, me.h);
    if (!auto) flash.animate([{ opacity: 0.3 }, { opacity: 0 }], { duration: 300 });
    toast(`Screenshot saved: ${f.stamp}_<em>${f.pos.join(", ")}</em>_<em>${f.rot.slice(1, 4).join(", ")}…</em>`);
  }
  let opIdx = 0; const ops = [0.86, 0.6, 0.35, 1];
  let shotTimer;
  const act = {
    PrintScreen: () => screenshot(false),
    F5: () => ov.classList.toggle("full"),
    F6: () => { opIdx = (opIdx + 1) % ops.length; ov.style.opacity = ops[opIdx]; },
    F7: () => ov.classList.toggle("hidden"),
    F8: () => {
      flash.animate([{ opacity: 0.12 }, { opacity: 0 }], { duration: 250 });
      toast(`<b>F8</b> Sent your last screenshot to K7Q2XM · 3 teammates`, "sent");
      clearTimeout(shotTimer); shot.classList.remove("on");
      shotTimer = setTimeout(() => { void shot.offsetWidth; shot.classList.add("on"); mates[2].ping = performance.now();
        shotTimer = setTimeout(() => shot.classList.remove("on"), 10000); }, 1400);
    },
  };
  function press(k) {
    const b = $(`.key[data-k="${k}"]`); if (!b || !act[k] || !atTop()) return;
    act[k]();
    b.classList.add("down", "lit"); setTimeout(() => b.classList.remove("down"), 120); setTimeout(() => b.classList.remove("lit"), 900);
  }
  $$(".key").forEach((b) => b.addEventListener("click", () => press(b.dataset.k)));
  // the demo keys only work at the top of the page, and never with a modifier (Ctrl+P, Ctrl+F5 stay the browser's)
  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key === "p" || e.key === "P" ? "PrintScreen" : e.key;
    if (act[k] && atTop()) { e.preventDefault(); press(k); }
  });
  addEventListener("keyup", (e) => { if (e.key === "PrintScreen") press("PrintScreen"); });
  let left = 31 * 60 + 42;
  setInterval(() => { left = Math.max(0, left - 1); }, 1000);

  // ======================= STORY: the scrolled raid =======================
  const m = TT.map($("#map"), { seed: 11, scale: 820 });
  const S = m.scene;
  const YOU = { x: 0.64, y: 0.5 };
  const final = { ghost: [0.56, 0.4], nomad: [0.74, 0.58], vex: [0.71, 0.36] };
  const start = { ghost: [0.3, -0.1], nomad: [1.1, 0.8], vex: [0.95, -0.1] };
  const P = {
    you: { id: "you", label: "YOU", color: C.you, x: YOU.x, y: YOU.y, h: 48, show: false },
    ghost: { id: "ghost", label: "GHOST", color: C.ghost, h: 20, show: false },
    nomad: { id: "nomad", label: "NOMAD", color: C.nomad, h: 300, floor: "2F", show: false },
    vex: { id: "vex", label: "VEX", color: C.vex, h: 330, show: false },
  };
  S.players = [P.you, P.ghost, P.nomad, P.vex];
  const T = [
    { color: C.you, pts: [[0.4, 0.95], [0.45, 0.82], [0.5, 0.74], [0.55, 0.66], [0.6, 0.57], [YOU.x, YOU.y]] },
    { color: C.ghost, pts: [[0.18, 0.12], [0.28, 0.2], [0.38, 0.27], [0.47, 0.33], final.ghost] },
    { color: C.nomad, pts: [[0.98, 0.95], [0.92, 0.82], [0.86, 0.72], [0.8, 0.64], final.nomad] },
    { color: C.vex, pts: [[0.9, 0.08], [0.84, 0.16], [0.78, 0.24], [0.74, 0.3], final.vex] },
  ];

  // the filename types itself out in beat 2
  const f = TT.filename(-182.4, 2.1, -71.03, 48, new Date(2026, 10, 8, 21, 14));
  const parts = [["p", "Screenshots\\"], ["", f.stamp + "_"], ["e", f.pos.join(", ")], ["", "_"], ["e", f.rot.join(", ")], ["", " (0).png"]];
  const full = parts.map((p) => p[1]).join("");
  const typedEl = $("#typed");
  let typed = -1;
  function typeTo(n) {
    if (n === typed) return; typed = n; typedEl.textContent = "";
    let l = n;
    for (const [cls, txt] of parts) {
      if (l <= 0) break;
      const s = txt.slice(0, l); l -= txt.length;
      const el = document.createElement(cls === "e" ? "em" : "span"); if (cls === "p") el.className = "p";
      el.textContent = s; typedEl.append(el);
    }
    if (n < full.length) { const c = document.createElement("span"); c.className = "caret"; typedEl.append(c); }
  }

  // ---------- scroll ----------
  const track = $("#raid"), beats = $$(".beat"), rail = $$("#rail li");
  let target = 0;
  function readScroll() { const r = track.getBoundingClientRect(); target = clamp(-r.top / (r.height - innerHeight)); }
  addEventListener("scroll", readScroll, { passive: true }); addEventListener("resize", readScroll);
  rail.forEach((li) => li.addEventListener("click", () => {
    const r = track.getBoundingClientRect(), b = +li.dataset.b;
    scrollTo({ top: scrollY + r.top + ((b === 0 ? 0 : b + 0.5) / U) * (r.height - innerHeight), behavior: "smooth" });
  }));

  const lines = $$(".line"), chips = $$("#chips .chip"), roomCells = $$("#room span"), popup = $("#popup"), ptime = $("#ptime");
  const dock = $("#dock"), playhead = $("#playhead"), clockEl = $("#clock"), dockT = $("#dockT"), f8 = $("#f8");
  const railbox = $("#railbox"), vig = $("#vig"), mapEl = $("#map"), ovmap = $("#ovmap"), rw = $("#rw"), ovclock = $("#ovclock");
  let shotFired = false, f8Fired = false, joined = {};

  S.beforeFrame = (now) => {
    const rdt = Math.min(1000, now - (S._t || now)); S._t = now;
    cur += (target - cur) * (1 - Math.pow(0.0005, rdt / 1000)); if (Math.abs(target - cur) < 1e-4) cur = target;
    const p = cur * U, local = (b) => p - b;
    const t0 = local(0);
    mini.pause(p > 1.05); // the overlay is gone after the dive

    // ---- the dive: the overlay's minimap grows until it is the page ----
    const heroA = 1 - ss(0.03, 0.2, t0);
    hero.style.opacity = heroA; hero.style.transform = `translateY(${(1 - heroA) * -40}px)`; hero.style.pointerEvents = heroA > 0.5 ? "" : "none";
    deck.style.opacity = heroA; deck.style.pointerEvents = heroA > 0.5 ? "" : "none";
    shapeEl.style.opacity = heroA; shapeEl.style.pointerEvents = heroA > 0.5 ? "" : "none";
    if (t0 <= 0.02) { // the shape toggle sits centred under the overlay, wherever F5 has put it
      const o = ov.getBoundingClientRect(), s = stage.getBoundingClientRect();
      shapeEl.style.transform = `translate(${Math.round(o.left + o.width / 2 - s.left - shapeEl.offsetWidth / 2)}px, ${Math.round(o.bottom - s.top + 12)}px)`;
    }
    toasts.style.opacity = heroA; shot.style.visibility = heroA > 0.05 ? "" : "hidden";
    const g = ss(0.15, 0.78, t0);
    if (t0 > 0.02) {
      if (!ov.classList.contains("diving")) { ov.classList.add("diving"); ov.classList.remove("full", "hidden"); ov.style.opacity = ""; opIdx = 0; }
      const L = ov.offsetLeft, Tp = ov.offsetTop, mw = ovmap.offsetWidth, mh = ovmap.offsetHeight, mx0 = ovmap.offsetLeft, my0 = ovmap.offsetTop;
      const vw = innerWidth, vh = stage.offsetHeight;
      const sEnd = Math.max(vw / mw, vh / mh) * 1.02, k = lerp(1, sEnd, g * g * (3 - 2 * g) * 0.5 + g * 0.5);
      const cx = lerp(L + mx0 + mw / 2, vw / 2, g), cy = lerp(Tp + my0 + mh / 2, vh / 2, g);
      ov.style.transform = `translate(${cx - L - k * (mx0 + mw / 2)}px, ${cy - Tp - k * (my0 + mh / 2)}px) scale(${k})`;
      // marks grow from the app's screen size to the story map's (zoom 1.9) by the end of the dive
      mini.setRes(Math.ceil(sEnd)); MS.markScale = lerp(1, 1.9, (k - 1) / (sEnd - 1)) / (MS.zoom * k);
      // a round map opens out to a square so it can fill the page
      ov.style.borderRadius = ov.classList.contains("circle") ? `${50 * (1 - ss(0.1, 0.6, g))}%` : "";
      ovmap.style.borderRadius = ov.style.borderRadius;
      bezel.style.opacity = 1 - ss(0, 0.35, g);
      ov.style.opacity = 1 - ss(0.8, 0.97, t0);
      ov.style.visibility = t0 > 1 ? "hidden" : "";
    } else if (ov.classList.contains("diving")) { ov.classList.remove("diving"); ov.style.transform = ""; ov.style.opacity = ""; ov.style.visibility = ""; ov.style.borderRadius = ""; ovmap.style.borderRadius = ""; bezel.style.opacity = ""; mini.setRes(1); MS.markScale = 1 / MS.zoom; }
    // the scene falls away behind it
    world.style.opacity = 1 - ss(0.3, 0.8, t0);
    world.style.transform = `scale(${1 + g * 0.18})`;
    world.style.visibility = t0 > 1 ? "hidden" : "";
    mapEl.style.opacity = ss(0.62, 0.92, t0);
    vig.style.opacity = ss(0.7, 1, t0);
    // rewind the raid clock on the overlay while diving
    rw.style.opacity = ss(0.2, 0.35, t0);
    const rem = Math.round(lerp(left, 0, ss(0.25, 0.8, t0)));
    ovclock.textContent = `${pad(Math.floor(rem / 60))}:${pad(rem % 60)}`;
    railbox.style.opacity = ss(0.75, 1, t0);

    // ---- beats ----
    beats.forEach((el) => {
      const b = +el.dataset.b, t = local(b);
      const a = b === 6 ? ss(0.05, 0.35, t) : ss(0.05, 0.3, t) * (1 - ss(0.75, 0.95, t));
      el.style.opacity = a.toFixed(3);
      const y = (1 - a) * (t < 0.5 ? 30 : -30);
      el.style.transform = mobile() ? `translateY(${y}px)` : `translateY(calc(-50% + ${y}px))`;
      el.classList.toggle("on", a > 0.5);
    });
    const active = clamp(Math.floor(p), 0, U - 1);
    rail.forEach((li, i) => li.classList.toggle("on", i <= active));
    const secs = Math.round(clamp((p - 1) / (U - 1)) * 42 * 60);
    clockEl.textContent = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;

    // camera + fog
    const t1 = local(1), t2 = local(2), t3 = local(3), t4 = local(4), t5 = local(5), t6 = local(6);
    const zIn = 1.9, off = mobile() ? 0 : 0.1;
    let z = zIn, cx = YOU.x - off, cy = YOU.y;
    const out = ss(0.1, 0.8, t3);
    z = lerp(zIn, 1.05, out); cx = lerp(YOU.x - off, 0.6, out); cy = lerp(YOU.y, 0.5, out);
    const f8z = ss(0.0, 0.5, t4) * (1 - ss(0.8, 1, t4));
    z = lerp(z, 1.35, f8z); cx = lerp(cx, 0.66, f8z); cy = lerp(cy, 0.42, f8z);
    const ex = ss(0.1, 0.8, t6);
    z = lerp(z, 1.15, ex); cx = lerp(cx, 0.72, ex); cy = lerp(cy, 0.62, ex);
    if (mobile()) cx = lerp(cx, YOU.x, 0.6);
    S.zoom = z; S.cx = cx; S.cy = cy;
    const reveal = ss(0.35, 1, t2);
    S.fog = reveal >= 1 ? null : { x: YOU.x, y: YOU.y, r: lerp(0.035 + 0.006 * Math.sin(now / 400), 1.2, reveal) };
    S.dim = lerp(0.35, 0, ss(0.35, 0.9, t2));

    lines.forEach((l, i) => { const a = ss(0.12 + i * 0.18, 0.28 + i * 0.18, t1); l.style.opacity = a; l.style.transform = `translateY(${(1 - a) * 10}px)`; });

    const fa = ss(0.0, 0.08, t2) * (1 - ss(0.85, 1, t2));
    typedEl.style.opacity = fa;
    typeTo(Math.round(ss(0.04, 0.42, t2) * full.length));
    typedEl.classList.toggle("hot", t2 > 0.45);
    chips.forEach((c, i) => { const a = ss(0.48 + i * 0.05, 0.6 + i * 0.05, t2) * (1 - ss(0.85, 1, t2)); c.style.opacity = a; c.style.transform = `translateY(${(1 - a) * 12}px) scale(${0.9 + a * 0.1})`; });
    const landed = t2 > 0.42;
    P.you.show = landed;
    if (landed && !shotFired) { shotFired = true; P.you.ping = now; flash.animate([{ opacity: 0.25 }, { opacity: 0 }], { duration: 320 }); }
    if (!landed) shotFired = false;

    roomCells.forEach((c, i) => { const a = ss(0.05 + i * 0.05, 0.15 + i * 0.05, t3); c.style.opacity = a; c.style.transform = `rotateX(${(1 - a) * 90}deg)`; });
    ["ghost", "nomad", "vex"].forEach((id, i) => {
      const a = ss(0.3 + i * 0.12, 0.65 + i * 0.12, t3), pl = P[id];
      pl.show = a > 0; pl.x = lerp(start[id][0], final[id][0], a); pl.y = lerp(start[id][1], final[id][1], a); pl.alpha = Math.min(1, a * 1.5);
      if (a >= 1 && !joined[id]) { joined[id] = true; pl.ping = now; } if (a < 1) joined[id] = false;
    });

    const pa = ss(0.18, 0.4, t4) * (1 - ss(0.82, 0.98, t4));
    const [vx, vy] = m.toScreen(P.vex.x, P.vex.y);
    const pw = popup.offsetWidth || 360;
    popup.style.left = Math.min(innerWidth - pw - 16, vx + 22) + "px"; popup.style.top = Math.max(70, vy - popup.offsetHeight - 26) + "px";
    popup.style.opacity = pa; popup.style.transform = `scale(${0.6 + 0.4 * pa}) rotate(${(1 - pa) * -4}deg)`;
    ptime.style.transform = `scaleX(${1 - ss(0.4, 0.82, t4)})`;
    const pressed = t4 > 0.12 && t4 < 0.2;
    f8.classList.toggle("down", pressed);
    if (pressed && !f8Fired) { f8Fired = true; P.vex.ping = now; } if (t4 < 0.1) f8Fired = false;

    const tr = ss(0.05, 0.85, t5);
    S.trails = t5 > 0 && t5 < 1.6 ? T.map((x) => ({ ...x, t: tr, bright: 0.65 })) : [];
    const da = ss(0.0, 0.15, t5) * (1 - ss(0.9, 1.05, t5));
    dock.style.opacity = da; dock.style.transform = `translateX(-50%) translateY(${(1 - da) * 30}px)`;
    playhead.style.left = 19 + tr * (playhead.parentElement.offsetWidth - 19) + "px";
    const rs = Math.round(tr * 31 * 60 + 40); dockT.textContent = `${pad(Math.floor(rs / 60))}:${pad(rs % 60)}`;
    S.route = t6 > 0.05 ? { from: "you", to: 0 } : null;
  };

  // ======================= below the raid =======================
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.2 });
  $$(".reveal").forEach((el) => io.observe(el));
  const neverItems = $$("#never li"), keysTrack = $("#keys"), keysRow = $("#keysRow");
  function after() {
    neverItems.forEach((li) => { const r = li.getBoundingClientRect(); li.style.setProperty("--strike", clamp((innerHeight * 0.8 - r.top) / (innerHeight * 0.25)).toFixed(3)); });
    const r = keysTrack.getBoundingClientRect(), t = clamp(-r.top / (r.height - innerHeight));
    keysRow.style.transform = `translateX(${-t * Math.max(0, keysRow.scrollWidth - innerWidth + 48)}px)`;
  }
  addEventListener("scroll", after, { passive: true }); addEventListener("resize", after);

  document.fonts.ready.then(() => {
    mini.start(); m.start(); readScroll(); after();
    // both maps sleep while the track is off screen
    new IntersectionObserver(([e]) => { m.pause(!e.isIntersecting); if (!e.isIntersecting) mini.pause(true); }).observe(track);
    setTimeout(() => { if (atTop()) press("F8"); }, 2600);
  });
})();
