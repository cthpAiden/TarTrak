# Changelog

## 0.6.1 - 2026-09-07

### Fixes
- Item pictures on loot spots and in popups are small again: Leaflet overrode the size cap, so Moonshine or a fuel can filled the screen. They now sit in a fixed 20px box.

## 0.6.0 - 2026-09-07

### Map
- "Go here" on the right-click menu: a straight dotted route line from my marker to the spot under the cursor, with the distance on it, like the route to an extract. Clear it from the route button.
- A map card at the top of the Filters tab: raid length and player count, the keys needed to enter (The Lab, Terminal, The Labyrinth), and each boss with its spawn chance, escort size, portrait, and whether a switch spawns it.
- Boss spawn popups name the boss with its chance, escort size and switch trigger.
- Loose loot spots draw like tarkov.dev's: a spot holding one item shows that item's picture as its marker, a spot whose items share a handbook category shows the category's picture, the rest keep the loose loot icon. The Loose Loot filter rows carry the category pictures too. Pictures load from assets.tarkov.dev; offline, the generic icon stands in.
- Popups show the picture of a loot spot's item, a lock's key, an extract's fee item and a quest item.

### Quests
- Click a quest name to unfold it: every objective with its count, found-in-raid and optional flags (and its map when the quest spans several), what still gates it (prerequisites not done, trader loyalty level, faction), the rewards (XP, items, trader reputation, skills, unlocked offers and crafts), and what fails it.
- Settings > PMC faction: USEC- or BEAR-only quests of the other side (Drip-Out, Textile, Our Own Land, Counteraction, ...) are hidden from the finder; the rest carry a USEC or BEAR badge.

### Data
- Data schema 12 (caches refresh on first start): map raid duration, player count and access keys; boss escorts, spawn trigger and portrait; task faction, experience, finish rewards, trader level requirements and fail conditions; objective count, found-in-raid and optional flags; picture ids of single-item loot spots, lock keys and extract fee items. data/itemCategories.json (`npm run snapshot`) also carries the handbook category pictures and the few items whose picture belongs to another item.

## 0.5.0 - 2026-09-07

### Map
- The Lab, The Labyrinth and Icebreaker now show a map: tarkov.dev draws these as image tiles rather than a vector drawing, and the tiles load straight from assets.tarkov.dev. The Lab has its Second Level and Technical floors, Icebreaker its sixteen decks.
- Floors that tarkov.dev only draws as tiles are in the Floors menu too: Customs' 4th floor, Reserve's 2nd to 5th floors sit as an image over the vector map.

### Data
- Loose loot is filtered by the items' handbook categories, the rows tarkov.dev's map uses (Barter items, Keys, Medical supplies, ...); a spot with items of several categories shows while any of its rows is on. The item-to-category map is bundled (data/itemCategories.json, refreshed by `npm run snapshot`), so the app never downloads tarkov.dev's 17 MB item list. Data schema 10 (caches refresh on first start).
- Night Factory's and Ground Zero 21+'s extracts no longer double Factory's and Ground Zero's: tarkov.dev lists them under the same names a rounding error apart, now without a faction, and those read as PMC & Scav like on its map.
- Snapshot refreshed from tarkov.dev's data of 2026-09-07: Interchange lists nine extracts (Railway Exfil once for PMCs and once for Scavs, Path to River (Flare), Smugglers' Tunnel), Factory gained Gate 2, Shoreline five extracts, Ground Zero three. tarkov.dev's data of that day dropped Reserve's D-2 and Armored Train, five Lighthouse extracts, and the switch-to-extract links.

## 0.4.1 - 2026-09-06

### Quests
- A quest marker on another floor stays on the map, dimmed, instead of vanishing; its popup names the floor. Cargo X's laptop on the resort's 3rd floor was invisible from the ground view.
- Objectives tarkov.dev places on Night Factory, Ground Zero 21+ or The Lab (Dark) show on Factory, Ground Zero and The Lab; one that it lists for both variants is drawn once. Health Care Privacy - Part 5 had no marker at all.
- An objective's map list comes from tarkov.dev's own list for it, not only from the task's map. Data schema 9 (caches refresh on first start).

### Map
- A floor only claims the buildings drawn on it. tarkov.dev's 2nd and 3rd floor bands on Shoreline, Streets, Ground Zero and Factory covered the whole map, so a hillside at that height flipped the map to the resort's 2nd floor and hid every ground marker. Building outlines are traced from tarkov.dev's floor drawings (`npm run floor-bounds`, data/floorBounds.json).
- Ground markers above or below tarkov.dev's nominal ground height no longer vanish: Shoreline's Climber's Trail extract, Reserve's barracks spawns.
- The heading line is thicker with longer dashes, and its far end no longer fades out completely.

### Data
- Night Factory, Ground Zero 21+ and The Lab (Dark) fold onto Factory, Ground Zero and The Lab: their own loot spots and boss spawns (the Cultist Priest) show there; a spot both variants list is drawn once.

## 0.4.0 - 2026-09-06

### Quests
- The quest finder starts with every quest unticked; tick one to put it on your to-do and on the map, untick to take it off. (It used to be the other way round: ticked meant completed.)
- Every quest and trader heading carries the trader's portrait, from tarkov.dev. Data schema 8 (caches refresh on first start).

## 0.3.3 - 2026-09-06

### Map
- The heading line is 125 m long by default (Settings: 5 to 125 m), with thicker, longer dashes.

## 0.3.2 - 2026-09-06

### Map
- The heading line fades out towards its far end, so it no longer hides what is 50 m ahead.

### Quests
- The quest finder lists every quest as ticked, meaning completed; untick one to show it on the map and put it on your to-do.

## 0.3.1 - 2026-09-06

### Map
- The heading line is a thin dotted line of sight, 50 m long in game units (Settings: 5 to 50 m), so it scales with the map and shows what a teammate calls out on V without hiding the map.
- The extract list shows each extract's distance from you, like "Dorms V-Ex (312 m)".

### Squad
- A teammate whose connection drops is announced as "Bob disconnected", a deliberate leave as "Bob left the room"; your own outage reads "Lost connection to the room" and "Back in the room".
- No more duplicate player markers after a disconnect: a reconnect under a new relay id replaces the old marker even when the old socket's leave never arrives, my own stale socket is never listed as a teammate, and the relay announces a dead socket the moment a send to it fails.

### Quests
- The Quests tab is a to-do list. "Find quests on <map>" lists the quests with markers on the map you are on (type to search; "all maps" widens it); + adds one to your to-do. Only to-do quests draw markers on the map, and a quest marked done leaves it. "Share with squad" sends your list to the room: teammates see your quests' markers on their map and your list under yours, with + to copy a quest over; leaving the room withdraws it. The per-quest hide toggle is gone, the to-do list replaces it.

### Squad
- The app tells you when a teammate runs a different TarTrak version. An older build silently drops message types it does not know, so shared markers and drawings only work when everyone is on the same version.

### Performance
- Less memory: the offline fallback data set is no longer inlined into the app's script (4 MB parsed at every start and kept all session); it is loaded from a file only when there is no cached data. Map points are built for the map on screen instead of all seventeen maps.

## 0.3.0 - 2026-09-06

### Map
- Route to an extract: the exit button next to Follow me lists the map's extracts (PMC first, then co-op, Scav, transits); pick one and a dashed line runs from your marker to it with the distance in metres, redrawn on every screenshot. The button shows the distance too. "Clear route" turns it off.
- Draw on the map: the pencil button turns a left drag into a stroke. In a room every stroke goes to the squad as you finish it, in your colour, and is replayed to whoever joins later; outside a room strokes stay on your screen. Right-click offers "Undo my last drawing" (also Ctrl+Z) and "Clear all drawings", which wipes the map for the whole room.
- The map cursor is an arrow instead of a hand, so the spot under it is visible when placing a marker; a crosshair while drawing.

### Quests
- Quest item spawn points are on the map: every place a quest item can be found (tarkov.dev's "possibleLocations"), with the item's name in the popup. They were missing before, so a map like Lighthouse showed only objective zones and none of the hundred-plus item spots. Filter: Quests → Quest items. Data schema 7 (caches refresh on first start).

## 0.2.2 - 2026-09-06

### Squad
- Click a teammate's colour dot in the squad list to pick the colour they are drawn in on your screen. It is yours alone: they keep the colour they chose on their own screen, and their shared markers take it too. The ↺ button next to the name goes back to their colour.
- Name labels on the map carry the floor a teammate is on, like "Aiden [2F]"; the squad list shows the same tag.
- Name labels are more translucent so they hide less of the map.

### Map data
- Extracts named "(Co-Op)", such as Interchange's Scav Camp, are filed under "Co-op Extracts (PMC + Scav)" instead of "PMC & Scav Extracts": they only open when a PMC and a Scav stand in them together, unlike Emercom Checkpoint, which either can use alone.

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
