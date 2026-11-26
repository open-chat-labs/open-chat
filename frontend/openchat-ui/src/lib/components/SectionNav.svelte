<!-- A list panel of sections, for a workspace whose list column holds pages rather than chats (the operator console;
     settings-like areas): a title with an optional tag pill, then groups under mono caps headings, each row an icon tile,
     its label, a line under it (the section's status, toned) and an optional count. The open row is marked
     (aria-current); a `danger` row is red. WalletPanel's header, rows and headings. Text is resource keys or literal
     text. -->
<script lang="ts" module>
  export type SectionNavTone = 'neutral' | 'warning' | 'danger';

  export type SectionNavItem = {
    id: string;
    /** Resource key (or literal text). */
    label: string;
    /** An icons.js name, in the row's 34px tile. */
    icon: string;
    /** Resource key (or literal text): the line under the label. */
    sub?: string;
    subTone?: SectionNavTone;
    /** A count at the row's end; none at 0. */
    count?: number;
    countTone?: SectionNavTone;
    /** Resource key (or literal text): what the count means, its accessible name. */
    countLabel?: string;
    /** A destructive area: the row in red. */
    danger?: boolean;
  };

  export type SectionNavGroup = {
    /** Resource key (or literal text). */
    label: string;
    items: SectionNavItem[];
  };
</script>

<script lang="ts">
  import { useT } from '../i18n';
  import Pill from './Pill.svelte';

  interface Props {
    /** Resource key (or literal text). */
    title: string;
    /** Resource key (or literal text): a pill after the title ("Operator"). */
    tag?: string;
    groups: SectionNavGroup[];
    /** The open section's id. */
    selected?: string;
    /** Resource key (or literal text): the list's accessible name. */
    ariaLabel?: string;
    onSelect?: (id: string) => void;
  }

  let { title, tag = '', groups, selected, ariaLabel = '', onSelect }: Props = $props();
  const t = useT();
</script>

<section class="section-nav" aria-label={t(title)}>
  <div class="head">
    <span class="title">{t(title)}</span>
    {#if tag}
      <Pill label={tag} />
    {/if}
  </div>
  <nav class="scroll" aria-label={t(ariaLabel || title)}>
    {#each groups as group (group.label)}
      <div class="group" role="group" aria-label={t(group.label)}>
        <span class="group-label">{t(group.label)}</span>
        {#each group.items as item (item.id)}
          {@const on = item.id === selected}
          <button
            type="button"
            class="item"
            class:on
            class:danger={item.danger}
            aria-current={on ? 'page' : undefined}
            onclick={() => onSelect?.(item.id)}>
            <span class="tile"><span class="tile-icon" style:mask-image={`var(--icon-${item.icon})`}></span></span>
            <span class="text">
              <span class="label">{t(item.label)}</span>
              {#if item.sub}<span class="sub {item.subTone ?? 'neutral'}">{t(item.sub)}</span>{/if}
            </span>
            {#if item.count}
              <span class="count {item.countTone ?? 'neutral'}" aria-label={item.countLabel ? t(item.countLabel) : undefined}>{item.count}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </nav>
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  .section-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    padding: var(--space-10);
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: var(--control-md);
    padding: var(--space-10) var(--space-4) var(--space-10) var(--space-10);
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink);
    @include truncate;
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-18);
    padding-bottom: var(--space-10);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .group-label {
    padding: 0 var(--space-10) var(--space-8);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    width: 100%;
    padding: var(--space-10);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--ink);
    text-align: start;
    cursor: pointer;

    &:hover {
      background: var(--overlay-1);
    }

    &.on {
      background: var(--overlay-2);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 11px;
    background: var(--overlay-2);
    color: var(--ink-2);

    .on & {
      background: var(--accent-soft);
      color: var(--accent-bright);
    }

    .danger & {
      background: color-mix(in oklch, var(--status-danger) 14%, transparent);
      color: var(--status-danger);
    }
  }

  .tile-icon {
    @include icon(gear, 16px, currentColor);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .label {
    font: var(--weight-bold) var(--text-md) / 1.2 var(--font-sans);
    @include truncate;

    .danger & {
      color: color-mix(in oklch, var(--status-danger) 70%, var(--ink));
    }
  }

  .sub {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-4);
    @include truncate;

    &.warning {
      color: var(--status-warning);
    }

    &.danger {
      color: var(--status-danger);
    }
  }

  .count {
    flex: none;
    min-width: 20px;
    height: 20px;
    box-sizing: border-box;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 20px var(--font-mono);
    color: var(--ink-2);
    text-align: center;

    &.warning {
      background: color-mix(in oklch, var(--status-warning) 18%, transparent);
      color: var(--status-warning);
    }

    &.danger {
      background: var(--status-danger);
      color: var(--on-accent);
    }
  }
</style>
