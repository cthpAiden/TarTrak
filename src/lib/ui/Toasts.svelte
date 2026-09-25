<script lang="ts">
  import { app } from "../state/app.svelte";
</script>

<div class="toasts">
  <!-- A backlog of stale notices is noise on top of the map; only the newest few are worth a corner. -->
  {#each app.toasts.slice(-3) as t (t.id)}
    <div class="toast">{t.text}</div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed; right: 12px; bottom: 12px; left: auto; transform: none;
    z-index: 2000; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
    pointer-events: none;
  }
  /* Above the overlay's teammate-distance pill instead of on it. */
  :global(body.overlay) .toasts { bottom: 44px; }
  :global(.toast) {
    background: rgba(30, 35, 43, 0.85); color: #fff; padding: 6px 10px; border: 1px solid var(--line-2);
    border-radius: 4px; box-shadow: none; font-size: 12px; max-width: 260px;
  }
</style>
