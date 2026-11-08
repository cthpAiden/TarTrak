# Promo UI refresh plan (2026-11-02)

Goal: both cuts (15 s `Showreel`, 50 s `Reel45` + `Reel45Vertical`) show the app as it is in v0.16.1.
Nothing here is built or rendered yet.

## What the user asked for (2026-11-02, in order)

1. Update the promo video to match the app's changed UI, banners, new icons and design.
2. Don't render or run anything heavy for now (the user was in a raid). Write the design down only.
3. Check the GitHub repo for the latest code changes too. (Done: see "GitHub check" below.)
4. Build the parked 6 s QUESTS scene in the same pass, so the reel only renders once.
5. Keep the RAID CLOCK scene, but make it shorter. It becomes 2 s, placed after QUESTS, so the reel is 54 s.
6. Wait for the user before starting any of the edits. The user will run this in another session.

The raid timer accuracy work (PMC raids exactly in step with the in-game timer) is a separate task, also for another session. It is not part of this plan.

The promo's app shots were last updated on 2026-09-26 (v0.12.2). Since then the app has changed in the ways below.

## Already up to date (no work)

- End card and README banner: topo compass logo plus topo contour background (commits 40b9e08, 37f0d53, e02d68b).
- `components/Logo.tsx` `LogoMark` draws the new H1b topo compass from `public/logo.svg`.

## Must fix: the promo shows UI the app no longer has

| # | What changed in the app | Where the promo draws the old version | Change |
|---|---|---|---|
| 1 | The sidebar logo is the topo compass image (`public/logo.png`, 34 px, no amber tile). Changed in 0.16.1, c22dc57. | `shots/app/Rail.tsx:104-125`: amber 34 px tile with a crosshair glyph and an amber glow | Replace the tile with `<Img src={staticFile("logo.svg")}>` at 34 px. Keep the `pop` scale-in. Change the glow from a box-shadow to a `drop-shadow` filter so it follows the round dial, not a square. |
| 2 | New **Raids** tab between Quests and Settings (0.16.0, raid replay). Glyph: `M2 12.5l3.5-4 3 2.5 5.5-7` plus dots at (2,12.5) and (14,4). | `Rail.tsx` `TABS` has only 4 tabs | Add the 5th tab with that glyph. Its enter stagger becomes `362 + i`, so Settings now lands 1 frame later; check that it doesn't collide with the RailAction enter at 367. Optional: a small green "fresh" dot on Raids, popping at about f371, to hint at the new feature. |
| 3 | Status bar version and coordinates. The app now shows `X -182 · Y 4 · Z -71 · 048°` (whole numbers, Y included). | `shots/app/StatusBar.tsx:42,54`: `X -182.4 · Z -71.0`, hard-coded `v0.12.2` | Switch to the app's format. Read the version from the root `package.json` at build time, so it never goes stale again. |
| 4 | Teammates are an **18 px age capsule** showing seconds since their last screenshot (`3s`, `12s`, then `2m`), with black or white digits picked for contrast (0.13.0). | `world/World.tsx` teammate dots (around line 537); `components/Markers.tsx` `MateDot`, used in `Gallery.tsx` and the overlay `Minimap` | Add a `MateCapsule` beside `MateDot` (pill, team colour, 1.5 px dark border, mono digits). Use it wherever a teammate shows. The age ticks up with the frame and resets to `0s` when that teammate's position updates in the shot. Drop `MateDot` if nothing uses it afterwards. |
| 5 | My heading line is 100 m by default and has **range marks**: split ticks either side of the line at 50, 100 and 150 m, 4-8 px off the line, 70 % opacity, hidden when 50 m is under 16 px (0.14.4). | `World.tsx` `heading("me", ...)` (line 532); `Markers.tsx` `HeadingLine` | Give `HeadingLine` an optional `marks` prop (metres per px plus the 16 px rule) and turn it on for my own line in World and in the Safe scene (`reel45/scenes/Safe.tsx:654`). Teammates' lines stay plain, as in the app. |

## Optional: new features worth a beat

- **Raid replay (0.16.0)** is the biggest new feature and no shot shows it. The only cheap way in is THE APP (shot 4): after the rail lands, the Raids tab gets clicked and the map plays the squad's trails back for about 1 s. No timing change, but the shot gets busy. Skipped unless you ask for it.
- **Room code Hide button** (0.14.0): the squad panel could show the masked code `••••••`. Low value, skip unless the squad shot needs it.
- Leave out the **screenshot reminder**. On main it greys the map after 30 s without a screenshot. On the unmerged branch `origin/claude/sweet-keller-nr89b2` (2026-11-02, no PR) it becomes a red "45s" tag by my marker instead. Either way it is a warning state, which doesn't help a promo. The branch touches nothing else the promo draws.

## GitHub check (fetched 2026-11-02)

`main` is level with `origin/main` (0.16.1); there is nothing to pull. Besides the branch above, the only open items are 4 Dependabot PRs (#19-#22, dependency bumps only, no UI).

## Scene 8: QUESTS, then a shorter RAID CLOCK (approved 2026-11-02, same pass)

QUESTS runs 6 s (360 frames, 12 beats at 120 BPM) at reel frames 1680-2040, after EXTRACTS. RAID CLOCK stays but shrinks from 4 s to 2 s and becomes scene 9 (2040-2160), right before SHARED MARKERS. The reel goes from 50 s to **54 s**.

**Idea:** you tick quests onto your to-do list, and their objectives land on the map. The same three made-up quests appear later in the montage's quest card (`shots/montage/QuestCard.tsx`: Supply Run, Signal Lost, Cold Storage), so the reel calls back to itself. The trader avatars stay as made-up initials (QM, SP, DR). No BSG trader art, same rule as the montage.

Landscape layout: the Quests panel on the left (about x 130-640), the tilted map on the right. Portrait layout: the panel in the top third, the map below, and the headline under the map as in the other scenes.

| Local frames | Beat | Picture | Sound |
|---|---|---|---|
| 0-18 | 0 | Cut in from EXTRACTS' whoosh. The panel rises in; the map (`SettledWorld`, `BARE` with mates off, as in Exits) sits dimmed behind it. | `impactLite` |
| 30 / 60 / 90 | 1-3 | One row ticked per beat: checkbox, amber sweep, TO-DO count 1, 2, 3. | `uiClick` and `pop` A5, C6, E6 |
| 40-48 | | Headline lands: **"TICK THE JOB." / "FIND IT."**, with "FIND IT." in amber. | `impactLite` |
| 120-150 | 4 | The map brightens and the camera pushes in (`camAt`, tilt 38 to 46, as in Exits). The panel stays, slightly smaller. | `whoosh` |
| 150 / 180 / 210 / 240 | 5-8 | One objective pops per beat, each with a thin amber leader line from its quest row to its marker: Supply Run's zone outline draws on (`QUEST_ZONES` q1), then its item; Signal Lost's zone (q2); Cold Storage's item (new point). | `pop` A5, C6, E6, G6, plus `ping` on the last |
| 270-330 | 9-11 | Squad beat: a teammate's quest marker pops in their colour (nomad blue), with a small chip saying "+ squad's quests". The app shows teammates' to-do lists on your map unless you switch that off (`showSquadTodo`). | `pop` A6 |
| 336-359 | | Out: the scene fades (`out` 344) and a whoosh carries into RAID CLOCK. | `whoosh` at 336 |

**Scene 9, RAID CLOCK, 2 s (120 frames = 1 bar):** the same ring and big mono countdown as today's `Clock.tsx`, compressed:

| Local frames | Beat | Picture | Sound |
|---|---|---|---|
| 0-60 | 0-1 | The ring scales in while the countdown time-lapses from 41:52 to 05:00. "WATCH THE CLOCK." lands at frames 6-12. | `impactLite`, then a `ratchet` over 4-50 |
| 60 / 90 | 2-3 | It turns red on beat 2 and ticks 04:59 and 04:58 on beats 2 and 3. | `stab`, `tick` A6 on each beat |
| 106-119 | | Out, then the glitch cut into SHARED MARKERS. | `whoosh` at 104 |

`CLOCK` = `{ lapse: [4, 60], red: 60, beats: [60, 90], headline: [6, 12], out: 106 }`. The "RAID TIME LEFT" chip stays. Optional, once the timer has been checked against the in-game clock in a live raid: change the chip to "SAME AS THE IN-GAME CLOCK".

**Code:**
- New `src/reel45/scenes/Quests.tsx`, about 180 lines. It's built like `Exits.tsx`: its markers are drawn on top of the world with `project3d`, so each one can pop on its own beat. It does not use the World's `quests` layer, whose `drawAt` frames are showreel frames.
- `QuestCard.tsx` gets an `at` prop (today the 510 start is hard-coded), so the scene and the montage share one card. Add an optional `scale` prop too.
- `world/data.ts`: add two quest item points, `QUEST_ITEMS` (Supply Run's item and Cold Storage's), plus one teammate quest point. Match the app's quest item marker style (`src/lib/layers/pointMarkers.ts`).
- `timeline.ts`:
  - Add `quests: { from: 1680, to: 2040, index: 8, name: "QUESTS" }`.
  - `clock` becomes `{ from: 2040, to: 2160, index: 9 }`.
  - Every later scene's index goes up by 1.
  - Add `QUESTS = { ticks: [30, 60, 90], push: [120, 150], pops: [150, 180, 210, 240], squad: 270, headline: [40, 48], out: 344 }`. The new `CLOCK` is given above.
  - The cues are rewritten as in the tables.
- `Clock.tsx` stays, with the shorter timings. Its ring maths is unchanged; only the `CLOCK` frames move.

**Timing shift (+240 frames = two bars, after 2040):**
- `share` 2160-2520, `keys` 2520-2820, `montage` 2820-2940, `overlay` 2940-3060, `end` 3060-3240.
- `DURATION_FRAMES` 3000 becomes 3240 (54 s). `SHIFT` 2100 becomes 2340.
- `GLITCHES`:
  - 1920 becomes 2160.
  - 2580, 2610, 2640, 2670, 2700 become 2820, 2850, 2880, 2910, 2940.
  - 2820 becomes 3060.
  - 480, 1140 and 1380 stay.
- `audio/reel45.ts`: the Am-F-C-G loop goes from 11 to 13 bars. Bar 13 lands on Am, so the cadence becomes Am, then the fixed F-G-Am. That reads cleanly, but confirm it by ear on the render.
- `reel45/timeline.test.ts` needs new frame numbers. Update the README's reel section ("45 s reel", the scene list) too.

The other raid timer mentions stay: "Raid 31:59 left" in the status bar, the clock callout in THE APP, and the minimap rim chip.

**Check with stills:** `node scripts/still.ts Reel45 1770` (3 ticked), `Reel45 1930` (objectives on the map), `Reel45 2000` (squad), `Reel45 2110` (clock red), and `Reel45Vertical 1930`. About 3 h of work.

## Order of work

Every step is a code edit plus a few single-frame stills, which is light on the CPU. Only the final step is heavy.

1. Rail: logo and Raids tab (items 1-2). About 20 min.
   Check: `node scripts/still.ts Shot4 380` and `Shot4 470`.
2. Status bar (item 3). About 10 min.
   Check: `node scripts/still.ts Shot4 470`.
3. Teammate capsule (item 4). About 45 min.
   Check: stills of `Shot3` at about 300 (squad lands) and `Reel45` at about 2780 (minimap).
4. Range marks (item 5). About 30 min.
   Check: stills of `Shot2` at about 200 and `Reel45` at about 900 (Safe).
5. QUESTS scene and the +120 frame shift (section above). About 2-3 h.
6. `npm test` in `promo/` (timeline, montage, overlay and world tests).
7. **Heavy, do it when not gaming:** run `npm run render` and `npm run render:reel45`, then render the vertical cut.
   After that, copy the web cut to `site/media/showreel.mp4` and the poster to `site/media/poster.jpg` (see `docs/developing.md:52`).

Steps 1-5 total about 4-5 h. Each still renders one frame in a few seconds.

## Update 2026-11-08: what the launch needs on top (approved: "do whatever is missing, then render")

App is now 0.20.4. On top of everything above:

1. **New scene 11, SEE WHAT I SEE (F8), 6 s.** It goes after SHARED MARKERS, so the reel becomes **60 s**. The user's own story, beat by beat:
   - 0-30: GHOST's screen, his TarTrak map. A chip pops up: "GHOST: where are you?"
   - 30: I press the screenshot key. My marker and heading land on his map, inside a patch of trees.
   - 60: The headline lands: "PRESS F8." / "SEE WHAT I SEE."
   - 120: F8 is pressed. My screenshot pops up in the app's popup window (the "YOU shared a screenshot" header) at the bottom-left of his screen.
   - 170: It enlarges. The picture shows the treeline, with an enemy marked by a red ring.
   - 240: It shrinks away. On his map, a red mark lands where the enemy is, and his push arrow draws toward it.
   - 336: Out.
2. **Fonts:** app shots use Geist and Geist Mono, as in the app since 0.18.1. Headlines keep their condensed face.
3. **Red timer:** the app turns the raid timer red from 10:00 left (0.17.0). The 2 s RAID CLOCK turns red at 10:00 instead of 05:00.
4. **Timeline at 60 s (3600 frames):**
   - snap 0-120, map 120-240, squad 240-360, app 360-480
   - safe 480-1140, maps 1140-1380, exits 1380-1680
   - quests 1680-2040, clock 2040-2160, share 2160-2520, peek 2520-2880, keys 2880-3180
   - montage 3180-3300, overlay 3300-3420, end 3420-3600
   - SHIFT is 2700.
   - GLITCHES: 480, 1140, 1380, 2160, 3180, 3210, 3240, 3270, 3300, 3420.
   - The score loop grows from 11 to 16 bars.
5. **Preview:** Remotion Studio (`.claude/launch.json` "promo-studio", port 3010). Scrub any frame live before a render.
