<script lang="ts">
  import { distanceM as metresBetween, type RouteGroup } from "./route";

  let {
    groups,
    selectedId,
    selectedName,
    distanceM,
    from,
    onSelect,
  }: {
    groups: RouteGroup[];
    selectedId: string | null;
    selectedName: string | null;
    /** Metres from my marker to the chosen extract; null without a position. */
    distanceM: number | null;
    /** My position; every extract in the list shows its distance from here. */
    from: { x: number; z: number } | null;
    onSelect: (id: string | null) => void;
  } = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  function pick(id: string | null) {
    onSelect(id);
    open = false;
  }
  // Clicking anywhere else closes the list, like a native dropdown.
  function onWindowPointerDown(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
  function onWindowKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") open = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeyDown} />

<div class="route" bind:this={root}>
  <button
    class="mode-btn route-btn"
    aria-pressed={selectedId !== null}
    aria-haspopup="menu"
    aria-expanded={open}
    title={selectedName ? `Route to ${selectedName}; click to change or clear` : "Route to an extract"}
    aria-label="Route to extract"
    onclick={() => (open = !open)}
  >
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M6.5 2.5H2.5v11h4" />
      <path d="M6 8h7.5M11 5.5L13.5 8 11 10.5" />
    </svg>
    {#if selectedId !== null}
      <span class="dist">{distanceM === null ? "no position" : `${distanceM} m`}</span>
    {/if}
  </button>
  {#if open}
    <div class="route-menu" role="menu">
      {#if selectedId !== null}
        <button type="button" role="menuitem" class="clear" onclick={() => pick(null)}>Clear route</button>
      {/if}
      {#each groups as g (g.category)}
        <div class="route-cat">{g.label}</div>
        {#each g.items as p (p.id)}
          <button type="button" role="menuitemradio" aria-checked={p.id === selectedId} onclick={() => pick(p.id)}>
            {p.name}{#if from}<span class="m">({metresBetween(from, p)} m)</span>{/if}
          </button>
        {/each}
      {/each}
      {#if groups.length === 0}
        <div class="route-cat">No extracts on this map</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .route { position: relative; }
  .route .route-btn { width: auto; min-width: 26px; padding: 0 6px; display: inline-flex; gap: 5px; color: var(--muted); }
  .route .route-btn[aria-pressed="true"] { color: var(--accent); border-color: var(--accent); }
  .dist { font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .route-menu {
    position: absolute; top: 30px; left: 0; z-index: 1001; min-width: 230px; max-height: 60vh; overflow-y: auto;
    display: flex; flex-direction: column; padding: 4px;
    background: var(--panel); border: 1px solid #3a4048; border-radius: 4px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .route-cat { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 8px 2px; white-space: nowrap; }
  .route-menu button { background: none; color: var(--fg); border: 0; border-radius: 3px; padding: 5px 8px; text-align: left; cursor: pointer; font: inherit; font-size: 12px; white-space: nowrap; }
  .route-menu button:hover { background: rgba(255, 255, 255, 0.07); }
  .route-menu button[aria-checked="true"] { color: var(--accent); }
  .route-menu .m { color: var(--muted); margin-left: 6px; font-variant-numeric: tabular-nums; }
  .route-menu .clear { color: var(--muted); border-bottom: 1px solid #3a4048; border-radius: 0; margin-bottom: 2px; }
  :global(body.overlay) .route-menu { background: rgba(30, 35, 43, 0.9); }
</style>
