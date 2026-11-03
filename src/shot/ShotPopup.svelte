<script lang="ts">
  import { onMount } from "svelte";
  import { emitTo, listen } from "@tauri-apps/api/event";
  import { currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
  import ShotCard from "../lib/room/ShotCard.svelte";
  import { bigRect, POPUP_H, POPUP_W, readPopupData, type PopupData } from "../lib/room/popup";
  import { closeShotWindow, shotPopupData } from "../lib/tauri/commands";

  const win = getCurrentWindow();
  /** Numbers what is shown, so closing it leaves a newer screenshot that came meanwhile open. */
  let gen = $state(0);
  let data = $state<PopupData | null>(null);
  /** Where the small popup was before it was enlarged, in logical pixels. */
  let small: { x: number; y: number } | null = null;
  /** Moves before this time are the app's own (opening, enlarging, shrinking), not the player's drag. */
  let quietUntil = Date.now() + 1000;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  async function refresh() {
    // A new screenshot opens small, where the player put the popup.
    if (small) await setBig(false);
    const s = await shotPopupData();
    gen = s.gen;
    data = readPopupData(s.data);
    // Nothing it can show: an invisible window on top must not linger.
    if (!data) close();
  }

  async function setBig(big: boolean) {
    quietUntil = Infinity;
    try {
      if (big) {
        const mon = await currentMonitor();
        if (!mon) return;
        const scale = await win.scaleFactor();
        const pos = await win.outerPosition();
        small = { x: pos.x / scale, y: pos.y / scale };
        const s = mon.scaleFactor;
        const r = bigRect({
          x: mon.workArea.position.x / s,
          y: mon.workArea.position.y / s,
          width: mon.workArea.size.width / s,
          height: mon.workArea.size.height / s,
        });
        await win.setSize(new LogicalSize(r.width, r.height));
        await win.setPosition(new LogicalPosition(r.x, r.y));
      } else if (small) {
        await win.setSize(new LogicalSize(POPUP_W, POPUP_H));
        await win.setPosition(new LogicalPosition(small.x, small.y));
        small = null;
      }
    } finally {
      if (!small) quietUntil = Date.now() + 1000;
    }
  }

  /** The player's spot goes to the main window, which keeps it in the settings. */
  function moved() {
    if (small || Date.now() < quietUntil) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const scale = await win.scaleFactor();
      const pos = await win.outerPosition();
      await emitTo("main", "shot-moved", { x: pos.x / scale, y: pos.y / scale });
    }, 300);
  }

  function close() {
    void closeShotWindow(gen);
  }

  onMount(() => {
    const unlisten = [listen("shot-update", () => void refresh()), win.onMoved(moved)];
    // Read only once listening, so a screenshot that comes while this page loads is not missed.
    void unlisten[0].then(refresh);
    return () => unlisten.forEach((u) => void u.then((f) => f()));
  });
</script>

{#if data}
  {#key gen}
    <ShotCard {data} onClose={close} onDrag={() => void win.startDragging()} onBig={(b) => void setBig(b)} />
  {/key}
{/if}

<style>
  /* "html body" outranks app.css's "body", whichever stylesheet loads last. */
  :global(html), :global(html body) { background: transparent; }
</style>
