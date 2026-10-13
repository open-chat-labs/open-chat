<!-- Popup menu surface: optional heading, then MenuItems. A separator is inserted before the first danger item.
     Up/Down/Home/End move between items; Enter/Space activate (a11y.js); Esc closes (owner). -->
<script lang="ts">
  import type { MenuItem as Item } from '../types';
  import { rove } from '../behaviours/rove';
  import MenuItem from './MenuItem.svelte';

  interface Props {
    items: Item[];
    heading?: string;
    minWidth?: string;
    /** Called for items without their own onSelect. */
    onSelect?: (item: Item) => void;
  }

  let { items, heading = '', minWidth = '212px', onSelect }: Props = $props();

  let vw = $state(typeof window === 'undefined' ? 1920 : window.innerWidth);

  const rows = $derived.by(() => {
    const shown = items.filter((it) => (it.minVw == null || vw >= it.minVw) && (it.maxVw == null || vw < it.maxVw));
    const out: Item[] = [];
    shown.forEach((it, i) => {
      const variant = it.variant ?? 'regular';
      const prev = shown[i - 1]?.variant ?? (i > 0 ? 'regular' : undefined);
      if (variant === 'danger' && prev && prev !== 'danger' && prev !== 'separator') out.push({ label: '', variant: 'separator' });
      out.push({ ...it, variant, onSelect: it.onSelect ?? (onSelect ? () => onSelect(it) : undefined) });
    });
    return out;
  });
</script>

<svelte:window bind:innerWidth={vw} />

<div class="menu" style:min-width={minWidth} role="menu" aria-label={heading} onkeydown={(e) => rove(e, '[role="menuitem"]', 'v')}>
  {#if heading}
    <span class="heading">{heading}</span>
  {/if}
  {#each rows as item}
    <MenuItem {...item} />
  {/each}
</div>

<style>
  .menu {
    padding: var(--space-6);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--surface-2, #191921);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-panel, 0 8px 24px rgba(0, 0, 0, 0.28));
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .heading {
    padding: var(--space-6) var(--space-10) var(--space-4);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #6e6e7c);
  }
</style>
