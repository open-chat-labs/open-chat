<!-- Segmented tab bar. Left/Right/Home/End move and select (automatic activation), RTL-aware.
     With onSelect the parent owns the selection; without, it keeps its own. counts are index-aligned (null = no pill). -->
<script lang="ts">
  import { rove } from '../behaviours/rove';

  interface Props {
    labels: string[];
    counts?: (number | null | undefined)[];
    selectedIndex?: number;
    /** Tabs that show an accent dot; overrides dotOnLast. */
    dotIndexes?: number[] | null;
    dotOnLast?: boolean;
    onSelect?: (i: number) => void;
  }

  let { labels, counts = [], selectedIndex = 0, dotIndexes = null, dotOnLast = true, onSelect }: Props = $props();

  let own = $state<number | null>(null);
  const active = $derived(onSelect ? selectedIndex : (own ?? selectedIndex));

  function select(i: number) {
    if (onSelect) onSelect(i);
    else own = i;
  }

  function keyNav(e: KeyboardEvent & { currentTarget: HTMLElement }) {
    rove(e, '[role="tab"]', 'h')?.click();
  }
</script>

<div class="wrap">
  <div class="tabs" role="tablist" onkeydown={keyNav}>
    {#each labels as label, i}
      {@const selected = i === active}
      <div class="tab" class:selected onclick={() => select(i)} role="tab" aria-selected={selected} tabindex={selected ? 0 : -1}>
        {#if selected}
          <div class="plate"></div>
        {/if}
        <span class="label">{label}</span>
        {#if counts[i] != null}
          <span class="count">{counts[i]}</span>
        {/if}
        {#if dotIndexes ? dotIndexes.includes(i) : dotOnLast && i === labels.length - 1}
          <span class="dot"></span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .wrap {
    width: 100%;
  }

  .tabs {
    display: flex;
    gap: var(--space-4);
    height: var(--control-xl, 44px);
    box-sizing: border-box;
    padding: var(--space-4);
    background: var(--overlay-1, rgba(255, 255, 255, 0.045));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.05));
    border-radius: var(--radius-md);
  }

  .tab {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .tab:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .plate {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-sm);
    background: var(--card, #0e0e12);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.16),
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .label {
    position: relative;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3, #8a8a99);
  }

  .selected .label {
    color: var(--ink, #ececf1);
  }

  .count {
    position: relative;
    min-width: 18px;
    box-sizing: border-box;
    padding: 2px 5px;
    text-align: center;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
    font: var(--weight-semibold) var(--text-2xs) / 1.35 var(--font-mono);
    color: var(--ink-3, #8a8a99);
  }

  .selected .count {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
  }

  .dot {
    position: relative;
    width: 5px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
  }
</style>
