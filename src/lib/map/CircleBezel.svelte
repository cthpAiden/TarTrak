<script lang="ts">
  import { pad3, type CompassTarget } from "./compass";
  import { angleGap, polar, ringAngle, RING } from "./circle";
  import { safeColor } from "../room/squad";

  let {
    r,
    heading,
    northUp,
    targets,
    show = true,
  }: {
    /** Map disc radius; the ring sits around it. */
    r: number;
    /** My heading in degrees, or null before the first screenshot. */
    heading: number | null;
    /** North-up: the ring is fixed and the heading box rides round it. Heading-up: the ring turns under a fixed box. */
    northUp: boolean;
    /** Teammates and the route, drawn on the ring at their bearing from me. */
    targets: CompassTarget[];
    /** Off leaves a plain rim: no ticks, letters, markers or heading box. */
    show?: boolean;
  } = $props();

  const ro = $derived(r + RING);
  const c = $derived(ro);
  const size = $derived(2 * ro);
  /** Ring turn: the tick rings rotate with the map in heading-up mode. */
  const turn = $derived(northUp || heading === null ? 0 : -heading);
  /** Where the heading box sits: at my heading on a fixed ring, or at 12 o'clock on a turning one. */
  const boxAt = $derived(heading === null ? null : northUp ? heading : 0);
  const labelR = $derived(r + 9);
  const LABELS = [
    { deg: 0, text: "N", letter: true },
    { deg: 30, text: "30" },
    { deg: 60, text: "60" },
    { deg: 90, text: "E", letter: true },
    { deg: 120, text: "120" },
    { deg: 150, text: "150" },
    { deg: 180, text: "S", letter: true },
    { deg: 210, text: "210" },
    { deg: 240, text: "240" },
    { deg: 270, text: "W", letter: true },
    { deg: 300, text: "300" },
    { deg: 330, text: "330" },
  ];
  // A label the heading box would cover is left out rather than drawn half under it.
  const labels = $derived(
    LABELS.map((l) => {
      const a = ringAngle(l.deg, heading, northUp);
      return { ...l, a, ...polar(c, c, labelR, a) };
    }).filter((l) => boxAt === null || angleGap(l.a, boxAt) > 13),
  );
  const marks = $derived(targets.map((t) => ({ ...t, a: ringAngle(t.bearing, heading, northUp) })));
  const box = $derived(boxAt === null ? null : polar(c, c, (r + ro) / 2, boxAt));
  const minorC = $derived(2 * Math.PI * (ro - 3));
  const majorC = $derived(2 * Math.PI * (ro - 5));
</script>

<svg class="bezel" width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
  {#if show}
    <circle cx={c} cy={c} r={(r + ro) / 2} fill="none" stroke="#0f1318" stroke-opacity="0.92" stroke-width={RING} />
    <circle cx={c} cy={c} r={ro - 0.5} fill="none" stroke="#fff" stroke-opacity="0.3" />
    <circle cx={c} cy={c} r={r} fill="none" stroke="#fff" stroke-opacity="0.22" />
    <g transform="rotate({turn} {c} {c})">
      <circle
        cx={c} cy={c} r={ro - 3} fill="none" stroke="#8b95a1" stroke-width="5"
        stroke-dasharray="1.2 {minorC / 72 - 1.2}" stroke-dashoffset="0.6"
      />
      <circle
        cx={c} cy={c} r={ro - 5} fill="none" stroke="#d9dee4" stroke-width="9"
        stroke-dasharray="2 {majorC / 12 - 2}" stroke-dashoffset="1"
      />
    </g>
    {#each labels as l (l.deg)}
      <text
        class:letter={l.letter}
        class:north={l.deg === 0}
        x={l.x}
        y={l.y}
        text-anchor="middle"
        dominant-baseline="central">{l.text}</text
      >
    {/each}
    {#each marks as m (m.id)}
      <g transform="rotate({m.a} {c} {c})" class="mark {m.kind}">
        {#if m.kind === "route"}
          <path d="M{c} {c - r - 2}l5.5 6.5-5.5 6.5-5.5-6.5z" fill="#0f1318" stroke={safeColor(m.color)} stroke-width="2" />
        {:else}
          <path d="M{c - 5.5} {c - r - 1}h11l-5.5 9z" fill={safeColor(m.color)} stroke="#000" stroke-width="1" />
        {/if}
        <title>{m.label} · {pad3(m.bearing)}</title>
      </g>
    {/each}
    {#if box && heading !== null}
      <rect class="hdg-box" x={box.x - 19} y={box.y - 9.5} width="38" height="19" rx="4" />
      <text class="hdg" x={box.x} y={box.y + 0.5} text-anchor="middle" dominant-baseline="central">{pad3(heading)}</text>
      {#if !northUp}
        <path class="hdg-tip" d="M{c - 4.5} {c - r - 5}h9l-4.5 6z" />
      {/if}
    {/if}
  {:else}
    <circle cx={c} cy={c} r={r} fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="1.5" />
  {/if}
</svg>

<style>
  .bezel { display: block; overflow: visible; pointer-events: none; }
  text { font-family: var(--mono); font-size: 11px; font-weight: 500; fill: #b9c2cc; }
  text.letter { font-family: var(--sans); font-size: 14px; font-weight: 700; fill: #eef1f4; }
  text.north { fill: #ff5a4e; }
  .hdg-box { fill: #0f1318; stroke: var(--accent); stroke-width: 1.2; }
  text.hdg { font-size: 11.5px; font-weight: 700; fill: var(--accent); }
  .hdg-tip { fill: var(--accent); stroke: #000; stroke-width: 0.8; }
</style>
