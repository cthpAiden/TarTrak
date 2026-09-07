# RAM usage: where it goes and what this branch changes

Branch `perf/ram-usage`, based on 0.6.2 (99e28b8). Goal: lower the app's memory footprint without any
visible or behavioural change.

## Where the memory is (measured 2026-09-07)

Process set of a running 0.6.2 (Task Manager's "Memory" column is the private working set):

| process | private WS | commit | note |
|---|---|---|---|
| tartrak.exe | 2 MB | 12 MB | Rust side; nothing to gain |
| WebView2 browser | 14 MB | 39 MB | fixed runtime cost |
| WebView2 renderer | 46 MB (trimmed) | 100 MB | the page: JS heap, DOM, paint data |
| WebView2 gpu-process | 13 MB | 456 MB | NVIDIA driver baseline: Chrome (444 MB), Discord (332 MB) and Claude (255 MB) show the same on this machine |
| 2 utility + crashpad | 5 MB | 25 MB | network and storage services |

So the renderer is the only part the app controls. Inside it:

- **Markers dominate.** Each Leaflet marker is an `<img>` positioned with `translate3d(...)`. Chromium
  promotes every element with a 3D transform to its own compositor layer. Measured in the browser
  harness on Streets with every layer on (3,081 markers): the renderer grows from 69 MB to 176 MB
  private, about 35 KB per marker. With the same markers on 2D `translate(...)` the cost drops to
  about 14 KB per marker (105 MB for 2,694 markers). The remaining cost is the DOM element, its unique
  computed style, the paint layer and the `drop-shadow` filter, which is inherent to a DOM marker.
- **Quest data is modest.** The parsed data set (4.3 MB of JSON) costs about 6 to 7 MB of V8 heap.
  Loose loot alone holds 53,766 item-name strings of which 311 are distinct: `JSON.parse` creates a
  separate string for every occurrence, and every loot container carries its own copy of the
  `{id, name, normalizedName}` descriptor. Interning brings the set to about 60% of its size.
- Item pictures are small (36 distinct URLs on Streets, 0.8 MB decoded) and the map SVGs are small
  (27 to 335 KB, at most 1,216 elements). Neither matters.

## Changes

1. **Flat marker transforms** (`src/lib/map/flatMarkers.ts`). `L.Marker`'s `_setPos` writes
   `translate(x px, y px)` instead of `translate3d(x px, y px, 0)` and keeps `_leaflet_pos` up to date
   for Leaflet's own readers. Positions are the same integers; zoom animations still run because they
   are CSS transitions on `transform`. Panes and the SVG overlay keep their 3D transforms so panning
   stays composited. Applies to every marker: points, quest markers, labels, pins.
2. **Viewport culling of point markers** (`src/lib/layers/pointMarkers.ts`). Only the points inside the
   view padded by one viewport on each side get a DOM marker; markers are added and removed by id as
   the view moves instead of rebuilding the whole group on every change. A drag moves less than one
   viewport and a wheel notch zooms out 1.25 levels, both inside the pad, so neither uncovers an empty
   area. A bigger jump (Fit, several notches) fills the newly visible area in right after the move, in
   batches of 150 markers per frame with the markers on screen first, so the map never freezes while
   thousands come in. A marker with an open popup is never culled. A point that comes back as a new
   object (the daily data refresh) gets a fresh marker; a picture that failed once is not retried after
   a re-add. Zone outlines are few and stay on the map regardless of view.
3. **Interned quest data** (`src/lib/quests/compact.ts`). After loading (cache, snapshot or network)
   repeated strings share one instance and loot containers share one descriptor per id. Values are
   unchanged; only identity is shared. Arrays are never shared.
4. **Lazy popup HTML.** Point and quest popups build their HTML when opened instead of at marker
   creation, so a thousand markers no longer hold a thousand HTML strings.

Not changed, on purpose: the GPU process (driver baseline, `--disable-gpu` would trade CPU for it and
risk the transparent overlay window), the item picture variant (the `-base-image` is the transparent
one tarkov.dev's map uses), Leaflet's `keepBuffer`, and WebView2 browser flags.

## What can look different

- After a zoom-out of more than one wheel notch, or a Fit from close up, with thousands of markers on:
  the newly visible markers appear over the next few frames instead of animating in with the zoom.
  What is on screen is complete within one or two frames; the padding ring fills in unseen.
- At the opening view the whole map is inside the pad, so culling saves nothing there; the memory win
  from culling appears once zoomed in. The 2D transforms and the interned data apply everywhere.
- Two markers at the same pixel row used to stack in filter-group order; now the one added later is on
  top. During a zoom animation Chromium still promotes the moving markers to layers for the 250 ms of
  the transition (Leaflet's own will-change), so the per-marker layer cost returns briefly then.

## Results

Release builds of main (0.7.0) and of this branch, each started fresh under a throwaway identifier
with the same warm caches, Streets of Tarkov, window 1100x750, measured after a forced GC. "default"
is the filter set a new install has (labels, extracts, tracked quests: 60 markers); "heavy" is every
layer on (3,081 markers). "zoomed" is four wheel notches into the map centre, measured 20 s later.
Private working set is what Task Manager's Memory column shows; commit is the charge against RAM
plus page file. Per-process figures are for the renderer and the GPU process; totals cover all
eight processes.

| scenario | build | renderer | gpu | total private | total commit | markers in DOM |
|---|---|---|---|---|---|---|
| default, opening view | main | 44 MB | 43 MB | 143 MB | 304 MB | 60 |
| default, opening view | branch | 43 MB | 39 MB | 139 MB | 300 MB | 60 |
| heavy, opening view | main | 164 MB | 211 MB | 432 MB | 897 MB | 3,081 |
| heavy, opening view | branch | 95 MB | 49 MB | 201 MB | 333 MB | 3,081 |
| heavy, zoomed | main | 194 MB | 173 MB | 427 MB | 807 MB | 3,081 |
| heavy, zoomed | branch | 155 MB | 94 MB | 308 MB | 686 MB | 1,668 |

- With every layer on, the app now takes less than half the memory it did (201 vs 432 MB private) at
  the opening view. The compositor layers were costing the GPU process as much as the renderer.
- Zoomed in, the branch sits 119 MB under main. Its renderer is higher than at the opening view
  because each zoom animation still promotes the moving markers to layers for its 250 ms and Chromium
  gives that memory back slowly; the culled markers are gone from the DOM (1,668 of 3,081 left, with
  4 notches ending short of full zoom).
- With the default filters the change is within noise (4 MB): the JS heap after GC drops from 10.6
  to 7.6 MB from the interned data, and there are too few markers for the rest to matter.
- Screenshots of main and of the branch at the zoomed heavy view are pixel-identical.
- The GPU process's commit (400 to 630 MB) is mostly the NVIDIA driver's reservation and is not
  resident; its private working set is the figure to compare.
