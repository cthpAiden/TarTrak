<script lang="ts">
  import { untrack } from "svelte";
  import { normalizeHotkey } from "../tauri/window";
  import {
    DEFAULT_RELAY_URL,
    FACTIONS,
    FACTION_LABELS,
    MINIMAP_ROTATIONS,
    MINIMAP_SIZE_MAX,
    MINIMAP_SIZE_MIN,
    OVERLAY_SHAPES,
    type Faction,
    type Settings,
  } from "./store";
  import { GAME_MODES, GAME_MODE_LABELS, type GameMode } from "../quests/jsonSource";
  import { MARK_KEY_OFF, PRINT_SCREEN_VK, markKeyFromButton, markKeyFromCode, markKeyLabel } from "./markKey";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { version } from "../../../package.json";

  /** The webview opens no new windows on its own; links go to the system browser. */
  function external(e: MouseEvent) {
    e.preventDefault();
    const href = (e.currentTarget as HTMLAnchorElement).href;
    openUrl(href).catch((err) => onInvalid?.(`Could not open ${href}: ${err}`));
  }

  let { settings, onChange, onPickDir, onInvalid, onCheckUpdate, shotKey = "PrintScreen" }: {
    settings: Settings;
    onChange: (patch: Partial<Settings>) => void;
    onPickDir: (kind: "screenshots" | "logs") => void;
    onInvalid?: (msg: string) => void;
    onCheckUpdate?: () => void;
    /** The game's screenshot key as read from its log, for display. */
    shotKey?: string;
  } = $props();

  /** An unparseable hotkey would be stored and the key would then silently stop working. */
  function commitHotkey(which: "hotkeyOverlay" | "hotkeyOpacity" | "hotkeyHide", raw: string) {
    const text = raw.trim();
    // Empty is the way to unbind a key, so only a non-empty string can be invalid.
    if (text !== "" && normalizeHotkey(text) === null) {
      onInvalid?.(`Invalid hotkey: ${text}`);
      return;
    }
    onChange({ [which]: text });
  }

  // untrack: these are the editable copies, seeded once from the stored settings.
  let relay = $state(untrack(() => settings.relayUrl));

  /** A blank field means "back to the project relay", not a relay at an empty address. */
  function commitRelay() {
    const next = relay.trim() || DEFAULT_RELAY_URL;
    relay = next;
    if (next !== settings.relayUrl) onChange({ relayUrl: next });
  }
  let overlayKey = $state(untrack(() => settings.hotkeyOverlay));
  let opacityKey = $state(untrack(() => settings.hotkeyOpacity));
  let hideKey = $state(untrack(() => settings.hotkeyHide));
  let lineLen = $state(untrack(() => settings.lineLengthM));

  /** While true, the next key or mouse button pressed anywhere becomes the mark-here key. */
  let capturing = $state(false);

  function bindKey(vk: number) {
    capturing = false;
    onChange({ markKeyVk: vk });
  }

  function captureKey(e: KeyboardEvent) {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    if (e.code === "Escape") {
      capturing = false;
      return;
    }
    if (e.code === "Backspace" || e.code === "Delete") {
      bindKey(MARK_KEY_OFF);
      return;
    }
    const key = markKeyFromCode(e.code);
    if (!key) {
      onInvalid?.(`Cannot bind ${e.code || "that key"}`);
      return;
    }
    if (key.vk === PRINT_SCREEN_VK) {
      onInvalid?.("PrintScreen is a screenshot key; pick another key to hold");
      return;
    }
    bindKey(key.vk);
  }



  /** The mouse button just bound, whose mouseup and auxclick still have to be swallowed. */
  let boundButton = -1;

  function captureButton(e: MouseEvent) {
    if (!capturing) return;
    // The capture button's own click toggles the capture; its mousedown must not end it first.
    if ((e.target as Element | null)?.closest?.(".capture")) return;
    const key = markKeyFromButton(e.button);
    // A left or right click on anything else just ends the capture.
    if (!key) {
      capturing = false;
      if (e.button === 2) e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    boundButton = e.button;
    bindKey(key.vk);
  }

  /** The webview would otherwise treat the side button just bound as browser back or forward. */
  function swallowButton(e: MouseEvent) {
    if (e.button !== boundButton) return;
    e.preventDefault();
    if (e.type === "auxclick") boundButton = -1;
  }

  function swallowContextMenu(e: Event) {
    if (capturing) e.preventDefault();
  }
</script>

<svelte:window
  onkeydown={captureKey}
  onmousedown={captureButton}
  onmouseup={swallowButton}
  onauxclick={swallowButton}
  oncontextmenu={swallowContextMenu}
/>

<section class="panel settings">
  <h2>Settings</h2>

  <section class="group" aria-labelledby="set-h-overlay">
    <h3 id="set-h-overlay">Overlay</h3>
    <div class="card">
      <div class="row">
        <span id="set-shape-l">Overlay shape</span>
        <div class="seg" role="radiogroup" aria-labelledby="set-shape-l">
          {#each OVERLAY_SHAPES as shape (shape)}
            <button type="button" role="radio" aria-checked={settings.overlayShape === shape} onclick={() => onChange({ overlayShape: shape })}>
              {shape === "circle" ? "Circle" : "Box"}
            </button>
          {/each}
        </div>
      </div>
      {#if settings.overlayShape === "circle"}
        <div class="row stack">
          <div class="row">
            <span id="set-rot-l">Minimap rotation</span>
            <div class="seg" role="radiogroup" aria-labelledby="set-rot-l">
              {#each MINIMAP_ROTATIONS as rot (rot)}
                <button type="button" role="radio" aria-checked={settings.minimapRotation === rot} onclick={() => onChange({ minimapRotation: rot })}>
                  {rot === "north" ? "North-up" : "Heading-up"}
                </button>
              {/each}
            </div>
          </div>
          <span class="hint">Heading-up turns the map at each screenshot</span>
        </div>
        <div class="row">
          <label for="set-size">Minimap size</label>
          <input
            id="set-size"
            type="range"
            min={MINIMAP_SIZE_MIN}
            max={MINIMAP_SIZE_MAX}
            step="10"
            value={settings.minimapSize}
            onchange={(e) => onChange({ minimapSize: Number(e.currentTarget.value) })}
          />
          <span class="val mono">{settings.minimapSize} px</span>
        </div>
        <div class="row">
          <label for="set-bezel">Compass bezel</label>
          <input id="set-bezel" class="switch" type="checkbox" checked={settings.compassBezel} onchange={(e) => onChange({ compassBezel: e.currentTarget.checked })} />
        </div>
        <div class="row">
          <label for="set-rim" title="Off shows the buttons around the minimap only while the mouse is over it">Tool buttons on the rim</label>
          <input id="set-rim" class="switch" type="checkbox" checked={settings.rimTools} onchange={(e) => onChange({ rimTools: e.currentTarget.checked })} />
        </div>
      {/if}
      <div class="row">
        <label for="set-raid-timer" title="Time left in the raid, counted from the moment the log says the raid started. PMC raids only: a Scav raid joins late and reads too high.">Raid timer</label>
        <input id="set-raid-timer" class="switch" type="checkbox" checked={settings.raidTimer} onchange={(e) => onChange({ raidTimer: e.currentTarget.checked })} />
      </div>
      <div class="row place">
        <span class="screen" aria-hidden="true"><span class:round={settings.overlayShape === "circle"}></span></span>
        <span class="hint">Needs the game in borderless windowed mode. Alt+drag moves the overlay; park it in a corner.</span>
      </div>
    </div>
  </section>

  <section class="group" aria-labelledby="set-h-keys">
    <h3 id="set-h-keys">Hotkeys</h3>
    <div class="card">
      <div class="row">
        <label for="set-hk-overlay">Overlay</label>
        <input id="set-hk-overlay" class="key" bind:value={overlayKey} onblur={() => commitHotkey("hotkeyOverlay", overlayKey)} placeholder="F5" />
      </div>
      <div class="row">
        <label for="set-hk-opacity">Opacity</label>
        <input id="set-hk-opacity" class="key" bind:value={opacityKey} onblur={() => commitHotkey("hotkeyOpacity", opacityKey)} placeholder="F6" />
      </div>
      <div class="row">
        <label for="set-hk-hide" title="Hides the whole window, so it is out of the way while you loot. The same key brings it back. Empty unbinds it.">Hide</label>
        <input id="set-hk-hide" class="key" bind:value={hideKey} onblur={() => commitHotkey("hotkeyHide", hideKey)} placeholder="F7" />
      </div>
      <div class="row">
        <label for="set-mark-key" title="Hold this key and press the game's screenshot key: a private marker drops where you stand. Nothing happens on either key alone. Backspace turns it off.">Mark-here key</label>
        <button id="set-mark-key" type="button" class="capture key" class:capturing onclick={() => (capturing = !capturing)}>
          {capturing ? "Press a key…" : markKeyLabel(settings.markKeyVk)}
        </button>
      </div>
      <div class="row">
        <span title="The key the game takes screenshots with, read from the game's log when it starts. Change it in the game's controls, not here.">Screenshot key</span>
        <span class="small muted ro" data-testid="shot-key">{shotKey}</span>
      </div>
    </div>
  </section>

  <section class="group" aria-labelledby="set-h-game">
    <h3 id="set-h-game">Game</h3>
    <div class="card">
      <div class="row">
        <label for="set-mode">Game mode</label>
        <select id="set-mode" value={settings.gameMode} onchange={(e) => onChange({ gameMode: e.currentTarget.value as GameMode })}>
          {#each GAME_MODES as m (m)}
            <option value={m}>{GAME_MODE_LABELS[m]}</option>
          {/each}
        </select>
      </div>
      <div class="row">
        <label for="set-faction" title="Quests only the other faction gets are hidden">PMC faction</label>
        <select id="set-faction" value={settings.faction} onchange={(e) => onChange({ faction: e.currentTarget.value as Faction })}>
          {#each FACTIONS as f (f)}
            <option value={f}>{FACTION_LABELS[f]}</option>
          {/each}
        </select>
      </div>
      <div class="row">
        <label for="set-line">Heading line (m, max 125)</label>
        <input id="set-line" class="num" type="number" min="5" max="125" bind:value={lineLen} onchange={() => onChange({ lineLengthM: Number(lineLen) || 125 })} />
      </div>
    </div>
  </section>

  <section class="group" aria-labelledby="set-h-folders">
    <h3 id="set-h-folders">Folders</h3>
    <div class="card">
      <div class="row">
        <div class="dir">
          <span>Screenshots</span>
          <code title={settings.screenshotsDir ?? ""}>{settings.screenshotsDir ?? "not set"}</code>
        </div>
        <button type="button" class="browse" aria-label="Choose screenshot folder" onclick={() => onPickDir("screenshots")}>Browse</button>
      </div>
      <div class="row">
        <div class="dir">
          <span>Game logs</span>
          <code title={settings.logsDir ?? ""}>{settings.logsDir ?? "not set"}</code>
        </div>
        <button type="button" class="browse" aria-label="Choose game log folder" onclick={() => onPickDir("logs")}>Browse</button>
      </div>
      <div class="row">
        <label for="set-delete">Delete screenshots after reading</label>
        <input id="set-delete" class="switch" type="checkbox" checked={settings.deleteScreenshots} onchange={(e) => onChange({ deleteScreenshots: e.currentTarget.checked })} />
      </div>
    </div>
  </section>

  <section class="group" aria-labelledby="set-h-squad">
    <h3 id="set-h-squad">Squad relay</h3>
    <div class="card">
      <div class="row">
        <input id="set-relay" class="wide" aria-label="Relay URL" bind:value={relay} onblur={commitRelay} placeholder={DEFAULT_RELAY_URL} />
      </div>
    </div>
  </section>

  <details>
    <summary>About</summary>
    <p class="small">
      TarTrak is free and open source (MIT). It only reads screenshot filenames and the game's text logs.
      Map images: <a href="https://github.com/the-hideout/tarkov-dev-svg-maps" onclick={external}>tarkov-dev-svg-maps</a> (CC BY-NC-SA 4.0).
      Map math and quest data: <a href="https://tarkov.dev" onclick={external}>tarkov.dev</a> (MIT). Not affiliated with Battlestate Games.
      Source and issues: <a href="https://github.com/cthpAiden/TarTrak" onclick={external}>github.com/cthpAiden/TarTrak</a>.
    </p>
    <p class="small">
      TarTrak {version} · updates are checked at every start.
      <button type="button" class="check-update" onclick={onCheckUpdate}>Check for updates</button>
    </p>
  </details>
</section>

<style>
  .settings { display: flex; flex-direction: column; gap: 14px; }
  .group { display: flex; flex-direction: column; gap: 6px; }
  h3 { margin: 0; }
  .card { display: flex; flex-direction: column; background: var(--raised); border: 1px solid var(--line); border-radius: 10px; padding: 0 12px; }
  .row { display: flex; align-items: center; gap: 10px; min-height: 40px; justify-content: space-between; }
  .card > .row + .row, .card > .row + .stack, .card > .stack + .row { border-top: 1px solid #242b34; }
  .row.stack { flex-direction: column; align-items: stretch; gap: 0; padding: 6px 0; }
  .row.stack .row { min-height: 30px; }
  .hint { font-size: 11.5px; color: var(--muted); }
  .seg { display: flex; gap: 2px; padding: 2px; background: #0f1216; border-radius: 8px; }
  .seg button {
    height: 26px; padding: 0 10px; background: none; color: var(--muted); border: 0; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;
  }
  .seg button[aria-checked="true"] { background: var(--raised-2); color: var(--fg); font-weight: 600; }
  input[type="range"] { flex: 1; min-width: 0; }
  .val { min-width: 52px; text-align: right; font-size: 12px; color: var(--fg-2); }
  .key {
    width: 96px; box-sizing: border-box; text-align: center; font-family: var(--mono); font-size: 12px;
    background: #0f1216; color: var(--fg); border: 1px solid var(--line-2); border-bottom-width: 2px; border-radius: 6px; padding: 4px 6px; cursor: text;
  }
  button.key { cursor: pointer; }
  .capture.capturing { border-color: var(--accent); color: var(--accent); }
  .ro { font-family: var(--mono); text-align: right; }
  select { min-width: 110px; }
  .num { width: 72px; box-sizing: border-box; }
  .wide { flex: 1; min-width: 0; font-family: var(--mono); font-size: 12px; }
  .dir { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding: 6px 0; }
  .dir code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .browse, .check-update {
    background: var(--raised-2); color: var(--fg); border: 1px solid var(--line-2); border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer;
  }
  .browse:hover, .check-update:hover { border-color: var(--accent); }
  .place { justify-content: flex-start; padding: 8px 0; }
  .screen { position: relative; flex: none; width: 56px; height: 32px; border: 1.5px solid var(--line-2); border-radius: 4px; background: #0f1216; }
  .screen span { position: absolute; right: 3px; bottom: 3px; width: 16px; height: 9px; border-radius: 2px; background: var(--accent); }
  .screen span.round { top: 3px; bottom: auto; width: 12px; height: 12px; border-radius: 50%; }
  .small { font-size: 11.5px; }
  .muted { color: var(--muted); }
  details { font-size: 12px; color: var(--fg-2); }
  summary { cursor: pointer; color: var(--muted); }
  a { color: var(--accent); }
</style>
