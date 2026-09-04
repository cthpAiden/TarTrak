<script lang="ts">
  import { onMount } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { app } from "./lib/state/app.svelte";
  import { startEventBridge } from "./lib/tauri/events";
  import { setOverlay, applyOpacity, nextOpacity, installAltDrag, registerHotkeys } from "./lib/tauri/window";
  import { detectDirs, startScreenshotWatcher, startLogTail, type DetectedDirs } from "./lib/tauri/commands";
  import { checkForUpdate } from "./lib/tauri/updater";
  import { retryUntil } from "./lib/tauri/retry";
  import { getMapDef, floorForHeight, visibleOnFloor } from "./lib/map/mapsData";
  import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "./lib/settings/store";
  import { room } from "./lib/room/controller.svelte";
  import RoomPanel from "./lib/room/RoomPanel.svelte";
  import SettingsPanel from "./lib/settings/SettingsPanel.svelte";
  import QuestPanel from "./lib/quests/QuestPanel.svelte";
  import { loadQuestData, defaultDeps } from "./lib/quests/cache";
  import { extractQuestMarkers } from "./lib/quests/markers";
  import { visibleQuestMarkers } from "./lib/quests/questLayer";
  import FilterPanel from "./lib/layers/FilterPanel.svelte";
  import { buildCounts } from "./lib/layers/counts";
  import { extractPoints } from "./lib/layers/points";
  import { isOn } from "./lib/layers/filters";
  import { loadDone } from "./lib/quests/done";
  import MapView from "./lib/map/MapView.svelte";
  import MapPicker from "./lib/map/MapPicker.svelte";
  import Toasts from "./lib/ui/Toasts.svelte";
  import Banner from "./lib/ui/Banner.svelte";

  const DIR_RETRY_MS = 10_000;
  const QUEST_RETRY_MS = 300_000;

  let pinnedFloor = $state<string | null>(null);
  let screenshotsDir = $state<string | null>(null);
  let logsDir = $state<string | null>(null);
  let settings = $state<Settings | null>(null);
  let mapView = $state<ReturnType<typeof MapView>>();
  let overlay = $state(false);
  let opacity = $state(100);
  let unhookHotkeys: (() => Promise<void>) | null = null;
  let stopQuestRetry: (() => void) | null = null;

  const def = $derived(app.currentMap ? (getMapDef(app.currentMap) ?? null) : null);
  const layerFilters = $derived(settings?.layerFilters ?? {});
  const hiddenQuests = $derived(settings?.hiddenQuests ?? {});
  const allQuestMarkers = $derived(app.questData ? extractQuestMarkers(app.questData) : []);
  const allPoints = $derived(app.questData ? extractPoints(app.questData) : []);
  const mapPoints = $derived(def ? allPoints.filter((p) => p.mapKey === def.key) : []);
  // The floor the map is showing: the pinned one, or the floor my own height puts me on.
  const activeFloor = $derived(
    pinnedFloor === null ? (def && app.ownPos ? floorForHeight(def, app.ownPos) : null) : pinnedFloor || null,
  );
  const points = $derived(
    def
      ? mapPoints.filter(
          (p) => isOn(layerFilters, p.group, p.category) && visibleOnFloor(def, activeFloor, p.x, p.z, p.y),
        )
      : [],
  );
  const showLabels = $derived(isOn(layerFilters, "labels", "landmark"));
  // Kept unfiltered by the layer toggles so the panel's shown/total can differ.
  const mapQuestMarkersBeforeFilters = $derived(
    def
      ? visibleQuestMarkers(allQuestMarkers, def.key, app.doneQuests, settings?.playerLevel ?? 0).filter(
          (m) => !hiddenQuests[m.taskId],
        )
      : [],
  );
  const questMarkers = $derived(
    def
      ? mapQuestMarkersBeforeFilters.filter(
          (m) => isOn(layerFilters, "quests", m.category) && visibleOnFloor(def, activeFloor, m.x, m.z, m.y),
        )
      : [],
  );

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
  // `quiet` is for the background retry below: the first failure is worth a toast, one every 10 s is not.
  async function useScreenshotsDir(dir: string, quiet = false): Promise<boolean> {
    try {
      await startScreenshotWatcher(dir, settings?.deleteScreenshots ?? DEFAULT_SETTINGS.deleteScreenshots);
      screenshotsDir = dir;
      return true;
    } catch (e) {
      if (!quiet) app.toast(`Screenshot folder ${dir}: ${e}`);
      return false;
    }
  }
  async function useLogsDir(dir: string, quiet = false): Promise<boolean> {
    try {
      await startLogTail(dir);
      logsDir = dir;
      return true;
    } catch (e) {
      if (!quiet) app.toast(`Log folder ${dir}: ${e}`);
      return false;
    }
  }

  /** Try the stored folder, then the detected one; remember whichever works. */
  async function useDir(kind: "screenshots" | "logs", stored: string | null, detected: string | null, quiet = false) {
    const start = kind === "screenshots" ? useScreenshotsDir : useLogsDir;
    if (stored && (await start(stored, quiet))) return;
    if (detected && detected !== stored && (await start(detected, quiet))) {
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
    let stopRetry: (() => void) | undefined;
    // Startup runs async, so it can still be mid-flight when the component goes away.
    let disposed = false;
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
      const deps = defaultDeps();
      loadQuestData(deps, (d, src) => app.setQuestData(d, src))
        .catch((e) => app.toast(`Quest data error: ${e}`))
        .then(() => {
          // With no cache and no snapshot, a tarkov.dev outage at startup would otherwise leave the
          // map and every filter empty until the next launch. Keep asking while it stays empty.
          if (app.questData || disposed) return;
          stopQuestRetry = retryUntil(async () => {
            await loadQuestData(deps, (d, src) => app.setQuestData(d, src));
            return app.questData !== null;
          }, QUEST_RETRY_MS);
        });

      let dirs: DetectedDirs = { screenshots: null, logs: null };
      try {
        dirs = await detectDirs();
      } catch (e) {
        app.toast(`Folder detection failed: ${e}`);
      }

      await useDir("screenshots", s.screenshotsDir, dirs.screenshots);
      await useDir("logs", s.logsDir, dirs.logs);

      // Spec 7: EFT creates the Screenshots folder on the first screenshot ever, so keep looking
      // (re-detecting each time, since the folder may only appear now) until the watcher is armed.
      if (!screenshotsDir && !disposed) {
        stopRetry = retryUntil(async () => {
          if (screenshotsDir) return true;
          let again: DetectedDirs = { screenshots: null, logs: null };
          try {
            again = await detectDirs();
          } catch {
            // Keep retrying; the startup attempt already reported the failure.
          }
          await useDir("screenshots", settings?.screenshotsDir ?? null, again.screenshots, true);
          return screenshotsDir !== null;
        }, DIR_RETRY_MS);
      }

      checkForUpdate((m) => app.toast(m)).catch((e) => app.toast(`Update failed: ${e}`));
    })().catch((e) => app.toast(`Startup error: ${e}`));
    return () => {
      disposed = true;
      stop?.();
      stopDrag();
      stopRetry?.();
      stopQuestRetry?.();
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
          {activeFloor}
          onFloorPinned={(n) => (pinnedFloor = n)}
          {questMarkers}
          {points}
          {showLabels}
          lineLengthPx={settings?.lineLengthPx ?? DEFAULT_SETTINGS.lineLengthPx}
        />
      {:else}
        <div class="empty">Pick a map above, or load into a raid.</div>
      {/if}
    </section>
    <aside id="side" class="side">
      {#if settings}
        <FilterPanel
          counts={buildCounts(mapPoints, mapQuestMarkersBeforeFilters, layerFilters, def?.labels.length ?? 0)}
          filters={layerFilters}
          onChange={(f) => patchSettings({ layerFilters: f })}
        />
        <RoomPanel {settings} onSettingsChange={patchSettings} />
        <QuestPanel
          markers={allQuestMarkers}
          playerLevel={settings.playerLevel}
          onPlayerLevel={(n) => patchSettings({ playerLevel: n })}
          hiddenQuests={settings.hiddenQuests}
          onHiddenChange={(h) => patchSettings({ hiddenQuests: h })}
        />
        <SettingsPanel {settings} onChange={applySettings} onPickDir={pickDir} onInvalid={(m) => app.toast(m)} />
      {/if}
    </aside>
  </div>
</div>
<Toasts />
