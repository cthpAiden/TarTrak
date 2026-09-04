<script lang="ts">
  import { untrack } from "svelte";
  import { room } from "./controller.svelte";
  import { generateRoomCode, isValidRoomCode } from "./protocol";
  import type { Settings } from "../settings/store";

  let { settings, onSettingsChange }: { settings: Settings; onSettingsChange: (patch: Partial<Settings>) => void } =
    $props();

  // untrack: these are the editable copies, seeded once from the stored settings.
  let code = $state(untrack(() => settings.lastRoom));
  let name = $state(untrack(() => settings.name));
  let color = $state(untrack(() => settings.color));

  const codeOk = $derived(isValidRoomCode(code.toUpperCase()));

  function persist() {
    onSettingsChange({ name, color, lastRoom: code.toUpperCase() });
  }
  function create() {
    code = generateRoomCode();
    join();
  }
  function join() {
    if (!codeOk) return;
    persist();
    room.join(code, name, color, settings.relayUrl);
  }
</script>

<section class="panel">
  <h2>Room</h2>
  <label>Name <input maxlength="32" bind:value={name} onblur={persist} /></label>
  <label>Color <input type="color" bind:value={color} onchange={persist} /></label>
  <label>
    Code <input maxlength="6" bind:value={code} oninput={() => (code = code.toUpperCase())} placeholder="ABC123" />
  </label>
  <div class="row">
    {#if room.code}
      <button onclick={() => room.leave()}>Leave {room.code}</button>
    {:else}
      <button onclick={join} disabled={!codeOk}>Join</button>
      <button onclick={create}>Create</button>
    {/if}
    <span class="dot {room.status}" title={room.status}></span>
    <span class="muted">{room.status}</span>
  </div>
</section>

<style>
  .panel { padding: 10px; border-bottom: 1px solid #2a2f38; display: flex; flex-direction: column; gap: 6px; }
  h2 { margin: 0 0 4px; font-size: 14px; }
  label { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; }
  input { background: #2a2f38; color: var(--fg); border: 1px solid #3a4048; padding: 3px 6px; width: 150px; }
  input[type="color"] { width: 40px; padding: 0; height: 24px; }
  .row { display: flex; gap: 8px; align-items: center; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #c33; display: inline-block; }
  .dot.open { background: #3c3; }
  .dot.connecting { background: #cc3; }
</style>
