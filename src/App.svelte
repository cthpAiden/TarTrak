<script lang="ts">
  import { onMount } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { app } from "./lib/state/app.svelte";
  import { startEventBridge } from "./lib/tauri/events";
  import { detectDirs, startScreenshotWatcher, startLogTail } from "./lib/tauri/commands";
  import { getMapDef } from "./lib/map/mapsData";
  import MapView from "./lib/map/MapView.svelte";
  import MapPicker from "./lib/map/MapPicker.svelte";
  import Toasts from "./lib/ui/Toasts.svelte";
  import Banner from "./lib/ui/Banner.svelte";

  let pinnedFloor = $state<string | null>(null);
  let screenshotsDir = $state<string | null>(null);
  let logsDir = $state<string | null>(null);
  let mapView = $state<ReturnType<typeof MapView>>();

  const def = $derived(app.currentMap ? (getMapDef(app.currentMap) ?? null) : null);

  async function useScreenshotsDir(dir: string) {
    screenshotsDir = dir;
    await startScreenshotWatcher(dir, true);
  }
  async function useLogsDir(dir: string) {
    logsDir = dir;
    await startLogTail(dir);
  }
  async function pickDir(kind: "screenshots" | "logs") {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked !== "string") return;
    if (kind === "screenshots") await useScreenshotsDir(picked);
    else await useLogsDir(picked);
  }

  onMount(() => {
    let stop: (() => void) | undefined;
    (async () => {
      stop = await startEventBridge();
      const dirs = await detectDirs();
      if (dirs.screenshots) await useScreenshotsDir(dirs.screenshots);
      if (dirs.logs) await useLogsDir(dirs.logs);
    })().catch((e) => app.toast(`Startup error: ${e}`));
    return () => stop?.();
  });
</script>

<div class="layout">
  <header class="topbar">
    <strong>TarTrak</strong>
    <MapPicker value={app.currentMap} onchange={(k) => { app.setMap(k, "manual"); pinnedFloor = null; }} />
    {#if app.mapSource === "log"}<span class="muted">auto</span>{/if}
    <span class="grow"></span>
    {#if app.ownPos}
      <span class="coords">x {app.ownPos.x.toFixed(0)} · y {app.ownPos.y.toFixed(0)} · z {app.ownPos.z.toFixed(0)} · {app.ownPos.yaw.toFixed(0)}°</span>
    {:else}
      <span class="muted">Take a screenshot in raid to place yourself</span>
    {/if}
    <button onclick={() => mapView?.centerOnMe()} disabled={!app.ownPos}>Center</button>
    <button onclick={() => mapView?.fitMap()} disabled={!def}>Fit</button>
  </header>

  {#if !screenshotsDir}
    <Banner text="Screenshot folder not found." action="Pick folder" onaction={() => pickDir("screenshots")} />
  {/if}
  {#if !logsDir}
    <Banner text="Game log folder not found; map auto-detect is off." action="Pick folder" onaction={() => pickDir("logs")} />
  {/if}

  <div class="body">
    <section class="map">
      {#if def}
        <MapView bind:this={mapView} {def} {pinnedFloor} onFloorPinned={(n) => (pinnedFloor = n)} />
      {:else}
        <div class="empty">Pick a map above, or load into a raid.</div>
      {/if}
    </section>
    <aside id="side" class="side"></aside>
  </div>
</div>
<Toasts />
