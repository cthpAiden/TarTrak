<script lang="ts">
  import { safeColor } from "./squad";
  import type { ReceivedShot } from "./controller.svelte";

  let { shot, onClose }: { shot: ReceivedShot; onClose: () => void } = $props();

  /** Shown over the whole window; App keys this component by shot, so a new one opens small again. */
  let big = $state(false);

  function onKey(e: KeyboardEvent) {
    if (big && e.key === "Escape") big = false;
  }
</script>

<svelte:window onkeydown={onKey} />

<!-- A teammate's shared screenshot: a card in the map's bottom-left corner, clicked to fill the window. -->
<div class="shot" role="dialog" aria-label="Screenshot from {shot.from}">
  <div class="head">
    <span class="dot" style="background: {safeColor(shot.color)}"></span>
    <span class="from" style="color: {safeColor(shot.color)}">{shot.from}</span>
    <span class="what">shared a screenshot</span>
    <button type="button" class="x" aria-label="Close screenshot" title="Close" onclick={onClose}>×</button>
  </div>
  <button type="button" class="thumb" title="Click to enlarge" onclick={() => (big = true)}>
    <img src={shot.url} alt="Screenshot from {shot.from}" />
  </button>
</div>

{#if big}
  <button type="button" class="big" aria-label="Shrink screenshot" onclick={() => (big = false)}>
    <img src={shot.url} alt="Screenshot from {shot.from}" />
  </button>
{/if}

<style>
  .shot {
    position: fixed; left: 12px; bottom: 42px; z-index: 1900;
    width: min(300px, calc(100vw - 24px)); box-sizing: border-box;
    background: rgba(22, 26, 32, 0.94); border: 1px solid var(--line-2); border-radius: 4px;
    overflow: hidden;
  }
  /* No status bar in the overlay: down to the corner, and narrower in the small window. */
  :global(body.overlay) .shot { bottom: 12px; width: min(220px, calc(100vw - 24px)); }
  .head {
    display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 4px 0 8px;
    font-size: 12px; white-space: nowrap;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .from { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
  .what { color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .x {
    flex: none; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 3px;
    background: transparent; color: var(--fg-2); font-size: 16px; line-height: 1; cursor: pointer;
  }
  .x:hover { background: var(--raised-2); color: var(--fg); }
  .thumb { display: block; width: 100%; padding: 0; border: 0; background: #000; cursor: zoom-in; }
  .thumb img { display: block; width: 100%; height: auto; }
  .big {
    position: fixed; inset: 0; z-index: 2100; padding: 12px; border: 0;
    background: rgba(8, 10, 13, 0.92); cursor: zoom-out;
    display: flex; align-items: center; justify-content: center;
  }
  .big img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style>
