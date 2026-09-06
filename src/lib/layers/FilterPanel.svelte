<script lang="ts">
  // MapView owns the same import, but the panel renders before a map is picked.
  import "../map/map.css";
  import { isOn, setCategory, setGroup, type Filters } from "./filters";
  import { iconUrl } from "./pointLayer";
  import type { GroupId } from "./points";
  import { questIconUrl, type QuestCategory } from "../quests/questLayer";
  import type { CategoryCount, GroupCount } from "./counts";
  import Chevron from "../ui/Chevron.svelte";
  import MapInfoCard from "../map/MapInfoCard.svelte";
  import type { MapInfo } from "../quests/types";

  let {
    counts,
    filters,
    onChange,
    itemQuery = "",
    onItemQuery = () => {},
    hitCount = 0,
    mapInfo = null,
  }: {
    counts: GroupCount[];
    filters: Filters;
    onChange: (f: Filters) => void;
    itemQuery?: string;
    onItemQuery?: (q: string) => void;
    /** Points on this map that hold the searched item. */
    hitCount?: number;
    /** tarkov.dev's entry for the current map: raid length, players, bosses. */
    mapInfo?: MapInfo | null;
  } = $props();

  let search = $state("");
  let collapsed = $state<Record<string, boolean>>({
    spawns: true,
    loot: true,
    locks: true,
    hazards: true,
    switches: true,
    btr: true,
  });

  // Labels are the one pseudo-group without a picture; every other row shows its map icon.
  function rowIcon(c: CategoryCount): string {
    return c.group === "quests"
      ? questIconUrl(c.category as QuestCategory)
      : iconUrl({ group: c.group as GroupId, category: c.category });
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
  <MapInfoCard info={mapInfo} />
  <input class="search" aria-label="Search filters" placeholder="Search filters" bind:value={search} />
  <div class="finder">
    <input
      class="search"
      aria-label="Find item on map"
      placeholder="Find item on map (e.g. Bolts)"
      value={itemQuery}
      oninput={(e) => onItemQuery(e.currentTarget.value)}
    />
    {#if itemQuery.trim().length >= 2}
      <span class="muted hits">{hitCount} {hitCount === 1 ? "spot" : "spots"}</span>
    {/if}
  </div>
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
            <Chevron open={search !== "" || !collapsed[g.group]} />
          </button>
          <input
            type="checkbox"
            aria-label="Toggle all {g.label}"
            checked={g.state === "all"}
            indeterminate={g.state === "some"}
            onchange={() => onChange(setGroup(filters, g.group, g.state !== "all"))}
          />
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span class="label clickable" onclick={() => (collapsed[g.group] = !collapsed[g.group])}>{g.label}</span>
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
                {#if c.group === "labels"}
                  <span class="row-icon glyph">Aa</span>
                {:else}
                  <img class="row-icon" alt="" src={rowIcon(c)} />
                {/if}
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
  .panel { padding: 10px; display: flex; flex-direction: column; gap: 6px; min-height: 0; height: 100%; box-sizing: border-box; }
  h2 { margin: 0 0 4px; font-size: 14px; }
  input { background: #2a2f38; color: var(--fg); border: 1px solid #3a4048; padding: 3px 6px; }
  input[type="checkbox"] { padding: 0; }
  .search { width: 100%; box-sizing: border-box; }
  .finder { position: relative; }
  .finder .hits { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 11px; pointer-events: none; }
  .finder .search { padding-right: 60px; }
  .groups { flex: 1; min-height: 0; overflow-y: auto; }
  .note { margin: 0; font-size: 11px; }
  .hdr { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 3px 0; }
  .tri {
    background: none; border: none; color: var(--muted); cursor: pointer; padding: 0;
    width: 22px; height: 22px; display: grid; place-items: center; border-radius: 4px;
  }
  .tri:hover { background: rgba(255, 255, 255, 0.06); color: var(--fg); }
  .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .label.clickable { cursor: pointer; }
  .cnt { color: var(--muted); font-size: 11px; }
  ul { list-style: none; margin: 0 0 2px; padding: 0 0 0 18px; }
  li { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 0; }
  .row-icon { width: 18px; height: 18px; flex: none; }
  .glyph { display: block; line-height: 18px; text-align: center; font-size: 13px; }
</style>
