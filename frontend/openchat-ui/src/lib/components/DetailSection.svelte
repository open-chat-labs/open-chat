<!-- Labelled detail card for side panels. variant: value (one bold line, optional online dot / accent highlight)
     | prose (paragraph; `clamp` lines with a More / Less toggle when the text is long). -->
<script lang="ts">
  interface Props {
    label: string;
    value: string;
    variant?: 'value' | 'prose';
    /** Prose only: clamp to this many lines (0 = never). */
    clamp?: number;
    dot?: boolean;
    highlight?: boolean;
  }

  let { label, value, variant = 'value', clamp = 0, dot = false, highlight = false }: Props = $props();

  let open = $state(false);

  const long = $derived(clamp > 0 && value.length > clamp * 38);
</script>

<div class="section">
  <span class="label">{label}</span>
  {#if variant === 'prose'}
    <span class="prose" style:-webkit-line-clamp={long && !open ? String(clamp) : 'unset'}>{value}</span>
    {#if long}
      <span class="more" onclick={() => (open = !open)} role="button" tabindex="0">{open ? 'Less' : 'More'}</span>
    {/if}
  {:else}
    <span class="value" class:highlight>
      {#if dot}
        <span class="dot"></span>
      {/if}
      {value}
    </span>
  {/if}
</div>

<style>
  .section {
    padding: var(--space-14) var(--space-16);
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-8);
  }

  .label {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--ink-4, #6e6e7c);
  }

  .prose {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .more {
    align-self: flex-start;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent-bright, #ff8298);
    cursor: pointer;
    user-select: none;
  }

  .value {
    display: flex;
    align-items: center;
    gap: 7px;
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .value.highlight {
    color: var(--accent-bright, #ff8298);
  }

  .dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--status-online, #2ee6a8);
  }
</style>
