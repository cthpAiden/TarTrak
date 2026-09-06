<script lang="ts">
  import { untrack } from "svelte";
  import { normalizeHotkey } from "../tauri/window";
  import { DEFAULT_RELAY_URL, FACTIONS, FACTION_LABELS, type Faction, type Settings } from "./store";
  import { GAME_MODES, GAME_MODE_LABELS, type GameMode } from "../quests/jsonSource";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { version } from "../../../package.json";

  /** The webview opens no new windows on its own; links go to the system browser. */
  function external(e: MouseEvent) {
    e.preventDefault();
    const href = (e.currentTarget as HTMLAnchorElement).href;
    openUrl(href).catch((err) => onInvalid?.(`Could not open ${href}: ${err}`));
  }

  let { settings, onChange, onPickDir, onInvalid, onCheckUpdate }: {
    settings: Settings;
    onChange: (patch: Partial<Settings>) => void;
    onPickDir: (kind: "screenshots" | "logs") => void;
    onInvalid?: (msg: string) => void;
    onCheckUpdate?: () => void;
  } = $props();

  /** An unparseable hotkey would be stored and the key would then silently stop working. */
  function commitHotkey(which: "hotkeyOverlay" | "hotkeyOpacity", raw: string) {
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
  let lineLen = $state(untrack(() => settings.lineLengthM));
</script>

<section class="panel">
  <h2>Settings</h2>
    <div class="grid">
      <span>Screenshots</span>
      <div class="dir">
        <code title={settings.screenshotsDir ?? ""}>{settings.screenshotsDir ?? "not set"}</code>
        <button aria-label="Choose screenshot folder" onclick={() => onPickDir("screenshots")}>…</button>
      </div>

      <span>Game logs</span>
      <div class="dir">
        <code title={settings.logsDir ?? ""}>{settings.logsDir ?? "not set"}</code>
        <button aria-label="Choose game log folder" onclick={() => onPickDir("logs")}>…</button>
      </div>

      <label for="set-delete">Delete screenshots</label>
      <input
        id="set-delete"
        type="checkbox"
        checked={settings.deleteScreenshots}
        onchange={(e) => onChange({ deleteScreenshots: e.currentTarget.checked })}
      />

      <label for="set-mode">Game mode</label>
      <select
        id="set-mode"
        value={settings.gameMode}
        onchange={(e) => onChange({ gameMode: e.currentTarget.value as GameMode })}
      >
        {#each GAME_MODES as m (m)}
          <option value={m}>{GAME_MODE_LABELS[m]}</option>
        {/each}
      </select>

      <label for="set-faction" title="Quests only the other faction gets are hidden">PMC faction</label>
      <select id="set-faction" value={settings.faction} onchange={(e) => onChange({ faction: e.currentTarget.value as Faction })}>
        {#each FACTIONS as f (f)}
          <option value={f}>{FACTION_LABELS[f]}</option>
        {/each}
      </select>

      <label for="set-relay">Relay URL</label>
      <input id="set-relay" bind:value={relay} onblur={commitRelay} placeholder={DEFAULT_RELAY_URL} />

      <label for="set-hk-overlay">Overlay hotkey</label>
      <input
        id="set-hk-overlay"
        bind:value={overlayKey}
        onblur={() => commitHotkey("hotkeyOverlay", overlayKey)}
        placeholder="F5"
      />

      <label for="set-hk-opacity">Opacity hotkey</label>
      <input
        id="set-hk-opacity"
        bind:value={opacityKey}
        onblur={() => commitHotkey("hotkeyOpacity", opacityKey)}
        placeholder="F6"
      />

      <label for="set-line">Heading line (m, max 125)</label>
      <input
        id="set-line"
        type="number"
        min="5"
        max="125"
        bind:value={lineLen}
        onchange={() => onChange({ lineLengthM: Number(lineLen) || 125 })}
      />
    </div>
    <p class="muted small">Overlay mode needs the game in borderless windowed mode. Alt+drag moves the overlay.</p>
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
  .panel { padding: 10px; font-size: 13px; }
  h2 { margin: 0 0 4px; font-size: 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 6px 8px; align-items: center; margin-top: 4px; }
  .dir { display: flex; gap: 4px; min-width: 0; }
  .dir code { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
  input, select { background: #2a2f38; color: var(--fg); border: 1px solid #3a4048; padding: 3px 6px; min-width: 0; }
  input[type="checkbox"] { justify-self: start; }
  .small { font-size: 11px; }
  a { color: var(--accent); }
</style>
