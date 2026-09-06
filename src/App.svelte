<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { app, type Drawing, type Pin } from "./lib/state/app.svelte";
  import { newPinId, PRIVATE_PIN_COLOR } from "./lib/map/pins";
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
  import { loadQuestData, defaultDeps, type QuestSource } from "./lib/quests/cache";
  import type { GameMode } from "./lib/quests/jsonSource";
  import type { QuestData } from "./lib/quests/types";
  import { extractQuestMarkers } from "./lib/quests/markers";
  import FilterPanel from "./lib/layers/FilterPanel.svelte";
  import { buildCounts } from "./lib/layers/counts";
  import { extractPoints } from "./lib/layers/points";
  import { isOn, pointOn } from "./lib/layers/filters";
  import { findItem } from "./lib/layers/points";
  import { loadDone } from "./lib/quests/done";
  import MapView from "./lib/map/MapView.svelte";
  import RoutePicker from "./lib/map/RoutePicker.svelte";
  import { distanceM, routeGroups } from "./lib/map/route";
  import MapPicker from "./lib/map/MapPicker.svelte";
  import Toasts from "./lib/ui/Toasts.svelte";
  import Banner from "./lib/ui/Banner.svelte";

  const DIR_RETRY_MS = 10_000;
  const QUEST_RETRY_MS = 300_000;
  const TABS = [
    { id: "filters", label: "Filters" },
    { id: "squad", label: "Squad" },
    { id: "quests", label: "Quests" },
    { id: "settings", label: "Settings" },
  ] as const;

  let tab = $state<(typeof TABS)[number]["id"]>("filters");

  let pinnedFloor = $state<string | null>(null);
  /** Point id of the extract the route line leads to. */
  let routeTarget = $state<string | null>(null);
  let drawMode = $state(false);
  /** Item finder text; matching points show regardless of the layer toggles. */
  let itemQuery = $state("");
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
  const todoQuests = $derived(settings?.todoQuests ?? {});
  // Mine plus what teammates share: a quest on either list has its markers on the map.
  const trackedQuests = $derived.by(() => {
    const ids = new Set(Object.keys(todoQuests));
    for (const list of Object.values(app.squadTodos)) for (const id of list) ids.add(id);
    return ids;
  });
  const allQuestMarkers = $derived(app.questData ? extractQuestMarkers(app.questData) : []);
  // Only the current map's points are built; the other maps' thousands would sit in memory unused.
  const mapPoints = $derived(def && app.questData ? extractPoints(app.questData, def.key) : []);
  // The floor the map is showing: the pinned one, or the floor my own height puts me on.
  const activeFloor = $derived(
    pinnedFloor === null ? (def && app.ownPos ? floorForHeight(def, app.ownPos) : null) : pinnedFloor || null,
  );
  const hitIds = $derived(findItem(mapPoints, itemQuery));
  const points = $derived(
    def
      ? mapPoints.filter(
          (p) =>
            (hitIds.has(p.id) || pointOn(layerFilters, p)) &&
            visibleOnFloor(def, activeFloor, p.x, p.z, p.y, p.top, p.bottom),
        )
      : [],
  );
  const showLabels = $derived(isOn(layerFilters, "labels", "landmark"));
  const extractGroups = $derived(routeGroups(mapPoints));
  // Looked up on the current map, so a target left over from another map simply draws nothing.
  const routePoint = $derived(routeTarget ? (mapPoints.find((p) => p.id === routeTarget) ?? null) : null);
  const routeDistance = $derived(routePoint && app.ownPos ? distanceM(app.ownPos, routePoint) : null);
  // Only to-do quests reach the map; a done one leaves it. Kept unfiltered by the layer toggles so
  // the panel's shown/total can differ.
  const mapQuestMarkersBeforeFilters = $derived(
    def ? allQuestMarkers.filter((m) => m.mapKey === def.key && !app.doneQuests[m.taskId] && trackedQuests.has(m.taskId)) : [],
  );
  // Layer toggles only: a marker on another floor is drawn dimmed by the map view, not dropped.
  const questMarkers = $derived(mapQuestMarkersBeforeFilters.filter((m) => isOn(layerFilters, "quests", m.category)));

  function focusTeammate(id: string) {
    const t = app.teammates[id];
    if (t) mapView?.centerOn(t.x, t.z);
  }

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
    if (after.gameMode !== before.gameMode) loadQuests(after.gameMode);
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

  // Startup runs async, so it can still be mid-flight when the component goes away.
  let disposed = false;

  /** Loads the data set for one game mode; a switch drops the retry loop of the previous one. */
  function loadQuests(mode: GameMode) {
    stopQuestRetry?.();
    stopQuestRetry = null;
    const deps = defaultDeps(mode);
    // A late answer for a mode the user has already left must not overwrite the current data.
    const apply = (d: QuestData, src: QuestSource) => {
      if (settings?.gameMode === mode) app.setQuestData(d, src);
    };
    loadQuestData(deps, apply)
      .catch((e) => app.toast(`Quest data error: ${e}`))
      .then(() => {
        // With no cache and no snapshot, a tarkov.dev outage at startup would otherwise leave the
        // map and every filter empty until the next launch. Keep asking while it stays empty.
        if (app.questData || disposed || settings?.gameMode !== mode) return;
        stopQuestRetry = retryUntil(async () => {
          await loadQuestData(deps, apply);
          return app.questData !== null;
        }, QUEST_RETRY_MS);
      });
  }

  onMount(() => {
    let stop: (() => void) | undefined;
    let stopRetry: (() => void) | undefined;
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
      loadQuests(s.gameMode);

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

  function placePin(p: { x: number; z: number; label: string; shared: boolean }) {
    if (!def) return;
    const pin: Pin = {
      id: newPinId(),
      map: def.key,
      x: p.x,
      z: p.z,
      label: p.label,
      color: p.shared ? (settings?.color ?? DEFAULT_SETTINGS.color) : PRIVATE_PIN_COLOR,
      shared: p.shared,
    };
    if (pin.shared && !room.sharePin(pin)) {
      app.toast("Squad not connected: marker kept for you only");
      pin.shared = false;
      pin.color = PRIVATE_PIN_COLOR;
    }
    app.addPin(pin);
  }

  function removePin(id: string) {
    const pin = app.pins[id];
    if (!pin) return;
    app.removePin(id);
    if (pin.shared) room.unsharePin(id);
  }

  /** A finished stroke: shared with the room when one is connected, otherwise kept to this app. */
  function addDrawing(points: [number, number][]) {
    if (!def) return;
    const d: Drawing = {
      id: newPinId(),
      map: def.key,
      color: settings?.color ?? DEFAULT_SETTINGS.color,
      points,
      shared: room.status === "open",
      mine: true,
    };
    if (d.shared && !room.shareDrawing(d)) d.shared = false;
    app.addDrawing(d);
  }

  function undoDrawing() {
    if (!def) return;
    const d = app.lastOwnDrawing(def.key);
    if (!d) return;
    app.removeDrawing(d.id);
    if (d.shared) room.unshareDrawing(d.id);
  }

  /** Every drawing on this map; in a room that is everyone's, on every screen. */
  function clearDrawings() {
    if (!def) return;
    app.clearDrawings(def.key);
    if (room.status === "open") room.clearSharedDrawings(def.key);
  }

  // My to-do list goes to the room on every change while sharing is on, and again after a reconnect;
  // turning sharing off withdraws it. untrack: sending must not make this depend on the room client.
  $effect(() => {
    const status = room.status;
    const share = settings?.shareTodo ?? false;
    const ids = Object.keys(todoQuests);
    if (status !== "open") return;
    untrack(() => room.shareTodo(share ? ids : []));
  });

  // Every screenshot recentres the map on me while follow is on; a small overlay would otherwise
  // lose the marker after a short walk. untrack: reading settings here must not re-pan on edits.
  $effect(() => {
    const at = app.ownUpdatedAt;
    untrack(() => {
      if (at && (settings?.followMe ?? true)) mapView?.centerOnMe();
    });
  });
</script>

<div class="layout">
  {#if !overlay}
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
    {#if app.mapSource === "log"}<span class="muted" title="Map detected from the game log">auto</span>{/if}
    <span class="grow"></span>
    {#if app.ownPos}
      <span class="coords">x {app.ownPos.x.toFixed(0)} · y {app.ownPos.y.toFixed(0)} · z {app.ownPos.z.toFixed(0)} · {app.ownPos.yaw.toFixed(0)}°</span>
    {:else}
      <span class="muted" title="Take an in-game screenshot to place yourself">No position yet</span>
    {/if}
    <button onclick={() => mapView?.centerOnMe()} disabled={!app.ownPos}>Center</button>
    <button onclick={() => mapView?.fitMap()} disabled={!def}>Fit</button>
    <button onclick={toggleOverlay}>{overlay ? "Window" : "Overlay"}</button>
    <button onclick={cycleOpacity}>{opacity}%</button>
  </header>
  {/if}

  {#if !screenshotsDir}
    <Banner text="Screenshot folder not found." action="Pick folder" onaction={() => pickDir("screenshots")} />
  {/if}
  {#if !logsDir}
    <Banner text="Game log folder not found; map auto-detect is off." action="Pick folder" onaction={() => pickDir("logs")} />
  {/if}

  <div class="body">
    <section class="map">
      <!-- Overlay is the minimal view: map only. These buttons are the controls that survive it. -->
      <div class="map-tools">
      <button class="mode-btn" onclick={toggleOverlay} title={overlay ? "Full window" : "Overlay (map only)"} aria-label={overlay ? "Full window" : "Overlay (map only)"}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          {#if overlay}
            <rect x="1.5" y="4.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path d="M5.5 4.5v-3h9v9h-3" fill="none" stroke="currentColor" stroke-width="1.5" />
          {:else}
            <rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path d="M2.5 5.5h11" stroke="currentColor" stroke-width="1.5" />
          {/if}
        </svg>
      </button>
      <button
        class="mode-btn follow-btn"
        aria-pressed={settings?.followMe ?? true}
        onclick={() => patchSettings({ followMe: !(settings?.followMe ?? true) })}
        title="Follow me: keep the map centred on my marker"
        aria-label="Follow me"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="8" cy="8" r="4" />
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
        </svg>
      </button>
      <RoutePicker
        groups={extractGroups}
        selectedId={routePoint?.id ?? null}
        selectedName={routePoint?.name ?? null}
        distanceM={routeDistance}
        from={app.ownPos ? { x: app.ownPos.x, z: app.ownPos.z } : null}
        onSelect={(id) => (routeTarget = id)}
      />
      <button
        class="mode-btn draw-btn"
        aria-pressed={drawMode}
        onclick={() => (drawMode = !drawMode)}
        title="Draw on the map: drag to draw, right-click for undo and clear. In a room the squad sees it live."
        aria-label="Draw on the map"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 13l1-4 7.5-7.5 3 3L7 12z" />
          <path d="M10.5 3.5l2 2" />
        </svg>
      </button>
      </div>
      {#if room.reconnecting}
        <div class="conn-pill" role="status">
          <span class="dot connecting"></span>
          {room.status === "connecting" ? "Squad: connecting…" : "Squad: reconnecting…"}
        </div>
      {/if}
      {#if def}
        <MapView
          bind:this={mapView}
          {def}
          {pinnedFloor}
          {activeFloor}
          onFloorPinned={(n) => (pinnedFloor = n)}
          {questMarkers}
          {points}
          {hitIds}
          {showLabels}
          lineLengthM={settings?.lineLengthM ?? DEFAULT_SETTINGS.lineLengthM}
          mateColors={settings?.mateColors ?? DEFAULT_SETTINGS.mateColors}
          canShare={room.status === "open"}
          onPin={placePin}
          onRemovePin={removePin}
          route={routePoint ? { x: routePoint.x, z: routePoint.z, name: routePoint.name } : null}
          {drawMode}
          drawColor={settings?.color ?? DEFAULT_SETTINGS.color}
          onDraw={addDrawing}
          onUndoDraw={undoDrawing}
          onClearDraw={clearDrawings}
        />
      {:else}
        <div class="empty">Pick a map above, or load into a raid.</div>
      {/if}
    </section>
    <aside id="side" class="side">
      {#if settings}
        <div class="tabs" role="tablist">
          {#each TABS as t (t.id)}
            <button role="tab" aria-selected={tab === t.id} onclick={() => (tab = t.id)}>
              {t.label}
              {#if t.id === "squad" && room.code}
                <span class="dot {room.status}"></span>
              {/if}
            </button>
          {/each}
        </div>
        <div class="pane">
          {#if tab === "filters"}
            <FilterPanel
              counts={buildCounts(mapPoints, mapQuestMarkersBeforeFilters, layerFilters, def?.labels.length ?? 0)}
              filters={layerFilters}
              onChange={(f) => patchSettings({ layerFilters: f })}
              {itemQuery}
              onItemQuery={(q) => (itemQuery = q)}
              hitCount={hitIds.size}
            />
          {:else if tab === "squad"}
            <RoomPanel {settings} onSettingsChange={patchSettings} onFocus={focusTeammate} />
          {:else if tab === "quests"}
            <QuestPanel
              markers={allQuestMarkers}
              gameMode={settings.gameMode}
              playerLevel={settings.playerLevel}
              onPlayerLevel={(n) => patchSettings({ playerLevel: n })}
              availableOnly={settings.questsAvailableOnly}
              onAvailableOnly={(on) => patchSettings({ questsAvailableOnly: on })}
              todoQuests={settings.todoQuests}
              onTodoChange={(t) => patchSettings({ todoQuests: t })}
              shareTodo={settings.shareTodo}
              onShareTodo={(on) => patchSettings({ shareTodo: on })}
            />
          {:else}
            <SettingsPanel
              {settings}
              onChange={applySettings}
              onPickDir={pickDir}
              onInvalid={(m) => app.toast(m)}
              onCheckUpdate={() => checkForUpdate((m) => app.toast(m), { manual: true }).catch((e) => app.toast(`Update failed: ${e}`))}
            />
          {/if}
        </div>
      {/if}
    </aside>
  </div>
</div>
<Toasts />
