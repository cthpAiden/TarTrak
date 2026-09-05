<script lang="ts">
  import { app } from "../state/app.svelte";
  import { toggleDone, saveDone } from "./done";
  import { groupByTrader } from "./grouping";
  import type { QuestMarker } from "./markers";
  import Chevron from "../ui/Chevron.svelte";
  import { GAME_MODE_LABELS, type GameMode } from "./jsonSource";
  import { openUrl } from "@tauri-apps/plugin-opener";

  let {
    markers,
    gameMode,
    playerLevel,
    onPlayerLevel,
    availableOnly,
    onAvailableOnly,
    hiddenQuests,
    onHiddenChange,
  }: {
    markers: QuestMarker[];
    gameMode: GameMode;
    playerLevel: number;
    onPlayerLevel: (n: number) => void;
    availableOnly: boolean;
    onAvailableOnly: (on: boolean) => void;
    hiddenQuests: Record<string, true>;
    onHiddenChange: (h: Record<string, true>) => void;
  } = $props();

  let search = $state("");
  let hideDone = $state(true);
  let kappaOnly = $state(false);
  let collapsed = $state<Record<string, boolean>>({});

  const groups = $derived.by(() => {
    const data = app.questData;
    if (!data) return [];
    const countsOnMap = new Map<string, number>();
    // Done tasks have no markers on the map, so they must not be counted here either.
    for (const m of markers) {
      if (m.mapKey === app.currentMap && !app.doneQuests[m.taskId]) {
        countsOnMap.set(m.taskId, (countsOnMap.get(m.taskId) ?? 0) + 1);
      }
    }
    return groupByTrader(data.tasks, {
      search,
      hideDone,
      availableOnly,
      kappaOnly,
      playerLevel,
      done: app.doneQuests,
      countsOnMap,
    });
  });

  function toggle(id: string) {
    app.setDone(toggleDone(app.doneQuests, id));
    // Saving on top of a done set that never loaded would replace the stored file with this one id.
    if (!app.doneLoaded) {
      app.toast("Quest progress not loaded, not saving");
      return;
    }
    saveDone(app.doneQuests).catch((e) => app.toast(`Could not save quest progress: ${e}`));
  }

  function openWiki(url: string) {
    openUrl(url).catch((e) => app.toast(`Could not open the wiki: ${e}`));
  }

  function flipHidden(id: string) {
    const next = { ...hiddenQuests };
    if (next[id]) delete next[id];
    else next[id] = true;
    onHiddenChange(next);
  }

  const dataDate = $derived(app.questData ? new Date(app.questData.fetchedAt).toLocaleDateString() : "");
</script>

<section class="panel quests">
  <h2>Quests</h2>
  <div class="row">
    <input class="search" aria-label="Search quests" placeholder="Search" bind:value={search} />
    <label title="Your PMC level (0 = show all)">
      Lvl
      <input
        type="number"
        min="0"
        max="79"
        value={playerLevel}
        onchange={(e) => {
          // A non-numeric paste yields NaN, which would hide every quest marker.
          const n = Number(e.currentTarget.value);
          onPlayerLevel(Number.isFinite(n) ? Math.max(0, Math.min(79, n)) : 0);
        }}
      />
    </label>
  </div>
  <div class="row toggles">
    <label><input type="checkbox" bind:checked={hideDone} /> hide done</label>
    <label title="Only quests whose prerequisite quests you have marked done; also hides their markers">
      <input type="checkbox" checked={availableOnly} onchange={(e) => onAvailableOnly(e.currentTarget.checked)} /> available
    </label>
    <label title="Only quests needed for the Kappa container"><input type="checkbox" bind:checked={kappaOnly} /> Kappa</label>
  </div>
  {#if !app.questData}
    <p class="muted">No quest data yet.</p>
  {:else}
    <div class="list">
      {#each groups as g (g.trader)}
        <div class="trader">
          <button class="hdr" onclick={() => (collapsed[g.trader] = !collapsed[g.trader])} aria-expanded={!collapsed[g.trader]}>
            <span class="tri"><Chevron open={!collapsed[g.trader]} /></span>{g.trader}<span class="cnt">{g.done}/{g.total}</span>
          </button>
          {#if !collapsed[g.trader]}
            <ul>
              {#each g.tasks as { t, count } (t.id)}
                <li class:done={app.doneQuests[t.id]} class:hidden={hiddenQuests[t.id]}>
                  <input
                    type="checkbox"
                    aria-label="Mark {t.name} done"
                    checked={!!app.doneQuests[t.id]}
                    onchange={() => toggle(t.id)}
                  />
                  <span class="name">
                    {t.name}
                    {#if t.kappaRequired}<span class="badge" title="Needed for Kappa">κ</span>{/if}
                    {#if t.lightkeeperRequired}<span class="badge" title="Needed for Lightkeeper">LK</span>{/if}
                  </span>
                  {#if t.wikiLink}
                    <button class="wiki" title="Open on the wiki" aria-label="Open {t.name} on the wiki" onclick={() => openWiki(t.wikiLink!)}>?</button>
                  {/if}
                  <button
                    class="eye"
                    aria-pressed={!!hiddenQuests[t.id]}
                    title={hiddenQuests[t.id] ? "Show on map" : "Hide on map"}
                    onclick={() => flipHidden(t.id)}>{hiddenQuests[t.id] ? "◌" : "◉"}</button
                  >
                  <span class="meta">
                    lvl {t.minPlayerLevel}{#if count} · {count} here{/if}{#if t.neededKeys?.length} · keys: {t.neededKeys.join(", ")}{/if}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </div>
    <p class="muted footer">{GAME_MODE_LABELS[gameMode]} data: {app.questSource} · {dataDate}</p>
  {/if}
</section>

<style>
  .panel { padding: 10px; display: flex; flex-direction: column; gap: 6px; min-height: 0; flex: 1; }
  h2 { margin: 0 0 4px; font-size: 14px; }
  .row { display: flex; gap: 6px; align-items: center; font-size: 12px; }
  .row .search { flex: 1; min-width: 0; }
  .toggles { flex-wrap: wrap; column-gap: 10px; }
  .toggles label { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
  .badge {
    display: inline-block; margin-left: 4px; padding: 0 4px; border-radius: 3px; font-size: 10px; line-height: 14px;
    vertical-align: 1px; background: #2a2f38; color: var(--accent); border: 1px solid #3a4048;
  }
  input { background: #2a2f38; color: var(--fg); border: 1px solid #3a4048; padding: 3px 6px; }
  input[type="number"] { width: 48px; }
  .list { overflow-y: auto; flex: 1; }
  .hdr {
    display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none;
    color: var(--fg); font-size: 13px; text-align: left; padding: 5px 0; cursor: pointer;
  }
  .hdr .tri { color: var(--muted); width: 22px; height: 22px; display: grid; place-items: center; border-radius: 4px; }
  .hdr:hover .tri { background: rgba(255, 255, 255, 0.06); color: var(--fg); }
  .hdr .cnt { margin-left: auto; color: var(--muted); font-size: 11px; }
  ul { list-style: none; margin: 0; padding: 0 0 0 18px; }
  li { display: grid; grid-template-columns: auto 1fr auto auto; column-gap: 6px; padding: 4px 0; border-bottom: 1px solid #262b33; font-size: 13px; }
  li .meta { grid-row: 2; grid-column: 2; color: var(--muted); font-size: 11px; }
  li.done .name { text-decoration: line-through; color: var(--muted); }
  li.hidden .name { opacity: .5; }
  .eye, .wiki { background: none; border: none; color: var(--muted); cursor: pointer; padding: 0 2px; font-size: 12px; }
  .wiki { font-weight: 600; }
  .wiki:hover, .eye:hover { color: var(--fg); }
  .footer { margin: 0; font-size: 11px; }
</style>
