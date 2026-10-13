<!-- Converted from the generated lib/TokenPicker.dc.html export (source hash 8699ab5d) to a plain Svelte 5 component;
     a re-export no longer applies here. See EXPORT.md. -->
<script lang="ts">
  import type { TokenOption } from '../types';

  interface Props {
    tokens?: TokenOption[];
    chevron?: boolean;
    placeholder?: string;
    ownedHeading?: string;
    otherHeading?: string;
    emptyHint?: string;
    onSelect?: (symbol: string) => void;
  }

  let {
    tokens = [],
    chevron = false,
    placeholder = 'Search any token',
    ownedHeading = 'IN YOUR WALLET',
    otherHeading = 'ALL TOKENS',
    emptyHint = 'Try the symbol instead — BTC rather than Bitcoin.',
    onSelect,
  }: Props = $props();

  let query = $state('');

  const trimmed = $derived(query.trim());

  const matches = $derived.by(() => {
    const needle = trimmed.toLowerCase();
    if (!needle) return tokens;
    return tokens.filter((tk) => `${tk.symbol} ${tk.name ?? ''}`.toLowerCase().includes(needle));
  });

  const isOwned = (tk: TokenOption) => tk.owned ?? !!tk.held;

  // Tokens the wallet already holds lead the list; the headings only appear
  // when there is genuinely more than one group to tell apart.
  const groups = $derived.by(() => {
    const owned = matches.filter(isOwned);
    const rest = matches.filter((tk) => !isOwned(tk));
    if (owned.length === 0 || rest.length === 0) return [{ heading: '', rows: matches }];
    return [
      { heading: ownedHeading, rows: owned },
      { heading: trimmed ? 'OTHER MATCHES' : otherHeading, rows: rest },
    ];
  });

  function select(tk: TokenOption) {
    if (tk.disabled) return;
    query = '';
    onSelect?.(tk.symbol);
  }
</script>

<div class="picker">
  <div class="search-wrap">
    <div class="search">
      <span class="icon search-icon"></span>
      <input bind:value={query} {placeholder} />
      {#if query.length > 0}
        <span class="clear" onclick={() => (query = '')} role="button" tabindex="0" aria-label="Clear" title="Clear">
          <span class="icon clear-icon"></span>
        </span>
      {/if}
    </div>
  </div>

  <div class="list">
    {#each groups as group}
      <div class="group">
        {#if group.heading}
          <span class="heading">{group.heading}</span>
        {/if}
        <div class="rows">
          {#each group.rows as tk}
            <div
              class="row"
              class:current={tk.current}
              class:disabled={tk.disabled}
              onclick={() => select(tk)}
              role="button"
              tabindex="0"
              aria-disabled={tk.disabled || undefined}
              aria-label={tk.title || undefined}
              title={tk.title || undefined}
            >
              <span class="mark" style:background={tk.gradient ?? 'var(--overlay-2,rgba(255,255,255,.09))'}>{tk.mark ?? ''}</span>
              <div class="names">
                <span class="symbol">{tk.symbol}</span>
                <span class="name">{tk.note ?? tk.name ?? ''}</span>
              </div>
              <span class="held">{tk.held ?? ''}</span>
              {#if chevron}
                <span class="icon chevron-icon"></span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}

    {#if matches.length === 0}
      <div class="empty">
        <span class="empty-title">{trimmed ? `No token called “${trimmed}”` : 'Nothing to pick'}</span>
        <span class="empty-hint">{emptyHint}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
  }

  .search-wrap {
    flex: none;
    padding: 0 0 var(--space-14);
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 44px;
    padding: 0 var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .icon {
    flex: none;
    background: var(--ink-4, #7c7c8c);
  }

  .search-icon {
    width: 15px;
    height: 15px;
    mask: var(--icon-search) center/contain no-repeat;
  }

  .clear-icon {
    width: 12px;
    height: 12px;
    mask: var(--icon-close) center/contain no-repeat;
  }

  .chevron-icon {
    width: 14px;
    height: 14px;
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .clear {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .clear:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .list {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
  }

  .group {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .heading {
    padding: 0 var(--space-12);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .row {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    height: 58px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .row:hover,
  .row.current {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .row.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mark {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-pill);
    font: var(--weight-bold) var(--text-sm) / 1 var(--font-sans);
    color: #0b0b0f;
  }

  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .symbol {
    font: var(--weight-bold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .name {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .held {
    flex: none;
    font: var(--weight-medium) var(--text-md) / 1.2 var(--font-mono);
    color: var(--ink-2, #c9c9d4);
  }

  .empty {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-22) var(--space-12);
  }

  .empty-title {
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .empty-hint {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }
</style>
