<script lang="ts">
  let { text, action, onaction }: { text: string; action?: string; onaction?: () => void } = $props();
</script>

<div class="banner">
  <span>{text}</span>
  {#if action}<button onclick={onaction}>{action}</button>{/if}
</div>

<style>
  .banner { background: #5a3d00; color: #ffe9b3; padding: 6px 10px; display: flex; gap: 10px; align-items: center; font-size: 13px; }
  button { background: var(--accent); border: none; padding: 3px 8px; cursor: pointer; }
</style>
