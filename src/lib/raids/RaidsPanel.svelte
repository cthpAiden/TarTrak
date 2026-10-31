<script lang="ts">
  import type { RaidRecord } from "./record";
  import { mmss, raidSpan } from "./replay";
  import { MAX_RAIDS } from "./log.svelte";
  import { getMapDef } from "../map/mapsData";

  let {
    raids,
    selected,
    onSelect,
    now = Date.now(),
  }: {
    /** Newest first. */
    raids: RaidRecord[];
    /** startedAt of the raid on the map. */
    selected: number | null;
    onSelect: (startedAt: number) => void;
    now?: number;
  } = $props();

  const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function when(t: number): string {
    const d = new Date(t);
    const today = new Date(now);
    if (d.toDateString() === today.toDateString()) return `today ${hhmm(t)}`;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${hhmm(t)}`;
  }
  const mapName = (key: string | null) => (key ? (getMapDef(key)?.name ?? key) : "Unknown map");
</script>

<section class="panel raids">
  <h2>Raids</h2>
  {#if raids.length === 0}
    <p class="muted">No raids yet. Take screenshots in a raid; once you leave it, it shows up here to replay with your squad's trails.</p>
  {:else}
    <ul>
      {#each raids as r (r.startedAt)}
        {@const span = raidSpan(r)}
        <li>
          <button type="button" class="raid" aria-pressed={selected === r.startedAt} onclick={() => onSelect(r.startedAt)}>
            <span class="top">
              <b>{mapName(r.map)}</b>
              <span class="muted">{when(r.startedAt)}</span>
              <!-- A raid that ended while TarTrak was closed never saw me leave; its clock tells it is over. -->
              {#if r.leftAt === null && r.endsAt > now}<span class="live">in raid</span>{/if}
            </span>
            <span class="muted">
              {r.me.length} screenshot{r.me.length === 1 ? "" : "s"} · {mmss(span.end - span.start)}{r.mates.length > 0
                ? ` · ${r.mates.map((m) => m.name).join(", ")}`
                : ""}
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <p class="muted foot">The last {MAX_RAIDS} raids are kept on this PC.</p>
  {/if}
</section>

<style>
  ul { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  button.raid {
    width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 8px 10px;
    text-align: left; background: var(--raised); border-color: var(--line);
  }
  button.raid[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
  .top { display: flex; align-items: baseline; gap: 8px; width: 100%; }
  .top b { font-size: 13px; }
  .live { margin-left: auto; font-size: 11px; color: var(--ok); }
  .foot { margin-top: 10px; }
</style>
