<script lang="ts">
  import L from "leaflet";
  import { onMount, untrack } from "svelte";
  import "./map.css";
  import type { MapDef } from "./mapsData";
  import { floorForHeight } from "./mapsData";
  import { makeCrs, boundsOf, toLatLng } from "./crs";
  import { buildSvgElement, showFloor, type LoadedSvg } from "./svgLoader";
  import { PositionMarker } from "./markers";
  import { fetchTextCached } from "../tauri/http";
  import { opacityFor } from "../room/fade";
  import { app, type Teammate } from "../state/app.svelte";
  import { questDivIcon, extractDivIcon, questPopupHtml, esc } from "../quests/questLayer";
  import type { QuestMarker, ExtractMarker } from "../quests/markers";

  let {
    def,
    pinnedFloor,
    onFloorPinned,
    questMarkers,
    extracts,
    showExtracts,
    lineLengthPx,
  }: {
    def: MapDef | null;
    pinnedFloor: string | null;
    onFloorPinned: (name: string | null) => void;
    questMarkers: QuestMarker[];
    extracts: ExtractMarker[];
    showExtracts: boolean;
    lineLengthPx: number;
  } = $props();

  const OWN_COLOR = "#f0b429";

  let container: HTMLDivElement;
  // map and svg are $state so the marker and floor effects re-run once build() assigns them.
  let map = $state<L.Map | null>(null);
  let svg = $state<LoadedSvg | null>(null);
  let own: PositionMarker | null = null;
  let mates = new Map<string, PositionMarker>();
  // $state so the quest and extract effects re-run once build() creates the groups.
  let questGroup = $state<L.LayerGroup | null>(null);
  let extractGroup = $state<L.LayerGroup | null>(null);
  /** Bumped by every destroy(); a build whose generation is stale drops its result. */
  let gen = 0;
  let message = $state("");
  /** Ticks once a second so the marker effects re-run and re-apply the age fade. */
  let now = $state(Date.now());

  const activeFloor = $derived(
    pinnedFloor === null ? (def && app.ownPos ? floorForHeight(def, app.ownPos) : null) : pinnedFloor || null,
  );
  const floorGroup = $derived(def?.layers.find((l) => l.name === activeFloor)?.svgLayer ?? null);

  function destroy() {
    gen++;
    for (const m of mates.values()) m.remove();
    mates = new Map();
    own?.remove();
    own = null;
    questGroup = null;
    extractGroup = null;
    svg = null;
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
    map = m;
    questGroup = L.layerGroup().addTo(m);
    extractGroup = L.layerGroup().addTo(m);
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
    if (s && d) showFloor(s, d.svgLayer, group);
  });

  // A marker bakes its line length in at construction, so a change drops every marker and the two
  // effects below rebuild them at the new length. untrack: the removal must not track the markers.
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
    if (!m || !p) return;
    if (!own) own = new PositionMarker(m, { color: OWN_COLOR, radius: 6, lineLengthPx: len });
    own.update(p.x, p.z, p.yaw);
    own.setOpacity(opacityFor(t - updatedAt));
  });

  $effect(() => {
    const all = app.teammates;
    const tick = now;
    const d = def;
    const m = map;
    const len = lineLengthPx;
    if (!m || !d) return;
    const wanted: Teammate[] = Object.values(all).filter((t) => t.map === d.key);
    const ids = new Set(wanted.map((t) => t.id));
    for (const [id, marker] of mates) {
      if (!ids.has(id)) {
        marker.remove();
        mates.delete(id);
      }
    }
    for (const t of wanted) {
      let marker = mates.get(t.id);
      if (!marker) {
        marker = new PositionMarker(m, { color: t.color, radius: 6, lineLengthPx: len, label: t.name });
        mates.set(t.id, marker);
      }
      marker.setColor(t.color);
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
      L.marker(toLatLng(m.x, m.z), { icon: questDivIcon(m) }).bindPopup(questPopupHtml(m)).addTo(g);
    }
  });

  $effect(() => {
    const all = extracts;
    const show = showExtracts;
    const g = extractGroup;
    if (!g) return;
    g.clearLayers();
    if (!show) return;
    for (const e of all) {
      L.marker(toLatLng(e.x, e.z), { icon: extractDivIcon(e) }).bindTooltip(esc(e.name)).addTo(g);
    }
  });

  export function centerOnMe() {
    if (map && app.ownPos) map.panTo(L.latLng(app.ownPos.z, app.ownPos.x));
  }

  export function fitMap() {
    if (map && def) map.fitBounds(boundsOf(def));
  }
</script>

<div class="map-root" bind:this={container} role="application" aria-label="map"></div>

{#if def && def.layers.some((l) => l.svgLayer)}
  <div class="floor-bar">
    <button class:active={pinnedFloor === null} onclick={() => onFloorPinned(null)} title="Follow my height">Auto</button>
    <button class:active={pinnedFloor === ""} onclick={() => onFloorPinned("")}>Ground</button>
    {#each def.layers.filter((l) => l.svgLayer) as layer (layer.name)}
      <button class:active={pinnedFloor === layer.name} onclick={() => onFloorPinned(layer.name)}>{layer.name}</button>
    {/each}
  </div>
{/if}

{#if message}<div class="map-msg">{message}</div>{/if}
