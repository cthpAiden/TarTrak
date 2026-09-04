<script lang="ts">
  import L from "leaflet";
  import { onMount, untrack } from "svelte";
  import "./map.css";
  import type { MapDef } from "./mapsData";
  import { floorForHeight } from "./mapsData";
  import { makeCrs, boundsOf } from "./crs";
  import { buildSvgElement, showFloor, type LoadedSvg } from "./svgLoader";
  import { PositionMarker } from "./markers";
  import { fetchTextCached } from "../tauri/http";
  import { app, type Teammate } from "../state/app.svelte";

  let {
    def,
    pinnedFloor,
    onFloorPinned,
  }: { def: MapDef | null; pinnedFloor: string | null; onFloorPinned: (name: string | null) => void } = $props();

  const OWN_COLOR = "#f0b429";
  const LINE_PX = 28;

  let container: HTMLDivElement;
  // map and svg are $state so the marker and floor effects re-run once build() assigns them.
  let map = $state<L.Map | null>(null);
  let svg = $state<LoadedSvg | null>(null);
  let own: PositionMarker | null = null;
  let mates = new Map<string, PositionMarker>();
  /** Bumped by every destroy(); a build whose generation is stale drops its result. */
  let gen = 0;
  let message = $state("");

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
    return () => destroy();
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

  $effect(() => {
    const p = app.ownPos;
    const m = map;
    if (!m || !p) return;
    if (!own) own = new PositionMarker(m, { color: OWN_COLOR, radius: 6, lineLengthPx: LINE_PX });
    own.update(p.x, p.z, p.yaw);
  });

  $effect(() => {
    const all = app.teammates;
    const d = def;
    const m = map;
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
        marker = new PositionMarker(m, { color: t.color, radius: 6, lineLengthPx: LINE_PX, label: t.name });
        mates.set(t.id, marker);
      }
      marker.setColor(t.color);
      marker.update(t.x, t.z, t.yaw);
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
