<script lang="ts">
  import { onMount } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { app } from "./lib/state/app.svelte";
  import { startEventBridge } from "./lib/tauri/events";
  import { setOverlay, applyOpacity, nextOpacity, installAltDrag, registerHotkeys } from "./lib/tauri/window";
  import { detectDirs, startScreenshotWatcher, startLogTail, type DetectedDirs } from "./lib/tauri/commands";
  import { checkForUpdate } from "./lib/tauri/updater";
  import { getMapDef } from "./lib/map/mapsData";
  import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "./lib/settings/store";
  import { room } from "./lib/room/controller.svelte";
  import RoomPanel from "./lib/room/RoomPanel.svelte";
  import SettingsPanel from "./lib/settings/SettingsPanel.svelte";
  import QuestPanel from "./lib/quests/QuestPanel.svelte";
  import { loadQuestData, defaultDeps } from "./lib/quests/cache";
  import { extractQuestMarkers, extractExtracts } from "./lib/quests/markers";
  import { visibleQuestMarkers } from "./lib/quests/questLayer";
  import { loadDone } from "./lib/quests/done";
  import MapView from "./lib/map/MapView.svelte";
  import MapPicker from "./lib/map/MapPicker.svelte";
  import Toasts from "./lib/ui/Toasts.svelte";
  import Banner from "./lib/ui/Banner.svelte";

  let pinnedFloor = $state<string | null>(null);
  let screenshotsDir = $state<string | null>(null);
  let logsDir = $state<string | null>(null);
  let settings = $state<Settings | null>(null);
  let showExtracts = $state(true);
  let mapView = $state<ReturnType<typeof MapView>>();
  let overlay = $state(false);
  let opacity = $state(100);
  let unhookHotkeys: (() => Promise<void>) | null = null;

  const def = $derived(app.currentMap ? (getMapDef(app.currentMap) ?? null) : null);
  const allQuestMarkers = $derived(app.questData ? extractQuestMarkers(app.questData) : []);
  const allExtracts = $derived(app.questData ? extractExtracts(app.questData) : []);
  const questMarkers = $derived(
    def ? visibleQuestMarkers(allQuestMarkers, def.key, app.doneQuests, settings?.playerLevel ?? 0) : [],
  );
  const extracts = $derived(def ? allExtracts.filter((e) => e.mapKey === def.key) : []);

  async function toggleOverlay() {
    const next = !overlay;
    try {
      await setOverlay(next);
      overlay = next;
    } catch (e) {
      app.toast(`Could not switch overlay mode: ${e}`);
    }
  }

  function cycleOpacity() {
    opacity = nextOpacity(opacity);
    applyOpacity(opacity);
  }

  /** Registering can fail when another app already owns the key, which must not break startup. */
  async function armHotkeys(s: Settings) {
    // Dropped before the await so a failure below can never leave a stale unhook behind.
    const previous = unhookHotkeys;
    unhookHotkeys = null;
    try {
      if (previous) await previous();
      unhookHotkeys = await registerHotkeys(s.hotkeyOverlay, s.hotkeyOpacity, { toggleOverlay, cycleOpacity });
    } catch (e) {
      app.toast(`Could not register hotkeys: ${e}`);
    }
  }

  function patchSettings(patch: Partial<Settings>) {
    if (!settings) return;
    settings = { ...settings, ...patch };
    saveSettings(settings).catch((e) => app.toast(`Could not save settings: ${e}`));
  }

  // The dir state is set only once the backend accepts the folder, so a stale or moved folder
  // leaves the banner up instead of silently pretending the watcher runs.
  async function useScreenshotsDir(dir: string): Promise<boolean> {
    try {
      await startScreenshotWatcher(dir, settings?.deleteScreenshots ?? DEFAULT_SETTINGS.deleteScreenshots);
      screenshotsDir = dir;
      return true;
    } catch (e) {
      app.toast(`Screenshot folder ${dir}: ${e}`);
      return false;
    }
  }
  async function useLogsDir(dir: string): Promise<boolean> {
    try {
      await startLogTail(dir);
      logsDir = dir;
      return true;
    } catch (e) {
      app.toast(`Log folder ${dir}: ${e}`);
      return false;
    }
  }

  /** Try the stored folder, then the detected one; remember whichever works. */
  async function useDir(kind: "screenshots" | "logs", stored: string | null, detected: string | null) {
    const start = kind === "screenshots" ? useScreenshotsDir : useLogsDir;
    if (stored && (await start(stored))) return;
    if (detected && detected !== stored && (await start(detected))) {
      patchSettings(kind === "screenshots" ? { screenshotsDir: detected } : { logsDir: detected });
    }
  }

  /** Persists a settings change, then re-applies the parts of it that are live. */
  async function applySettings(patch: Partial<Settings>) {
    const before = settings!;
    patchSettings(patch);
    const after = settings!;
    // Re-arm the watcher through the helper so the dir state still only survives a success.
    if (patch.deleteScreenshots !== undefined && screenshotsDir) await useScreenshotsDir(screenshotsDir);
    if (patch.relayUrl !== undefined && patch.relayUrl !== before.relayUrl && room.code) {
      room.join(room.code, after.name, after.color, after.relayUrl);
    }
    if (after.hotkeyOverlay !== before.hotkeyOverlay || after.hotkeyOpacity !== before.hotkeyOpacity) {
      await armHotkeys(after);
    }
  }

  async function pickDir(kind: "screenshots" | "logs") {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked !== "string") return;
    if (kind === "screenshots") {
      if (await useScreenshotsDir(picked)) patchSettings({ screenshotsDir: picked });
    } else {
      if (await useLogsDir(picked)) patchSettings({ logsDir: picked });
    }
  }

  onMount(() => {
    let stop: (() => void) | undefined;
    const stopDrag = installAltDrag();
    // Each phase is isolated: a failure in one must not stop the others from starting.
    (async () => {
      stop = await startEventBridge();

      const s = await loadSettings();
      settings = s;
      if (s.lastMap && !app.currentMap) app.setMap(s.lastMap, "manual");
      await armHotkeys(s);

      try {
        app.setDone(await loadDone());
        app.doneLoaded = true;
      } catch (e) {
        app.toast(`Could not load quest progress: ${e}`);
      }
      // Fire and forget: quest data arrives whenever it arrives, the UI never waits for it.
      loadQuestData(defaultDeps(), (d, src) => app.setQuestData(d, src)).catch((e) =>
        app.toast(`Quest data error: ${e}`),
      );

      let dirs: DetectedDirs = { screenshots: null, logs: null };
      try {
        dirs = await detectDirs();
      } catch (e) {
        app.toast(`Folder detection failed: ${e}`);
      }

      await useDir("screenshots", s.screenshotsDir, dirs.screenshots);
      await useDir("logs", s.logsDir, dirs.logs);

      checkForUpdate((m) => app.toast(m)).catch((e) => app.toast(`Update failed: ${e}`));
    })().catch((e) => app.toast(`Startup error: ${e}`));
    return () => {
      stop?.();
      stopDrag();
      unhookHotkeys?.().catch(() => {});
    };
  });

  $effect(() => {
    const p = app.ownPos;
    if (p) room.onOwnPosition(app.currentMap, p);
  });
</script>

<div class="layout">
  <header class="topbar">
    <strong>TarTrak</strong>
    <MapPicker
      value={app.currentMap}
      onchange={(k) => {
        app.setMap(k, "manual");
        pinnedFloor = null;
        patchSettings({ lastMap: k });
      }}
    />
    {#if app.mapSource === "log"}<span class="muted">auto</span>{/if}
    <label class="muted"><input type="checkbox" bind:checked={showExtracts} /> extracts</label>
    <span class="grow"></span>
    {#if app.ownPos}
      <span class="coords">x {app.ownPos.x.toFixed(0)} · y {app.ownPos.y.toFixed(0)} · z {app.ownPos.z.toFixed(0)} · {app.ownPos.yaw.toFixed(0)}°</span>
    {:else}
      <span class="muted">Take a screenshot in raid to place yourself</span>
    {/if}
    <button onclick={() => mapView?.centerOnMe()} disabled={!app.ownPos}>Center</button>
    <button onclick={() => mapView?.fitMap()} disabled={!def}>Fit</button>
    <button onclick={toggleOverlay}>{overlay ? "Window" : "Overlay"}</button>
    <button onclick={cycleOpacity}>{opacity}%</button>
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
        <MapView
          bind:this={mapView}
          {def}
          {pinnedFloor}
          onFloorPinned={(n) => (pinnedFloor = n)}
          {questMarkers}
          {extracts}
          {showExtracts}
          lineLengthPx={settings?.lineLengthPx ?? DEFAULT_SETTINGS.lineLengthPx}
        />
      {:else}
        <div class="empty">Pick a map above, or load into a raid.</div>
      {/if}
    </section>
    <aside id="side" class="side">
      {#if settings}
        <RoomPanel {settings} onSettingsChange={patchSettings} />
        <QuestPanel
          markers={allQuestMarkers}
          playerLevel={settings.playerLevel}
          onPlayerLevel={(n) => patchSettings({ playerLevel: n })}
        />
        <SettingsPanel {settings} onChange={applySettings} onPickDir={pickDir} />
      {/if}
    </aside>
  </div>
</div>
<Toasts />
