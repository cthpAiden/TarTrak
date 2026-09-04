<script lang="ts">
  import { loadMapDefs } from "./mapsData";
  let { value, onchange }: { value: string | null; onchange: (key: string) => void } = $props();
  const defs = loadMapDefs();
</script>

<select value={value ?? ""} onchange={(e) => onchange((e.currentTarget as HTMLSelectElement).value)} aria-label="Map">
  <option value="" disabled>Pick a map</option>
  {#each defs as d (d.key)}
    <option value={d.key}>{d.name}</option>
  {/each}
</select>
