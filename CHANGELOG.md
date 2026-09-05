# Changelog

## 0.2.1 - 2026-09-06

### Map data
- Extracts tarkov.dev marks "shared" (usable by PMCs and Scavs, such as Interchange's Emercom Checkpoint and Railway) are labelled "PMC & Scav Extracts" instead of "Co-op Extracts", and the extracts group is on by default as a whole so a new faction can never be hidden. Every extract, transit and hazard footprint is drawn in tarkov.dev's colours; extract popups name the switch that opens them and the item they cost (V-Ex fee, secret-extract item); locks say when they need power; artillery zones appear as "Mortar zones". Data schema 6 (caches refresh on first start).
- Switch popups say what the switch does ("Unlocks Saferoom Exfil", "Locks Alarm Switch"); transit popups carry their access condition (keycard, night hours).
- A snapshot test checks every map's layers against the data set, so a dropped entry fails CI.

## 0.2.0 - 2026-09-05

### Map
- Right-click places a marker: private (only this app) or shared with the squad room, with an optional label; click a marker to remove it. Shared markers are kept by the relay and replayed to teammates who join later.
- Floors are picked from a "Floors" dropdown in the top-right corner instead of a permanent button column.
- The view cone is gone; the heading line stays.
- Overlay mode no longer clips heading lines at the old map edge (Leaflet is told when the map area changes size).
- Marker icons are the tarkov.dev interactive-map PNGs (MIT), including the two quest icons; quest markers show a hover tooltip.
- Quest objectives with a zone draw its footprint as a translucent green outline, visible on every floor the zone spans.
- Players draw in their own pane above every map layer, so a floor redraw can never hide you or your squad.
- Follow-me (crosshair button next to the mode button, on by default) recentres the map on your marker after each screenshot.
- Item finder in the Filters tab: type part of an item name and every loose-loot spot, key-matched lock and stationary gun holding it lights up, whatever the layer toggles say.
- The square corner button switches between the full window and the map-only overlay; overlay hides the sidebar, top bar and setup banners, and its buttons are translucent.
- A new raid (GameStarted in the log, or a different map) clears the stale marker from the previous raid.
- Cached map drawings refresh after seven days; the old copy stays in use offline.

### Sidebar
- Four tabs: Filters, Squad, Quests, Settings. Filter and quest sections use rotating chevrons; the group name toggles the section too.
- Quests: `available` toggle (persisted) lists only quests whose prerequisites you marked done and hides the markers of locked ones; `Kappa` toggle; κ / LK badges; needed keys per quest; `?` opens the wiki page in your browser.
- Settings: PvP/PvE game mode (separate tarkov.dev data sets and caches); a blank Relay URL falls back to the project relay; About links open in the browser.

### Squad
- Heartbeat: the app pings the relay every 20 s and reconnects when a pong is missing; works against a relay without ping support too.
- Quiet notices: toasts sit in the bottom-right corner (three at most), one notice on connection loss and one on recovery, a small "Squad: reconnecting" pill next to the corner button in both modes, red tab dot while reconnecting.
- Teammates appear in the list as soon as they join ("no position yet"); the relay replays a hello to late joiners.
- A teammate whose game log was not detected reports no map; they are drawn on your map and labelled "map unknown". Rows name a teammate's floor when it differs from yours.
- Reconnects no longer announce a join or a leave. Fresh installs get a "PMC-###" name. Room code shown large with a Copy button.
- Teammate names are escaped before reaching Leaflet tooltips; relay colours are validated once.

### Fixes
- The screenshot watcher deletes only screenshots named with coordinates; menu screenshots stay.
- The pre-deploy placeholder relay URL in old settings is replaced by the real one.
- A per-user EFT install is detected through HKCU as well as HKLM.
- Unknown map names in the log are reported once, not per replayed line.

### Relay
- `ping` is answered with `pong` by the runtime (no Durable Object wake-up); a socket's hello is replayed to newcomers until its first position.
- Shared markers (`pin` / `unpin`) are stored per room (50 at most) and replayed to newcomers; an empty room forgets them after 30 minutes.

### Updater and release
- The update prompt names both versions with Update / Later buttons, the download is announced, and the Windows installer runs in passive mode. Settings > About has a "Check for updates" button.
- Tagged releases are published directly with `latest.json`; the workflow refuses a tag that does not match the app version.
