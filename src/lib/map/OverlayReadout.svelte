<script lang="ts">
  import { safeColor } from "../room/squad";

  let {
    route,
    mates,
    hasPosition,
  }: {
    route: { name: string; distanceM: number | null } | null;
    mates: { id: string; name: string; color: string; distanceM: number | null }[];
    hasPosition: boolean;
  } = $props();
</script>

<div class="readout">
  {#if !hasPosition}
    <span class="muted">No position yet: take an in-game screenshot</span>
  {:else if route}
    <span class="dist">{#if route.distanceM === null}—{:else}{route.distanceM}<span class="unit">m</span>{/if}</span>
    <span class="name" title={route.name}>{route.name}</span>
  {:else}
    <span class="muted">No route</span>
  {/if}
  <span class="grow"></span>
  <span class="mates">
    {#each mates as m (m.id)}
      <span class="mate" style="color: {safeColor(m.color)}" title={m.name}><span class="dot"></span>{m.distanceM ?? "?"}</span>
    {/each}
  </span>
</div>

<style>
  .readout {
    display: flex; align-items: center; gap: 11px; height: 36px; padding: 0 12px; box-sizing: border-box;
    border-top: 1px solid rgba(255, 255, 255, 0.09);
    overflow: hidden; white-space: nowrap; font-size: 12px;
  }
  .dist { font-family: ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; font-size: 19px; color: var(--accent); }
  .unit { font-size: 10px; color: var(--muted); }
  .name { color: #c2c9d3; max-width: 46%; overflow: hidden; text-overflow: ellipsis; }
  .grow { flex: 1; }
  .mates { display: flex; gap: 10px; }
  .mate {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; font-size: 13px;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
</style>
