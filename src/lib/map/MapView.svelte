<script lang="ts">
  import L from "leaflet";
  import { onMount, untrack } from "svelte";
  import "./map.css";
  import type { MapDef } from "./mapsData";
  import { floorForHeight, visibleOnFloor } from "./mapsData";
  import { makeCrs, boundsOf, toLatLng } from "./crs";
  import { buildSvgElement, showFloor, type LoadedSvg } from "./svgLoader";
  import { OWN_PANE, PositionMarker } from "./markers";
  import { fetchTextCached } from "../tauri/http";
  import { opacityFor } from "../room/fade";
  import { floorTag, mateColor, mateLabel, safeColor } from "../room/squad";
  import { app, type Teammate } from "../state/app.svelte";
  import { questIcon, questPopupHtml, esc } from "../quests/questLayer";
  import type { QuestMarker } from "../quests/markers";
  import type { MapPoint } from "../layers/points";
  import { outlineColor, pointIcon, pointPopupHtml } from "../layers/pointLayer";
  import { labelDivIcon } from "./labels";
  import { watchSize } from "./resize";
  import { pinIcon, pinPopup } from "./pins";
  import Chevron from "../ui/Chevron.svelte";

  let {
    def,
    pinnedFloor,
    activeFloor,
    onFloorPinned,
    questMarkers,
    points,
    hitIds,
    showLabels,
    lineLengthPx,
    mateColors,
    canShare,
    onPin,
    onRemovePin,
  }: {
    def: MapDef | null;
    pinnedFloor: string | null;
    activeFloor: string | null;
    onFloorPinned: (name: string | null) => void;
    questMarkers: QuestMarker[];
    points: MapPoint[];
    /** Points the item finder matched; drawn with a glow. */
    hitIds: ReadonlySet<string>;
    showLabels: boolean;
    lineLengthPx: number;
    /** Colours I picked for teammates, by name; only on this screen. */
    mateColors: Record<string, string>;
    /** In a room with the socket up: the right-click menu offers a shared marker. */
    canShare: boolean;
    onPin: (p: { x: number; z: number; label: string; shared: boolean }) => void;
    onRemovePin: (id: string) => void;
  } = $props();

  const OWN_COLOR = "#f0b429";
  /** tarkov.dev draws quest zones in this green. */
  const QUEST_ZONE_COLOR = "#4caf50";

  let container: HTMLDivElement;
  // map and svg are $state so the marker and floor effects re-run once build() assigns them.
  let map = $state<L.Map | null>(null);
  let svg = $state<LoadedSvg | null>(null);
  let own: PositionMarker | null = null;
  let mates = new Map<string, PositionMarker>();
  // $state so the quest and point effects re-run once build() creates the groups.
  let questGroup = $state<L.LayerGroup | null>(null);
  let pointGroup = $state<L.LayerGroup | null>(null);
  let labelGroup = $state<L.LayerGroup | null>(null);
  let pinGroup = $state<L.LayerGroup | null>(null);
  /** Right-click menu: where it opens (container pixels) and the game point under the cursor. */
  let pinMenu = $state<{ px: number; py: number; x: number; z: number } | null>(null);
  let pinMenuEl: HTMLDivElement | undefined = $state();
  let pinInput: HTMLInputElement | undefined = $state();
  let pinLabel = $state("");
  const PIN_MENU_W = 200;
  const PIN_MENU_H = 112;
  /** Bumped by every destroy(); a build whose generation is stale drops its result. */
  let gen = 0;
  let stopSizeWatch: (() => void) | null = null;
  let message = $state("");
  /** Ticks once a second so the marker effects re-run and re-apply the age fade. */
  let now = $state(Date.now());

  const floorGroup = $derived(def?.layers.find((l) => l.name === activeFloor)?.svgLayer ?? null);

  function destroy() {
    gen++;
    for (const m of mates.values()) m.remove();
    mates = new Map();
    own?.remove();
    own = null;
    questGroup = null;
    pointGroup = null;
    labelGroup = null;
    pinGroup = null;
    pinMenu = null;
    svg = null;
    stopSizeWatch?.();
    stopSizeWatch = null;
    map?.remove();
    map = null;
  }

  async function build(d: MapDef) {
    destroy();
    const my = gen;
    message = "";
    const m = L.map(container, {
      crs: makeCrs(d),
      minZoom: d.minZoom - 1,
      maxZoom: d.maxZoom + 1,
      zoomSnap: 0.25,
      attributionControl: false,
      zoomControl: false,
    });
    m.fitBounds(boundsOf(d));
    // The sidebar and top bar come and go with overlay mode; Leaflet only watches the window.
    stopSizeWatch = watchSize(container, () => m.invalidateSize({ animate: false }));
    map = m;
    questGroup = L.layerGroup().addTo(m);
    // Own pane above the overlay pane (400) so the SVG map, added later, cannot cover the labels.
    m.createPane("labels").style.zIndex = "460";
    // Quest zone footprints: above the map SVG (400), under the labels and every marker.
    m.createPane("zones").style.zIndex = "450";
    pointGroup = L.layerGroup().addTo(m);
    labelGroup = L.layerGroup().addTo(m);
    // Hand-placed pins: above the point and quest markers (600), under the players (620).
    m.createPane("pins").style.zIndex = "615";
    pinGroup = L.layerGroup().addTo(m);
    m.on("contextmenu", (e: L.LeafletMouseEvent) => {
      pinLabel = "";
      // Kept inside the map area, so a right-click near the right or bottom edge still shows the whole menu.
      const px = Math.max(0, Math.min(e.containerPoint.x, container.clientWidth - PIN_MENU_W));
      const py = Math.max(0, Math.min(e.containerPoint.y, container.clientHeight - PIN_MENU_H));
      pinMenu = { px, py, x: e.latlng.lng, z: e.latlng.lat };
    });
    if (!d.svgPath) {
      message = `${d.name}: no vector map available yet`;
      return;
    }
    try {
      const text = await fetchTextCached(d.svgPath, `maps/${d.key}.svg`);
      if (my !== gen || !map) return;
      const loaded = buildSvgElement(text);
      L.svgOverlay(loaded.element, boundsOf(d)).addTo(m);
      svg = loaded;
    } catch (e) {
      if (my !== gen) return;
      message = `Map image failed to load: ${e}`;
    }
  }

  onMount(() => {
    const tick = setInterval(() => (now = Date.now()), 1000);
    return () => {
      clearInterval(tick);
      destroy();
    };
  });

  // untrack: build()/destroy() read and write map and svg, which would otherwise make this
  // effect depend on the state it assigns.
  $effect(() => {
    const d = def;
    untrack(() => {
      if (d) void build(d);
      else destroy();
    });
  });

  $effect(() => {
    const s = svg;
    const d = def;
    const group = floorGroup;
    if (s && d) showFloor(s, d.svgLayer, group, d.layers.map((l) => l.svgLayer).filter((v): v is string => !!v));
  });

  // A marker bakes its line length in at construction, so a change drops every marker and the two
  // effects below rebuild them. untrack: the removal must not track the markers.
  $effect(() => {
    void lineLengthPx;
    untrack(() => {
      for (const m of mates.values()) m.remove();
      mates = new Map();
      own?.remove();
      own = null;
    });
  });

  $effect(() => {
    const p = app.ownPos;
    const updatedAt = app.ownUpdatedAt;
    const t = now;
    const m = map;
    const len = lineLengthPx;
    if (!m) return;
    if (!p) {
      own?.remove();
      own = null;
      return;
    }
    if (!own) own = new PositionMarker(m, { color: OWN_COLOR, radius: 6, lineLengthPx: len, pane: OWN_PANE });
    own.update(p.x, p.z, p.yaw);
    own.setOpacity(opacityFor(t - updatedAt));
  });

  $effect(() => {
    const all = app.teammates;
    const tick = now;
    const d = def;
    const m = map;
    const len = lineLengthPx;
    const colors = mateColors;
    if (!m || !d) return;
    // A teammate whose game log was not found reports no map; a squad shares a raid, so they go on mine.
    const wanted: Teammate[] = Object.values(all).filter((t) => !t.noPosition && (t.map === d.key || t.map === null));
    const ids = new Set(wanted.map((t) => t.id));
    for (const [id, marker] of mates) {
      if (!ids.has(id)) {
        marker.remove();
        mates.delete(id);
      }
    }
    for (const t of wanted) {
      const color = mateColor(t.name, t.color, colors);
      // "Aiden [2F]": the floor their height puts them on, so a squadmate above me is not read as beside me.
      const label = mateLabel(t.name, floorTag(floorForHeight(d, t)));
      let marker = mates.get(t.id);
      if (!marker) {
        marker = new PositionMarker(m, { color, radius: 6, lineLengthPx: len, label });
        mates.set(t.id, marker);
      }
      marker.setColor(color);
      marker.setLabel(label);
      marker.update(t.x, t.z, t.yaw);
      marker.setOpacity(opacityFor(tick - t.receivedAt));
    }
  });

  $effect(() => {
    const markers = questMarkers;
    const g = questGroup;
    if (!g) return;
    g.clearLayers();
    for (const m of markers) {
      if (m.outline) {
        L.polygon(m.outline.map(([x, z]) => toLatLng(x, z)), {
          pane: "zones",
          color: QUEST_ZONE_COLOR,
          weight: 1,
          opacity: 0.7,
          fillColor: QUEST_ZONE_COLOR,
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(g);
      }
      L.marker(toLatLng(m.x, m.z), { icon: questIcon(m) }).bindTooltip(esc(m.taskName)).bindPopup(questPopupHtml(m)).addTo(g);
    }
  });

  $effect(() => {
    const all = points;
    const hits = hitIds;
    const g = pointGroup;
    if (!g) return;
    g.clearLayers();
    for (const p of all) {
      if (p.outline) {
        const color = outlineColor(p);
        L.polygon(p.outline.map(([x, z]) => toLatLng(x, z)), {
          pane: "zones",
          color,
          weight: 1,
          opacity: 0.7,
          fillColor: color,
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(g);
      }
      const layer = L.marker(toLatLng(p.x, p.z), { icon: pointIcon(p, hits.has(p.id)) });
      layer.bindTooltip(esc(p.name)).bindPopup(pointPopupHtml(p)).addTo(g);
    }
  });

  $effect(() => {
    const d = def;
    const show = showLabels;
    const floor = activeFloor;
    const g = labelGroup;
    if (!g) return;
    g.clearLayers();
    if (!show || !d) return;
    for (const l of d.labels) {
      // A label without a vertical span covers every floor; its midpoint is then meaningless.
      const top = l.top ?? 1000;
      const bottom = l.bottom ?? -1000;
      const y = l.top !== undefined && l.bottom !== undefined ? (l.top - l.bottom) / 2 + l.bottom : 0;
      if (!visibleOnFloor(d, floor, l.position[0], l.position[1], y, top, bottom)) continue;
      L.marker(toLatLng(l.position[0], l.position[1]), { icon: labelDivIcon(l), interactive: false, pane: "labels" }).addTo(g);
    }
  });

  let floorsOpen = $state(false);
  let floorMenu: HTMLDivElement | undefined = $state();

  function pickFloor(name: string | null) {
    onFloorPinned(name);
    floorsOpen = false;
  }

  // Clicking anywhere else closes the menus, like a native dropdown.
  function onWindowPointerDown(e: PointerEvent) {
    if (floorsOpen && floorMenu && !floorMenu.contains(e.target as Node)) floorsOpen = false;
    if (pinMenu && pinMenuEl && !pinMenuEl.contains(e.target as Node)) pinMenu = null;
  }

  function onWindowKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    floorsOpen = false;
    pinMenu = null;
  }

  function placePin(shared: boolean) {
    if (!pinMenu) return;
    onPin({ x: pinMenu.x, z: pinMenu.z, label: pinLabel.trim().slice(0, 32), shared });
    pinMenu = null;
  }

  // The label box takes focus as the menu opens, so a right-click, a word and Enter is all it takes.
  $effect(() => {
    if (pinMenu) pinInput?.focus();
  });

  $effect(() => {
    const pins = app.pins;
    const mates = app.teammates;
    const colors = mateColors;
    const d = def;
    const g = pinGroup;
    if (!g || !d) return;
    g.clearLayers();
    for (const p of Object.values(pins)) {
      if (p.map !== d.key) continue;
      const placedBy = p.from ? (mates[p.from]?.name ?? null) : null;
      // A teammate's shared marker takes the colour I picked for them, like their position marker.
      const shown = placedBy && colors[placedBy] ? { ...p, color: safeColor(colors[placedBy]) } : p;
      const marker = L.marker(toLatLng(p.x, p.z), { icon: pinIcon(shown), pane: "pins" });
      if (p.label) marker.bindTooltip(esc(p.label), { permanent: true, direction: "top", className: "tt-label", pane: "pins", interactive: false });
      marker.bindPopup(() => pinPopup(p, placedBy, () => onRemovePin(p.id)));
      marker.addTo(g);
    }
  });

  export function centerOnMe() {
    if (map && app.ownPos) map.panTo(L.latLng(app.ownPos.z, app.ownPos.x));
  }

  export function centerOn(x: number, z: number) {
    map?.panTo(toLatLng(x, z));
  }

  export function fitMap() {
    if (map && def) map.fitBounds(boundsOf(def));
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeyDown} />

<div class="map-root" bind:this={container} role="application" aria-label="map"></div>

{#if def && def.layers.some((l) => l.svgLayer)}
  <div class="floor-menu" bind:this={floorMenu}>
    <button
      class="floor-toggle"
      class:open={floorsOpen}
      aria-haspopup="listbox"
      aria-expanded={floorsOpen}
      title={pinnedFloor === null ? "Floor: auto" : `Floor: ${pinnedFloor || "Ground"}`}
      onclick={() => (floorsOpen = !floorsOpen)}
    >
      Floors <Chevron open={floorsOpen} />
    </button>
    {#if floorsOpen}
      <div class="floor-list" role="listbox" aria-label="Floors">
        <button role="option" aria-selected={pinnedFloor === null} class:active={pinnedFloor === null} onclick={() => pickFloor(null)} title="Follow my height">Auto</button>
        <button role="option" aria-selected={pinnedFloor === ""} class:active={pinnedFloor === ""} onclick={() => pickFloor("")}>Ground</button>
        {#each def.layers.filter((l) => l.svgLayer) as layer (layer.name)}
          <button role="option" aria-selected={pinnedFloor === layer.name} class:active={pinnedFloor === layer.name} onclick={() => pickFloor(layer.name)}>{layer.name}</button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

{#if pinMenu}
  <div
    class="pin-menu"
    bind:this={pinMenuEl}
    role="menu"
    style="left: {pinMenu.px}px; top: {pinMenu.py}px;"
  >
    <input
      bind:this={pinInput}
      bind:value={pinLabel}
      maxlength="32"
      placeholder="Label (optional)"
      aria-label="Marker label"
      onkeydown={(e) => e.key === "Enter" && placePin(false)}
    />
    <button type="button" role="menuitem" onclick={() => placePin(false)}>Marker for me</button>
    <button
      type="button"
      role="menuitem"
      disabled={!canShare}
      title={canShare ? "Everyone in the room sees it" : "Join a squad room first"}
      onclick={() => placePin(true)}
    >
      Shared marker
    </button>
  </div>
{/if}

{#if message}<div class="map-msg">{message}</div>{/if}
