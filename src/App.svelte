<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "./lib/state/app.svelte";
  import { startEventBridge } from "./lib/tauri/events";
  import { detectDirs, startScreenshotWatcher, startLogTail } from "./lib/tauri/commands";

  let status = $state("starting");

  onMount(() => {
    let stop: (() => void) | undefined;
    (async () => {
      stop = await startEventBridge();
      const dirs = await detectDirs();
      if (dirs.screenshots) await startScreenshotWatcher(dirs.screenshots, true);
      if (dirs.logs) await startLogTail(dirs.logs);
      status = `screenshots: ${dirs.screenshots ?? "not found"} | logs: ${dirs.logs ?? "not found"}`;
    })().catch((e) => (status = `error: ${e}`));
    return () => stop?.();
  });
</script>

<main>
  <h1>TarTrak</h1>
  <p>{status}</p>
  <p>Map: {app.currentMap ?? "unknown"} ({app.mapSource ?? "-"})</p>
  {#if app.ownPos}
    <p>x {app.ownPos.x.toFixed(1)} y {app.ownPos.y.toFixed(1)} z {app.ownPos.z.toFixed(1)} yaw {app.ownPos.yaw.toFixed(0)}</p>
  {:else}
    <p>No position yet. Take a screenshot in raid.</p>
  {/if}
</main>
