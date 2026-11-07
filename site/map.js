// TarTrak site map engine. A made-up topo map (simplex noise + marching squares) with TarTrak-style markers,
// heading lines, trails and a fog reveal. Everything is in fractions of the canvas so a scene looks the same at
// any size. Nothing here is real Tarkov data. Canvas fonts follow the page's --display / --mono tokens.
const TT_F = { display: '"Barlow Condensed", sans-serif', mono: '"JetBrains Mono", monospace' };
function ttSyncFonts() { const cs = getComputedStyle(document.documentElement); TT_F.display = cs.getPropertyValue("--display").trim() || TT_F.display; TT_F.mono = cs.getPropertyValue("--mono").trim() || TT_F.mono; }
window.TT = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    function n2(xin, yin) {
      const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255;
      const c = (gi, x, y) => { let q = 0.5 - x * x - y * y; if (q < 0) return 0; q *= q; return q * q * (g[gi][0] * x + g[gi][1] * y); };
      return 70 * (c(p[ii + p[jj]] & 7, x0, y0) + c(p[ii + i1 + p[jj + j1]] & 7, x1, y1) + c(p[ii + 1 + p[jj + 1]] & 7, x2, y2));
    }
    return (x, y, oct = 4) => { let a = 1, f = 1, s = 0, n = 0; for (let k = 0; k < oct; k++) { s += a * n2(x * f, y * f); n += a; a *= 0.5; f *= 2; } return s / n; };
  }
  const CASES = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]], [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];
  function contours(field, w, h, cell, levels, majorEvery) {
    const cols = Math.ceil(w / cell) + 2, rows = Math.ceil(h / cell) + 2, v = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = field(i * cell, j * cell);
    const minor = new Path2D(), major = new Path2D();
    levels.forEach((l, k) => {
      const path = majorEvery && k % majorEvery === 0 ? major : minor;
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = v[j * cols + i], b = v[j * cols + i + 1], c = v[(j + 1) * cols + i + 1], d = v[(j + 1) * cols + i];
        const idx = (a > l ? 8 : 0) | (b > l ? 4 : 0) | (c > l ? 2 : 0) | (d > l ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const pt = (e) => e === 0 ? [(i + (l - a) / (b - a)) * cell, j * cell] : e === 1 ? [(i + 1) * cell, (j + (l - b) / (c - b)) * cell]
          : e === 2 ? [(i + (l - d) / (c - d)) * cell, (j + 1) * cell] : [i * cell, (j + (l - a) / (d - a)) * cell];
        for (const [e1, e2] of CASES[idx]) { const p1 = pt(e1), p2 = pt(e2); path.moveTo(p1[0], p1[1]); path.lineTo(p2[0], p2[1]); }
      }
    });
    return { minor, major };
  }
  const range = (a, b, s) => { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(x); return o; };
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  function filename(x, y, z, heading, date = new Date()) {
    const half = (heading * Math.PI) / 360;
    const q = [0, Math.sin(half), 0, Math.cos(half)].map((n) => n.toFixed(5));
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}[${pad(date.getHours())}-${pad(date.getMinutes())}]`;
    return { stamp, pos: [x, y, z].map((n) => n.toFixed(2)), rot: q };
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  const deg = (a) => (a * Math.PI) / 180;
  const COL = { you: "#f0b429", ghost: "#00e5ff", nomad: "#b388ff", vex: "#ff4081", ok: "#3ecf8e", blue: "#4fb3ff" };

  // ---------- the map ----------
  // opts: { seed, world: {river, roads, clusters, extracts}, scale (metres per css px at 760 wide), tone: "green"|"night" }
  function map(canvas, opts = {}) {
    const ctx = canvas.getContext("2d"), host = canvas.parentElement;
    const field = noise(opts.seed ?? 11);
    const tone = opts.tone === "night"
      ? { ground: "#14181b", contour: "#232a2c", major: "#2f3836", water: "#0f191d", waterEdge: "#1f3036", road: "#4a5048", roadEdge: "#1c201b", roof: "#283029", wall: "#191d18" }
      : { ground: "#20251d", contour: "#343d2e", major: "#465140", water: "#18252a", waterEdge: "#2c4046", road: "#6a705f", roadEdge: "#2b3026", roof: "#3a4136", wall: "#262b23" };
    const world = Object.assign({
      river: [[-0.05, 0.82], [0.2, 0.7], [0.38, 0.76], [0.55, 0.58], [0.72, 0.52], [0.86, 0.3], [1.05, 0.22]],
      roads: [[[-0.05, 0.38], [0.25, 0.42], [0.48, 0.34], [0.7, 0.4], [1.05, 0.36]], [[0.62, -0.05], [0.6, 0.3], [0.66, 0.6], [0.6, 1.05]]],
      clusters: [[0.72, 0.24, "SAWMILL"], [0.88, 0.62, "DEPOT"], [0.44, 0.22, "RAIL YARD"], [0.3, 0.6, "RIVERSIDE"]],
      extracts: [[0.86, 0.86, "NORTH GATE", COL.ok], [0.5, 0.9, "PIER 4", COL.blue], [0.12, 0.2, "TUNNEL", COL.you]],
    }, opts.world || {});
    let W = 0, H = 0, DPR = 1, mpp = 1, base = null;
    // scene: callers mutate this. Entity positions are fractions; tx/ty are targets the entity glides to.
    const scene = {
      players: [], // {id, label, color, x, y, h, floor, sub, alpha, ping, show}
      trails: [], // {color, pts:[[fx,fy]], t: 0..1 drawn, bright: 0..1 from where the bright part starts}
      fog: null, // {x, y, r: fraction of diagonal} or null
      route: null, // {from: id, to: extract index}
      extracts: true, labels: true, grid: true, zoom: 1, cx: 0.5, cy: 0.5, dim: 0,
      onFrame: null,
    };
    function smooth(g, pts) {
      const P = pts.map(([x, y]) => [x * W, y * H]);
      g.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
      g.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    }
    function build() {
      const r = host.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height); DPR = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      mpp = Math.max(0.45, Math.min(1.25, (opts.scale ?? 760) / W));
      base = document.createElement("canvas"); base.width = canvas.width; base.height = canvas.height;
      const b = base.getContext("2d"); b.scale(DPR, DPR);
      b.fillStyle = tone.ground; b.fillRect(0, 0, W, H);
      const k = mpp / 300;
      const paths = contours((x, y) => field(x * k + 3, y * k + 7), W, H, 7, range(-0.75, 0.75, 0.075), 4);
      b.lineWidth = 1; b.strokeStyle = tone.contour; b.stroke(paths.minor);
      b.lineWidth = 1.5; b.strokeStyle = tone.major; b.stroke(paths.major);
      const step = 100 / mpp;
      if (scene.grid) {
        b.strokeStyle = "rgba(255,255,255,0.035)"; b.lineWidth = 1; b.beginPath();
        for (let x = (W / 2) % step; x < W; x += step) { b.moveTo(x, 0); b.lineTo(x, H); }
        for (let y = (H / 2) % step; y < H; y += step) { b.moveTo(0, y); b.lineTo(W, y); }
        b.stroke();
      }
      b.lineCap = "round"; b.lineJoin = "round";
      if (world.river) {
        b.beginPath(); smooth(b, world.river); b.strokeStyle = tone.waterEdge; b.lineWidth = 24 / mpp; b.stroke();
        b.beginPath(); smooth(b, world.river); b.strokeStyle = tone.water; b.lineWidth = 20 / mpp; b.stroke();
      }
      for (const rd of world.roads) {
        b.beginPath(); smooth(b, rd); b.strokeStyle = tone.roadEdge; b.lineWidth = 9 / mpp + 2; b.stroke();
        b.beginPath(); smooth(b, rd); b.strokeStyle = tone.road; b.lineWidth = 2; b.setLineDash([10, 8]); b.stroke(); b.setLineDash([]);
      }
      const br = rng(9);
      for (const [cx, cy] of world.clusters) for (let i = 0; i < 9; i++) {
        const x = cx * W + ((br() - 0.5) * 150) / mpp, y = cy * H + ((br() - 0.5) * 110) / mpp;
        const w = (10 + br() * 26) / mpp, h = (8 + br() * 18) / mpp, a = (br() - 0.5) * 0.5;
        b.save(); b.translate(x, y); b.rotate(a); b.fillStyle = tone.roof; b.fillRect(-w / 2, -h / 2, w, h);
        b.strokeStyle = tone.wall; b.lineWidth = 2; b.strokeRect(-w / 2, -h / 2, w, h); b.restore();
      }
      if (scene.labels) {
        b.font = `600 ${Math.round(13 / Math.sqrt(mpp))}px ${TT_F.display}`;
        b.fillStyle = "rgba(232,234,237,0.3)"; b.textAlign = "center";
        for (const [cx, cy, name] of world.clusters) b.fillText(name.split("").join(" "), cx * W, cy * H - 70 / mpp);
      }
    }
    const px = (e) => [e.x * W, e.y * H];
    function headingLine(x, y, h, color, alpha, len = 100) {
      const a = deg(h - 90), L = len / mpp, cs = Math.cos(a), sn = Math.sin(a);
      const g = ctx.createLinearGradient(x, y, x + cs * L, y + sn * L);
      g.addColorStop(0, hexA(color, 0.95 * alpha)); g.addColorStop(1, hexA(color, 0));
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(x + cs * 9, y + sn * 9); ctx.lineTo(x + cs * L, y + sn * L); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      for (const [m, o] of [[50, 0.8], [100, 0.55], [150, 0.35]]) {
        const d = m / mpp; if (d > L) break;
        const cx = x + cs * d, cy = y + sn * d; ctx.strokeStyle = hexA(color, o * alpha); ctx.beginPath();
        ctx.moveTo(cx - sn * 3.5, cy + cs * 3.5); ctx.lineTo(cx - sn * 8, cy + cs * 8);
        ctx.moveTo(cx + sn * 3.5, cy - cs * 3.5); ctx.lineTo(cx + sn * 8, cy - cs * 8); ctx.stroke();
      }
    }
    function dot(x, y, color, alpha, r) {
      ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.fillStyle = hexA("#0b0d10", 0.9 * alpha); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = hexA(color, alpha); ctx.fill();
    }
    function ping(x, y, color, t0, now) {
      const t = (now - t0) / 900; if (t < 0 || t > 1) return;
      ctx.beginPath(); ctx.arc(x, y, 8 + t * 46, 0, Math.PI * 2); ctx.strokeStyle = hexA(color, 0.7 * (1 - t)); ctx.lineWidth = 2; ctx.stroke();
    }
    function tag(x, y, color, text, sub, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.font = `600 11px ${TT_F.mono}`;
      const w1 = ctx.measureText(text).width, w2 = sub ? ctx.measureText(sub).width + 8 : 0;
      const bx = x + 13, by = y - 22, w = w1 + w2 + 14;
      ctx.fillStyle = "rgba(11,13,16,0.86)"; ctx.strokeStyle = hexA(color, 0.55); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(bx, by, w, 19, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(text, bx + 7, by + 10);
      if (sub) { ctx.fillStyle = "#e8eaed"; ctx.fillText(sub, bx + 7 + w1 + 8, by + 10); }
      ctx.globalAlpha = 1;
    }
    function trail(tr) {
      const P = tr.pts.map(([x, y]) => [x * W, y * H]);
      const n = P.length - 1, upto = Math.max(0, Math.min(1, tr.t ?? 1)) * n;
      if (upto <= 0) return null;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 3;
      let last = P[0];
      for (let i = 0; i < Math.ceil(upto); i++) {
        const f = Math.min(1, upto - i), a = P[i], b = P[i + 1];
        const e = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        ctx.strokeStyle = hexA(tr.color, i / n >= (tr.bright ?? 0.6) * (upto / n) ? 1 : 0.3);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
        last = e;
      }
      for (let i = 0; i <= Math.floor(upto); i++) { ctx.beginPath(); ctx.arc(P[i][0], P[i][1], 2.5, 0, 7); ctx.fillStyle = hexA(tr.color, 0.8); ctx.fill(); }
      return last;
    }
    let last = 0;
    function draw(now) {
      const dt = Math.min(50, now - (last || now)); last = now;
      scene.beforeFrame && scene.beforeFrame(now, dt);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = "#0b0d10"; ctx.fillRect(0, 0, W, H);
      // camera: zoom around (cx, cy)
      const z = scene.zoom;
      const hz = 0.5 / Math.max(1, z); scene.cx = Math.max(hz, Math.min(1 - hz, scene.cx)); scene.cy = Math.max(hz, Math.min(1 - hz, scene.cy));
      ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-scene.cx * W, -scene.cy * H);
      ctx.save();
      if (scene.fog) {
        const f = scene.fog, R = f.r * Math.hypot(W, H);
        ctx.beginPath(); ctx.arc(f.x * W, f.y * H, Math.max(0, R), 0, Math.PI * 2); ctx.clip();
      }
      ctx.drawImage(base, 0, 0, W, H);
      // extracts
      if (scene.extracts) {
        ctx.font = `600 11px ${TT_F.mono}`; ctx.textBaseline = "middle";
        for (const [fx, fy, name, col] of world.extracts) {
          const x = fx * W, y = fy * H;
          ctx.fillStyle = "rgba(11,13,16,0.85)"; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(x - 9, y - 9, 18, 18, 4); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.lineTo(x + 4, y - 3); ctx.moveTo(x - 1, y - 3); ctx.lineTo(x + 4, y - 3); ctx.lineTo(x + 4, y + 2); ctx.stroke();
          const right = x < W - 120; ctx.textAlign = right ? "left" : "right"; ctx.fillStyle = col;
          ctx.fillText(name, right ? x + 15 : x - 15, y);
        }
      }
      if (scene.route) {
        const p = scene.players.find((q) => q.id === scene.route.from), ex = world.extracts[scene.route.to];
        if (p && p.show !== false) {
          ctx.strokeStyle = "rgba(62,207,142,0.55)"; ctx.lineWidth = 1.5; ctx.setLineDash([2, 6]); ctx.lineDashOffset = -now / 40;
          ctx.beginPath(); ctx.moveTo(p.x * W, p.y * H); ctx.lineTo(ex[0] * W, ex[1] * H); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      for (const tr of scene.trails) trail(tr);
      // players glide to targets
      const you = scene.players[0];
      for (const p of [...scene.players].reverse()) {
        if (p.show === false) continue;
        if (p.tx != null) {
          const k = reduce ? 1 : 1 - Math.pow(0.0025, dt / 1000);
          p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
        }
        const [x, y] = px(p), a = p.alpha ?? 1;
        headingLine(x, y, p.h, p.color, a, p.len ?? 100); ping(x, y, p.color, p.ping ?? -9e9, now); dot(x, y, p.color, a, p === you ? 7.5 : 6);
        if (p.label) {
          const dist = p !== you && you && you.show !== false ? `${Math.round(Math.hypot((p.x - you.x) * W, (p.y - you.y) * H) * mpp)} m` : p.sub;
          tag(x, y, p.color, p.floor ? `${p.label} [${p.floor}]` : p.label, dist, a);
        }
      }
      ctx.restore();
      if (scene.fog) {
        const f = scene.fog, R = f.r * Math.hypot(W, H);
        if (R > 2) { ctx.beginPath(); ctx.arc(f.x * W, f.y * H, R, 0, Math.PI * 2); ctx.strokeStyle = "rgba(240,180,41,0.6)"; ctx.lineWidth = 1.5 / z; ctx.stroke(); }
      }
      if (scene.dim) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = `rgba(11,13,16,${scene.dim})`; ctx.fillRect(0, 0, W, H); }
      scene.onFrame && scene.onFrame(now, dt);
    }
    // one rAF chain at most; paused while off screen
    let paused = false, running = false;
    function loop(now) { if (paused) { running = false; return; } draw(now); requestAnimationFrame(loop); }
    function kick() { if (!running && !paused) { running = true; requestAnimationFrame(loop); } }
    let rt;
    new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { const r = host.getBoundingClientRect(); if (Math.round(r.width) !== Math.round(W) || Math.round(r.height) !== Math.round(H)) build(); }, 120); }).observe(host);
    const api = {
      scene, rng, W: () => W, H: () => H, mpp: () => mpp,
      start() { ttSyncFonts(); build(); kick(); return api; },
      pause(v) { paused = v; if (!v) kick(); },
      // fraction on the map -> css px on the canvas, through the current camera
      toScreen(fx, fy) { const z = scene.zoom; return [(fx - scene.cx) * W * z + W / 2, (fy - scene.cy) * H * z + H / 2]; },
      toWorld(fx, fy) { return { X: -182.4 + (fx - 0.62) * W * mpp, Z: -71.0 - (fy - 0.48) * H * mpp }; },
    };
    return api;
  }
  return { map, rng, filename, pad, COL };
})();
