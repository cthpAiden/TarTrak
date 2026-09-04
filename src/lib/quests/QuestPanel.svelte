<script lang="ts">
  import { app } from "../state/app.svelte";
  import { toggleDone, saveDone } from "./done";
  import type { QuestMarker } from "./markers";

  let {
    markers,
    playerLevel,
    onPlayerLevel,
  }: { markers: QuestMarker[]; playerLevel: number; onPlayerLevel: (n: number) => void } = $props();

  let search = $state("");
  let hideDone = $state(true);

  const tasks = $derived.by(() => {
    const data = app.questData;
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const onMap = new Map<string, number>();
    for (const m of markers) if (m.mapKey === app.currentMap) onMap.set(m.taskId, (onMap.get(m.taskId) ?? 0) + 1);
    return data.tasks
      .filter((t) => !hideDone || !app.doneQuests[t.id])
      .filter((t) => playerLevel <= 0 || t.minPlayerLevel <= playerLevel)
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.trader.name.toLowerCase().includes(q))
      .map((t) => ({ t, count: onMap.get(t.id) ?? 0 }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.t.trader.name.localeCompare(b.t.trader.name) ||
          a.t.minPlayerLevel - b.t.minPlayerLevel,
      );
  });

  function toggle(id: string) {
    app.setDone(toggleDone(app.doneQuests, id));
    void saveDone(app.doneQuests);
  }

  const dataDate = $derived(app.questData ? new Date(app.questData.fetchedAt).toLocaleDateString() : "");
</script>

<section class="panel quests">
  <h2>Quests</h2>
  <div class="row">
    <input class="search" placeholder="Search" bind:value={search} />
    <label title="Your PMC level (0 = show all)">
      Lvl
      <input
        type="number"
        min="0"
        max="79"
        value={playerLevel}
        onchange={(e) => onPlayerLevel(Number(e.currentTarget.value))}
      />
    </label>
    <label><input type="checkbox" bind:checked={hideDone} /> hide done</label>
  </div>
  {#if !app.questData}
    <p class="muted">No quest data yet.</p>
  {:else}
    <ul>
      {#each tasks as { t, count } (t.id)}
        <li class:done={app.doneQuests[t.id]}>
          <input
            type="checkbox"
            aria-label="Mark {t.name} done"
            checked={!!app.doneQuests[t.id]}
            onchange={() => toggle(t.id)}
          />
          <span class="name">{t.name}</span>
          <span class="meta">{t.trader.name} · {t.minPlayerLevel}{#if count} · {count} here{/if}</span>
        </li>
      {/each}
    </ul>
    <p class="muted footer">data: {app.questSource} · {dataDate}</p>
  {/if}
</section>

<style>
  .panel { padding: 10px; display: flex; flex-direction: column; gap: 6px; min-height: 0; flex: 1; }
  h2 { margin: 0 0 4px; font-size: 14px; }
  .row { display: flex; gap: 6px; align-items: center; font-size: 12px; }
  .row .search { flex: 1; min-width: 0; }
  input { background: #2a2f38; color: var(--fg); border: 1px solid #3a4048; padding: 3px 6px; }
  input[type="number"] { width: 48px; }
  ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
  li { display: grid; grid-template-columns: auto 1fr; column-gap: 6px; padding: 4px 0; border-bottom: 1px solid #262b33; font-size: 13px; }
  li .meta { grid-column: 2; color: var(--muted); font-size: 11px; }
  li.done .name { text-decoration: line-through; color: var(--muted); }
  .footer { margin: 0; font-size: 11px; }
</style>
