/**
 * Topographic contour lines as one SVG path: iso-lines of seeded 2-octave gradient noise over a w x h
 * area, traced with marching squares and chained into polylines. `scale` is the noise feature size in
 * px, `levels` the number of contour levels (more = denser lines), `step` the sampling grid in px,
 * `octaves`/`gain` the fractal detail (more octaves = rougher, more irregular lines) and `warp` how far
 * the terrain is bent by a second noise field (0 = none; ~1 gives stretched, twisting ridges).
 */
export function topoPath({ w, h, seed = 1, scale = 260, levels = 26, step = 6, octaves = 2, gain = 0.45, warp = 0 }: {
  w: number; h: number; seed?: number; scale?: number; levels?: number; step?: number; octaves?: number; gain?: number; warp?: number;
}): string {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const grads = perm.map((_, i) => [Math.cos((i / 256) * 2 * Math.PI), Math.sin((i / 256) * 2 * Math.PI)]);
  const hash = (x: number, y: number) => perm[(perm[x & 255] + y) & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const noise = (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const dot = (ix: number, iy: number) => {
      const [gx, gy] = grads[hash(x0 + ix, y0 + iy)];
      return gx * (fx - ix) + gy * (fy - iy);
    };
    const u = fade(fx), v = fade(fy);
    const a = dot(0, 0) + u * (dot(1, 0) - dot(0, 0));
    const b = dot(0, 1) + u * (dot(1, 1) - dot(0, 1));
    return a + v * (b - a);
  };
  const fbm = (x: number, y: number, o: number) => {
    let v = 0, a = 1, f = 1;
    for (let i = 0; i < octaves; i++) {
      v += a * noise(x * f + o + i * 3.7, y * f + o * 0.7 + i * 11.9);
      a *= gain;
      f *= 2.3;
    }
    return v;
  };
  const height = (x: number, y: number) => {
    const u = x / scale, v = y / scale;
    const qx = warp ? fbm(u, v, 41.2) : 0, qy = warp ? fbm(u, v, 87.5) : 0;
    return fbm(u + warp * qx, v + warp * qy, 17.3);
  };

  const nx = Math.ceil(w / step) + 1, ny = Math.ceil(h / step) + 1;
  const g: number[][] = [];
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < ny; j++) {
    const row: number[] = [];
    for (let i = 0; i < nx; i++) {
      const v = height(i * step, j * step);
      row.push(v);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    g.push(row);
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  let d = "";
  for (let k = 1; k <= levels; k++) {
    const L = lo + ((hi - lo) * k) / (levels + 1);
    const segs: [number, number][][] = [];
    const at = (i0: number, j0: number, i1: number, j1: number): [number, number] => {
      const a = g[j0][i0], t = (L - a) / (g[j1][i1] - a);
      return [r1((i0 + (i1 - i0) * t) * step), r1((j0 + (j1 - j0) * t) * step)];
    };
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const c: [number, number][] = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const e: [number, number][] = [];
        for (let q = 0; q < 4; q++) {
          const [a0, a1] = c[q], [b0, b1] = c[(q + 1) % 4];
          if (g[a1][a0] > L !== g[b1][b0] > L) e.push(at(a0, a1, b0, b1));
        }
        if (e.length === 2) segs.push(e);
        else if (e.length === 4) segs.push([e[0], e[1]], [e[2], e[3]]);
      }
    const key = (p: [number, number]) => `${p[0]},${p[1]}`;
    const ends = new Map<string, number[]>();
    segs.forEach((sg, idx) => sg.forEach((p) => {
      const kk = key(p);
      const list = ends.get(kk);
      if (list) list.push(idx);
      else ends.set(kk, [idx]);
    }));
    const used = new Set<number>();
    for (let idx = 0; idx < segs.length; idx++) {
      if (used.has(idx)) continue;
      used.add(idx);
      const line = [...segs[idx]];
      for (const fwd of [true, false])
        for (;;) {
          const p = fwd ? line[line.length - 1] : line[0];
          const next = (ends.get(key(p)) ?? []).find((m) => !used.has(m));
          if (next === undefined) break;
          used.add(next);
          const [a, b] = segs[next];
          const q = key(a) === key(p) ? b : a;
          if (fwd) line.push(q);
          else line.unshift(q);
        }
      d += `M${line.map((p) => `${p[0]} ${p[1]}`).join("L")}`;
    }
  }
  return d;
}
