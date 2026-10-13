<!-- Small mono uppercase heading for list groups and form fields (TODAY, ACTIVITY, YOU PAY).
     Optional right-side meta (e.g. "Balance 4,820 ICP"). -->
<script lang="ts">
  interface Props {
    label: string;
    meta?: string;
    inset?: boolean;
  }

  let { label, meta = '', inset = false }: Props = $props();
</script>

<div class="section-label" class:inset>
  <span class="label">{label}</span>
  {#if meta}<span class="meta">{meta}</span>{/if}
</div>

<style>
  .section-label {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
  }

  .inset {
    padding-inline-start: var(--space-10);
  }

  .label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) 11.5px/1 var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-4, #8a8a99);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    flex: none;
    font: var(--weight-medium) 12px/1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }
</style>
