<script lang="ts">
  import { onMount } from "svelte";
  import { emitTo, listen } from "@tauri-apps/api/event";
  import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
  import ShotCard from "../lib/room/ShotCard.svelte";
  import { bigRect, POPUP_H, POPUP_W, readPopupData, type PopupData } from "../lib/room/popup";
  import { closeShotWindow, shotPopupData } from "../lib/tauri/commands";

  const win = getCurrentWindow();
  /** Numbers what is shown, so closing it leaves a newer screenshot that came meanwhile open. */
  let gen = $state(0);
  let data = $state<PopupData | null>(null);
  /** Where the small popup was before it was enlarged, in physical pixels: logical ones are not one space across screens at different scales. */
  let small: { x: number; y: number } | null = null;
  /** Set once the player presses the header to drag: moves before that are the app's own (opening, enlarging, shrinking). */
  let dragged = false;
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
    dragged = false;
    if (big) {
      const mon = await currentMonitor();
      if (!mon) return;
      const pos = await win.outerPosition();
      small = { x: pos.x, y: pos.y };
      const s = mon.scaleFactor;
      const r = bigRect({
        x: mon.workArea.position.x / s,
        y: mon.workArea.position.y / s,
        width: mon.workArea.size.width / s,
        height: mon.workArea.size.height / s,
      });
      // Moved, then grown: it stays on this screen all along, so nothing rescales it half-way.
      await win.setPosition(new PhysicalPosition(Math.round(r.x * s), Math.round(r.y * s)));
      await win.setSize(new PhysicalSize(Math.round(r.width * s), Math.round(r.height * s)));
    } else if (small) {
      await win.setSize(new LogicalSize(POPUP_W, POPUP_H));
      await win.setPosition(new PhysicalPosition(small.x, small.y));
      small = null;
    }
  }

  /**
   * The player's spot goes to the main window, which keeps it in the settings. The spot is the one
   * this move reported: read later, it could already be the enlarged window's.
   */
  function moved({ x, y }: { x: number; y: number }) {
    if (small || !dragged) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void emitTo("main", "shot-moved", { x, y }), 300);
  }

  function drag() {
    dragged = true;
    void win.startDragging();
  }

  function close() {
    void closeShotWindow(gen);
  }

  onMount(() => {
    const unlisten = [listen("shot-update", () => void refresh()), win.onMoved((e) => moved(e.payload))];
    // Read only once listening, so a screenshot that comes while this page loads is not missed.
    void unlisten[0].then(refresh);
    return () => unlisten.forEach((u) => void u.then((f) => f()));
  });
</script>

{#if data}
  {#key gen}
    <ShotCard {data} onClose={close} onDrag={drag} onBig={(b) => void setBig(b)} />
  {/key}
{/if}

<style>
  /* "html body" outranks app.css's "body", whichever stylesheet loads last. */
  :global(html), :global(html body) { background: transparent; }
</style>
