<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { room } from "./controller.svelte";
  import { generateRoomCode, isValidRoomCode } from "./protocol";
  import { squadRows, type SquadRow } from "./squad";
  import { app } from "../state/app.svelte";
  import { getMapDef } from "../map/mapsData";
  import type { Settings } from "../settings/store";

  let {
    settings,
    onSettingsChange,
    onFocus,
  }: {
    settings: Settings;
    onSettingsChange: (patch: Partial<Settings>) => void;
    onFocus: (id: string) => void;
  } = $props();

  // untrack: these are the editable copies, seeded once from the stored settings.
  let code = $state(untrack(() => settings.lastRoom));
  let name = $state(untrack(() => settings.name));
  let color = $state(untrack(() => settings.color));

  const codeOk = $derived(isValidRoomCode(code.toUpperCase()));

  // While we are still in a room, a dropped socket is a retry in progress, not a resting state.
  const statusText = $derived(room.code && room.status === "closed" ? "reconnecting" : room.status);

  /** Ticks once a second so the ages in the squad list stay current. */
  let now = $state(Date.now());
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  onMount(() => {
    const tick = setInterval(() => (now = Date.now()), 1000);
    return () => {
      clearInterval(tick);
      if (copyTimer) clearTimeout(copyTimer);
    };
  });

  /** Clipboard access can be denied, so the fallback tells the user to copy the code by hand. */
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code!);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1500);
    } catch {
      app.toast("Copy failed: select the code and press Ctrl+C");
    }
  }

  const rows = $derived(
    squadRows(
      Object.values(app.teammates),
      { map: app.currentMap, pos: app.ownPos ? { x: app.ownPos.x, z: app.ownPos.z } : null },
      now,
      (k) => getMapDef(k)?.name ?? null,
    ),
  );

  function where(r: SquadRow): string {
    if (r.noPosition) return "no position yet";
    if (r.sameMap) return r.distanceM !== null ? `${r.distanceM} m` : r.mapUnknown ? "map unknown" : "same map";
    return r.mapName ?? "elsewhere";
  }
  function rowTitle(r: SquadRow): string {
    if (r.noPosition) return `${r.name} has not taken a screenshot yet`;
    if (r.mapUnknown) return `${r.name} has no map detected; shown on your map`;
    return r.sameMap ? `Centre the map on ${r.name}` : "";
  }

  /** The relay accepts any string as a colour, so never let one reach a style attribute unchecked. */
  function swatch(c: string): string {
    return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#888888";
  }

  /** The code is persisted only on join, so a half-typed one is never stored. */
  function persistIdentity() {
    onSettingsChange({ name, color });
  }
  function create() {
    code = generateRoomCode();
    join();
  }
  function join() {
    if (!codeOk) return;
    onSettingsChange({ name, color, lastRoom: code.toUpperCase() });
    room.join(code, name, color, settings.relayUrl);
  }
</script>

<section class="panel">
  <h2>Room</h2>
  <label>Name <input maxlength="32" bind:value={name} onblur={persistIdentity} /></label>
  <label>Color <input type="color" bind:value={color} onchange={persistIdentity} /></label>
  {#if room.code}
    <div class="code-row">
      <span class="code">{room.code}</span>
      <button onclick={copyCode}>{copied ? "Copied" : "Copy"}</button>
    </div>
  {:else}
    <label>
      Code <input maxlength="6" bind:value={code} oninput={() => (code = code.toUpperCase())} placeholder="ABC123" />
    </label>
  {/if}
  <div class="row">
    {#if room.code}
      <button onclick={() => room.leave()}>Leave</button>
    {:else}
      <button onclick={join} disabled={!codeOk}>Join</button>
      <button onclick={create}>Create</button>
    {/if}
    <span class="dot {room.status}" title={statusText}></span>
    <span class="muted">{statusText}</span>
  </div>

  {#if room.code}
    <h3>Squad</h3>
    {#if rows.length === 0}
      <p class="muted small">No teammates yet</p>
    {:else}
      <ul class="squad">
        {#each rows as r (r.id)}
          <li>
            <button class="mate" disabled={!r.sameMap} title={rowTitle(r)} onclick={() => onFocus(r.id)}>
              <span class="swatch" style="background: {swatch(r.color)}"></span>
              <span class="mate-name">{r.name}</span>
              <span class="muted">{where(r)}</span>
              <span class="muted age">{r.noPosition ? "" : `${r.ageSec}s`}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .panel { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
  h2 { margin: 0 0 4px; font-size: 14px; }
  label { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; }
  input { background: #2a2f38; color: var(--fg); border: 1px solid #3a4048; padding: 3px 6px; width: 150px; }
  input[type="color"] { width: 40px; padding: 0; height: 24px; }
  .row { display: flex; gap: 8px; align-items: center; }
  .code-row { display: flex; gap: 8px; align-items: center; }
  .code { flex: 1; font-family: ui-monospace, Consolas, monospace; font-size: 20px; letter-spacing: 0.12em; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #c33; display: inline-block; }
  .dot.open { background: #3c3; }
  .dot.connecting { background: #cc3; }
  h3 { margin: 6px 0 0; font-size: 13px; }
  .squad { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .mate {
    width: 100%; display: grid; grid-template-columns: 10px 1fr auto auto; gap: 6px;
    align-items: center; text-align: left; font-size: 12px; padding: 2px 4px;
  }
  .mate:disabled { cursor: default; }
  .mate-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .swatch { width: 10px; height: 10px; border-radius: 50%; }
  .age { min-width: 34px; text-align: right; }
  .small { font-size: 11px; }
</style>
