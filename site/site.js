// TarTrak site: the live map in the hero, the filename anatomy, the squad panel's ages, and the latest version from GitHub.
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

  // ---------- filename anatomy: light the two groups in turn ----------
  const groups = [...document.querySelectorAll("#fname .grp[data-g]")];
  let gi = 0;
  if (!reduce) setInterval(() => { groups.forEach((g, i) => g.classList.toggle("hot", i === gi % 2)); gi++; }, 1800);
  else groups.forEach((g) => g.classList.add("hot"));

  // ---------- terrain: seeded simplex noise and marching-squares contours ----------
  function rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 2D simplex noise, summed over octaves. Returns roughly -1..1.
  function noise(seed) {
    const r = rng(seed);
    const perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const g = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    function n2(xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      const c = (gi, x, y) => {
        let q = 0.5 - x * x - y * y;
        if (q < 0) return 0;
        q *= q;
        return q * q * (g[gi][0] * x + g[gi][1] * y);
      };
      return 70 * (c(p[ii + p[jj]] & 7, x0, y0) + c(p[ii + i1 + p[jj + j1]] & 7, x1, y1) + c(p[ii + 1 + p[jj + 1]] & 7, x2, y2));
    }
    return function (x, y, oct = 4) {
      let a = 1, f = 1, s = 0, n = 0;
      for (let k = 0; k < oct; k++) { s += a * n2(x * f, y * f); n += a; a *= 0.5; f *= 2; }
      return s / n;
    };
  }
  // Edges: 0 top, 1 right, 2 bottom, 3 left.
  const CASES = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]],
    [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];
  // field(x, y) in px -> value. Returns { minor, major } Path2D in px; every `majorEvery`-th level is major.
  function contours(field, w, h, cell, levels, majorEvery) {
    const cols = Math.ceil(w / cell) + 2, rows = Math.ceil(h / cell) + 2;
    const v = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = field(i * cell, j * cell);
    const minor = new Path2D(), major = new Path2D();
    levels.forEach((l, k) => {
      const path = majorEvery && k % majorEvery === 0 ? major : minor;
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = v[j * cols + i], b = v[j * cols + i + 1], c = v[(j + 1) * cols + i + 1], d = v[(j + 1) * cols + i];
          const idx = (a > l ? 8 : 0) | (b > l ? 4 : 0) | (c > l ? 2 : 0) | (d > l ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const pt = (e) => {
            if (e === 0) return [(i + (l - a) / (b - a)) * cell, j * cell];
            if (e === 1) return [(i + 1) * cell, (j + (l - b) / (c - b)) * cell];
            if (e === 2) return [(i + (l - d) / (c - d)) * cell, (j + 1) * cell];
            return [i * cell, (j + (l - a) / (d - a)) * cell];
          };
          for (const [e1, e2] of CASES[idx]) {
            const p1 = pt(e1), p2 = pt(e2);
            path.moveTo(p1[0], p1[1]);
            path.lineTo(p2[0], p2[1]);
          }
        }
      }
    });
    return { minor, major };
  }
  function range(from, to, step) {
    const out = [];
    for (let x = from; x <= to + 1e-9; x += step) out.push(x);
    return out;
  }
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  // The filename Tarkov saves on PrintScreen. heading in degrees, 0 = north, clockwise.
  function filename(x, y, z, heading, date = new Date()) {
    const half = (heading * Math.PI) / 360;
    const q = [0, Math.sin(half), 0, Math.cos(half)].map((n) => n.toFixed(5));
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}[${pad(date.getHours())}-${pad(date.getMinutes())}]`;
    return { stamp, pos: [x, y, z].map((n) => n.toFixed(2)), rot: q };
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  // ---------- the live map ----------
  const C = { ground: "#20251d", contour: "#343d2e", major: "#465140", water: "#18252a", waterEdge: "#2c4046",
    road: "#6a705f", roadEdge: "#2b3026", roof: "#3a4136", wall: "#262b23", amber: "#f0b429", fg: "#e8eaed", deep: "#0b0d10" };
  const cv = document.getElementById("map"), ctx = cv.getContext("2d");
  const wrap = cv.parentElement;
  const field = noise(11);
  let W = 0, H = 0, DPR = 1, mpp = 1, base = null, born = performance.now();
  const rnd = rng(4);

  // world features, in fractions of the map box (all made up)
  const river = [[-0.05, 0.82], [0.2, 0.7], [0.38, 0.76], [0.55, 0.58], [0.72, 0.52], [0.86, 0.3], [1.05, 0.22]];
  const road = [[-0.05, 0.38], [0.25, 0.42], [0.48, 0.34], [0.7, 0.4], [1.05, 0.36]];
  const road2 = [[0.62, -0.05], [0.6, 0.3], [0.66, 0.6], [0.6, 1.05]];
  const clusters = [[0.72, 0.24, "SAWMILL"], [0.88, 0.62, "DEPOT"], [0.44, 0.22, "RAIL YARD"], [0.3, 0.6, "RIVERSIDE"]];
  const extracts = [[0.86, 0.86, "NORTH GATE", "#3ecf8e"], [0.5, 0.9, "PIER 4", "#4fb3ff"], [0.12, 0.2, "TUNNEL", "#f0b429"]];

  function smooth(g, pts) {
    const P = pts.map(([x, y]) => [x * W, y * H]);
    g.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) {
      const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
      g.quadraticCurveTo(P[i][0], P[i][1], mx, my);
    }
    g.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
  }

  function build() {
    const r = wrap.getBoundingClientRect();
    W = r.width; H = r.height; DPR = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    mpp = Math.max(0.5, Math.min(1.25, 760 / W));
    base = document.createElement("canvas");
    base.width = cv.width; base.height = cv.height;
    const b = base.getContext("2d");
    b.scale(DPR, DPR);
    b.fillStyle = C.ground; b.fillRect(0, 0, W, H);
    // terrain
    const k = mpp / 300;
    const paths = contours((x, y) => field(x * k + 3, y * k + 7), W, H, 7, range(-0.75, 0.75, 0.075), 4);
    b.lineWidth = 1; b.strokeStyle = C.contour; b.stroke(paths.minor);
    b.lineWidth = 1.5; b.strokeStyle = C.major; b.stroke(paths.major);
    // 100 m grid
    b.strokeStyle = "rgba(255,255,255,0.035)"; b.lineWidth = 1;
    const step = 100 / mpp;
    b.beginPath();
    for (let x = W / 2 % step; x < W; x += step) { b.moveTo(x, 0); b.lineTo(x, H); }
    for (let y = H / 2 % step; y < H; y += step) { b.moveTo(0, y); b.lineTo(W, y); }
    b.stroke();
    // river
    b.lineCap = "round"; b.lineJoin = "round";
    b.beginPath(); smooth(b, river); b.strokeStyle = C.waterEdge; b.lineWidth = 24 / mpp; b.stroke();
    b.beginPath(); smooth(b, river); b.strokeStyle = C.water; b.lineWidth = 20 / mpp; b.stroke();
    // roads
    for (const rd of [road, road2]) {
      b.beginPath(); smooth(b, rd); b.strokeStyle = C.roadEdge; b.lineWidth = 9 / mpp + 2; b.stroke();
      b.beginPath(); smooth(b, rd); b.strokeStyle = C.road; b.lineWidth = 2; b.setLineDash([10, 8]); b.stroke(); b.setLineDash([]);
    }
    // buildings
    const br = rng(9);
    for (const [cx, cy] of clusters) {
      for (let i = 0; i < 9; i++) {
        const x = cx * W + (br() - 0.5) * 150 / mpp, y = cy * H + (br() - 0.5) * 110 / mpp;
        const w = (10 + br() * 26) / mpp, h = (8 + br() * 18) / mpp, a = (br() - 0.5) * 0.5;
        b.save(); b.translate(x, y); b.rotate(a);
        b.fillStyle = C.roof; b.fillRect(-w / 2, -h / 2, w, h);
        b.strokeStyle = C.wall; b.lineWidth = 2; b.strokeRect(-w / 2, -h / 2, w, h);
        b.restore();
      }
    }
    // area labels
    b.font = `600 ${Math.round(13 / Math.sqrt(mpp))}px "IBM Plex Sans Condensed", sans-serif`;
    b.fillStyle = "rgba(232,234,237,0.3)"; b.textAlign = "center";
    for (const [cx, cy, name] of clusters) b.fillText(name.split("").join(String.fromCharCode(8202)), cx * W, cy * H - 70 / mpp);
    // edge ticks
    b.font = '10px "IBM Plex Mono", monospace'; b.fillStyle = "rgba(232,234,237,0.28)"; b.textAlign = "left";
    for (let x = W / 2 % step; x < W; x += step) b.fillText(String((Math.round((x - W / 2) * mpp / 100)) * 100), x + 4, H - 56);
  }

  // entities
  const deg = (a) => (a * Math.PI) / 180;
  const you = { x: 0, y: 0, h: 48, ping: -9, label: "YOU", color: C.amber };
  const mates = [
    { label: "GHOST", color: "#00e5ff", off: [-60, -40] },
    { label: "NOMAD", color: "#b388ff", off: [70, 30], floor: "2F" },
    { label: "VEX", color: "#ff4081", off: [-40, 110] },
  ];
  let lastClick = 0, pointer = null;

  function place() {
    you.x = W > 760 ? W * 0.66 : W * 0.5;
    you.y = H * 0.48;
    for (const m of mates) {
      m.tx = m.x = you.x + m.off[0] / mpp; m.ty = m.y = you.y + m.off[1] / mpp;
      m.h = Math.round(rnd() * 360); m.ping = -9; m.next = performance.now() + 600 + rnd() * 1800;
      pickWaypoint(m);
    }
  }
  const clampX = (x) => Math.max(W > 760 ? W * 0.44 : 24, Math.min(W - 24, x));
  const clampY = (y) => Math.max(110, Math.min(H - 70, y));
  function pickWaypoint(m) {
    const a = rnd() * Math.PI * 2, d = (40 + rnd() * 120) / mpp;
    m.wx = clampX(you.x + Math.cos(a) * d); m.wy = clampY(you.y + Math.sin(a) * d);
  }

  const bearing = (dx, dy) => ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const toWorld = (x, y) => ({ X: -182.4 + (x - you.x0) * mpp, Z: -71.0 - (y - you.y0) * mpp });

  function headingLine(e, alpha) {
    const a = deg(e.h - 90), len = 100 / mpp, cs = Math.cos(a), sn = Math.sin(a);
    const g = ctx.createLinearGradient(e.x, e.y, e.x + cs * len, e.y + sn * len);
    g.addColorStop(0, hexA(e.color, 0.95 * alpha)); g.addColorStop(1, hexA(e.color, 0));
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(e.x + cs * 9, e.y + sn * 9); ctx.lineTo(e.x + cs * len, e.y + sn * len); ctx.stroke();
    ctx.setLineDash([]);
    // range marks at 50, 100, 150 m: split ticks either side of the line
    if (len > 40) {
      ctx.lineWidth = 1.5;
      for (const [m, o] of [[50, 0.8], [100, 0.55], [150, 0.35]]) {
        const d = m / mpp, cx = e.x + cs * d, cy = e.y + sn * d;
        ctx.strokeStyle = hexA(e.color, o * alpha);
        ctx.beginPath();
        ctx.moveTo(cx - sn * 3.5, cy + cs * 3.5); ctx.lineTo(cx - sn * 8, cy + cs * 8);
        ctx.moveTo(cx + sn * 3.5, cy - cs * 3.5); ctx.lineTo(cx + sn * 8, cy - cs * 8);
        ctx.stroke();
      }
    }
  }
  function dot(e, alpha, r) {
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 2.5, 0, Math.PI * 2); ctx.fillStyle = hexA("#0b0d10", 0.9 * alpha); ctx.fill();
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fillStyle = hexA(e.color, alpha); ctx.fill();
  }
  function ping(e, now) {
    const t = (now - e.ping) / 900;
    if (t < 0 || t > 1) return;
    ctx.beginPath(); ctx.arc(e.x, e.y, 8 + t * 46, 0, Math.PI * 2);
    ctx.strokeStyle = hexA(e.color, 0.7 * (1 - t)); ctx.lineWidth = 2; ctx.stroke();
  }
  function label(e, text, sub) {
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    const w1 = ctx.measureText(text).width, w2 = sub ? ctx.measureText(sub).width + 8 : 0;
    const x = e.x + 13, y = e.y - 22, w = w1 + w2 + 14;
    ctx.fillStyle = "rgba(11,13,16,0.86)"; ctx.strokeStyle = hexA(e.color, 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, 19, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = e.color; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(text, x + 7, y + 10);
    if (sub) { ctx.fillStyle = C.fg; ctx.fillText(sub, x + 7 + w1 + 8, y + 10); }
  }

  function draw(now) {
    const dt = Math.min(50, now - (draw.last || now)); draw.last = now;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(base, 0, 0, W, H);
    const age = reduce ? 99 : (now - born) / 1000;
    const R = Math.hypot(W, H) * (1 - Math.pow(2, -6 * Math.min(1, age / 1.8)));
    const revealing = age < 1.8;
    ctx.save();
    if (revealing) {
      ctx.fillStyle = C.deep; ctx.fillRect(0, 0, W, H);
      ctx.beginPath(); ctx.arc(you.x, you.y, R, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(base, 0, 0, W, H);
    }
    // route to the first extract
    const ex = extracts[0], exX = ex[0] * W, exY = ex[1] * H;
    ctx.strokeStyle = "rgba(62,207,142,0.5)"; ctx.lineWidth = 1.5; ctx.setLineDash([2, 6]); ctx.lineDashOffset = -now / 40;
    ctx.beginPath(); ctx.moveTo(you.x, you.y); ctx.lineTo(exX, exY); ctx.stroke(); ctx.setLineDash([]);
    // extracts
    ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textBaseline = "middle";
    for (const [fx, fy, name, col] of extracts) {
      const x = fx * W, y = fy * H;
      ctx.fillStyle = "rgba(11,13,16,0.85)"; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x - 9, y - 9, 18, 18, 4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.lineTo(x + 4, y - 3); ctx.moveTo(x - 1, y - 3); ctx.lineTo(x + 4, y - 3); ctx.lineTo(x + 4, y + 2);
      ctx.strokeStyle = col; ctx.stroke();
      const right = x < W - 120;
      ctx.textAlign = right ? "left" : "right"; ctx.fillStyle = col;
      const dist = name === ex[2] ? `  ${Math.round(Math.hypot(exX - you.x, exY - you.y) * mpp)} m` : "";
      ctx.fillText(name + dist, right ? x + 15 : x - 15, y);
    }
    // teammates
    for (const m of mates) {
      if (!reduce) {
        const sp = (2.6 / mpp) * (dt / 1000) * 3;
        const dx = m.wx - m.tx, dy = m.wy - m.ty, d = Math.hypot(dx, dy);
        if (d < 4) pickWaypoint(m); else { m.tx += (dx / d) * sp; m.ty += (dy / d) * sp; m.dir = bearing(dx, dy); }
        if (now > m.next) {
          m.x = m.tx; m.y = m.ty; m.h = (m.dir ?? m.h) + (rnd() - 0.5) * 70; m.ping = now;
          m.next = now + 1600 + rnd() * 2600;
        }
      }
      const stale = Math.min(1, Math.max(0, (now - m.ping) / 1000 - 30) / 270);
      const a = 1 - 0.65 * stale;
      headingLine(m, a); ping(m, now); dot(m, a, 6);
      label(m, m.floor ? `${m.label} [${m.floor}]` : m.label, `${Math.round(Math.hypot(m.x - you.x, m.y - you.y) * mpp)} m`);
    }
    // you
    headingLine(you, 1); ping(you, now); dot(you, 1, 7.5);
    if (revealing) {
      ctx.restore(); ctx.save();
      ctx.beginPath(); ctx.arc(you.x, you.y, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(240,180,41,0.75)"; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
    // cursor readout
    if (pointer) {
      const w = toWorld(pointer.x, pointer.y);
      ctx.strokeStyle = "rgba(240,180,41,0.9)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.textAlign = "left"; ctx.textBaseline = "top";
      const t = `X ${w.X.toFixed(1)}  Z ${w.Z.toFixed(1)}`;
      ctx.fillStyle = "rgba(11,13,16,0.86)"; ctx.fillRect(pointer.x + 16, pointer.y + 12, ctx.measureText(t).width + 12, 34);
      ctx.fillStyle = C.fg; ctx.fillText(t, pointer.x + 22, pointer.y + 16);
      ctx.fillStyle = C.amber; ctx.fillText("click = PrtSc", pointer.x + 22, pointer.y + 31);
    }
    // idle demo: you take a screenshot now and then
    if (!reduce && now - lastClick > 5200 && age > 2.4) {
      const a = deg(you.h - 90 + (rnd() - 0.5) * 80), d = (50 + rnd() * 70) / mpp;
      snap(clampX(you.x + Math.cos(a) * d), clampY(you.y + Math.sin(a) * d), now, true);
    }
    if (!reduce) requestAnimationFrame(draw);
  }

  const logEl = document.getElementById("log"), cap = document.getElementById("cap"), flash = document.getElementById("flash");
  function logShot() {
    const w = toWorld(you.x, you.y);
    const elev = 2 + field(you.x * 0.01, you.y * 0.01) * 6;
    const f = filename(w.X, elev, w.Z, you.h);
    const li = document.createElement("li");
    const em = (t) => { const e = document.createElement("em"); e.textContent = t; return e; };
    li.append(f.stamp + "_", em(f.pos.join(", ")), "_", em(f.rot.join(", ")), " (0).png");
    const relay = document.createElement("span"); relay.className = "relay"; relay.textContent = "→ sent to room K7Q2XM (3 teammates)";
    li.append(relay);
    logEl.prepend(li);
    while (logEl.children.length > 3) logEl.lastChild.remove();
    for (const r of logEl.querySelectorAll("li:not(:first-child) .relay")) r.remove();
    document.getElementById("sx").textContent = w.X.toFixed(1);
    document.getElementById("sz").textContent = w.Z.toFixed(1);
    document.getElementById("sh").textContent = String(Math.round(you.h) % 360).padStart(3, "0") + "°";
  }
  function snap(x, y, now, auto) {
    const dx = x - you.x, dy = y - you.y;
    if (Math.hypot(dx, dy) > 3) you.h = bearing(dx, dy);
    you.x = x; you.y = y; you.ping = now; lastClick = now;
    logShot();
    if (!auto) { flash.classList.remove("on"); void flash.offsetWidth; flash.classList.add("on"); }
    cap.classList.add("down"); setTimeout(() => cap.classList.remove("down"), 140);
  }

  cv.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; if (reduce) requestAnimationFrame(draw); });
  cv.addEventListener("pointerleave", () => { pointer = null; if (reduce) requestAnimationFrame(draw); });
  cv.addEventListener("click", (e) => { const r = cv.getBoundingClientRect(); snap(e.clientX - r.left, e.clientY - r.top, performance.now()); if (reduce) requestAnimationFrame(draw); });

  function init() {
    build(); place();
    you.x0 = you.x; you.y0 = you.y;
    logEl.textContent = ""; logShot();
    requestAnimationFrame(draw);
  }
  // phones fire resize when the address bar slides; only a new map size or pixel ratio needs new contours
  let t;
  addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const r = wrap.getBoundingClientRect();
      if (Math.round(r.width) === Math.round(W) && Math.round(r.height) === Math.round(H) && Math.min(2, devicePixelRatio || 1) === DPR) return;
      const ox = you.x / W, oy = you.y / H;
      build(); you.x = ox * W; you.y = oy * H;
      requestAnimationFrame(draw);
    }, 150);
  });
  document.fonts.ready.then(init);

  // raid clock
  let left = 31 * 60 + 42;
  setInterval(() => { left = Math.max(0, left - 1); document.getElementById("raid").textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`; }, 1000);
})();
