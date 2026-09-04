<script lang="ts">
  import L from "leaflet";
  import { onMount, untrack } from "svelte";
  import "./map.css";
  import type { MapDef } from "./mapsData";
  import { visibleOnFloor } from "./mapsData";
  import { makeCrs, boundsOf, toLatLng } from "./crs";
  import { buildSvgElement, showFloor, type LoadedSvg } from "./svgLoader";
  import { PositionMarker } from "./markers";
  import { fetchTextCached } from "../tauri/http";
  import { opacityFor } from "../room/fade";
  import { app, type Teammate } from "../state/app.svelte";
  import { questDivIcon, questPopupHtml, esc } from "../quests/questLayer";
  import type { QuestMarker } from "../quests/markers";
  import type { MapPoint } from "../layers/points";
  import { colorFor, pointDivIcon, usesCanvas } from "../layers/pointLayer";
  import { labelDivIcon } from "./labels";

  let {
    def,
    pinnedFloor,
    activeFloor,
    onFloorPinned,
    questMarkers,
    points,
    showLabels,
    lineLengthPx,
    showCone,
  }: {
    def: MapDef | null;
    pinnedFloor: string | null;
    activeFloor: string | null;
    onFloorPinned: (name: string | null) => void;
    questMarkers: QuestMarker[];
    points: MapPoint[];
    showLabels: boolean;
    lineLengthPx: number;
    showCone: boolean;
  } = $props();

  const OWN_COLOR = "#f0b429";

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
  let canvas = L.canvas({ padding: 0.5 });
  /** Bumped by every destroy(); a build whose generation is stale drops its result. */
  let gen = 0;
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
    // Own panes above the overlay pane (400): the SVG map is added later, and in a shared pane it
    // would land on top of the canvas and hide every circle marker.
    m.createPane("points").style.zIndex = "450";
    m.createPane("labels").style.zIndex = "460";
    // Fresh renderer per map; assigned before pointGroup so the point effect sees the new one.
    canvas = L.canvas({ padding: 0.5, pane: "points" });
    pointGroup = L.layerGroup().addTo(m);
    labelGroup = L.layerGroup().addTo(m);
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

  // A marker bakes its line length and cone in at construction, so a change drops every marker and
  // the two effects below rebuild them. untrack: the removal must not track the markers.
  $effect(() => {
    void lineLengthPx;
    void showCone;
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
    const cone = showCone;
    if (!m || !p) return;
    if (!own) own = new PositionMarker(m, { color: OWN_COLOR, radius: 6, lineLengthPx: len, cone });
    own.update(p.x, p.z, p.yaw);
    own.setOpacity(opacityFor(t - updatedAt));
  });

  $effect(() => {
    const all = app.teammates;
    const tick = now;
    const d = def;
    const m = map;
    const len = lineLengthPx;
    const cone = showCone;
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
        marker = new PositionMarker(m, { color: t.color, radius: 6, lineLengthPx: len, label: t.name, cone });
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
    const all = points;
    const g = pointGroup;
    if (!g) return;
    g.clearLayers();
    for (const p of all) {
      const ll = toLatLng(p.x, p.z);
      const layer = usesCanvas(p.group)
        ? L.circleMarker(ll, {
            renderer: canvas,
            radius: 4,
            className: `point-canvas ${p.group} ${p.category}`,
            color: colorFor(p),
            fillColor: colorFor(p),
            fillOpacity: 0.9,
            weight: 1,
          })
        : L.marker(ll, { icon: pointDivIcon(p) });
      layer.bindTooltip(esc(p.name)).addTo(g);
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
