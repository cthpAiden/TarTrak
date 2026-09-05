<script lang="ts">
  import { app } from "../state/app.svelte";
  import { toggleDone, saveDone } from "./done";
  import { groupByTrader } from "./grouping";
  import type { QuestMarker } from "./markers";
  import type { QuestTask } from "./types";
  import { getMapDef } from "../map/mapsData";
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
    todoQuests,
    onTodoChange,
    shareTodo,
    onShareTodo,
  }: {
    markers: QuestMarker[];
    gameMode: GameMode;
    playerLevel: number;
    onPlayerLevel: (n: number) => void;
    availableOnly: boolean;
    onAvailableOnly: (on: boolean) => void;
    /** My to-do list: the quests whose markers are on the map. */
    todoQuests: Record<string, true>;
    onTodoChange: (t: Record<string, true>) => void;
    /** Send my to-do list to the squad room, so teammates see those markers too. */
    shareTodo: boolean;
    onShareTodo: (on: boolean) => void;
  } = $props();

  let search = $state("");
  let kappaOnly = $state(false);
  let allMaps = $state(false);
  let collapsed = $state<Record<string, boolean>>({});

  const mapName = $derived(app.currentMap ? (getMapDef(app.currentMap)?.name ?? app.currentMap) : null);

  // Markers per task on the current map; done tasks have none on the map, so none here either.
  const countsOnMap = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const m of markers) {
      if (m.mapKey === app.currentMap && !app.doneQuests[m.taskId]) counts.set(m.taskId, (counts.get(m.taskId) ?? 0) + 1);
    }
    return counts;
  });

  const byId = $derived(new Map((app.questData?.tasks ?? []).map((t) => [t.id, t])));

  /** The finder: quests with a marker on this map (or everywhere with "all maps"), done ones left out. */
  const groups = $derived.by(() => {
    const data = app.questData;
    if (!data) return [];
    return groupByTrader(data.tasks, {
      search,
      hideDone: true,
      availableOnly,
      kappaOnly,
      playerLevel,
      done: app.doneQuests,
      countsOnMap,
      onMapOnly: app.currentMap !== null && !allMaps,
    });
  });

  /** My list, quests with markers on this map first. */
  const mine = $derived.by(() => {
    const out: { t: QuestTask; count: number }[] = [];
    for (const id of Object.keys(todoQuests)) {
      const t = byId.get(id);
      if (t) out.push({ t, count: countsOnMap.get(id) ?? 0 });
    }
    return out.sort((a, b) => b.count - a.count || a.t.name.localeCompare(b.t.name));
  });

  /** What teammates share, minus what is already on my list; a list whose owner is gone is not shown. */
  const squad = $derived.by(() => {
    const out: { id: string; name: string; tasks: { t: QuestTask; count: number }[] }[] = [];
    for (const [id, ids] of Object.entries(app.squadTodos)) {
      const name = app.teammates[id]?.name;
      if (!name) continue;
      const tasks = ids
        .filter((tid) => !todoQuests[tid])
        .map((tid) => byId.get(tid))
        .filter((t): t is QuestTask => !!t)
        .map((t) => ({ t, count: countsOnMap.get(t.id) ?? 0 }));
      if (tasks.length > 0) out.push({ id, name, tasks });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  });

  function setTodo(id: string, on: boolean) {
    const next = { ...todoQuests };
    if (on) next[id] = true;
    else delete next[id];
    onTodoChange(next);
  }

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

  const dataDate = $derived(app.questData ? new Date(app.questData.fetchedAt).toLocaleDateString() : "");
</script>

{#snippet badges(t: QuestTask)}
  {#if t.kappaRequired}<span class="badge" title="Needed for Kappa">κ</span>{/if}
  {#if t.lightkeeperRequired}<span class="badge" title="Needed for Lightkeeper">LK</span>{/if}
{/snippet}

{#snippet meta(t: QuestTask, count: number)}
  <span class="meta">
    {t.trader.name} · lvl {t.minPlayerLevel}{#if count} · {count} here{/if}{#if t.neededKeys?.length} · keys: {t.neededKeys.join(", ")}{/if}
  </span>
{/snippet}

<section class="panel quests">
  <h2>Quests</h2>

  <div class="head">
    <h3>To-do <span class="cnt">{mine.length}</span></h3>
    <label class="share" title="Teammates in your room see your to-do quests' markers on their map, and you see theirs">
      <input type="checkbox" checked={shareTodo} onchange={(e) => onShareTodo(e.currentTarget.checked)} /> share with squad
    </label>
  </div>
  {#if mine.length === 0 && squad.length === 0}
    <p class="muted small">Nothing yet. Every quest below counts as completed; untick one to show it on the map.</p>
  {:else}
    <div class="todo">
      <ul>
        {#each mine as { t, count } (t.id)}
          <li class:done={app.doneQuests[t.id]} class:here={count > 0}>
            <input type="checkbox" aria-label="Mark {t.name} done" checked={!!app.doneQuests[t.id]} onchange={() => toggle(t.id)} />
            <span class="name">{t.name}{@render badges(t)}</span>
            {#if t.wikiLink}
              <button class="icon wiki" title="Open on the wiki" aria-label="Open {t.name} on the wiki" onclick={() => openWiki(t.wikiLink!)}>?</button>
            {/if}
            <button class="icon" title="Remove from to-do" aria-label="Remove {t.name} from to-do" onclick={() => setTodo(t.id, false)}>✕</button>
            {@render meta(t, count)}
          </li>
        {/each}
      </ul>
      {#each squad as s (s.id)}
        <h4>{s.name}'s to-do</h4>
        <ul>
          {#each s.tasks as { t, count } (t.id)}
            <li class:here={count > 0}>
              <span class="from" aria-hidden="true">↳</span>
              <span class="name">{t.name}{@render badges(t)}</span>
              {#if t.wikiLink}
                <button class="icon wiki" title="Open on the wiki" aria-label="Open {t.name} on the wiki" onclick={() => openWiki(t.wikiLink!)}>?</button>
              {/if}
              <button class="icon add" title="Add to my to-do" aria-label="Add {t.name} to my to-do" onclick={() => setTodo(t.id, true)}>+</button>
              {@render meta(t, count)}
            </li>
          {/each}
        </ul>
      {/each}
    </div>
  {/if}

  <h3 class="find">Find quests{mapName && !allMaps ? ` on ${mapName}` : ""}</h3>
  <div class="row">
    <input class="search" aria-label="Search quests" placeholder="Type a quest name" bind:value={search} />
    <label title="Your PMC level (0 = show all)">
      Lvl
      <input
        type="number"
        min="0"
        max="79"
        value={playerLevel}
        onchange={(e) => {
          // A non-numeric paste yields NaN, which would hide every quest.
          const n = Number(e.currentTarget.value);
          onPlayerLevel(Number.isFinite(n) ? Math.max(0, Math.min(79, n)) : 0);
        }}
      />
    </label>
  </div>
  <div class="row toggles">
    <label title="Only quests whose prerequisite quests you have marked done">
      <input type="checkbox" checked={availableOnly} onchange={(e) => onAvailableOnly(e.currentTarget.checked)} /> available
    </label>
    <label title="Only quests needed for the Kappa container"><input type="checkbox" bind:checked={kappaOnly} /> Kappa</label>
    {#if app.currentMap}
      <label title="List quests from every map, not only this one"><input type="checkbox" bind:checked={allMaps} /> all maps</label>
    {/if}
  </div>
  {#if !app.questData}
    <p class="muted">No quest data yet.</p>
  {:else}
    <div class="list">
      {#if groups.length === 0}
        <p class="muted small">No quest matches{mapName && !allMaps ? ` on ${mapName}` : ""}.</p>
      {/if}
      {#each groups as g (g.trader)}
        <div class="trader">
          <button class="hdr" onclick={() => (collapsed[g.trader] = !collapsed[g.trader])} aria-expanded={!collapsed[g.trader]}>
            <span class="tri"><Chevron open={!collapsed[g.trader]} /></span>{g.trader}<span class="cnt">{g.tasks.length}</span>
          </button>
          {#if !collapsed[g.trader]}
            <ul>
              {#each g.tasks as { t, count } (t.id)}
                <li class:here={count > 0} class:listed={todoQuests[t.id]}>
                  <!-- Ticked means "completed, keep it off my map"; unticking puts the quest on the to-do list. -->
                  <input
                    type="checkbox"
                    checked={!todoQuests[t.id]}
                    title={todoQuests[t.id] ? "Tick to hide it again" : "Untick to show it on the map"}
                    aria-label="{t.name} completed"
                    onchange={(e) => setTodo(t.id, !e.currentTarget.checked)}
                  />
                  <span class="name">{t.name}{@render badges(t)}</span>
                  {#if t.wikiLink}
                    <button class="icon wiki" title="Open on the wiki" aria-label="Open {t.name} on the wiki" onclick={() => openWiki(t.wikiLink!)}>?</button>
                  {/if}
                  <span></span>
                  {@render meta(t, count)}
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
  h3 { margin: 4px 0 0; font-size: 13px; display: flex; align-items: center; gap: 6px; }
  h3.find { margin-top: 8px; padding-top: 8px; border-top: 1px solid #2a2f38; }
  h4 { margin: 6px 0 0; font-size: 12px; color: var(--muted); font-weight: 500; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .share { display: flex; align-items: center; gap: 4px; font-size: 12px; white-space: nowrap; }
  .cnt { color: var(--muted); font-size: 11px; font-weight: normal; }
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
  /* The to-do list keeps to the top third so the finder below stays reachable. */
  .todo { overflow-y: auto; max-height: 34%; flex: none; }
  .list { overflow-y: auto; flex: 1; min-height: 80px; }
  .hdr {
    display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none;
    color: var(--fg); font-size: 13px; text-align: left; padding: 5px 0; cursor: pointer;
  }
  .hdr .tri { color: var(--muted); width: 22px; height: 22px; display: grid; place-items: center; border-radius: 4px; }
  .hdr:hover .tri { background: rgba(255, 255, 255, 0.06); color: var(--fg); }
  .hdr .cnt { margin-left: auto; }
  ul { list-style: none; margin: 0; padding: 0; }
  .list ul { padding-left: 18px; }
  li { display: grid; grid-template-columns: auto 1fr auto auto; column-gap: 6px; align-items: center; padding: 4px 0; border-bottom: 1px solid #262b33; font-size: 13px; }
  li .meta { grid-row: 2; grid-column: 2; color: var(--muted); font-size: 11px; }
  li.done .name { text-decoration: line-through; color: var(--muted); }
  li.here .name { color: var(--accent); }
  li.listed .name { font-weight: 600; }
  .from { color: var(--muted); font-size: 12px; width: 13px; text-align: center; }
  .icon { background: none; border: none; color: var(--muted); cursor: pointer; padding: 0 3px; font-size: 13px; line-height: 1; }
  .icon:hover { color: var(--fg); }
  .wiki { font-weight: 600; font-size: 12px; }
  .add { font-size: 15px; width: 18px; }
  .small { font-size: 11px; margin: 0; }
  .footer { margin: 0; font-size: 11px; }
</style>
