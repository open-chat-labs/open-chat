<!-- A table of records on a card: a heading with its count and actions, sticky column headings (mono caps), rows the
     host draws cell by cell (`cell`), a row's tone (danger: a red tint and edge; warning: an amber edge; busy: faded,
     while something runs on it), and its states: loading (shimmering rows), empty and error (with Retry), said in place
     of the rows. Wider than its card it scrolls sideways, a `maxHeight` makes it scroll down under its headings, and a
     `footer` is for "Load more". Text is resource keys or literal text. -->
<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export interface Props<T> {
    /** Resource key (or literal text). */
    title?: string;
    /** Beside the title. */
    count?: number | string;
    /** The columns: a key for `cell`, its heading (resource key or literal text), a width, numbers kept on one line. */
    columns: { key: string; label: string; width?: string; nowrap?: boolean }[];
    rows: T[];
    rowKey: (row: T) => string | number;
    /** Draws a row's cell for a column key. */
    cell: Snippet<[T, string]>;
    rowTone?: (row: T) => 'default' | 'danger' | 'warning' | 'busy';
    state?: 'ready' | 'loading' | 'empty' | 'error';
    /** Resource key (or literal text). */
    emptyTitle?: string;
    /** Resource key (or literal text). */
    emptyBody?: string;
    /** Resource key (or literal text). */
    errorTitle?: string;
    /** Resource key (or literal text). */
    errorBody?: string;
    onRetry?: () => void;
    /** px: narrower than this it scrolls sideways. */
    minWidth?: number;
    /** A CSS length: taller than this it scrolls under its headings. */
    maxHeight?: string;
    /** At the end of the heading's line. */
    actions?: Snippet;
    /** Under the rows: "Load more". */
    footer?: Snippet;
  }</script>

<script lang="ts" generics="T">
  import { useT } from '../i18n';
  import Button from './Button.svelte';



  let {
    title = '',
    count,
    columns,
    rows,
    rowKey,
    cell,
    rowTone,
    state = 'ready',
    emptyTitle = 'ui.dataTable.emptyTitle',
    emptyBody = '',
    errorTitle = 'ui.dataTable.errorTitle',
    errorBody = '',
    onRetry,
    minWidth = 640,
    maxHeight,
    actions,
    footer,
  }: Props<T> = $props();
  const t = useT();

  // fixed, varied widths so the loading rows don't look stamped
  const SKELETON = [62, 78, 54, 70];
</script>

<section class="data-table" aria-label={title ? t(title) : undefined} aria-busy={state === 'loading'}>
  {#if title || actions}
    <div class="head">
      <h3 class="title">{t(title)}{#if count !== undefined}<span class="count">{count}</span>{/if}</h3>
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </div>
  {/if}
  <div class="scroll" style:max-height={maxHeight}>
    <table style:min-width="{minWidth}px">
      <thead>
        <tr>
          {#each columns as column (column.key)}
            <th scope="col" style:width={column.width}>{t(column.label)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if state === 'loading'}
          {#each SKELETON as width, i (i)}
            <tr aria-hidden="true">
              {#each columns as column, c (column.key)}
                <td><span class="skeleton" style:width="{Math.max(24, width - c * 6)}%"></span></td>
              {/each}
            </tr>
          {/each}
        {:else if state === 'ready'}
          {#each rows as row (rowKey(row))}
            <tr class={rowTone?.(row) ?? 'default'}>
              {#each columns as column (column.key)}
                <td class:nowrap={column.nowrap}>{@render cell(row, column.key)}</td>
              {/each}
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
    {#if state === 'empty'}
      <div class="state">
        <span class="state-icon empty"></span>
        <b>{t(emptyTitle)}</b>
        {#if emptyBody}<span>{t(emptyBody)}</span>{/if}
      </div>
    {:else if state === 'error'}
      <div class="state error" role="alert">
        <span class="state-icon"></span>
        <b>{t(errorTitle)}</b>
        {#if errorBody}<span>{t(errorBody)}</span>{/if}
        {#if onRetry}<Button label="ui.common.retry" variant="secondary" onClick={onRetry} />{/if}
      </div>
    {/if}
  </div>
  {#if footer && state === 'ready'}<div class="foot">{@render footer()}</div>{/if}
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  .data-table {
    min-width: 0;
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    overflow: hidden;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-14) var(--space-14) var(--space-14) var(--space-18);
    border-bottom: 1px solid var(--line-1);
  }

  .title {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    margin: 0;
    font: var(--weight-semibold) var(--text-lg) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .count {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 20px var(--font-mono);
    color: var(--ink-2);
    text-align: center;
  }

  .actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .scroll {
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: var(--space-10) var(--space-12);
    // opaque: the card's overlay on the surface it sits on, so rows scroll under it
    background: linear-gradient(var(--overlay-1), var(--overlay-1)), var(--surface-1);
    border-bottom: 1px solid var(--line-1);
    text-align: start;
    white-space: nowrap;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  td {
    padding: var(--space-12);
    border-bottom: 1px solid var(--line-1);
    vertical-align: top;
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-2);

    &.nowrap {
      white-space: nowrap;
    }
  }

  th:first-child,
  td:first-child {
    padding-inline-start: var(--space-18);
  }

  th:last-child,
  td:last-child {
    padding-inline-end: var(--space-14);
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  tbody tr:hover td {
    background: var(--overlay-1);
  }

  tr.danger td {
    background: color-mix(in oklch, var(--status-danger) 8%, transparent);
  }

  tr.danger td:first-child {
    box-shadow: inset 3px 0 0 var(--status-danger);
  }

  tr.warning td:first-child {
    box-shadow: inset 3px 0 0 var(--status-warning);
  }

  tr.busy td {
    opacity: 0.45;
  }

  .skeleton {
    display: block;
    height: 10px;
    border-radius: 5px;
    background: var(--skeleton-base);
    background-image: var(--skeleton-sheen);
    background-size: 200% 100%;
    animation: oc-shimmer 1.4s ease-in-out infinite;
  }

  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-32) var(--space-24);
    text-align: center;

    b {
      font: var(--weight-semibold) var(--text-lg) / 1.3 var(--font-sans);
      color: var(--ink);
    }

    span:not(.state-icon) {
      max-width: 420px;
      font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
      color: var(--ink-3);
    }
  }

  .state-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--status-danger) 14%, transparent);
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      margin: auto;
      width: 20px;
      height: 20px;
      background: var(--status-danger);
      mask: var(--icon-warning) center/contain no-repeat;
    }

    &.empty {
      background: var(--overlay-2);

      &::after {
        background: var(--ink-3);
        mask-image: var(--icon-check);
      }
    }
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-12);
    padding: var(--space-12);
    border-top: 1px solid var(--line-1);
  }
</style>
