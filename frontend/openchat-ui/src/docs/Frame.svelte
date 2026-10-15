<!-- Demo frame: rounded surface-1 card. Wraps its demos in a flex row, or a grid when `cols` is set
     (a number is the min column width for repeat(auto-fit, minmax(n, 1fr)); a string is used as-is). -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Mono caps label above the demos ("TRY IT · RIGHT-CLICK…"). */
    label?: string;
    cols?: number | string;
    /** Cross-axis alignment of the flex row. */
    align?: 'start' | 'center' | 'end' | 'stretch';
    /** Extra inline style for the content box (height, justify-content, padding …). */
    style?: string;
    children?: Snippet;
  }

  let { label = '', cols, align = 'start', style = '', children }: Props = $props();

  const template = $derived(cols == null ? null : typeof cols === 'number' ? `repeat(auto-fit, minmax(min(${cols}px, 100%), 1fr))` : cols);
</script>

<div class="frame">
  {#if label}<div class="label">{label}</div>{/if}
  <div class="content" class:grid={template} style:grid-template-columns={template} style:align-items={align === 'start' || align === 'end' ? 'flex-' + align : align} {style}>
    {@render children?.()}
  </div>
</div>

<style>
  .frame { box-sizing: border-box; min-width: 0; display: flex; flex-direction: column; gap: 14px; padding: 22px; border-radius: 20px; background: var(--surface-1); box-shadow: inset 0 0 0 1px var(--line-1); }
  .label { font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); }
  .content { min-width: 0; display: flex; flex-wrap: wrap; gap: 18px; }
  .content.grid { display: grid; }
</style>
