<script lang="ts">
  import type { MapInfo } from "../quests/types";
  import { raidLine, summarizeBosses } from "./mapInfo";
  import Chevron from "../ui/Chevron.svelte";

  /** tarkov.dev's entry for the current map; nothing is drawn without one. */
  let { info }: { info: MapInfo | null } = $props();

  let open = $state(true);
  const bosses = $derived(info ? summarizeBosses(info.bosses ?? []) : []);
  const raid = $derived(info ? raidLine(info) : "");
  const keys = $derived(info?.accessKeys ?? []);
</script>

{#if info && (raid || keys.length > 0 || bosses.length > 0)}
  <div class="card">
    <div class="hdr">
      <button class="tri" aria-expanded={open} aria-label="Toggle map info" onclick={() => (open = !open)}>
        <Chevron {open} />
      </button>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <span class="label clickable" onclick={() => (open = !open)}>{info.name}</span>
      <span class="cnt">{raid}</span>
    </div>
    {#if open}
      {#if keys.length > 0}
        <p class="line">Entry needs {keys.length > 1 ? "one of: " : ""}{keys.join(", ")}</p>
      {/if}
      {#if bosses.length > 0}
        <ul class="bosses">
          {#each bosses as b (b.name)}
            <li>
              <!-- tarkov.dev's portrait, loaded from its asset host; offline, the name stands alone. -->
              {#if b.portrait}
                <img class="portrait" src={b.portrait} alt="" loading="lazy" onerror={(e) => ((e.currentTarget as HTMLImageElement).hidden = true)} />
              {/if}
              <span class="name">{b.name}</span>
              <span class="chance">{b.chance}%</span>
              {#if b.escorts}<span class="cnt">+{b.escorts} {b.escorts === 1 ? "guard" : "guards"}</span>{/if}
              {#if b.bySwitch}<span class="cnt" title="Spawned by a switch, not at raid start">switch</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .card { border-bottom: 1px solid #2a2f38; padding-bottom: 4px; }
  .hdr { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 3px 0; }
  .tri {
    background: none; border: none; color: var(--muted); cursor: pointer; padding: 0;
    width: 22px; height: 22px; display: grid; place-items: center; border-radius: 4px;
  }
  .tri:hover { background: rgba(255, 255, 255, 0.06); color: var(--fg); }
  .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .label.clickable { cursor: pointer; }
  .cnt { color: var(--muted); font-size: 11px; white-space: nowrap; }
  .line { margin: 0 0 2px 28px; font-size: 11px; color: var(--muted); }
  ul { list-style: none; margin: 0 0 2px; padding: 0 0 0 28px; }
  li { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 0; }
  .portrait { width: 18px; height: 18px; border-radius: 3px; object-fit: cover; flex: none; }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chance { font-variant-numeric: tabular-nums; }
</style>
