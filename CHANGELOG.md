# Changelog

## Unreleased (since v0.1.0)

### Map
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
