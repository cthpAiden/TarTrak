<script lang="ts">
  import type { MapDef } from "./mapsData";
  import Chevron from "../ui/Chevron.svelte";

  let {
    def,
    pinnedFloor,
    onPick,
    variant,
  }: {
    def: MapDef;
    /** null follows my height ("Auto"), "" is the ground, anything else a floor by name. */
    pinnedFloor: string | null;
    onPick: (name: string | null) => void;
    /** Where it sits: the window's map toolbar, the box overlay's corner, or under the round minimap. */
    variant: "toolbar" | "menu" | "chip";
  } = $props();

  /** Floors this map can draw: an SVG group when the base is the SVG, or tiles either way. */
  const floorLayers = $derived(def.layers.filter((l) => (l.svgLayer && def.svgPath) || l.tilePath));
  const current = $derived(pinnedFloor === null ? "Auto" : pinnedFloor || "Ground");

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  function pick(name: string | null) {
    onPick(name);
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

{#if floorLayers.length > 0}
  <div class="floor-menu {variant}" bind:this={root}>
    <button
      type="button"
      class="floor-toggle"
      class:open
      aria-haspopup="listbox"
      aria-expanded={open}
      title={pinnedFloor === null ? "Floor: auto (follows my height)" : `Floor: ${current}`}
      onclick={() => (open = !open)}
    >
      {#if variant === "toolbar"}
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 2l6 3-6 3-6-3z" /><path d="M2 8l6 3 6-3" /><path d="M2 11l6 3 6-3" />
        </svg>
        <span class="short">{current}</span>
      {:else if variant === "chip"}
        <span class="dim">Floor:</span>{current}<Chevron {open} />
      {:else}
        Floors <Chevron {open} />
      {/if}
    </button>
    {#if open}
      <div class="floor-list" role="listbox" aria-label="Floors">
        <button role="option" aria-selected={pinnedFloor === null} class:active={pinnedFloor === null} onclick={() => pick(null)} title="Follow my height">Auto</button>
        <button role="option" aria-selected={pinnedFloor === ""} class:active={pinnedFloor === ""} onclick={() => pick("")}>Ground</button>
        {#each floorLayers as layer (layer.name)}
          <button role="option" aria-selected={pinnedFloor === layer.name} class:active={pinnedFloor === layer.name} onclick={() => pick(layer.name)}>{layer.name}</button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .floor-menu { position: relative; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .floor-toggle {
    display: inline-flex; align-items: center; gap: 4px; font: inherit; font-size: 13px;
    background: var(--panel); color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 4px 6px 4px 10px; cursor: pointer;
  }
  .floor-toggle:hover { border-color: var(--accent); }
  /* The chevron points down while closed and up while open, like a native select. */
  .floor-toggle :global(svg.chevron) { transform: rotate(90deg); }
  .floor-toggle :global(svg.chevron.open) { transform: rotate(-90deg); }
  .floor-list {
    position: absolute; z-index: 1002; display: flex; flex-direction: column; min-width: 130px; max-height: 60vh; overflow-y: auto;
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
  }
  .floor-list button {
    background: none; color: var(--fg); border: 0; padding: 7px 12px; text-align: left; cursor: pointer; font: inherit; font-size: 13px; white-space: nowrap;
  }
  .floor-list button:hover { background: rgba(255, 255, 255, 0.07); }
  .floor-list button.active { background: var(--accent); color: var(--on-accent); }

  /* Box overlay: the old corner menu, list below the button. */
  .menu .floor-list { top: 100%; right: 0; margin-top: 4px; }

  /* Window toolbar: a square button with the floor's short name; the list opens to the left. */
  .toolbar .floor-toggle {
    flex-direction: column; gap: 2px; width: 40px; padding: 6px 0; justify-content: center;
    background: none; border-color: transparent; color: var(--muted); border-radius: 7px;
  }
  .toolbar .floor-toggle:hover, .toolbar .floor-toggle.open { color: var(--accent); background: rgba(240, 180, 41, 0.12); }
  .toolbar .short { font-size: 10.5px; font-weight: 600; max-width: 36px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .toolbar .floor-list { right: calc(100% + 10px); top: 0; }

  /* Under the round minimap: a pill whose list opens upward, over the disc. */
  .chip .floor-toggle {
    height: 24px; padding: 0 8px 0 10px; gap: 5px; border-radius: 12px; font-weight: 600;
    background: rgba(15, 19, 24, 0.94); border-color: rgba(255, 255, 255, 0.24); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  }
  .chip .dim { color: #b9c2cc; }
  .chip .floor-list { bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); background: rgba(22, 26, 32, 0.96); }
  :global(body.overlay) .menu .floor-toggle, :global(body.overlay) .menu .floor-list { background: rgba(30, 35, 43, 0.75); }
</style>
