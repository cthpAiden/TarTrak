<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { app, type Drawing, type Pin } from "./lib/state/app.svelte";
  import { newPinId, PRIVATE_PIN_COLOR } from "./lib/map/pins";
  import { startEventBridge } from "./lib/tauri/events";
  import {
    setOverlay,
    setHidden,
    applyOpacity,
    nextOpacity,
    installAltDrag,
    registerHotkeys,
    readWindowRect,
    fitWindowTo,
    restoreWindowRect,
    type WindowRect,
  } from "./lib/tauri/window";
  import { detectDirs, startScreenshotWatcher, startLogTail, startMarkKey, type DetectedDirs } from "./lib/tauri/commands";
  import { MarkPairer } from "./lib/tauri/markHere";
  import { DEFAULT_SHOT_KEY_VK, markKeyLabel } from "./lib/settings/markKey";
  import type { Position } from "./lib/parse/screenshot";
  import { checkForUpdate } from "./lib/tauri/updater";
  import { retryUntil } from "./lib/tauri/retry";
  import { getMapDef, floorForHeight, visibleOnFloor } from "./lib/map/mapsData";
  import { DEFAULT_SETTINGS, loadSettings, saveSettings, type OverlayShape, type Settings } from "./lib/settings/store";
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
  import CompassTape from "./lib/map/CompassTape.svelte";
  import CircleBezel from "./lib/map/CircleBezel.svelte";
  import FloorPicker from "./lib/map/FloorPicker.svelte";
  import {
    chipAngles,
    circleLayout,
    circleWindowSize,
    polar,
    rimChips,
    CHIP_GAP,
    FLOOR_GAP,
    RIM_BUTTON_ANGLES,
    RIM_BUTTON_GAP,
  } from "./lib/map/circle";
  import { version } from "../package.json";
  import MateReadout from "./lib/map/MateReadout.svelte";
  import { raidTimeLeft } from "./lib/map/raidTimer";
  import { bearingDeg, pad3, type CompassTarget } from "./lib/map/compass";
  import { mateColor } from "./lib/room/squad";
  import Toasts from "./lib/ui/Toasts.svelte";
  import Banner from "./lib/ui/Banner.svelte";

  const DIR_RETRY_MS = 10_000;
  const QUEST_RETRY_MS = 300_000;
  /** One sticky toast carries the update download's progress; a fresh line after it is taken down starts a new one. */
  const updateUi = (() => {
    let id: number | null = null;
    return {
      info: (m: string) => void app.toast(m),
      progress: (m: string | null) => {
        if (m === null) {
          if (id !== null) app.dismissToast(id);
          id = null;
        } else if (id === null) id = app.toast(m, { sticky: true });
        else app.updateToast(id, m);
      },
    };
  })();
  const TABS = [
    { id: "filters", label: "Filters" },
    { id: "squad", label: "Squad" },
    { id: "quests", label: "Quests" },
    { id: "settings", label: "Settings" },
  ] as const;

  let tab = $state<(typeof TABS)[number]["id"]>("filters");

  let pinnedFloor = $state<string | null>(null);
  /** Where the route line leads: an extract by point id, or a spot picked with "Go here" on the map. */
  let route = $state<{ kind: "extract"; id: string } | { kind: "spot"; map: string; x: number; z: number } | null>(null);
  let drawMode = $state(false);
  /** Item finder text; matching points show regardless of the layer toggles. */
  let itemQuery = $state("");
  let screenshotsDir = $state<string | null>(null);
  let logsDir = $state<string | null>(null);
  let settings = $state<Settings | null>(null);
  let mapView = $state<ReturnType<typeof MapView>>();
  let overlay = $state(false);
  /** The shape the overlay took when it went up; settings cannot change while it is up. */
  let overlayShape = $state<OverlayShape>("box");
  /** The window's place and size before the round minimap shrank it, to put back when it comes down. */
  let savedRect: WindowRect | null = null;
  let winW = $state(window.innerWidth);
  let winH = $state(window.innerHeight);
  let opacity = $state(100);
  let hidden = $state(false);
  let unhookHotkeys: (() => Promise<void>) | null = null;
  let stopQuestRetry: (() => void) | null = null;

  const def = $derived(app.currentMap ? (getMapDef(app.currentMap) ?? null) : null);
  const layerFilters = $derived(settings?.layerFilters ?? {});
  const todoQuests = $derived(settings?.todoQuests ?? {});
  // Mine plus what teammates share, unless squad quests are switched off: a quest on either list has its markers on the map.
  const trackedQuests = $derived.by(() => {
    const ids = new Set(Object.keys(todoQuests));
    if (settings?.showSquadTodo !== false) {
      for (const list of Object.values(app.squadTodos)) for (const id of list) ids.add(id);
    }
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
  // Resolved on the current map, so a target left over from another map simply draws nothing.
  const routePoint = $derived.by(() => {
    const r = route;
    if (!r || !def) return null;
    if (r.kind === "spot") return r.map === def.key ? { id: "spot", x: r.x, z: r.z, name: "chosen spot" } : null;
    const p = mapPoints.find((p) => p.id === r.id);
    return p ? { id: p.id, x: p.x, z: p.z, name: p.name } : null;
  });
  // tarkov.dev's entry for the map on screen: raid length, player count, bosses.
  const mapInfo = $derived(def && app.questData ? (app.questData.maps.find((m) => m.normalizedName === def.key) ?? null) : null);
  // The raid clock ticks once a second while a raid start is known (the status bar and the overlay show it).
  let now = $state(Date.now());
  $effect(() => {
    if (app.raidStartedAt === null) return;
    now = Date.now();
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });
  const raidLeft = $derived(settings?.raidTimer === false ? null : raidTimeLeft(app.raidStartedAt, mapInfo?.raidDuration, now));
  const routeDistance = $derived(routePoint && app.ownPos ? distanceM(app.ownPos, routePoint) : null);
  // Teammates drawn on my map, the map view's filter, for the overlay's compass and distance pill.
  const overlayMates = $derived.by(() => {
    const d = def;
    if (!d) return [];
    const colors = settings?.mateColors ?? {};
    return Object.values(app.teammates)
      .filter((t) => !t.noPosition && (t.map === d.key || t.map === null))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ id: t.id, name: t.name, color: mateColor(t.name, t.color, colors), x: t.x, z: t.z }));
  });
  const compassTargets = $derived.by((): CompassTarget[] => {
    const me = app.ownPos;
    if (!me) return [];
    const targets: CompassTarget[] = [];
    if (routePoint) targets.push({ id: "route", bearing: bearingDeg(me, routePoint), color: "#f0b429", label: routePoint.name, kind: "route" });
    // Relay ids are any 1..32 chars; the prefix keeps one from colliding with the "route" key above.
    for (const m of overlayMates) targets.push({ id: `mate:${m.id}`, bearing: bearingDeg(me, m), color: m.color, label: m.name, kind: "mate" });
    return targets;
  });
  const readoutMates = $derived(
    overlayMates.map((m) => ({ id: m.id, name: m.name, color: m.color, distanceM: app.ownPos ? distanceM(app.ownPos, m) : null })),
  );

  // Round minimap: the disc, its bezel and everything around its rim, placed in the shrunk window.
  const circle = $derived(overlay && overlayShape === "circle");
  const ring = $derived(circle ? circleLayout(winW, winH, settings?.minimapSize ?? DEFAULT_SETTINGS.minimapSize) : null);
  const headingUp = $derived((settings?.minimapRotation ?? DEFAULT_SETTINGS.minimapRotation) === "heading");
  // Heading-up turns the map under me; with no position yet there is no heading to turn to.
  const mapRotation = $derived(circle && headingUp && app.ownPos ? app.ownPos.yaw : 0);
  const chipSlots = $derived(ring ? chipAngles(ring.ro) : []);
  const chips = $derived(ring ? rimChips(raidLeft, readoutMates, chipSlots.length) : []);
  /** Inline position that centres an element `radius` from the disc centre at `deg` clockwise from 12 o'clock. */
  function onRim(deg: number, radius: number): string {
    const p = polar(ring!.cx, ring!.cy, radius, deg);
    return `left: ${p.x}px; top: ${p.y}px`;
  }
  const todoCount = $derived(Object.keys(todoQuests).length);
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
    const s = settings ?? DEFAULT_SETTINGS;
    const shape = next ? s.overlayShape : overlayShape;
    try {
      // Read before the frame comes off, so the full window comes back exactly as it was.
      if (next && shape === "circle") savedRect = await readWindowRect();
      await setOverlay(next, shape);
      overlay = next;
      overlayShape = shape;
    } catch (e) {
      // The overlay never went up, so there is no shrunk window to put back later.
      if (next) savedRect = null;
      app.toast(`Could not switch overlay mode: ${e}`);
      return;
    }
    try {
      if (next && shape === "circle") {
        const size = circleWindowSize(s.minimapSize);
        await fitWindowTo(size.width, size.height);
      } else if (!next && savedRect) {
        const r = savedRect;
        savedRect = null;
        await restoreWindowRect(r);
      }
    } catch (e) {
      app.toast(`Could not resize the window: ${e}`);
    }
    // The map area just changed size and place; follow me puts me back in the middle of it.
    if (settings?.followMe ?? true) setTimeout(() => mapView?.centerOnMe(), 50);
  }

  function cycleOpacity() {
    opacity = nextOpacity(opacity);
    applyOpacity(opacity);
  }

  /** The window vanishes, for looting with the overlay in the way; the same key brings it back. */
  async function toggleHidden() {
    const next = !hidden;
    try {
      await setHidden(next);
      hidden = next;
    } catch (e) {
      app.toast(`Could not hide the window: ${e}`);
    }
  }

  /** Registering can fail when another app already owns the key, which must not break startup. */
  async function armHotkeys(s: Settings) {
    // Dropped before the await so a failure below can never leave a stale unhook behind.
    const previous = unhookHotkeys;
    unhookHotkeys = null;
    try {
      if (previous) await previous();
      unhookHotkeys = await registerHotkeys(s.hotkeyOverlay, s.hotkeyOpacity, s.hotkeyHide, {
        toggleOverlay,
        cycleOpacity,
        toggleHidden,
      });
    } catch (e) {
      app.toast(`Could not register hotkeys: ${e}`);
    }
  }

  /** Mark-here: the screenshot paired with the mark key becomes a private pin where I stood. */
  const markPairer = new MarkPairer((p) => markHere(p));

  function markHere(p: Position) {
    if (!def) return;
    const t = new Date();
    const hhmm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    placePin({ x: p.x, z: p.z, label: `Marked ${hhmm}`, shared: false });
    app.toast("Marked");
  }

  /** The poller runs in Rust; a failure to start it must not break startup. */
  async function armMarkKey(vk: number, shotVk: number) {
    try {
      await startMarkKey(vk, shotVk);
    } catch (e) {
      app.toast(`Could not watch the mark-here key: ${e}`);
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
    if (
      after.hotkeyOverlay !== before.hotkeyOverlay ||
      after.hotkeyOpacity !== before.hotkeyOpacity ||
      after.hotkeyHide !== before.hotkeyHide
    ) {
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
      stop = await startEventBridge({
        onPosition: (p) => markPairer.screenshot(p),
        onMarkKey: () => markPairer.press(),
        // Rust already showed the window; the hide hotkey must not think it is still hidden.
        onSecondInstance: () => {
          hidden = false;
          app.toast("An instance of TarTrak is already running");
        },
      });

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

      checkForUpdate(updateUi).catch((e) => app.toast(`Update failed: ${e}`));
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

  // The chord poller follows the mark key setting and the screenshot key the game log reports;
  // before the log says, it assumes the game's stock PrintScreen.
  $effect(() => {
    const vk = settings?.markKeyVk;
    const shot = app.shotKeyVk ?? DEFAULT_SHOT_KEY_VK;
    if (vk === undefined) return;
    void armMarkKey(vk, shot);
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

<svelte:window bind:innerWidth={winW} bind:innerHeight={winH} />

{#snippet followIcon()}
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="8" cy="8" r="4" />
    <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
  </svg>
{/snippet}
{#snippet drawIcon()}
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M3 13l1-4 7.5-7.5 3 3L7 12z" />
    <path d="M10.5 3.5l2 2" />
  </svg>
{/snippet}
{#snippet overlayIcon()}
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="1.5" y="4.5" width="9" height="9" />
    <path d="M5.5 4.5v-3h9v9h-3" />
  </svg>
{/snippet}

<div class="layout">
  {#if overlay && !circle}
    <CompassTape heading={app.ownPos?.yaw ?? null} targets={compassTargets} />
  {/if}

  <div class="body">
    <nav class="rail" aria-label="Main">
      <div class="logo" title="TarTrak {version}">
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="8" cy="8" r="4" />
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
        </svg>
      </div>
      {#if settings}
        <div class="rail-tabs" role="tablist" aria-orientation="vertical">
          {#each TABS as t (t.id)}
            <button type="button" role="tab" aria-selected={tab === t.id} aria-controls="side" onclick={() => (tab = t.id)}>
              <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">
                {#if t.id === "filters"}
                  <path d="M8 2l6 3-6 3-6-3z" /><path d="M2 8l6 3 6-3" /><path d="M2 11l6 3 6-3" />
                {:else if t.id === "squad"}
                  <circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
                  <circle cx="11.5" cy="6" r="2" /><path d="M11 10c2 0 3.5 1.2 3.5 3.5" />
                {:else if t.id === "quests"}
                  <path d="M6 4h8M6 8h8M6 12h8" /><path d="M2 3.5l1 1 1.5-2M2 7.5l1 1 1.5-2M2 11.5l1 1 1.5-2" />
                {:else}
                  <path d="M2 4h7M12 4h2M2 12h2M7 12h7" /><circle cx="10.5" cy="4" r="1.5" /><circle cx="5.5" cy="12" r="1.5" />
                  <path d="M2 8h2M7 8h7" /><circle cx="5.5" cy="8" r="1.5" />
                {/if}
              </svg>
              {t.label}
              {#if t.id === "squad" && room.code}
                <span class="dot {room.status}" title="Squad {room.status}"></span>
              {:else if t.id === "quests" && todoCount > 0}
                <span class="badge" title="{todoCount} on my to-do">{todoCount}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
      <span class="grow"></span>
      <button type="button" class="rail-action" onclick={toggleOverlay} title="Overlay: map only, over the game ({settings?.hotkeyOverlay || 'no hotkey'})">
        {@render overlayIcon()}
        <span class="key">{settings?.hotkeyOverlay || "Overlay"}</span>
      </button>
      <button type="button" class="rail-action" onclick={cycleOpacity} title="Opacity ({settings?.hotkeyOpacity || 'no hotkey'})" aria-label="Opacity {opacity}%">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
        </svg>
        <span class="key">{opacity}%</span>
      </button>
    </nav>

    <aside id="side" class="side">
      {#if settings}
        <div class="pane">
          {#if tab === "filters"}
            <FilterPanel
              counts={buildCounts(mapPoints, mapQuestMarkersBeforeFilters, layerFilters, def?.labels.length ?? 0)}
              filters={layerFilters}
              onChange={(f) => patchSettings({ layerFilters: f })}
              {itemQuery}
              onItemQuery={(q) => (itemQuery = q)}
              hitCount={hitIds.size}
              {mapInfo}
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
              showSquadTodo={settings.showSquadTodo}
              onShowSquadTodo={(on) => patchSettings({ showSquadTodo: on })}
              faction={settings.faction}
            />
          {:else}
            <SettingsPanel
              {settings}
              onChange={applySettings}
              onPickDir={pickDir}
              shotKey={app.shotKeyVk === null ? "PrintScreen (game log not read yet)" : `${markKeyLabel(app.shotKeyVk)} (from the game log)`}
              onInvalid={(m) => app.toast(m)}
              onCheckUpdate={() => checkForUpdate(updateUi, { manual: true }).catch((e) => app.toast(`Update failed: ${e}`))}
            />
          {/if}
        </div>
      {/if}
    </aside>

    <div class="main">
      {#if !screenshotsDir}
        <Banner text="Screenshot folder not found." action="Pick folder" onaction={() => pickDir("screenshots")} />
      {/if}
      {#if !logsDir}
        <Banner text="Game log folder not found; map auto-detect is off." action="Pick folder" onaction={() => pickDir("logs")} />
      {/if}

      <section class="map" class:rim-hover={circle && settings?.rimTools === false}>
        {#if !overlay}
          <!-- Window: the map's tools stand in a column on its right edge. -->
          <div class="map-toolbar" role="toolbar" aria-label="Map tools" aria-orientation="vertical">
            <button type="button" class="tool-btn" onclick={toggleOverlay} title="Overlay: map only, over the game" aria-label="Overlay (map only)">
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2.5" y="2.5" width="11" height="11" /><path d="M2.5 5.5h11" />
              </svg>
            </button>
            <button
              type="button"
              class="tool-btn"
              aria-pressed={settings?.followMe ?? true}
              onclick={() => patchSettings({ followMe: !(settings?.followMe ?? true) })}
              title="Follow me: keep the map centred on my marker"
              aria-label="Follow me"
            >
              {@render followIcon()}
            </button>
            <RoutePicker
              variant="toolbar"
              groups={extractGroups}
              selectedId={routePoint?.id ?? null}
              selectedName={routePoint?.name ?? null}
              distanceM={routeDistance}
              from={app.ownPos ? { x: app.ownPos.x, z: app.ownPos.z } : null}
              onSelect={(id) => (route = id ? { kind: "extract", id } : null)}
            />
            <button
              type="button"
              class="tool-btn"
              aria-pressed={drawMode}
              onclick={() => (drawMode = !drawMode)}
              title="Draw on the map: drag to draw, right-click for undo and clear. In a room the squad sees it live."
              aria-label="Draw on the map"
            >
              {@render drawIcon()}
            </button>
            <button type="button" class="tool-btn" onclick={() => mapView?.centerOnMe()} disabled={!app.ownPos} title="Centre on me" aria-label="Centre on me">
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="8" r="2" /><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
              </svg>
            </button>
            <button type="button" class="tool-btn" onclick={() => mapView?.fitMap()} disabled={!def} title="Fit the whole map" aria-label="Fit map">
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
              </svg>
            </button>
            {#if def}
              <span class="sep"></span>
              <FloorPicker variant="toolbar" {def} {pinnedFloor} onPick={(n) => (pinnedFloor = n)} />
            {/if}
          </div>
        {:else if !circle}
          <!-- Box overlay: the minimal view, map only. These buttons are the controls that survive it. -->
          <div class="map-tools">
            <button class="mode-btn" onclick={toggleOverlay} title="Full window" aria-label="Full window">
              {@render overlayIcon()}
            </button>
            <button
              class="mode-btn follow-btn"
              aria-pressed={settings?.followMe ?? true}
              onclick={() => patchSettings({ followMe: !(settings?.followMe ?? true) })}
              title="Follow me: keep the map centred on my marker"
              aria-label="Follow me"
            >
              {@render followIcon()}
            </button>
            <RoutePicker
              groups={extractGroups}
              selectedId={routePoint?.id ?? null}
              selectedName={routePoint?.name ?? null}
              distanceM={routeDistance}
              from={app.ownPos ? { x: app.ownPos.x, z: app.ownPos.z } : null}
              onSelect={(id) => (route = id ? { kind: "extract", id } : null)}
            />
            <button
              class="mode-btn draw-btn"
              aria-pressed={drawMode}
              onclick={() => (drawMode = !drawMode)}
              title="Draw on the map: drag to draw, right-click for undo and clear. In a room the squad sees it live."
              aria-label="Draw on the map"
            >
              {@render drawIcon()}
            </button>
          </div>
          {#if def}
            <div class="box-floors"><FloorPicker variant="menu" {def} {pinnedFloor} onPick={(n) => (pinnedFloor = n)} /></div>
          {/if}
          {#if readoutMates.length > 0 || raidLeft}
            <div class="corner-pills">
              {#if readoutMates.length > 0}
                <MateReadout mates={readoutMates} />
              {/if}
              {#if raidLeft}
                <div class="raid-pill" role="timer" aria-label="Time left in raid">{raidLeft}</div>
              {/if}
            </div>
          {/if}
        {/if}

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
            {activeFloor}
            {questMarkers}
            {points}
            {hitIds}
            {showLabels}
            lineLengthM={settings?.lineLengthM ?? DEFAULT_SETTINGS.lineLengthM}
            mateColors={settings?.mateColors ?? DEFAULT_SETTINGS.mateColors}
            canShare={room.status === "open"}
            onPin={placePin}
            onRemovePin={removePin}
            onGoHere={(p) => (route = { kind: "spot", map: def.key, x: p.x, z: p.z })}
            route={routePoint ? { x: routePoint.x, z: routePoint.z, name: routePoint.name } : null}
            {drawMode}
            drawColor={settings?.color ?? DEFAULT_SETTINGS.color}
            ownColor={settings?.color ?? DEFAULT_SETTINGS.color}
            onDraw={addDrawing}
            onUndoDraw={undoDrawing}
            onClearDraw={clearDrawings}
            frame={ring ? { left: ring.cx - ring.r, top: ring.cy - ring.r, size: 2 * ring.r } : null}
            rotation={mapRotation}
          />
        {:else}
          <div class="empty" class:round={circle}>Pick a map, or load into a raid.</div>
        {/if}

        {#if ring}
          <!-- Round minimap: bezel over the disc, tools round its lower left, chips round its lower right. -->
          <div class="bezel-at" style="left: {ring.cx - ring.ro}px; top: {ring.cy - ring.ro}px">
            <CircleBezel
              r={ring.r}
              heading={app.ownPos?.yaw ?? null}
              northUp={!headingUp}
              targets={compassTargets}
              show={settings?.compassBezel ?? true}
            />
          </div>

          <div class="rim-tool rim-at" style={onRim(RIM_BUTTON_ANGLES[0], ring.ro + RIM_BUTTON_GAP)}>
            <button type="button" class="rim-btn" onclick={toggleOverlay} title="Full window" aria-label="Full window">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
              </svg>
            </button>
          </div>
          <div class="rim-tool rim-at" style={onRim(RIM_BUTTON_ANGLES[1], ring.ro + RIM_BUTTON_GAP)}>
            <button
              type="button"
              class="rim-btn"
              aria-pressed={settings?.followMe ?? true}
              onclick={() => patchSettings({ followMe: !(settings?.followMe ?? true) })}
              title="Follow me: keep the map centred on my marker"
              aria-label="Follow me"
            >
              {@render followIcon()}
            </button>
          </div>
          <div class="rim-tool rim-at" style={onRim(RIM_BUTTON_ANGLES[2], ring.ro + RIM_BUTTON_GAP)}>
            <RoutePicker
              variant="rim"
              groups={extractGroups}
              selectedId={routePoint?.id ?? null}
              selectedName={routePoint?.name ?? null}
              distanceM={routeDistance}
              from={app.ownPos ? { x: app.ownPos.x, z: app.ownPos.z } : null}
              onSelect={(id) => (route = id ? { kind: "extract", id } : null)}
            />
          </div>
          <div class="rim-tool rim-at" style={onRim(RIM_BUTTON_ANGLES[3], ring.ro + RIM_BUTTON_GAP)}>
            <button
              type="button"
              class="rim-btn"
              aria-pressed={drawMode}
              onclick={() => (drawMode = !drawMode)}
              title="Draw on the map: drag to draw, right-click for undo and clear"
              aria-label="Draw on the map"
            >
              {@render drawIcon()}
            </button>
          </div>
          <div class="rim-tool rim-at" style={onRim(RIM_BUTTON_ANGLES[4], ring.ro + RIM_BUTTON_GAP)}>
            <button
              type="button"
              class="rim-btn"
              aria-pressed={headingUp}
              onclick={() => patchSettings({ minimapRotation: headingUp ? "north" : "heading" })}
              title={headingUp ? "Heading-up · click for north-up" : "North-up · click for heading-up"}
              aria-label={headingUp ? "Rotation: heading-up. Click for north-up" : "Rotation: north-up. Click for heading-up"}
            >
              {#if headingUp}
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path d="M8 1.8l4.6 11.7L8 10.8l-4.6 2.7z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round" />
                </svg>
              {:else}
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path d="M8 1.5l3 6.5H5z" fill="#ff5a4e" />
                  <path d="M8 14.5l-3-6.5h6z" fill="none" stroke="currentColor" stroke-width="1.3" />
                </svg>
              {/if}
            </button>
          </div>
          <div class="rim-tool rim-at zoom" style={onRim(102, ring.ro - 4)}>
            <button type="button" onclick={() => mapView?.zoomIn()} aria-label="Zoom in" title="Zoom in">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M8 2.5v11M2.5 8h11" />
              </svg>
            </button>
            <button type="button" onclick={() => mapView?.zoomOut()} aria-label="Zoom out" title="Zoom out">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M2.5 8h11" />
              </svg>
            </button>
          </div>
          {#if def}
            <div class="rim-at floor-at" style="left: {ring.cx}px; top: {ring.cy + ring.ro + FLOOR_GAP}px">
              <FloorPicker variant="chip" {def} {pinnedFloor} onPick={(n) => (pinnedFloor = n)} />
            </div>
          {/if}

          {#each chips as c, i (c.id)}
            <div
              class="rim-at rim-chip {c.kind}"
              style="{onRim(chipSlots[i], ring.ro + CHIP_GAP)}{c.color ? `; color: ${c.color}` : ''}"
              title={c.title}
              role={c.kind === "timer" ? "timer" : undefined}
              aria-label={c.kind === "timer" ? `Time left in raid ${c.text}` : c.kind === "mate" ? `${c.title} ${c.text}` : `${c.text} more: ${c.title}`}
            >
              {#if c.kind === "timer"}
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="#b9c2cc" stroke-width="1.5" stroke-linecap="round">
                  <circle cx="8" cy="8.5" r="5.5" /><path d="M8 5.5v3.2l2 1.3M6.5 1.5h3" />
                </svg>
              {:else if c.kind === "mate"}
                <span class="mate-dot"></span>
              {/if}
              {c.text}
            </div>
          {/each}
        {/if}
      </section>
    </div>
  </div>

  <footer class="status">
    <span class="st-map">
      <MapPicker
        value={app.currentMap}
        onchange={(k) => {
          app.setMap(k, "manual");
          pinnedFloor = null;
          patchSettings({ lastMap: k });
        }}
      />
      {#if app.mapSource === "log"}<span class="auto" title="Map detected from the game log">AUTO</span>{/if}
    </span>
    <span class="st-sep"></span>
    {#if app.ownPos}
      <span class="st-coords">X {app.ownPos.x.toFixed(0)} · Y {app.ownPos.y.toFixed(0)} · Z {app.ownPos.z.toFixed(0)} · <b>{pad3(app.ownPos.yaw)}°</b></span>
    {:else}
      <span class="st-muted" title="Take an in-game screenshot to place yourself">No position yet</span>
    {/if}
    <span class="st-sep"></span>
    {#if room.code}
      <span class="st-squad"><span class="dot {room.status}"></span><span class="mono">{room.code}</span><span class="st-muted">· {Object.keys(app.teammates).length + 1} in room</span></span>
    {:else}
      <span class="st-muted">No squad</span>
    {/if}
    {#if raidLeft}
      <span class="st-sep"></span>
      <span class="st-raid">Raid <b>{raidLeft}</b> left</span>
    {/if}
    <span class="grow"></span>
    <span class="st-muted mono">v{version}</span>
  </footer>
</div>
<Toasts />
