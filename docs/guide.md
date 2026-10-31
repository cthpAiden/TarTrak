# TarTrak guide

Everything the app can do, in more detail. Back to the [README](../README.md).


## Overlay

Settings > Overlay shape picks the look. **Box** (the default) is a rectangle with the compass tape on top and the pills in its
bottom-right corner. **Circle** is a round minimap with a
compass bezel: degree ticks, N/E/S/W, and your teammates and route as markers on the ring at their bearing,
with a box showing your heading. The window shrinks around it, keeping its top-right corner where it was,
and comes back to its old size and place when you leave the overlay; park it in the screen's top-right
corner. Buttons round the lower left of the rim switch to the full window and toggle follow me, route,
draw and the rotation; zoom sits on the right of the rim and the floor picker under it; the raid timer and
teammate distances step up the lower right of the rim, closest teammate first. **North-up** (the default)
keeps the map still and slides the heading box round the ring; **heading-up** turns the map so you face up,
at each screenshot (the heading only changes when you take one). On a turned map, labels and tooltips stay
upright but marker icons turn with it. Settings also has the minimap size, the bezel on or off, and the rim
buttons always shown or only under the mouse. The window around the circle is still a rectangle, and its
see-through corners may catch clicks meant for the game: hide the overlay with F7 while looting.


## Mark here

Hold the mark-here key (Left Alt by default) and press the game's screenshot key: a private
marker labelled with the time drops where you stand, on top of the usual dot move. Either key alone does
nothing. Settings > Mark-here key rebinds the held key to any key or a middle or side mouse button (Backspace
turns it off). The screenshot key is read from the game's log, where the game lists its control bindings
at start, so a rebound screenshot key just works; Settings shows the key it read. Ctrl does not work as
the held key: the game ignores its screenshot key while Ctrl is held.


## Raid timer

The status bar and the overlay (a chip on the circle's rim, or a pill in the box's bottom-right corner) count down the time left in the
raid (mm:ss). It reads the game's own raid clock from its output log, so it matches the in-game watch in PMC and
Scav raids alike: a Scav raid joined 20 minutes in, a late spawn, a map whose raid is shorter than usual, and a
raid whose end the game moves are all counted right. It lets clicks through, hides when you leave the raid, shows
00:00 for a minute after the end, and Settings > Raid timer turns it off.


## Raid replay

TarTrak records each raid you take a screenshot in: your screenshots, and the positions your squad room passes on
for each teammate on your map. When you leave the raid, a toast says how many screenshots you took and the
**Raids** tab gets a dot. Open it to pick one of your last 10 raids; the map switches to that raid's map and shows
only the replay.

- Every trail is drawn in its player's colour: faint for the whole raid, bright for the last 3 minutes before the
  playhead, with each player's marker and heading where their last screenshot put them.
- The dock under the map plays the raid at 1×, 4×, 16× or 64×, steps to your previous or next screenshot, and has
  one lane per player with a tick for each position. Drag across the lanes to jump to any moment. Your gaps of
  more than a minute without a screenshot are shaded.
- The card in the top left counts your screenshots, how often you took one, and your longest gap.

Teammates keep being recorded after you leave, until the raid's clock runs out or your next raid starts. Their
trails only hold what reached you: a teammate who joined the room late or dropped out has a shorter trail. The line
between two screenshots is straight, so it is not the exact way anyone walked. Raids are kept in `raids.json` in
the app's data folder.


## Your own markers

Right-click anywhere on the map, type a label if you want one, and pick **Marker for
me** (only this app shows it) or **Shared marker** (everyone in your squad room sees it, in your colour).
Click a marker for its details and a Remove button; anyone in the room can remove a shared marker. Shared
markers live as long as the room does, and go away when you leave it.

Markers never disappear; they dim slowly after 30 s and settle at 35% after 5 minutes.


## Route and drawings

The exit button next to Follow me lists the map's extracts; pick one and a dashed line
runs from your marker to it with the distance in metres, updated on every screenshot. **Go here** on the
right-click menu draws the same line to any spot on the map; the route button clears either. The pencil button turns a
left drag into a stroke: in a room the squad sees every stroke live and later joiners get them replayed; right-click
offers undo (also Ctrl+Z) and clear-all, which wipes the map for the whole room.


## Quests

The Quests tab is a to-do list. "Find quests on <map>" lists the quests with markers on the map you
are on (type to search, "all maps" widens it). Tick a quest there to put it on your to-do; only to-do quests draw
markers, and the checkbox on a to-do entry marks it done.
"Share with squad" sends the list to your room, so teammates see those markers too and can copy quests over.
"See squad's quests" (on by default) shows what teammates share; turn it off to keep the map to your own quests.


## Squad

Every player marker has a heading line (length adjustable in Settings), with small split ticks either side of it 50, 100 and 150 m ahead
(they hide when zoomed out too far to tell apart). While you are in a room, the Squad tab lists your teammates: distance to you when they are on
your map, otherwise the map they are on, plus how long ago they last reported. Click a row to center on them.
Names carry the floor a teammate is on, like "Aiden [2F]". Click the colour dot in a row to pick the colour that
teammate is drawn in on your screen; it is yours alone, they keep their own colour on theirs (↺ goes back).
A teammate whose game log was not found reports no map and is drawn on yours, marked "map unknown". The app
pings the relay every 20 s; if the connection drops, a small "Squad: reconnecting" pill appears in the map's
top-left corner and the app reconnects by itself, with one notice on loss and one on recovery.


## Details

Click any marker for a popup with its name, type, elevation, and, for loose loot, the full item
list; boss spawns show each boss with its spawn chance, escort size and whether a switch spawns it. A loose loot
spot holding one item is drawn as that item's picture, one whose items share a handbook category as the category's
picture (both from assets.tarkov.dev, like tarkov.dev's map); popups also show a lock's key, an extract's fee item
and a quest item. Quest objectives with a zone draw its footprint
as a translucent green outline, shown on every floor the zone spans. The "?" button next to a quest opens its
wiki page in your browser.


## Filters

The sidebar has four tabs: Filters, Squad, Quests and Settings. The Filters tab opens with a card
for the current map: raid length, player count, the keys needed to get in (The Lab, Terminal, The Labyrinth), and
every boss with its spawn chance and escort size. Below it the tab groups
everything the map can draw: Extracts, Map
Tasks, Spawns, Containers, Locks, Hazards, Switches and BTR. Each group and each category shows a
`shown/total` count for the current map, so a group with nothing on this map still appears as `0/0`.
PMC, co-op and transit extracts plus every map task category are on by default; everything else is
off. Your choices are saved with the rest of your settings. The filter counts are for the whole
map; the map itself shows only markers on the selected floor.


## Find item

The Filters tab has a "Find item on map" box: type part of an item name (two letters or
more) and every loose-loot spot holding it, every lock opened by a key of that name and every stationary gun
of that name lights up on the current map, whatever the layer toggles say. The box shows how many spots matched.


## Game mode

Settings > Game mode picks the tarkov.dev data set: PvP (default) or PvE. Each mode keeps its
own cache; the quest list footer shows which one is loaded. Settings > PMC faction (USEC or BEAR) hides the
quests only the other faction gets; those quests carry a USEC or BEAR badge.


## Quest list

Quests are grouped by trader in the usual trader order, with a `done/total` count per
trader; sections collapse and quests with markers on the current map sort first. The checkbox marks a
quest done. Quests needed
for Kappa carry a "κ" badge, Lightkeeper ones "LK"; the **Kappa** toggle lists only those. The **available**
toggle (saved with your settings) shows only quests whose prerequisite quests you have marked done, and hides
the markers of the locked ones from the map as well. Click a quest's name to unfold it: every objective with
its count and found-in-raid flag, what still gates it (prerequisites left, trader loyalty level, faction), the
rewards, and what would fail it.
