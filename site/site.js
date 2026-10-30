// TarTrak site: the dial in the hero, the squad panel's ages, and the latest version from GitHub.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- latest release ----------
  // The page ships with the current version filled in; this only updates it.
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  function applyRelease(r) {
    const ver = String(r.tag_name || "").replace(/^v/, "");
    if (!/^\d+\.\d+\.\d+$/.test(ver)) return;
    document.querySelectorAll("[data-ver]").forEach((el) => (el.textContent = ver));
    if (r.published_at) document.querySelectorAll("[data-date]").forEach((el) => (el.textContent = fmtDate(r.published_at)));
    const exe = (r.assets || []).find((a) => /-setup\.exe$/i.test(a.name));
    if (exe && /^https:\/\/github\.com\/cthpAiden\/TarTrak\/releases\/download\//.test(exe.browser_download_url)) {
      document.querySelectorAll("[data-dl]").forEach((a) => (a.href = exe.browser_download_url));
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

  // ---------- squad panel: ages tick and reset like real updates ----------
  const ages = [...document.querySelectorAll(".age")];
  if (!reduce) setInterval(() => ages.forEach((a) => {
    let n = +a.dataset.age + 1;
    if (n > 4 + Math.random() * 6) n = 0;
    a.dataset.age = n;
    a.textContent = n === 0 ? "now" : `${n}s ago`;
  }), 1000);

  // ---------- terrain: seeded simplex noise and marching-squares contours ----------
  function rng(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise(seed) {
    const r = rng(seed), perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const g = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    const c = (gi, x, y) => { let q = 0.5 - x * x - y * y; if (q < 0) return 0; q *= q; return q * q * (g[gi][0] * x + g[gi][1] * y); };
    function n2(xin, yin) {
      const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255;
      return 70 * (c(p[ii + p[jj]] & 7, x0, y0) + c(p[ii + i1 + p[jj + j1]] & 7, x1, y1) + c(p[ii + 1 + p[jj + 1]] & 7, x2, y2));
    }
    return (x, y) => { let a = 1, f = 1, s = 0, n = 0; for (let k = 0; k < 4; k++) { s += a * n2(x * f, y * f); n += a; a *= 0.5; f *= 2; } return s / n; };
  }
  // Edges: 0 top, 1 right, 2 bottom, 3 left.
  const CASES = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]], [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];
  function contours(field, w, h, cell, levels, majorEvery) {
    const cols = Math.ceil(w / cell) + 2, rows = Math.ceil(h / cell) + 2, v = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = field(i * cell, j * cell);
    const minor = new Path2D(), major = new Path2D();
    levels.forEach((l, k) => {
      const path = k % majorEvery === 0 ? major : minor;
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = v[j * cols + i], b = v[j * cols + i + 1], cc = v[(j + 1) * cols + i + 1], d = v[(j + 1) * cols + i];
        const idx = (a > l ? 8 : 0) | (b > l ? 4 : 0) | (cc > l ? 2 : 0) | (d > l ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const pt = (e) => e === 0 ? [(i + (l - a) / (b - a)) * cell, j * cell] : e === 1 ? [(i + 1) * cell, (j + (l - b) / (cc - b)) * cell]
          : e === 2 ? [(i + (l - d) / (cc - d)) * cell, (j + 1) * cell] : [i * cell, (j + (l - a) / (d - a)) * cell];
        for (const [e1, e2] of CASES[idx]) { const p1 = pt(e1), p2 = pt(e2); path.moveTo(p1[0], p1[1]); path.lineTo(p2[0], p2[1]); }
      }
    });
    return { minor, major };
  }
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };

  // ---------- the dial ----------
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  const ring = document.getElementById("ring"), hbox = document.getElementById("hbox"), hlabel = document.getElementById("hlabel"), htext = document.getElementById("htext");
  if (!ring) return;

  // engraved degree ring: ticks every 2°, numbers every 30°, cardinals
  for (let d = 0; d < 360; d += 2) {
    const a = d * Math.PI / 180, s = Math.sin(a), c = -Math.cos(a), len = d % 30 === 0 ? 26 : d % 10 === 0 ? 17 : 9;
    svgEl("line", { x1: 500 + s * 420, y1: 500 + c * 420, x2: 500 + s * (420 - len), y2: 500 + c * (420 - len),
      stroke: d === 0 ? "#e8513f" : "#dcd8c6", "stroke-width": d % 30 === 0 ? 3.5 : d % 10 === 0 ? 2.2 : 1.2, opacity: d % 10 === 0 ? 1 : 0.7 }, ring);
  }
  for (let d = 0; d < 360; d += 30) {
    const a = d * Math.PI / 180, x = 500 + Math.sin(a) * 365, y = 500 - Math.cos(a) * 365, card = { 0: "N", 90: "E", 180: "S", 270: "W" }[d];
    svgEl("text", { x, y, "text-anchor": "middle", "dominant-baseline": "central", transform: `rotate(${d} ${x} ${y})`,
      fill: d === 0 ? "#e8513f" : "#dcd8c6", "font-family": "Michroma, sans-serif", "font-size": card ? 34 : 19 }, ring).textContent = card || String(d / 10).padStart(2, "0");
  }

  // squad, metres from you (x east, y south)
  const mates = [
    { name: "GHOST", color: "#00e5ff", x: -28, y: -38, h: 330 },
    { name: "NOMAD", floor: "2F", color: "#b388ff", x: 62, y: 57, h: 120 },
    { name: "VEX", color: "#ff4081", x: -96, y: 91, h: 210 },
  ];
  for (const m of mates) {
    m.d = Math.round(Math.hypot(m.x, m.y));
    m.b = (Math.atan2(m.x, -m.y) * 180 / Math.PI + 360) % 360;
    m.ping = -9;
    const g = svgEl("g", { transform: `rotate(${m.b} 500 500)` }, ring);
    svgEl("path", { d: "M500 330 l-11 -18 h22 z", fill: m.color, stroke: "#0c0e0a", "stroke-width": 2 }, g);
  }

  // raid timer and teammate distances step up the lower right of the rim, closest first
  const chips = document.getElementById("chips");
  [{ raid: true }, ...mates.slice().sort((a, b) => a.d - b.d).map((m) => ({ m }))].forEach((r, i) => {
    const ang = (165 - i * 17) * Math.PI / 180;
    const c = document.createElement("div");
    c.className = "chip" + (r.m ? " mate" : "");
    c.style.left = 50 + Math.sin(ang) * 47 + "%";
    c.style.top = 50 - Math.cos(ang) * 47 + "%";
    const s = document.createElement("span");
    if (r.m) {
      const dot = document.createElement("i"); dot.style.background = r.m.color;
      s.textContent = r.m.name;
      c.append(dot, s, `${r.m.d} m`);
    } else {
      const v = document.createElement("b"); v.id = "raid"; v.textContent = "31:42";
      s.textContent = "RAID";
      c.append(s, v);
    }
    chips.appendChild(c);
  });
  let left = 31 * 60 + 42;
  const raid = document.getElementById("raid");
  setInterval(() => { left = Math.max(0, left - 1); raid.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`; }, 1000);

  // map
  const cv = document.getElementById("dmap"), ctx = cv.getContext("2d");
  const field = noise(31);
  let size = 0, D = 1, span = 170, base = null;  // span: metres from the centre to the edge
  function build() {
    size = cv.clientWidth; D = Math.min(2, devicePixelRatio || 1);
    if (!size) return;
    cv.width = cv.height = Math.round(size * D);
    const ppm = size / 2 / span, s = Math.ceil(size * 1.45);
    base = document.createElement("canvas"); base.width = base.height = Math.round(s * D);
    const b = base.getContext("2d"); b.scale(D, D);
    b.fillStyle = "#1e2419"; b.fillRect(0, 0, s, s);
    const k = 1 / (ppm * 260), levels = [];
    for (let l = -0.75; l <= 0.75001; l += 0.075) levels.push(l);
    const p = contours((x, y) => field((x - s / 2) * k + 4, (y - s / 2) * k + 2), s, s, 6, levels, 4);
    b.strokeStyle = "#323b2b"; b.lineWidth = 1; b.stroke(p.minor);
    b.strokeStyle = "#45503b"; b.lineWidth = 1.5; b.stroke(p.major);
    b.strokeStyle = "rgba(220,216,198,0.05)"; b.beginPath();
    for (let v = (s / 2) % (50 * ppm); v < s; v += 50 * ppm) { b.moveTo(v, 0); b.lineTo(v, s); b.moveTo(0, v); b.lineTo(s, v); }
    b.stroke();
    const road = () => { b.beginPath(); b.moveTo(0, s * 0.62); b.quadraticCurveTo(s * 0.5, s * 0.42, s, s * 0.5); b.stroke(); };
    b.strokeStyle = "#2b3026"; b.lineWidth = 9 * ppm + 2; b.lineCap = "round"; road();
    b.strokeStyle = "#6a705f"; b.lineWidth = 2; b.setLineDash([10, 8]); road(); b.setLineDash([]);
    const r = rng(3);
    for (let i = 0; i < 14; i++) {
      const x = s / 2 + (r() - 0.3) * 120 * ppm, y = s / 2 + (r() - 0.75) * 110 * ppm, w = (8 + r() * 18) * ppm, h = (8 + r() * 14) * ppm;
      b.fillStyle = "#3a4136"; b.fillRect(x, y, w, h); b.strokeStyle = "#262b23"; b.lineWidth = 2; b.strokeRect(x, y, w, h);
    }
  }

  const st = { ht: 48, hd: 48, mode: 0, md: 0, ping: -9, aim: null, last: performance.now(), lastShot: performance.now() };
  const ad = (a, b) => ((a - b + 540) % 360) - 180;

  function line(x, y, h, color, alpha, ppm) {
    const a = (h - 90) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), len = 100 * ppm;
    const g = ctx.createLinearGradient(x, y, x + cs * len, y + sn * len);
    g.addColorStop(0, hexA(color, alpha)); g.addColorStop(1, hexA(color, 0));
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(x + cs * 9, y + sn * 9); ctx.lineTo(x + cs * len, y + sn * len); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    for (const [m, o] of [[50, 0.8], [100, 0.55], [150, 0.35]]) {
      const d = m * ppm, px = x + cs * d, py = y + sn * d;
      ctx.strokeStyle = hexA(color, o * alpha); ctx.beginPath();
      ctx.moveTo(px - sn * 3.5, py + cs * 3.5); ctx.lineTo(px - sn * 8, py + cs * 8);
      ctx.moveTo(px + sn * 3.5, py - cs * 3.5); ctx.lineTo(px + sn * 8, py - cs * 8); ctx.stroke();
    }
  }

  let visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(cv);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { st.last = now; return; }
    const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 7);
    st.hd = (st.hd + ad(st.ht, st.hd) * k + 360) % 360;
    st.md += (st.mode - st.md) * k;
    const ringRot = -st.hd * st.md, boxRot = st.hd * (1 - st.md);
    ring.setAttribute("transform", `rotate(${ringRot} 500 500)`);
    hbox.setAttribute("transform", `rotate(${boxRot} 500 500)`);
    hlabel.setAttribute("transform", `rotate(${-boxRot} 500 63)`);
    htext.textContent = String(Math.round(st.ht) % 360).padStart(3, "0") + "°";
    if (!base) return;

    const ppm = size / 2 / span, c = size / 2, s = base.width / D;
    ctx.setTransform(D, 0, 0, D, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.clip();
    ctx.translate(c, c); ctx.rotate(ringRot * Math.PI / 180);
    ctx.drawImage(base, -s / 2, -s / 2, s, s);
    for (const m of mates) {
      const x = m.x * ppm, y = m.y * ppm;
      if (!reduce && now > (m.next || 0)) { m.ping = now; m.next = now + 2200 + Math.random() * 3000; m.h = (m.h + (Math.random() - 0.5) * 60 + 360) % 360; }
      line(x, y, m.h, m.color, 1, ppm);
      const t = (now - m.ping) / 900;
      if (t >= 0 && t < 1) { ctx.beginPath(); ctx.arc(x, y, 7 + t * 34, 0, Math.PI * 2); ctx.strokeStyle = hexA(m.color, 0.7 * (1 - t)); ctx.lineWidth = 2; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fillStyle = "#0c0e0a"; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fillStyle = m.color; ctx.fill();
      // labels stay upright on a turned map
      ctx.save(); ctx.translate(x, y); ctx.rotate(-ringRot * Math.PI / 180);
      ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textBaseline = "middle";
      const label = m.floor ? `${m.name} [${m.floor}]` : m.name, w = ctx.measureText(label).width + 12;
      ctx.fillStyle = "rgba(12,14,10,0.88)"; ctx.fillRect(11, -24, w, 18);
      ctx.fillStyle = m.color; ctx.fillText(label, 17, -15);
      ctx.restore();
    }
    // where a screenshot taken now would point you
    if (st.aim !== null) {
      const a = (st.aim - 90) * Math.PI / 180;
      ctx.strokeStyle = "rgba(240,180,41,0.35)"; ctx.lineWidth = 1.5; ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * c, Math.sin(a) * c); ctx.stroke(); ctx.setLineDash([]);
    }
    line(0, 0, st.hd, "#f0b429", 1, ppm);
    const t = (now - st.ping) / 900;
    if (t >= 0 && t < 1) { ctx.beginPath(); ctx.arc(0, 0, 9 + t * 44, 0, Math.PI * 2); ctx.strokeStyle = `rgba(240,180,41,${0.75 * (1 - t)})`; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fillStyle = "#0c0e0a"; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fillStyle = "#f0b429"; ctx.fill();
    ctx.restore();
    const g = ctx.createRadialGradient(c, c, c * 0.82, c, c, c);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();

    if (!reduce && now - st.lastShot > 6000) shoot((st.ht + (Math.random() - 0.5) * 100 + 360) % 360, now);
  }
  function shoot(h, now) { st.ht = h; st.ping = now; st.lastShot = now; }

  const angleAt = (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    return ((Math.atan2(x, -y) * 180 / Math.PI) + st.hd * st.md + 720) % 360;
  };
  cv.addEventListener("pointermove", (e) => { st.aim = angleAt(e); });
  cv.addEventListener("pointerleave", () => { st.aim = null; });
  cv.addEventListener("click", (e) => shoot(angleAt(e), performance.now()));

  // rotation: rim button and the segmented control stay in sync
  const rot = document.getElementById("rot"), mn = document.getElementById("mn"), mh = document.getElementById("mh");
  function setMode(m) {
    st.mode = m;
    rot.setAttribute("aria-pressed", String(m === 1)); rot.textContent = m ? "H" : "N";
    mn.setAttribute("aria-pressed", String(m === 0)); mh.setAttribute("aria-pressed", String(m === 1));
  }
  rot.addEventListener("click", () => setMode(st.mode ? 0 : 1));
  mn.addEventListener("click", () => setMode(0));
  mh.addEventListener("click", () => setMode(1));
  document.getElementById("zin").addEventListener("click", () => { span = Math.max(80, span / 1.35); build(); });
  document.getElementById("zout").addEventListener("click", () => { span = Math.min(420, span * 1.35); build(); });

  document.fonts.ready.then(() => { build(); requestAnimationFrame(frame); });
  let rt;
  // phones fire resize when the address bar slides; only a new width or pixel ratio needs new contours
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (cv.clientWidth !== size || Math.min(2, devicePixelRatio || 1) !== D) build(); }, 150); });
})();
