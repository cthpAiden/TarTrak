<script lang="ts">
  import { safeColor } from "../room/squad";

  let {
    mates,
  }: {
    mates: { id: string; name: string; color: string; distanceM: number | null }[];
  } = $props();
</script>

<!-- Each teammate's distance in their colour: a pill in the map's bottom-right corner. -->
<div class="readout">
  {#each mates as m (m.id)}
    <span class="mate" style="color: {safeColor(m.color)}" title={m.name}><span class="dot"></span>{m.distanceM ?? "?"}</span>
  {/each}
</div>

<style>
  .readout {
    position: absolute; right: 8px; bottom: 8px; z-index: 1000;
    display: flex; align-items: center; gap: 10px;
    height: 26px; padding: 0 10px; box-sizing: border-box; white-space: nowrap;
    background: rgba(30, 35, 43, 0.75); border: 1px solid #3a4048; border-radius: 3px;
    pointer-events: none;
  }
  .mate {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; font-size: 13px;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
</style>
