// Shared by the site mockups: seeded noise, contour lines, screenshot filenames and the mockup switcher.
(function () {
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

  // Marching squares. Edges: 0 top, 1 right, 2 bottom, 3 left.
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
    return { stamp, pos: [x, y, z].map((n) => n.toFixed(2)), rot: q, text: `${stamp}_${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}_${q.join(", ")} (0).png` };
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  const MOCKUPS = [
    ["a-live-map.html", "A", "Live map"],
    ["b-field-manual.html", "B", "Field manual"],
    ["c-filename.html", "C", "The filename"],
    ["d-dial.html", "D", "The dial"],
  ];

  // A small fixed pill to step between mockups. Not part of any design.
  function switcher(current) {
    const i = MOCKUPS.findIndex((m) => m[1] === current);
    const prev = MOCKUPS[(i + MOCKUPS.length - 1) % MOCKUPS.length], next = MOCKUPS[(i + 1) % MOCKUPS.length];
    const css = document.createElement("style");
    css.textContent = `.ttm{position:fixed;z-index:9999;right:calc(12px + env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:rgba(14,16,19,.88);border:1px solid rgba(255,255,255,.14);font:500 12px/1 system-ui,sans-serif;color:#e8eaed;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 6px 24px rgba(0,0,0,.35)}
.ttm a{color:inherit;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 10px;border-radius:999px}
.ttm a:hover,.ttm a:focus-visible{background:rgba(255,255,255,.1);outline:none}
.ttm span{padding:0 8px;color:#aab3be;white-space:nowrap}.ttm b{color:#f0b429;font-weight:600}`;
    document.head.appendChild(css);
    const el = document.createElement("nav");
    el.className = "ttm";
    el.setAttribute("aria-label", "Mockups");
    const a = (href, text, label) => {
      const l = document.createElement("a");
      l.href = href;
      l.textContent = text;
      if (label) l.setAttribute("aria-label", label);
      return l;
    };
    const s = document.createElement("span");
    s.innerHTML = `<b>${current}</b> ${MOCKUPS[i][2]}`;
    el.append(a("index.html", "All", "All mockups"), a(prev[0], "‹", `Mockup ${prev[1]}`), s, a(next[0], "›", `Mockup ${next[1]}`));
    document.body.appendChild(el);
  }

  window.TT = { rng, noise, contours, range, filename, hexA, switcher, MOCKUPS };
})();
