<script lang="ts">
  import L from "leaflet";
  import { onMount } from "svelte";
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
  let map: L.Map | null = null;
  let svg: LoadedSvg | null = null;
  let own: PositionMarker | null = null;
  let mates = new Map<string, PositionMarker>();
  let message = $state("");

  const activeFloor = $derived(
    pinnedFloor === null ? (def && app.ownPos ? floorForHeight(def, app.ownPos) : null) : pinnedFloor || null,
  );
  const floorGroup = $derived(def?.layers.find((l) => l.name === activeFloor)?.svgLayer ?? null);

  function destroy() {
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
    message = "";
    map = L.map(container, {
      crs: makeCrs(d),
      minZoom: d.minZoom - 1,
      maxZoom: d.maxZoom + 1,
      zoomSnap: 0.25,
      attributionControl: false,
      zoomControl: false,
    });
    map.fitBounds(boundsOf(d));
    if (!d.svgPath) {
      message = `${d.name}: no vector map available yet`;
      return;
    }
    try {
      const text = await fetchTextCached(d.svgPath, `maps/${d.key}.svg`);
      if (!map) return;
      svg = buildSvgElement(text);
      L.svgOverlay(svg.element, boundsOf(d)).addTo(map);
      showFloor(svg, d.svgLayer, floorGroup);
    } catch (e) {
      message = `Map image failed to load: ${e}`;
    }
  }

  onMount(() => {
    return () => destroy();
  });

  $effect(() => {
    if (def) void build(def);
    else destroy();
  });

  $effect(() => {
    if (svg && def) showFloor(svg, def.svgLayer, floorGroup);
  });

  $effect(() => {
    const p = app.ownPos;
    if (!map || !p) return;
    if (!own) own = new PositionMarker(map, { color: OWN_COLOR, radius: 6, lineLengthPx: LINE_PX });
    own.update(p.x, p.z, p.yaw);
  });

  $effect(() => {
    if (!map || !def) return;
    const wanted: Teammate[] = Object.values(app.teammates).filter((t) => t.map === def.key);
    const ids = new Set(wanted.map((t) => t.id));
    for (const [id, m] of mates) {
      if (!ids.has(id)) {
        m.remove();
        mates.delete(id);
      }
    }
    for (const t of wanted) {
      let m = mates.get(t.id);
      if (!m) {
        m = new PositionMarker(map, { color: t.color, radius: 6, lineLengthPx: LINE_PX, label: t.name });
        mates.set(t.id, m);
      }
      m.setColor(t.color);
      m.update(t.x, t.z, t.yaw);
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
