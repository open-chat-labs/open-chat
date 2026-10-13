<!-- Visual spec for the app-wide tooltip (behaviour: lib/behaviours/tooltip.js — any element with a title gets it).
     Plain label only: inverted surface, 12px semibold, above the target (flips below near the top edge). -->
<script lang="ts">
  interface Props {
    label: string;
    placement?: 'top' | 'bottom';
  }

  let { label, placement = 'top' }: Props = $props();
</script>

<div class="tooltip" class:below={placement !== 'top'}>
  <span role="tooltip">{label}</span>
</div>

<style>
  .tooltip {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
  }

  .below {
    flex-direction: column-reverse;
  }

  span {
    max-width: 240px;
    padding: 6px 9px;
    border-radius: 7px;
    background: var(--ink, #ececf1);
    color: var(--surface-1, #0e0e12);
    font: 600 12px/1.3 var(--font-sans);
    text-wrap: balance;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  }
</style>
