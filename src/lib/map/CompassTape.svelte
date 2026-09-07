<script lang="ts">
  import { pad3, tapePosition, tapeTicks, type CompassTarget } from "./compass";
  import { safeColor } from "../room/squad";

  let { heading, targets }: { heading: number | null; targets: CompassTarget[] } = $props();

  /** The overlay's default width; used until the strip is measured (jsdom never measures). */
  const FALLBACK_WIDTH = 324;
  let measured = $state(0);
  const width = $derived(measured || FALLBACK_WIDTH);
  const ticks = $derived(heading === null ? [] : tapeTicks(heading, width));
  const marks = $derived(heading === null ? [] : targets.map((t) => ({ ...t, ...tapePosition(t.bearing, heading, width) })));
</script>

<div class="compass" bind:clientWidth={measured}>
  {#each ticks as t}
    <span class="tick" class:major={t.major} style="left: {t.x}px"></span>
    <!-- The heading pill sits on the same row; a label half under it would read as a wrong number. -->
    {#if t.major && Math.abs(t.x - width / 2) > 24}<span class="num" style="left: {t.x}px">{pad3(t.deg)}</span>{/if}
  {/each}
  {#each marks as m (m.id)}
    <span class="target {m.kind}" class:clamped={m.clamped} style="left: {m.x}px; color: {safeColor(m.color)}" title="{m.label} · {pad3(m.bearing)}">
      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 10 L0 2 L10 2 Z" fill="currentColor" /></svg>
    </span>
  {/each}
  <span class="line"></span>
  <span class="pill">{heading === null ? "---" : pad3(heading)}</span>
</div>

<style>
  .compass {
    position: relative; height: 34px; box-sizing: border-box; overflow: hidden;
    border-bottom: 1px solid rgba(255, 255, 255, 0.09);
    font-family: ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums;
    user-select: none;
  }
  .tick { position: absolute; bottom: 0; width: 1px; height: 4px; background: #39414d; }
  .tick.major { height: 8px; }
  .num { position: absolute; top: 3px; transform: translateX(-50%); font-size: 10px; color: var(--muted); }
  .line { position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; margin-left: -1px; background: var(--fg); }
  .pill {
    position: absolute; top: 2px; left: 50%; transform: translateX(-50%);
    font-size: 10px; line-height: 12px; padding: 1px 5px; border-radius: 2px;
    background: var(--fg); color: #14171c;
  }
  .target { position: absolute; bottom: 2px; transform: translateX(-50%); line-height: 0; }
  .target svg { display: block; width: 10px; height: 10px; }
  .target.mate svg { width: 9px; height: 9px; }
  .target.clamped { opacity: 0.5; }
</style>
