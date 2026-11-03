<script lang="ts">
  import { safeColor } from "./squad";
  import type { PopupData } from "./popup";

  let {
    data,
    onClose,
    onDrag = () => {},
    onBig = () => {},
  }: {
    data: PopupData;
    onClose: () => void;
    /** The header was pressed: the window follows the mouse from here. */
    onDrag?: () => void;
    /** The picture was clicked: the window grows to show it big, or shrinks back. */
    onBig?: (big: boolean) => void;
  } = $props();

  /** A screenshot closes itself this long after it opens, or after it is shrunk again; never while enlarged. */
  const SHOW_MS = 10_000;

  /** The popup keys this component by what it shows, so a new screenshot opens small again. */
  let big = $state(false);

  $effect(() => {
    if (big || data.kind !== "shot") return;
    const t = setTimeout(onClose, SHOW_MS);
    return () => clearTimeout(t);
  });

  function toggleBig() {
    big = !big;
    onBig(big);
  }

  function grab(e: MouseEvent) {
    // The close button is in the header too.
    if (e.button === 0 && !(e.target as Element).closest("button")) onDrag();
  }
</script>

<!-- The shared-screenshot popup's whole window: a header to drag it by, and the picture. -->
<div class="shot" role="dialog" aria-label={data.kind === "shot" ? `Screenshot from ${data.from}` : "Shared screenshot position"}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="head" title="Drag to move" onmousedown={grab}>
    {#if data.kind === "shot"}
      <span class="dot" style="background: {safeColor(data.color)}"></span>
      <span class="from" style="color: {safeColor(data.color)}">{data.from}</span>
      <span class="what">shared a screenshot</span>
    {:else}
      <span class="what">Shared screenshots show here</span>
    {/if}
    <button type="button" class="x" aria-label="Close" title="Close" onclick={onClose}>×</button>
  </div>
  {#if data.kind === "shot"}
    <button type="button" class="pic" class:big title={big ? "Click to shrink" : "Click to enlarge"} onclick={toggleBig}>
      <img src={data.url} alt="Screenshot from {data.from}" />
    </button>
  {:else}
    <div class="pic preview">
      <span>Drag this bar to where you want your squad's screenshots.</span>
      <button type="button" class="done" onclick={onClose}>Done</button>
    </div>
  {/if}
</div>

<style>
  .shot {
    position: fixed; inset: 0; display: flex; flex-direction: column; box-sizing: border-box;
    background: rgba(22, 26, 32, 0.94); border: 1px solid var(--line-2); border-radius: 4px;
    overflow: hidden;
  }
  .head {
    display: flex; align-items: center; gap: 6px; height: 28px; flex: none; padding: 0 4px 0 8px;
    font-size: 12px; white-space: nowrap; cursor: move;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .from { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
  .what { color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .x {
    flex: none; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 3px;
    background: transparent; color: var(--fg-2); font-size: 16px; line-height: 1; cursor: pointer;
  }
  .x:hover { background: var(--raised-2); color: var(--fg); }
  .pic { flex: 1; min-height: 0; display: block; width: 100%; padding: 0; border: 0; background: #000; cursor: zoom-in; }
  .pic.big { cursor: zoom-out; }
  .pic img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .preview {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
    padding: 0 20px; text-align: center; color: var(--fg-2); background: #0f1216; cursor: default;
  }
  .done {
    padding: 5px 16px; border: 1px solid var(--line-2); border-radius: 6px;
    background: var(--raised-2); color: var(--fg); cursor: pointer;
  }
</style>
