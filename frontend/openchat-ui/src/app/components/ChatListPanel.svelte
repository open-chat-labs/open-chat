<!-- The chat list column: optional header (dms or community), search, All / Direct / Groups / Unread filter, a "Thread replies"
     entry, then rows grouped into sections (Pinned, Recent). Section order is fixed, never inherited from row order. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import type { MenuItem } from '../../lib/types';
  import Badge from '../../lib/components/Badge.svelte';
  import ChatListHeader from './ChatListHeader.svelte';
  import ChatRow from '../../lib/components/ChatRow.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import Field from '../../lib/components/Field.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';

  const SECTION_ORDER = ['', 'Pinned', 'Recent'];

  type RowProps = Omit<ComponentProps<typeof ChatRow>, 'onClick' | 'menuItems'>;

  interface Row extends RowProps {
    /** Section heading; "Pinned" also pins the row. Defaults to Recent. */
    section?: string;
    /** Row menu. */
    menu?: MenuItem[];
  }

  type HeaderProps = ComponentProps<typeof ChatListHeader>;

  interface Props {
    rows: Row[];
    /** Section headings with counts; off = one flat list. */
    showLabels?: boolean;
    onSelect?: (title: string) => void;
    /** Shows the header. */
    headerKind?: HeaderProps['kind'];
    headerTitle?: string;
    headerVisibility?: HeaderProps['visibility'];
    headerMembers?: number;
    headerColor?: HeaderProps['color'];
    headerMenuItems?: MenuItem[];
    onHeaderMenu?: (label: string) => void;
    onHeaderDetails?: () => void;
    onCreateGroup?: () => void;
    searchPlaceholder?: string;
    /** Live search; otherwise the field is a static chip. */
    searchable?: boolean;
    showThreads?: boolean;
    threadCount?: number;
    threadsAction?: () => void;
    showTabs?: boolean;
    selectedFilter?: number;
    /** Filter keys by label: All, Direct, Groups, Unread. */
    filterLabels?: string[];
    emptyPreset?: ComponentProps<typeof EmptyState>['preset'];
    loading?: boolean;
  }

  let {
    rows,
    showLabels = true,
    onSelect,
    headerKind,
    headerTitle,
    headerVisibility = 'Public',
    headerMembers = 0,
    headerColor = 'teal',
    headerMenuItems,
    onHeaderMenu,
    onHeaderDetails,
    onCreateGroup,
    searchPlaceholder = 'Search conversations',
    searchable = false,
    showThreads = true,
    threadCount = 0,
    threadsAction,
    showTabs = true,
    selectedFilter = 0,
    filterLabels = ['All', 'Direct', 'Groups', 'Unread'],
    emptyPreset = 'no-conversations',
    loading = false,
  }: Props = $props();

  // the user's pick sticks until the parent selects a different filter
  let filter = $derived(selectedFilter);
  let query = $state('');

  const all = $derived(rows.map((r) => ({ ...r, kind: r.kind ?? 'user', pinned: r.pinned ?? r.section === 'Pinned' })));
  const filterKey = $derived((filterLabels[filter] ?? 'All').toLowerCase());
  const shown = $derived.by(() => {
    const q = searchable ? query.trim().toLowerCase() : '';
    return all
      .filter((r) => !q || r.title.toLowerCase().includes(q))
      .filter((r) =>
        filterKey === 'direct' ? r.kind === 'user' : filterKey === 'groups' ? r.kind !== 'user' : filterKey === 'unread' ? (r.unreadCount ?? 0) > 0 : true,
      );
  });
  const hasUnread = $derived(all.some((r) => (r.unreadCount ?? 0) > 0));

  const groups = $derived.by(() => {
    const order: { label: string; rows: typeof shown }[] = [];
    for (const r of shown) {
      const key = showLabels ? (r.section ?? 'Recent') : '';
      let g = order.find((o) => o.label === key);
      if (!g) order.push((g = { label: key, rows: [] }));
      g.rows.push(r);
    }
    // a newly created group landing first must not hoist its section above Pinned
    const rank = (label: string) => {
      const i = SECTION_ORDER.indexOf(label);
      return i === -1 ? SECTION_ORDER.length : i;
    };
    return order.sort((a, b) => rank(a.label) - rank(b.label));
  });
</script>

<div class="panel">
  {#if headerKind}
    <div class="cell">
      <ChatListHeader
        kind={headerKind}
        title={headerTitle}
        visibility={headerVisibility}
        memberCount={headerMembers}
        color={headerColor}
        menuItems={headerMenuItems}
        {onCreateGroup}
        onMenu={onHeaderMenu}
        openDetails={onHeaderDetails}
      />
    </div>
  {/if}
  <div class="cell">
    <Field placeholder={searchPlaceholder} value={query} onInput={searchable ? (e) => (query = e.currentTarget.value) : undefined} onClear={() => (query = '')} />
  </div>
  {#if showTabs}
    <div class="cell">
      <SegmentedTabs labels={filterLabels} selectedIndex={filter} dotIndexes={hasUnread ? [filterLabels.length - 1] : []} onSelect={(i) => (filter = i)} />
    </div>
  {/if}
  {#if showThreads && shown.length > 0}
    <div class="threads" onclick={threadsAction} role="button" tabindex="0">
      <span class="threads-slot"><span class="threads-icon"></span></span>
      <span class="threads-label">Thread replies</span>
      {#if threadCount > 0}
        <span class="threads-badge"><Badge label={String(threadCount)} variant="count" /></span>
      {/if}
    </div>
  {/if}
  {#if shown.length > 0}
    <div class="list">
      {#if loading}
        <Skeleton variant="chat" count={7} />
      {:else}
        {#each groups as group, i}
          <div class="section" class:first={i === 0}>
            {#if group.label}
              <div class="section-label">{group.label.toUpperCase()} <span class="section-count">{group.rows.length}</span></div>
            {/if}
            {#each group.rows as row}
              <div class="cell">
                <ChatRow
                  liveCall={row.liveCall}
                  muted={row.muted}
                  title={row.title}
                  kind={row.kind}
                  preview={row.preview}
                  time={row.time}
                  unreadCount={row.unreadCount}
                  color={row.color}
                  online={row.online}
                  verified={row.verified}
                  pinned={row.pinned}
                  selected={row.selected}
                  typing={row.typing}
                  onClick={onSelect ? () => onSelect(row.title) : undefined}
                  menuItems={row.menu}
                />
              </div>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  {:else}
    <div class="empty">
      <div class="empty-inner"><EmptyState preset={all.length > 0 ? 'no-results' : emptyPreset} /></div>
    </div>
  {/if}
</div>

<style>
  .panel {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-10);
    background: var(--surface-1, #0e0e12);
  }

  .cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .threads {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    height: var(--control-xl, 44px);
    box-sizing: border-box;
    padding: 0 var(--space-12);
    border-radius: var(--radius-lg);
    cursor: pointer;
  }

  .threads:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .threads-slot {
    flex: none;
    width: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .threads-icon {
    width: 19px;
    height: 19px;
    background: var(--ink-3, #8a8a99);
    mask: var(--icon-threads) center/contain no-repeat;
  }

  .threads-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3, #8a8a99);
  }

  .threads-badge {
    flex: none;
    display: grid;
    grid-template-columns: max-content;
  }

  .list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    overflow-y: auto;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-16);
  }

  .section.first {
    padding-top: 0px;
  }

  .section-label {
    padding: 0 var(--space-8) var(--space-6);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3, #8a8a99);
  }

  .section-count {
    color: var(--ink-4, #6e6e7c);
  }

  .empty {
    flex: 1;
    min-height: 0;
    display: flex;
    padding-top: 44px;
    width: 100%;
    box-sizing: border-box;
  }

  .empty-inner {
    width: 100%;
  }
</style>
