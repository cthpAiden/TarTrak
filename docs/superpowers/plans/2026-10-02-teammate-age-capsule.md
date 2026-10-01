# Teammate Age Capsule + Faster Position Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each teammate's map marker becomes a capsule showing the whole seconds since their last screenshot (mockup "F2"), and a position reaches the squad as fast as the pipeline allows.

**Architecture:** `PositionMarker` (src/lib/map/markers.ts) gains an `age: true` style: the Leaflet circle is replaced by an `L.marker` with a `divIcon` whose inner `<span>` holds the digits, is painted in the teammate's colour with auto-contrast ink, and counter-rotates by `--counter` so it stays upright on the heading-up minimap. MapView's existing one-second tick feeds `setAge`. The only software delay between a screenshot and the relay is the client's send throttle (500 ms, trailing); it drops to 100 ms. Everything else in the chain (notify file event, Tauri emit, Svelte effect, Durable Object broadcast, Leaflet setLatLng) is already event-driven with no polling.

**Tech Stack:** Svelte 5 runes, Leaflet 1.9 (jsdom in vitest), TypeScript, vitest.

**Spec:** Mockup F2 agreed in chat on 2026-10-02: an 18 px tall pill, min-width 18 px, padding 0 5 px, 1.5 px black border, 12 px mono digits; whole seconds under a minute, then whole minutes as `2m`; digits black on light colours and white on dark ones; the name label stays above it; the capsule fades with the existing 30 s → 5 min opacity curve.

## Global Constraints

- Own marker (OWN_PANE, no label) stays a plain dot; only teammates get the capsule.
- Teammates are never clickable today; the capsule marker must be `interactive: false` so it cannot intercept right-click pins or drags.
- Age is computed from `receivedAt` (my clock), never from the sender's `ts` (clock skew).
- No per-second DOM rebuilds: mutate the span's `textContent` and style; never `setIcon` on a tick.
- No build, no release, no version bump, no CHANGELOG entry in this work (user: commit and push only).
- Commit each task separately to `main` with the attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (Sonnet tasks use `Claude Sonnet 5.5`).

## Review Focus

1. A dark squad colour (e.g. `#7e57c2`, `#ff5252`) → digits must be white, not black. Pinned by the `inkFor` tests in Task 1 and the `setColor` test in Task 2.
2. Heading-up round minimap (`.map-root.rotated`, `--counter` set) → digits must stay upright while the map turns. Pinned by the inline-transform assertion in Task 2.
3. A teammate who left or has been silent 5+ minutes → the capsule keeps counting (`7m`) and sits at the 0.35 opacity floor, never vanishes. Pinned by `ageText(420)` in Task 1 and the opacity test in Task 2.
4. A colour override chosen in the squad panel (`mateColors`) → the capsule repaints without a new marker. Pinned by the `setColor` test in Task 2.
5. Two screenshots within 100 ms (double tap) → the second position still goes out, trailing, 100 ms after the first. Pinned by the throttle test in Task 4.

---

### Task 1: `ageText` and `inkFor` helpers (Sonnet)

**Files:**
- Modify: `src/lib/map/markers.ts` (append after `gradientDefs`, before `PositionMarker`)
- Test: `src/lib/map/markers.test.ts` (append a new `describe` at the end)

**Interfaces:**
- Produces: `export function ageText(sec: number): string` and `export function inkFor(color: string): "#000" | "#fff"`; Task 2 calls both.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/map/markers.test.ts` (add `ageText, inkFor` to the existing import from `./markers`):

```ts
describe("ageText", () => {
  it("shows whole seconds under a minute, then whole minutes", () => {
    expect(ageText(0)).toBe("0");
    expect(ageText(0.9)).toBe("0");
    expect(ageText(47)).toBe("47");
    expect(ageText(59.9)).toBe("59");
    expect(ageText(60)).toBe("1m");
    expect(ageText(130)).toBe("2m");
    expect(ageText(420)).toBe("7m");
    expect(ageText(3600)).toBe("60m");
  });

  it("never goes negative when the clock runs ahead of receivedAt", () => {
    expect(ageText(-3)).toBe("0");
  });
});

describe("inkFor", () => {
  it("picks black digits on light colours and white on dark ones", () => {
    expect(inkFor("#ffb74d")).toBe("#000");
    expect(inkFor("#4fc3f7")).toBe("#000");
    expect(inkFor("#ffffff")).toBe("#000");
    expect(inkFor("#7e57c2")).toBe("#fff");
    expect(inkFor("#ff5252")).toBe("#fff");
    expect(inkFor("#000000")).toBe("#fff");
  });

  it("reads short hex and ignores an alpha channel", () => {
    expect(inkFor("#fff")).toBe("#000");
    expect(inkFor("#000")).toBe("#fff");
    expect(inkFor("#ffb74d80")).toBe("#000");
  });

  it("falls back to white for a colour it cannot read", () => {
    expect(inkFor("nope")).toBe("#fff");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/map/markers.test.ts`
Expected: FAIL, `ageText is not a function` (or import error).

- [ ] **Step 3: Implement the helpers**

Insert into `src/lib/map/markers.ts` right before `/** A player: filled circle plus a heading line ... */`:

```ts
/** Digits for the age capsule: whole seconds under a minute, then whole minutes ("2m"). */
export function ageText(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return s < 60 ? String(s) : `${Math.floor(s / 60)}m`;
}

/** Black or white digits, whichever reads on the colour: perceived luminance of the hex, alpha ignored. */
export function inkFor(color: string): "#000" | "#fff" {
  // #rgb and #rgba double each digit; #rrggbbaa drops its alpha with the slice below.
  const hex = color.length <= 5 ? "#" + Array.from(color.slice(1), (c) => c + c).join("") : color;
  const n = parseInt(hex.slice(1, 7), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? "#000" : "#fff";
}
```

(`parseInt("nope".slice(1,7), 16)` is `NaN`; `NaN > 0.55` is false, so the fallback is white without a branch.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/map/markers.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/map/markers.ts src/lib/map/markers.test.ts
git commit -m "map: ageText and inkFor helpers for the teammate age capsule"
```

---

### Task 2: Age capsule in `PositionMarker` (Opus)

**Files:**
- Modify: `src/lib/map/markers.ts` (`MarkerStyle`, `PositionMarker`)
- Modify: `src/lib/map/map.css` (after the `.tt-label { pointer-events: none; }` line)
- Test: `src/lib/map/markers.test.ts`

**Interfaces:**
- Consumes: `ageText`, `inkFor` from Task 1.
- Produces: `MarkerStyle.age?: boolean`; `PositionMarker.circle: L.CircleMarker | null`; `PositionMarker.capsule: L.Marker | null`; `PositionMarker.setAge(sec: number): void`. Task 3 uses `age: true` and `setAge`.

- [ ] **Step 1: Make the existing tests compile against the nullable `circle`**

In `src/lib/map/markers.test.ts`, every `m.circle.`, `plain.circle.`, `mate.circle.` and `me.circle.` becomes `m.circle!.` etc. (10 occurrences: lines ~125, 126, 128, 130, 140, 149, 152, 164, 179, 182 of the current file; also `map.hasLayer(m.circle)` → `map.hasLayer(m.circle!)`).

- [ ] **Step 2: Write the failing capsule tests**

Append to `src/lib/map/markers.test.ts`:

```ts
describe("PositionMarker age capsule", () => {
  let map: L.Map;
  beforeEach(() => {
    map = makeMap();
  });

  it("draws a capsule in the players pane instead of a dot and holds the age digits", () => {
    const m = new PositionMarker(map, { color: "#ffb74d", radius: 6, lineLengthM: 28, label: "Bob", age: true });
    m.update(100, -50, 0);
    expect(m.circle).toBeNull();
    const el = m.capsule!.getElement()!;
    expect(el.parentElement).toBe(map.getPane(PLAYER_PANE));
    expect(el.classList.contains("tt-age")).toBe(true);
    const span = el.querySelector("span")!;
    expect(span.textContent).toBe("0");
    m.setAge(47);
    expect(span.textContent).toBe("47");
    m.setAge(130);
    expect(span.textContent).toBe("2m");
    expect(m.capsule!.getLatLng().lng).toBe(100);
    expect(m.capsule!.getLatLng().lat).toBe(-50);
    expect(m.capsule!.options.interactive).toBe(false);
    expect(m.capsule!.options.pane).toBe(PLAYER_PANE);
    m.remove();
    expect(map.hasLayer(m.capsule!)).toBe(false);
    expect(map.hasLayer(m.line)).toBe(false);
  });

  it("stays upright on a heading-up map: centred on the point and turned back by --counter", () => {
    const m = new PositionMarker(map, { color: "#ffb74d", radius: 6, lineLengthM: 28, age: true });
    const span = m.capsule!.getElement()!.querySelector("span")!;
    expect(span.style.transform).toBe("translate(-50%, -50%) rotate(var(--counter, 0deg))");
    m.remove();
  });

  it("paints the capsule in the colour with contrasting digits, and repaints on setColor", () => {
    const m = new PositionMarker(map, { color: "#ffb74d", radius: 6, lineLengthM: 28, age: true });
    const span = m.capsule!.getElement()!.querySelector("span")!;
    expect(span.style.background).toMatch(/#ffb74d|rgb\(255, 183, 77\)/);
    expect(span.style.color).toMatch(/#000|rgb\(0, 0, 0\)/);
    m.setColor("#7e57c2");
    expect(span.style.background).toMatch(/#7e57c2|rgb\(126, 87, 194\)/);
    expect(span.style.color).toMatch(/#fff|rgb\(255, 255, 255\)/);
    // The heading line follows the colour like it does for a dot.
    expect(Array.from(m.gradient.children).every((st) => st.getAttribute("stop-color") === "#7e57c2")).toBe(true);
    m.remove();
  });

  it("fades the capsule, its line and its label together", () => {
    const m = new PositionMarker(map, { color: "#ffb74d", radius: 6, lineLengthM: 28, label: "Bob", age: true });
    m.update(0, 0, 0);
    m.setOpacity(0.35);
    expect(m.capsule!.options.opacity).toBeCloseTo(0.35);
    expect(m.line.options.opacity).toBeCloseTo(0.35);
    expect(m.capsule!.getTooltip()!.options.opacity).toBeCloseTo(0.35);
    m.remove();
  });

  it("keeps the name label above the capsule, in the players pane", () => {
    const m = new PositionMarker(map, { color: "#ffb74d", radius: 6, lineLengthM: 28, label: "Bob", age: true });
    m.update(0, 0, 0);
    const tt = m.capsule!.getTooltip()!;
    expect(tt.getContent()).toBe(upright("Bob"));
    expect(tt.options.offset).toEqual([0, -12]);
    expect(tt.options.pane).toBe(PLAYER_PANE);
    m.setLabel("Bob [2F]");
    expect(tt.getContent()).toBe(upright("Bob [2F]"));
    m.remove();
  });

  it("setAge is a no-op on a dot marker", () => {
    const m = new PositionMarker(map, { color: "#fff", radius: 6, lineLengthM: 28 });
    expect(() => m.setAge(5)).not.toThrow();
    expect(m.capsule).toBeNull();
    m.remove();
  });
});
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `npx vitest run src/lib/map/markers.test.ts`
Expected: the six new tests FAIL (`capsule` undefined / `setAge is not a function`); the older tests PASS.

- [ ] **Step 4: Implement the capsule**

In `src/lib/map/markers.ts`:

1. Add to `MarkerStyle`:

```ts
  /** Draw a capsule holding the seconds since the last update (see setAge) instead of a dot. Teammates. */
  age?: boolean;
```

2. Add after the `inkFor` helper:

```ts
/** Tooltip offset that clears the capsule (9 px half height, 1.5 px border) or the 6 px dot. */
const CAPSULE_LABEL_OFFSET = -12;
const DOT_LABEL_OFFSET = -8;

function paintCapsule(el: HTMLSpanElement, color: string): void {
  el.style.background = color;
  el.style.color = inkFor(color);
}
```

3. Replace the class fields and constructor through the `map.on("zoomend", ...)` line with:

```ts
export class PositionMarker {
  /** The dot; null when the marker is an age capsule. */
  readonly circle: L.CircleMarker | null;
  /** The age capsule, a div icon; null for a dot marker. */
  readonly capsule: L.Marker | null;
  /** The capsule's visible span: digits, colour and the counter-rotation all live on it. */
  private readonly capsuleEl: HTMLSpanElement | null;
  readonly line: L.Polyline;
  /** Stroke gradient from full colour at the player to transparent at the tip, in layer pixels. */
  readonly gradient: SVGLinearGradientElement;
  private readonly gradientId = `tt-fade-${++gradientSeq}`;
  private x = 0;
  private z = 0;
  private yaw = 0;
  private label: string | undefined;
  private readonly onZoom = () => this.redraw();

  constructor(
    private readonly map: L.Map,
    private readonly style: MarkerStyle,
  ) {
    ensurePlayerPanes(map);
    this.label = style.label;
    const pane = style.pane ?? PLAYER_PANE;
    if (style.age) {
      const el = document.createElement("span");
      // Centred on the point; --counter is the map's own turn (map.css), so the digits stay upright heading-up.
      el.style.transform = "translate(-50%, -50%) rotate(var(--counter, 0deg))";
      el.textContent = ageText(0);
      paintCapsule(el, style.color);
      this.capsuleEl = el;
      // Not interactive: a teammate is never a click target, and a right-click on them must still pin.
      this.capsule = L.marker([0, 0], {
        pane,
        icon: L.divIcon({ className: "tt-age", html: el, iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
      });
      this.circle = null;
    } else {
      this.circle = L.circleMarker([0, 0], {
        pane,
        radius: style.radius,
        color: "#000",
        weight: 1.5,
        fillColor: style.color,
        fillOpacity: 1,
        opacity: 1,
      });
      this.capsule = null;
      this.capsuleEl = null;
    }
    // Dashed and fading: a line of sight that hides as little of the map as it can.
    this.line = L.polyline([], { pane, color: style.color, weight: 4, opacity: 0.85, dashArray: "5 10", lineCap: "round" });
    this.gradient = document.createElementNS(SVG_NS, "linearGradient");
    this.gradient.setAttribute("id", this.gradientId);
    this.gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    // Fades to a faint tip rather than nothing, so the far end still reads as a line.
    for (const [offset, opacity] of [["0", "1"], ["1", "0.3"]]) {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", style.color);
      stop.setAttribute("stop-opacity", opacity);
      this.gradient.appendChild(stop);
    }
    gradientDefs(map).appendChild(this.gradient);
    if (style.label) {
      this.dot.bindTooltip(upright(esc(style.label)), {
        permanent: true,
        direction: "top",
        offset: [0, style.age ? CAPSULE_LABEL_OFFSET : DOT_LABEL_OFFSET],
        className: "tt-label",
        pane,
        interactive: false,
      });
    }
    this.line.addTo(map);
    this.applyGradient();
    this.dot.addTo(map);
    map.on("zoomend", this.onZoom);
  }

  /** Whichever marks the point: the dot or the capsule. */
  private get dot(): L.CircleMarker | L.Marker {
    return this.circle ?? this.capsule!;
  }
```

4. Replace `setOpacity`, `setColor`, `setLabel`, `remove` and add `setAge`:

```ts
  setOpacity(o: number): void {
    if (this.circle) this.circle.setStyle({ opacity: o, fillOpacity: o });
    else this.capsule!.setOpacity(o);
    this.line.setStyle({ opacity: o });
    this.applyGradient();
    const tt = this.dot.getTooltip();
    if (tt) tt.setOpacity(o);
  }

  setColor(color: string): void {
    if (this.circle) this.circle.setStyle({ fillColor: color });
    else paintCapsule(this.capsuleEl!, color);
    this.line.setStyle({ color });
    this.applyGradient();
    for (const stop of Array.from(this.gradient.children)) stop.setAttribute("stop-color", color);
  }

  /** Seconds since the teammate's last update, shown in the capsule. No-op for a dot marker. */
  setAge(sec: number): void {
    if (!this.capsuleEl) return;
    const text = ageText(sec);
    if (this.capsuleEl.textContent !== text) this.capsuleEl.textContent = text;
  }

  /** Replaces the name label, e.g. when the teammate changes floor. No-op for a marker made without one. */
  setLabel(text: string): void {
    if (text === this.label) return;
    this.label = text;
    this.dot.getTooltip()?.setContent(upright(esc(text)));
  }

  remove(): void {
    this.map.off("zoomend", this.onZoom);
    this.dot.remove();
    this.line.remove();
    this.gradient.remove();
  }
```

5. In `redraw()`, change `this.circle.setLatLng(center);` to `this.dot.setLatLng(center);`.

6. Update the class doc comment to: `/** A player: filled dot (or an age capsule for a teammate) plus a heading line that fades out towards its far end. */`

- [ ] **Step 5: Add the capsule CSS**

In `src/lib/map/map.css`, after `.tt-label { pointer-events: none; }`:

```css
/* Teammate age capsule: the marker itself, with the seconds since their last screenshot inside.
   Background, digit colour and the counter-rotation are inline (markers.ts). */
.tt-age { pointer-events: none; }
.tt-age span {
  display: inline-flex; align-items: center; justify-content: center;
  height: 18px; min-width: 18px; padding: 0 5px; box-sizing: border-box;
  border: 1.5px solid #000; border-radius: 9px;
  font: 500 12px/1 ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npx vitest run src/lib/map/markers.test.ts`
Expected: PASS, every test in the file.

Run: `npm run check`
Expected: 0 errors (warnings that already existed are fine).

- [ ] **Step 7: Commit**

```bash
git add src/lib/map/markers.ts src/lib/map/markers.test.ts src/lib/map/map.css
git commit -m "map: teammate marker is a capsule showing seconds since their last screenshot"
```

---

### Task 3: Wire the capsule into MapView (Opus, same session as Task 2)

**Files:**
- Modify: `src/lib/map/MapView.svelte:424-436` (the teammate `$effect`)

**Interfaces:**
- Consumes: `MarkerStyle.age`, `PositionMarker.setAge` from Task 2.

- [ ] **Step 1: Edit the teammate effect**

In the `for (const t of wanted)` loop, change the constructor call and add the age line after `setOpacity`:

```ts
      if (!marker) {
        marker = new PositionMarker(m, { color, radius: 6, lineLengthM: len, label, age: true });
        mates.set(t.id, marker);
      }
      marker.setColor(color);
      marker.setLabel(label);
      marker.update(t.x, t.z, t.yaw);
      marker.setOpacity(opacityFor(tick - t.receivedAt));
      marker.setAge((tick - t.receivedAt) / 1000);
```

(`tick` is the component's `now` state, bumped every second at MapView.svelte:268, so the digits advance once a second and jump to 0 the moment a position lands, because `receivedAt` changes.)

- [ ] **Step 2: Type check and full test run**

Run: `npm run check`
Expected: 0 errors.

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/map/MapView.svelte
git commit -m "map: show each teammate's update age in their marker"
```

---

### Task 4: Position send throttle 500 ms → 100 ms (Sonnet)

**Files:**
- Modify: `src/lib/room/client.ts:45,103`
- Modify: `src/lib/room/client.test.ts:105-123`
- Modify: `HANDOFF.md:88`

Why: the chain is file event → Tauri emit → Svelte effect → `sendPosition` → relay broadcast → `setLatLng`, all event-driven. The one timer is this throttle: a screenshot taken within 500 ms of the previous one waits out the window. 100 ms keeps the newest-wins trailing behaviour (a held key still cannot flood the relay) while cutting the worst case from 500 ms to 100 ms.

- [ ] **Step 1: Update the test**

Replace the throttle test in `src/lib/room/client.test.ts`:

```ts
  it("throttles positions to one per 100 ms, sending the latest trailing one", () => {
    const { client } = make();
    client.connect();
    const ws = FakeWs.instances[0];
    ws.open();
    ws.sent.length = 0;
    client.sendPosition("customs", { x: 1, y: 0, z: 0, yaw: 0 });
    client.sendPosition("customs", { x: 2, y: 0, z: 0, yaw: 0 });
    client.sendPosition("customs", { x: 3, y: 0, z: 0, yaw: 0 });
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toMatchObject({ type: "pos", x: 1, map: "customs", name: "Bob", color: "#f00" });
    vi.advanceTimersByTime(99);
    expect(ws.sent).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(ws.sent).toHaveLength(2);
    expect(JSON.parse(ws.sent[1])).toMatchObject({ x: 3 });
    vi.advanceTimersByTime(1000);
    expect(ws.sent).toHaveLength(2);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/room/client.test.ts`
Expected: FAIL at `expect(ws.sent).toHaveLength(2)` after 100 ms (still 1).

- [ ] **Step 3: Change the constant and its comment**

`src/lib/room/client.ts`:

```ts
/** A double-tapped screenshot key still goes out once per window; the newest position wins. */
export const SEND_INTERVAL_MS = 100;
```

and on `sendPosition`:

```ts
  /** Throttled: at most one send per 100 ms; the newest position wins and is sent at the window end. */
```

`HANDOFF.md` line 88: `Client-side throttle 500 ms per player.` → `Client-side throttle 100 ms per player.`

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/room/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/room/client.ts src/lib/room/client.test.ts HANDOFF.md
git commit -m "room: position send throttle 100 ms, was 500"
```

---

### Task 5: Final check and push (orchestrator)

- [ ] **Step 1:** `npm test` and `npm run check` on `main` after all four commits: both clean.
- [ ] **Step 2:** `git push origin main`.
- [ ] **Step 3:** No build, no release, no tag.
