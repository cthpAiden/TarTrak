<script lang="ts">
  import { app } from "../state/app.svelte";
</script>

<div class="toasts">
  {#each app.toasts as t (t.id)}
    <div class="toast">{t.text}</div>
  {/each}
</div>

<style>
  .toasts { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 2000; display: flex; flex-direction: column; gap: 6px; }
  .toast { background: #2a2f38; color: #fff; padding: 8px 12px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,.4); font-size: 13px; }
</style>
