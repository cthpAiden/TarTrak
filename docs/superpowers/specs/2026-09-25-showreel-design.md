# TarTrak showreel: 15-second motion graphics video

Date: 2026-09-25. Picks made by the user in chat: 16:9 1080p60, original synthesized score + SFX,
stylized made-up map, "tactical-premium" tone.

## 1. Deliverables

| File | What |
|---|---|
| `promo/out/tartrak-showreel.mp4` | Master. 1920x1080, 60 fps, 15.0 s (900 frames), H.264 High, CRF 14, yuv420p, AAC 320 kb/s. |
| `promo/out/tartrak-showreel-web.mp4` | Same cut under 10 MB (GitHub README upload limit), `+faststart`, AAC 160 kb/s. |
| `promo/out/poster.png` | End-card frame, for a README thumbnail. |
| `promo/` | Source, committed to `main`. `node_modules/`, `out/`, `public/score.wav` ignored. |

`npm run render` in `promo/` rebuilds everything (audio first, then video, then the web copy and poster).

## 2. Tech

- **Remotion 4** (React + TypeScript), its own `package.json` in `promo/`; the app's root `tsconfig`,
  vitest and Vite never look there. All `@remotion/*` packages on one exact version. Remotion is free for
  individuals and companies up to 3 people.
- Packages: `remotion`, `@remotion/cli`, `@remotion/google-fonts` (IBM Plex Sans, IBM Plex Sans Condensed,
  IBM Plex Mono), `@remotion/noise` (contours, grain), `@remotion/paths` (stroke reveals),
  `@remotion/motion-blur` (whip moves only).
- Rendering in CSS 3D + SVG inside Remotion's headless Chrome. No WebGL.
- Audio: a Node 24 script (type-stripped `.ts`) synthesizes `public/score.wav` (48 kHz, stereo, 24-bit)
  sample by sample. No samples, no loops, no licences.
- **One timeline** (`src/timeline.ts`): FPS 60, BPM 120, so 1 beat = 30 frames and 1 bar = 120 frames.
  Shot boundaries and every cue (visual event with a sound) live there. The video and the synth both
  import it, so sound and picture cannot drift.

## 3. Design system

**Palette (the app's own tokens).** Background `#12151a`, deep `#0b0d10`, panel `#161a20`, raised
`#1c2129`, line `#2a313b`, text `#e8eaed`, muted `#9aa4b1`, accent amber `#f0b429`, on-accent `#1a1405`,
ok green `#3ecf8e`, map ground `#20251d`. Teammates from the app's `DISTINCT_COLORS`: GHOST `#00e5ff`,
NOMAD `#b388ff`, VEX `#ff4081`. The own marker is amber, as in the app.

**Type.** Headlines: IBM Plex Sans Condensed Bold, uppercase, 150-170 px, tracking -1%, the key word in
amber. Readouts, code, coordinates: IBM Plex Mono with tabular digits. UI replicas: IBM Plex Sans at the
app's sizes.

**Logo.** The app icon: amber ring with one tick at 12 o'clock on `#12151a`.

**Motion tokens.**
- Entrances `easeOutExpo` (0.16, 1, 0.3, 1); exits `easeInExpo` (0.7, 0, 0.84, 0); camera
  `easeInOutQuint` (0.83, 0, 0.17, 1).
- UI pops: spring (damping 12, stiffness 180, mass 0.6), a little overshoot. Settles: spring (damping
  20, stiffness 120).
- Stagger: 2-3 frames per list item, 1 frame per bezel tick.
- Headline words rise out of a baseline mask in 14 frames (skewY 6° to 0°), leave upward in 10.
- Every shot change lands on a downbeat; smaller events on beats or 8ths.

**Texture.** Film grain (about 6%, re-seeded every frame), a soft vignette, a thin HUD frame (corner
brackets, a shot counter `01/07`, a running timecode in mono) at about 35% opacity, scan lines only in
HUD-heavy moments, amber glows on amber elements, a 4-6 frame RGB-split glitch on hard cuts.

## 4. The world (one map, many cameras)

A single `World` component draws the made-up map and everything on it as a function of the **global**
frame; each shot shows it through its own camera (position, zoom, tilt, turn) and framing (full screen,
inside the app window, inside the round minimap). Teammates who land in shot 3 are still there, same
spot, in shots 4-6.

- Size 3000 x 2000 units, 1 unit = 0.5 m. Ground `#20251d` with faint noise.
- Terrain contour lines from seeded simplex noise (marching squares), 2 weights.
- A river, two main roads, a rail line (dashed double line), about 60 buildings in 5 clusters as real
  CSS 3D boxes that extrude when the reveal passes them.
- Area labels (made-up): SAWMILL, RAIL YARD, DEPOT, RIVERSIDE, POWER STATION. 100 m grid with edge ticks.
- Extracts (made-up names), drawn like the app's extract icons: NORTH GATE, RAIL BRIDGE, PIER 4,
  OLD DEPOT, TUNNEL.
- Me: amber dot + heading line (the app's look: dashed, fading out), heading 048°.
- Teammates (label style as in the app, "NOMAD [2F]"): GHOST 47 m, NOMAD 84 m, VEX 132 m from me.
- Route: NORTH GATE, 412 m. Quest zones: 2 translucent green outlines. A pin "Marked 14:32".
  A freehand stroke in NOMAD's colour. Room code `K7Q2XM`. Raid clock counting down from 32:00.
- Markers and labels stand upright (billboarded) when the map is tilted.

Made-up names only; no tarkov.dev map art, no game footage.

## 5. Storyboard

Frames at 60 fps. Beat k starts at frame 30k.

| # | Shot | Frames | Seconds |
|---|---|---|---|
| 1 | SNAP | 0-119 | 0.0-2.0 |
| 2 | ON THE MAP | 120-239 | 2.0-4.0 |
| 3 | SQUAD | 240-359 | 4.0-6.0 |
| 4 | THE APP | 360-479 | 6.0-8.0 |
| 5 | MONTAGE | 480-599 | 8.0-10.0 |
| 6 | OVERLAY | 600-719 | 10.0-12.0 |
| 7 | END CARD | 720-899 | 12.0-15.0 |

**1. SNAP (0-119).** Near-black, grain, HUD brackets draw in, a small amber crosshair blinks. Headline
"ONE KEY." rises. A keycap `PRT SC` springs up (f20-45) and is pressed on beat 2 (f60): a camera-shutter
iris (6 blades) closes and opens with a white flash at f66. The screenshot filename types itself out in
mono with a scramble-decode:
`2026-09-25[14-32]_-182.40, 2.10, -71.03_0.00000, 0.40674, 0.00000, 0.91355 (0).png`.
The two coordinates and the rotation light up amber and lift out into three chips: `X -182.4`,
`Z -71.0`, `HDG 048°` (f78-100). The chips fly together and collapse into one point (f104-119).

**2. ON THE MAP (120-239).** Downbeat: the point becomes the amber marker with a big sonar ping. The ping
ring reveals the map as it grows (a scan edge with a bright leading ring; contours, roads and river
inside, dark outside). Camera starts top-down and tight on the marker, pulls out and tilts back to
about 55° with a slow orbit; buildings extrude as the ring passes them. The heading line draws out.
Extract markers pop in on 8ths (f150-210) with typed labels. Headline "YOU'RE ON / THE MAP." (word per
beat), sub-line in mono "position + heading, straight from your screenshot". f225-239: whip pan with
motion blur.

**3. SQUAD (240-359).** Room code `ROOM · K7Q2XM` rolls in slot-machine style, one character locking per
16th. Three teammates drop from above the tilted map with coloured light trails, land with a ring and a
bounce on beats (f270, f285, f300), heading lines swing to their headings, labels type in. Thin measure
lines run from me to each with metres counting up. Headline "SO IS / YOUR SQUAD." (SQUAD in amber).

**4. THE APP (360-479).** The camera flattens to top-down while the real app window (the UI 02 layout)
builds around the map: icon rail slides in from the left (logo tile, Filters / Squad / Quests /
Settings), the 400 px Squad panel with the room code and three teammate rows (colour dot, name, metres,
"2s ago") staggers in, the map toolbar pops down the right edge, the status bar rises (coordinates,
heading, room, raid clock ticking). Then the whole window floats in 3D (rotateY -18° to -6°, soft
shadow, faint reflection). Callouts draw on with leader lines: "Live squad positions", "Heading lines",
"Extracts & quests", "Raid clock". f450-479: push into the toolbar's route button.

**5. MONTAGE (480-599).** Four hard cuts, one per beat, each a tight close-up with its own camera move,
an outlined giant word and a counter:
- f480 **ROUTE** 01/04: the dashed route draws from me to NORTH GATE, marching dashes, `412 m` rolling.
- f510 **QUESTS** 02/04: to-do checkboxes tick amber, green zone outlines draw, quest icons pop.
- f540 **MARK** 03/04: keycaps `ALT` + `V` press as a chord, a pin drops with a bounce: "Marked 14:32".
- f570 **DRAW** 04/04: a freehand stroke writes itself in NOMAD's colour. f585-599: a circular iris
  starts closing on the map.

**6. OVERLAY (600-719).** Downbeat, the biggest hit: the iris lands, the map is now the round minimap.
The compass bezel assembles: 72 minor ticks shoot in with a 1-frame stagger, 12 majors, N/E/S/W snap,
the heading box slides to 048°, teammate markers land on the ring at their bearings, raid timer and
distance chips step up the lower right of the rim, rim buttons pop round the lower left. Camera pulls
back: the minimap sits in the top-right corner of a dark, blurred, abstract "game" screen (fog, light
shafts, silhouettes; no real game footage). Headline "ALWAYS / ON TOP." Then heading-up: the ring and
map turn under the fixed heading box (048° to 0° box at 12 o'clock) with a whoosh.

**7. END CARD (720-899).** Downbeat, final hit: match cut. The bezel ring (heading box at 12 o'clock)
flies to centre and becomes the logo: amber ring, tick on top; the map inside fades out. "TARTRAK"
rises letter by letter out of a mask, tracking tightens, a light sweep crosses it. Tagline "The free
squad map for Escape from Tarkov". Badges pop on beats: FREE, OPEN SOURCE, BAN-SAFE (f780, f795, f810).
`github.com/cthpAiden/TarTrak` types in mono with a blinking cursor (f810-840). The logo sends one last
slow sonar ping (f840). Hold on the end card to the last frame (no fade to black: the last frame is the
thumbnail GitHub shows when the video stops).

## 6. Sound

120 BPM, 4/4, A minor. All synthesized: kick, sub/reese bass, clap, hats, dark pad (Am9), plucks (UI notes
tuned to the chord), risers (noise sweeps), impacts (sine drop + noise + reverb), whooshes (band-passed
noise, panned with the motion), key click, two-stage shutter, data chirps, sonar ping (E6 sine +
overtone, ping-pong echo), ticks, pops, pin thud, scribble, glitch stutter.

| Bar | Time | Music | Synced SFX |
|---|---|---|---|
| 1 | 0-2 s | Pad fades in, muffled 8th ticks | Key click 1.0, shutter 1.1, data chirps 1.2-1.75, short riser into 2.0 |
| 2 | 2-4 s | Drop: kick 4/4, bass 8ths, off-beat hats | Impact + sonar ping 2.0, extract pops on 8ths 2.5-3.5, whoosh 3.75 |
| 3 | 4-6 s | + clap on 2 and 4, light 16th hats | Code-roll ticks 4.0-4.75, teammate landings as plucks A4/C5/E5 + thuds 4.5/4.75/5.0 |
| 4 | 6-8 s | Groove | Impact-lite 6.0, UI assembly clicks 6.0-6.5, callout plucks 6.5-7.25, zoom riser 7.5-8.0 |
| 5 | 8-10 s | Groove, 16th hats | Hit + stab on each cut 8.0/8.5/9.0/9.5, per-cut SFX (dash ticks, check ticks, chord click + thud, scribble), riser 9.0-10.0 |
| 6 | 10-12 s | Drop 2 (biggest), crash | Bezel ratchet (72 ticks) 10.0-10.5, N/E/S/W stabs, chip pops, whoosh 11.0-11.5, riser + snare roll 11.25-12.0 |
| 7 | 12-15 s | Final hit + sub drop, drums stop, pad holds | Shimmer 12.1-12.6, badge plucks C5/E5/A5 13.0/13.25/13.5, typing 13.5-14.0, last sonar ping 14.0, silence by 15.0 |

Mix: kick ducks bass and pad; soft-clip the bus; master at about -14 LUFS integrated, true peak at or
below -1 dBTP (checked with ffmpeg `ebur128`).

## 7. Code layout (`promo/`)

- `src/index.ts`, `src/Root.tsx` (one composition `Showreel`, 1920x1080, 60 fps, 900 frames).
- `src/timeline.ts`: FPS, BPM, beat/bar helpers, shot ranges, cue list. No imports.
- `src/theme.ts`: palette, fonts, motion tokens.
- `src/lib/`: easing, spring presets, seeded random, stagger helpers.
- `src/components/`: HUD frame, grain, vignette, glitch, kinetic headline, keycap, shutter iris,
  scramble text, ping ring, player/teammate markers, heading line, bezel, app-window replica parts,
  callouts, logo.
- `src/world/`: map data (generated once, seeded), `World` component, camera math.
- `src/shots/`: one file per shot, `Shot1Snap.tsx` ... `Shot7End.tsx`.
- `src/Showreel.tsx`: sequences, persistent layers, `<Audio src={staticFile("score.wav")} />`.
- `audio/`: `dsp.ts` (oscillators, envelopes, biquads, noise, delay, reverb, WAV writer),
  `score.ts` (arrangement from the cue list), `build.ts` (writes `public/score.wav`).
- `scripts/`: web encode + poster + contact sheet (ffmpeg).

## 8. Checks

- `npx tsc --noEmit` clean in `promo/`.
- Stills of each shot at 2-3 frames (`npx remotion still`), looked at before the full render.
- Full render, then a contact sheet (one frame per half second) looked at as a whole for rhythm and
  consistency.
- Loudness and peak from `ebur128`; a waveform image lined up against the beat grid.
- Web copy under 10 MB. Final review of stills + contact sheet by a Fable agent.

## 9. Not in this job

Vertical cut, voice-over, real game footage, tarkov.dev map art, README changes (offered afterwards).
