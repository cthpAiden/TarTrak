<script lang="ts">
  // MapView owns the same import, but the panel renders before a map is picked.
  import "../map/map.css";
  import { isOn, setCategory, setGroup, type Filters } from "./filters";
  import { GLYPHS, colorFor, usesCanvas } from "./pointLayer";
  import type { GroupId } from "./points";
  import { QUEST_GLYPHS, type QuestCategory } from "../quests/questLayer";
  import type { CategoryCount, GroupCount } from "./counts";

  let {
    counts,
    filters,
    onChange,
  }: { counts: GroupCount[]; filters: Filters; onChange: (f: Filters) => void } = $props();

  let search = $state("");
  let collapsed = $state<Record<string, boolean>>({
    spawns: true,
    loot: true,
    locks: true,
    hazards: true,
    switches: true,
    btr: true,
  });

  // Canvas groups have no glyph on the map, so the panel shows a dot in the marker colour instead.
  function glyph(c: CategoryCount): string {
    if (c.group === "quests") return QUEST_GLYPHS[c.category as QuestCategory] ?? "•";
    return usesCanvas(c.group as GroupId) ? "●" : GLYPHS[c.group as GroupId];
  }
  function color(c: CategoryCount): string {
    return c.group === "quests" ? "" : `color: ${colorFor({ group: c.group as GroupId, category: c.category })}`;
  }

  const empty = $derived(counts.every((g) => g.total === 0));

  const shownGroups = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return counts.map((g) => ({ g, rows: g.categories }));
    return counts
      .map((g) => ({ g, rows: g.categories.filter((c) => c.label.toLowerCase().includes(q)) }))
      .filter((x) => x.rows.length > 0);
  });
</script>

<section class="panel filters">
  <h2>Filters</h2>
  <input class="search" aria-label="Search filters" placeholder="Search" bind:value={search} />
  {#if empty}<p class="muted note">Nothing to filter yet: no map data loaded.</p>{/if}
  <div class="groups">
    {#each shownGroups as { g, rows } (g.group)}
      <div class="group">
        <div class="hdr">
          <button
            class="tri"
            aria-expanded={search !== "" || !collapsed[g.group]}
            aria-label="Toggle {g.label} section"
            onclick={() => (collapsed[g.group] = !collapsed[g.group])}
          >
            {search !== "" || !collapsed[g.group] ? "▾" : "▸"}
          </button>
          <input
            type="checkbox"
            aria-label="Toggle all {g.label}"
            checked={g.state === "all"}
            indeterminate={g.state === "some"}
            onchange={() => onChange(setGroup(filters, g.group, g.state !== "all"))}
          />
          <span class="label">{g.label}</span>
          <span class="cnt">{g.shown}/{g.total}</span>
        </div>
        {#if search !== "" || !collapsed[g.group]}
          <ul>
            {#each rows as c (c.key)}
              <li>
                <input
                  type="checkbox"
                  aria-label={c.label}
                  checked={isOn(filters, c.group, c.category)}
                  onchange={(e) => onChange(setCategory(filters, c.group, c.category, e.currentTarget.checked))}
                />
                <span class="point-icon {c.group} {c.category}"><span style={color(c)}>{glyph(c)}</span></span>
                <span class="label">{c.label}</span>
                <span class="cnt">{c.shown}/{c.total}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .panel { padding: 10px; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  h2 { margin: 0 0 4px; font-size: 14px; }
  input { background: #2a2f38; color: var(--fg); border: 1px solid #3a4048; padding: 3px 6px; }
  input[type="checkbox"] { padding: 0; }
  .search { width: 100%; box-sizing: border-box; }
  .groups { overflow-y: auto; max-height: 240px; }
  .note { margin: 0; font-size: 11px; }
  .hdr { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 3px 0; }
  .tri { background: none; border: none; color: var(--muted); cursor: pointer; padding: 0; width: 12px; font-size: 11px; }
  .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cnt { color: var(--muted); font-size: 11px; }
  ul { list-style: none; margin: 0 0 2px; padding: 0 0 0 18px; }
  li { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 0; }
  li .point-icon { width: 18px; flex: none; }
</style>
