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

Filled in at the end of the branch; see the measurement table there.
