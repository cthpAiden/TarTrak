# Changelog

## 0.8.3 - 2026-09-09

### Fixed
- The 0.8.2 "Screenshot key" setting was left at PrintScreen by anyone who rebinds the game's screenshot key, so the mark chord never fired. The setting is gone: the game writes its control bindings to its log at start, and TarTrak now reads the screenshot binding (`MakeScreenshot`) from there, at launch and whenever the game restarts. Settings shows the key it read. A binding it cannot read (a controller button) gets one toast and falls back to PrintScreen.

## 0.8.2 - 2026-09-09

### Fixed
- Mark here fired on the mark key alone or on a plain screenshot: any Alt press and any screenshot within 2 s of each other, in either order, counted. Now it is a real chord. Settings gains **Screenshot key** (PrintScreen unless you changed it in the game's controls), and a marker drops only when that key goes down while the mark-here key is held. Either key on its own does nothing; the screenshot itself still moves your dot as before. The chord waits for the game's screenshot file for 2 s and marks one screenshot at most.

## 0.8.1 - 2026-09-09

### Fixed
- The mark-here key was blind while the game was in front: it only worked right after an Alt+Tab. Cause: the game runs elevated (its launcher asks for administrator rights), and Windows hides an elevated window's key state from apps that are not, so the poller read "up" the whole time. TarTrak now asks for administrator rights when it starts, the same level as the game, and the key is seen in raid. Nothing else changed: still no hook, no input sent, nothing touching the game process.

## 0.8.0 - 2026-09-09

### Map
- Mark here: hold the mark-here key (Left Alt by default) while taking a screenshot and a private marker labelled "Marked HH:MM" drops where you stand, with a "Marked" toast; the dot still moves as usual. The key press and the screenshot pair up when they come within 2 s of each other, in either order, and each press marks one screenshot at most. Settings > Mark-here key rebinds it by pressing any key or a middle or side mouse button (Backspace turns it off, Escape cancels); PrintScreen is refused since it would mark every screenshot. Ctrl is no use: the game ignores its screenshot key while Ctrl is held.
- Ban-safety: the app reads whether that one key is down with the Windows call push-to-talk apps use (`GetAsyncKeyState`, every 10 ms). No keyboard hook, nothing sent to the game, nothing touches the game process. README says so.

## 0.7.5 - 2026-09-09

### Overlay
- The raid timer moved from the map's bottom-left corner to the bottom-right, at the very corner, with the teammate-distance pill to its left when a squad is on. Both pills still let clicks through.

## 0.7.4 - 2026-09-09

### Overlay
- A raid timer sits in the map's bottom-left corner in overlay mode: the time left in the raid as mm:ss, counted from the moment the game log says the raid started, against the map's raid length from tarkov.dev. It is a small pill like the teammate-distance one and lets clicks through. It shows 00:00 for a minute after the raid ends, then goes away. Settings > Raid timer turns it off. PMC raids only: a Scav raid joins mid-raid, the log carries no remaining time, so it would read too high.

### Data
- Patch 1.1.5.0 moved Lighthouse's Mountain Pass extract north of Pikes Peak Resort; tarkov.dev still lists the old spot. `data/extracts.json` now pins it at the new one (`pinned: true`: the file's spot wins over upstream's for that name; `npm run snapshot` reports pinned names). The spot is read off a screenshot of the map, give or take a few metres.
- Lighthouse's minefields are gone: the patch removed the landmines, tarkov.dev still lists them, so the app drops that map's minefield hazards. Other maps keep theirs.

## 0.7.3 - 2026-09-09

### Squad
- Two teammates who send the same colour (two fresh installs both send the stock blue) are now told apart: the later joiner is shown in a spare colour, the first free one of red, green, orange, purple, cyan, pink, lime and lavender. This is per screen: everyone keeps sending the colour they picked, and my own picks in the squad list still win. A fresh install is offered one of those colours in the Room tab instead of the stock blue, the way the stock name gets a random suffix. The stand-in follows the teammate across a reconnect and their shared markers and strokes wear it too; it goes away once they pick a colour nobody has.

### Overlay
- The compass numbers sit 4 px lower, closer to their tick marks.

### Data
- Patch 1.1.5.0 (2026-09-08, the Lighthouse rework): the bundled tarkov.dev snapshot is regenerated from the files tarkov.dev rebuilt after the patch. Lighthouse's map card now lists the Rogues at the chalets and Glukhar at the water treatment plant; Icebreaker's access key is the Sudak-Tudak marine repair kit; renamed items (the face masks that lost their armour) carry their new names.
- tarkov.dev files the chalet Rogues under a new mob id it neither translates nor pictures; the app reads that id as the Rogue mob, so the card says "Rogue" with the Rogue portrait instead of "exUsecFree".
- Not yet in tarkov.dev's data, so not yet drawn: the stationary weapons and landmines the patch removed from the water treatment plant, the Icebreaker transit at the pier, the BTR route, the moved Marked Room and Prapor's camp, the new tasks (To the Light, Pay the Fare!, Can't Drink Away Skill), and the redrawn Lighthouse map. Extracts are unchanged. Rerun `npm run snapshot` when tarkov.dev catches up.

## 0.7.2 - 2026-09-08

### Overlay
- The readout footer is gone; it hid the bottom of the map. Teammate distances stay as a small pill in the map's bottom-right corner, shown only while a teammate is on the map. The route target's distance is already on the route picker.

## 0.7.1 - 2026-09-08

### Memory
- Map markers no longer each get their own compositor layer: Leaflet placed every marker with a 3D transform, which made Chromium promote each one to a layer of about 35 KB. With every layer on, Streets' three thousand markers cost the renderer over 100 MB; they now share the marker pane's layer. Positions and zoom animations are unchanged.
- Only the point markers near the view exist in the page: the view padded by one screen on each side. A drag or a single wheel notch never reaches the edge of that; a larger jump fills the newly visible area in within a frame or two, what is on screen first. Filter, floor and item-finder changes now add and remove only the markers that changed instead of rebuilding them all, so typing in the item finder no longer rebuilds thousands of markers per keystroke.
- Quest data uses less heap: repeated strings (an item name appears in tens of thousands of loot spots, 311 distinct) and loot container descriptors are shared after loading. Popup text is built when a popup opens instead of being kept for every marker.

## 0.7.0 - 2026-09-07

### Overlay
- Overlay mode is one rounded box with a compass tape across the top: my heading sits under the centre marker as a three-digit bearing, the tape scrolls with every screenshot, and a coloured tick marks the bearing of the route target (amber) and of each teammate (their squad colour). A target behind me is pinned to the edge it lies beyond, dimmed. Bearings use the app's heading convention, so "contact at 041" reads straight off the tape.
- A readout footer under the map: metres to the route target and its name, then each teammate's distance in their colour. Without a position it says so.
- The box has a hairline border and rounded corners; the game shows around them. Toasts sit above the footer.

## 0.6.2 - 2026-09-07

### Fixes
- Lighthouse has its Road to Military Base V-Ex again, with Side Tunnel (Co-Op), Southern Road, Hideout Under the Landing Stage and Industrial Zone Gates; Reserve its D-2 and Armored Train, Woods its Friendship Bridge (Co-Op), The Lab its Medical Block Elevator, Shoreline its Railway Bridge. tarkov.dev regenerated its map data on 2026-09-06 without them, and with other maps' extracts filed under the wrong map (Woods' UN Roadblock and Scav Bunker on Ground Zero, Customs' Scav Checkpoint on Streets, Reserve's Cliff Descent on Shoreline, a "Gate 2" on Factory), while its API was down; the game had not changed (patch 1.1.5.0 is not out yet).
- Extracts no longer depend on tarkov.dev alone: `data/extracts.json` holds every map's extracts, checked against independent sources, and the app draws that list. An extract tarkov.dev still lists is drawn as tarkov.dev has it (so a moved spot or a changed faction shows), one it dropped comes from the file, one the file does not know is left off. `npm run snapshot` reports what the file restored and what upstream lists that the file left off, for the next patch. Data schema 13, so caches refresh on first start and the extracts come back at once.

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
