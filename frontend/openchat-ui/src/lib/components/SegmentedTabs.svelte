<!-- Segmented tab bar. Left/Right/Home/End move and select (automatic activation), RTL-aware.
     With onSelect the parent owns the selection; without, it keeps its own. counts are index-aligned (null = no pill). -->
<script lang="ts">
  import { useT } from '../i18n';
  import { rove } from '../behaviours/rove';

  interface Props {
    /** Tab labels: resource keys (or literal text). */
    labels: string[];
    counts?: (number | null | undefined)[];
    selectedIndex?: number;
    /** Tabs that show an accent dot; overrides dotOnLast. */
    dotIndexes?: number[] | null;
    dotOnLast?: boolean;
    onSelect?: (i: number) => void;
  }

  let { labels, counts = [], selectedIndex = 0, dotIndexes = null, dotOnLast = true, onSelect }: Props = $props();
  const t = useT();

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
        <span class="label">{t(label)}</span>
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
    height: var(--control-xl);
    box-sizing: border-box;
    padding: var(--space-4);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
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
    background: var(--overlay-1);
  }

  .plate {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-sm);
    background: var(--card);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.16),
      inset 0 0 0 1px var(--line-2);
  }

  .label {
    position: relative;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .selected .label {
    color: var(--ink);
  }

  .count {
    position: relative;
    min-width: 18px;
    box-sizing: border-box;
    padding: 2px 5px;
    text-align: center;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-2xs) / 1.35 var(--font-mono);
    color: var(--ink-3);
  }

  .selected .count {
    background: var(--accent);
    color: var(--on-accent);
  }

  .dot {
    position: relative;
    width: 5px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }
</style>
