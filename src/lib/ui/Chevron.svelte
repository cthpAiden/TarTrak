<script lang="ts">
  /** Disclosure arrow: points right when closed, rotates to point down when open. */
  let { open }: { open: boolean } = $props();
</script>

<svg
  class="chevron"
  class:open
  viewBox="0 0 16 16"
  width="16"
  height="16"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M6 4l4 4-4 4" />
</svg>

<style>
  .chevron { transition: transform 150ms ease; }
  .chevron.open { transform: rotate(90deg); }
</style>
