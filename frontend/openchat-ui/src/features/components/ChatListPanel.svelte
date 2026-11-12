<!-- The chat list column: optional header (dms or community), search, All / Direct / Groups / Unread filter, a "Thread replies"
     entry, then rows grouped into sections (Pinned, Chats). Section order is fixed, never inherited from row order.
     Rows are identified by `id` (titles repeat: two DMs with "Alex"). Search filters `rows` (and `people`) by title; with
     onSearch the host searches instead (users and groups not loaded yet) and supplies the rows. While a search is on, the
     filter tabs push out (sliding up and away) and the search tabs push in, All / Chats / People / Groups with a badge
     of each one's results (web plan 04; Groups, the public groups found, the user's decision of 2026-11-12); clearing
     the search pushes the filters back, their pick kept. All shows up to 5 chats, 3 people and 3 groups, each section
     ending in "+N more …" that switches to its tab (lib/searchTabs). TODO(design): Groups; web/04 has no groups. -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import type { ComponentProps } from 'svelte';
  import type { MenuItem } from '../../lib/types';
  import Badge from '../../lib/components/Badge.svelte';
  import ChatListHeader from './ChatListHeader.svelte';
  import ChatRow from '../../lib/components/ChatRow.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import Field from '../../lib/components/Field.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import { SEARCH_TABS, searchSections, searchTabBadges } from '../../lib/searchTabs';

  const SECTION_ORDER = ['', 'Pinned', 'Chats'];
  // sections and filters are identified by their English names (rows and logic use them); these keys are for display
  const SECTION_KEYS: Record<string, string> = { Pinned: 'ui.chatListPanel.pinned', Chats: 'ui.chatListPanel.chats' };
  const FILTER_KEYS: Record<string, string> = {
    All: 'ui.chatListPanel.filters.all',
    Direct: 'ui.chatListPanel.filters.direct',
    Groups: 'ui.chatListPanel.filters.groups',
    Unread: 'ui.chatListPanel.filters.unread',
  };
  const SEARCH_TAB_KEYS = SEARCH_TABS.map((tab) => `ui.chatListPanel.searchTabs.${tab}`);
  const MORE_KEYS = { chats: 'ui.chatListPanel.moreChats', people: 'ui.chatListPanel.morePeople', groups: 'ui.chatListPanel.moreGroups' } as const;

  type RowProps = Omit<ComponentProps<typeof ChatRow>, 'onClick' | 'menuItems'>;

  interface Row extends RowProps {
    /** The chat's id, reported by onSelect. */
    id: string;
    /** Section heading; "Pinned" also pins the row. Defaults to Chats. */
    section?: string;
    /** Row menu. */
    menu?: MenuItem[];
  }

  type HeaderProps = ComponentProps<typeof ChatListHeader>;

  interface Props {
    rows: Row[];
    /** People (and bots) a search found, for its People tab and All's People section; unused with no search. With
        onSearch the host has found them for the query; without, they're filtered by title as `rows` are. */
    people?: Row[];
    /** Groups a search found (public groups not in the list), for its Groups tab and All's Groups section; unused with
        no search. With onSearch the host has found them for the query; without, they're filtered by title. */
    groups?: Row[];
    /** Section headings with counts; off = one flat list. */
    showLabels?: boolean;
    onSelect?: (id: string, row: Row) => void;
    /** Shows the header. */
    headerKind?: HeaderProps['kind'];
    headerTitle?: string;
    headerVisibility?: HeaderProps['visibility'];
    headerMembers?: number;
    headerColor?: HeaderProps['color'];
    headerMenuItems?: MenuItem[];
    /** Header ⋯ menu pick: the item's id (see ChatListHeader). */
    onHeaderMenu?: (id: string) => void;
    /** Header capabilities (community): see ChatListHeader. */
    headerCanEdit?: boolean;
    headerCanCreateChannel?: boolean;
    headerCanInvite?: boolean;
    onHeaderDetails?: () => void;
    onCreateGroup?: () => void;
    /** Resource key (or literal text). */
    searchPlaceholder?: string;
    /** Live search; otherwise the field is a static chip. */
    searchable?: boolean;
    /** The search text. The user's typing sticks until the host passes a different text: passing '' clears the search
        (the filter tabs come back, their pick kept). */
    query?: string;
    /** Server-side search: called as the user types; local title filtering is then off. */
    onSearch?: (query: string) => void;
    /** The Thread replies row, above the chats. Hidden while a search is on, whatever this says. */
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
    people = [],
    groups = [],
    showLabels = true,
    onSelect,
    headerKind,
    headerTitle,
    headerVisibility = 'Public',
    headerMembers = 0,
    headerColor = 'teal',
    headerMenuItems,
    onHeaderMenu,
    headerCanEdit = false,
    headerCanCreateChannel = false,
    headerCanInvite = false,
    onHeaderDetails,
    onCreateGroup,
    searchPlaceholder = 'ui.chatListPanel.searchPlaceholder',
    searchable = false,
    query: initialQuery = '',
    onSearch,
    showThreads = true,
    threadCount = 0,
    threadsAction,
    showTabs = true,
    selectedFilter = 0,
    filterLabels = ['All', 'Direct', 'Groups', 'Unread'],
    emptyPreset = 'no-conversations',
    loading = false,
  }: Props = $props();
  const t = useT();

  // the user's pick sticks until the parent selects a different filter
  let filter = $derived(selectedFilter);
  // the user's typing sticks until the host sends a different text (it clears the search with '')
  let query = $derived(initialQuery);
  const search = (q: string) => {
    query = q;
    onSearch?.(q);
  };

  // a search pushes the filter tabs out for its own, and the filter they hide doesn't narrow the results
  const searching = $derived(searchable && query.trim() !== '');
  // the search tab (SEARCH_TABS' index): the user's pick sticks until the search is cleared, and every new search
  // starts on All (it's worked out again, as 0, whenever `searching` changes)
  let searchTab = $derived.by(() => {
    void searching;
    return 0;
  });

  const withDefaults = (r: Row) => ({ ...r, kind: r.kind ?? 'user', pinned: r.pinned ?? r.section === 'Pinned' });
  const all = $derived(rows.map(withDefaults));
  const filterKey = $derived(searching ? 'all' : (filterLabels[filter] ?? 'All').toLowerCase());
  // with onSearch the host has already filtered `rows` and `people`
  const localTerm = $derived(searchable && !onSearch ? query.trim().toLowerCase() : '');
  const matches = (r: Row) => !localTerm || r.title.toLowerCase().includes(localTerm);
  const shown = $derived.by(() => {
    return all
      .filter(matches)
      .filter((r) =>
        filterKey === 'direct' ? r.kind === 'user' : filterKey === 'groups' ? r.kind !== 'user' : filterKey === 'unread' ? (r.unreadCount ?? 0) > 0 : true,
      );
  });
  const hasUnread = $derived(all.some((r) => (r.unreadCount ?? 0) > 0));

  // the list's sections (Pinned, Chats …), each with its rows
  const listSections = $derived.by(() => {
    const order: { label: string; rows: typeof shown }[] = [];
    for (const r of shown) {
      const key = showLabels ? (r.section ?? 'Chats') : '';
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

  // a search's results: the chats in the list's section order (pinned first), then the people and the groups found
  const found = $derived({
    chats: listSections.flatMap((s) => s.rows),
    people: searching ? people.map(withDefaults).filter(matches) : [],
    groups: searching ? groups.map(withDefaults).filter(matches) : [],
  });
  const badges = $derived(searchTabBadges(found));
  const resultSections = $derived(searchSections(SEARCH_TABS[searchTab] ?? 'all', found));
</script>

{#snippet chatRow(row: (typeof all)[number])}
  <div class="cell">
    <ChatRow
      liveCall={row.liveCall}
      muted={row.muted}
      title={row.title}
      kind={row.kind}
      preview={row.preview}
      previewIcon={row.previewIcon}
      time={row.time}
      unreadCount={row.unreadCount}
      mentions={row.mentions}
      color={row.color}
      avatarUrl={row.avatarUrl}
      online={row.online}
      suspended={row.suspended}
      verified={row.verified}
      locked={row.locked}
      pinned={row.pinned}
      selected={row.selected}
      typing={row.typing}
      onClick={onSelect ? () => onSelect(row.id, row) : undefined}
      menuItems={row.menu}
    />
  </div>
{/snippet}

{#snippet searchBar()}
  <SegmentedTabs labels={SEARCH_TAB_KEYS} counts={badges} selectedIndex={searchTab} dotIndexes={[]} onSelect={(i) => (searchTab = i)} />
{/snippet}

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
        canEdit={headerCanEdit}
        canCreateChannel={headerCanCreateChannel}
        canInvite={headerCanInvite}
        {onCreateGroup}
        onMenu={onHeaderMenu}
        openDetails={onHeaderDetails}
      />
    </div>
  {/if}
  <div class="cell">
    <Field placeholder={t(searchPlaceholder)} value={query} onInput={searchable ? (e) => search(e.currentTarget.value) : undefined} onClear={() => search('')} />
  </div>
  {#if showTabs}
    <!-- a search pushes the filter tabs up and away as its own tabs come up after them, and clearing it pushes them
         back (web/04); the row out of view is out of reach (inert, hidden) -->
    <div class="tab-rows">
      <div class="tab-track" class:searching>
        <div class="cell tab-row" inert={searching} aria-hidden={searching}>
          <SegmentedTabs labels={filterLabels.map((l) => FILTER_KEYS[l] ?? l)} selectedIndex={filter} dotIndexes={hasUnread && filterLabels.includes('Unread') ? [filterLabels.indexOf('Unread')] : []} onSelect={(i) => (filter = i)} />
        </div>
        <div class="cell tab-row" inert={!searching} aria-hidden={!searching}>
          {@render searchBar()}
        </div>
      </div>
    </div>
  {:else if searching}
    <div class="cell">{@render searchBar()}</div>
  {/if}
  <!-- the Thread replies row isn't a search result: it hides while a search is on (web plan 04) -->
  {#if showThreads && shown.length > 0 && !searching}
    <div class="threads" onclick={threadsAction} role="button" tabindex="0">
      <span class="threads-slot"><span class="threads-icon"></span></span>
      <span class="threads-label">{t('ui.chatListPanel.threadReplies')}</span>
      {#if threadCount > 0}
        <span class="threads-badge"><Badge label={String(threadCount)} variant="count" /></span>
      {/if}
    </div>
  {/if}
  {#if searching}
    <!-- a search's tab: its results fade in as the search starts and as another tab is picked -->
    {#key searchTab}
      {#if resultSections.length > 0}
        <div class="list searching">
          {#each resultSections as section, i (section.tab)}
            <div class="section" class:first={i === 0}>
              {#if section.labelled}
                <div class="section-label">{t(SEARCH_TAB_KEYS[SEARCH_TABS.indexOf(section.tab)]).toUpperCase()} <span class="section-count">{section.total}</span></div>
              {/if}
              {#each section.rows as row (row.id)}
                {@render chatRow(row)}
              {/each}
              {#if section.more > 0}
                <button type="button" class="more" onclick={() => (searchTab = SEARCH_TABS.indexOf(section.tab))}>{t(MORE_KEYS[section.tab], { count: section.more })}</button>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty searching">
          <div class="empty-inner"><EmptyState preset="no-results" /></div>
        </div>
      {/if}
    {/key}
  {:else if shown.length > 0}
    <div class="list">
      {#if loading}
        <Skeleton variant="chat" count={7} />
      {:else}
        {#each listSections as section, i}
          <div class="section" class:first={i === 0}>
            {#if section.label}
              <div class="section-label">{t(SECTION_KEYS[section.label] ?? section.label).toUpperCase()} <span class="section-count">{section.rows.length}</span></div>
            {/if}
            {#each section.rows as row (row.id)}
              {@render chatRow(row)}
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

<style lang="scss">
  @use '../../lib/styles/mixins' as *;

  .panel {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-10);
    background: var(--surface-1);
  }

  .cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  // the filter tabs and the search tabs, one above the other in a window one row tall: a search pushes the track up
  // a row (the filters up and away, the search tabs in after them), 400ms (web/04); clearing it pushes it back. The
  // row out of view is hidden once the push is over, and shown from its start
  // TODO(design): the push's easing and whether the rows fade too; web/04 gives the motion and its 400ms only
  .tab-rows {
    overflow: hidden;
    // the plate's shadow, clear of the window's edge
    margin: calc(-1 * var(--space-4));
    padding: var(--space-4);
  }

  .tab-track {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    height: var(--control-xl);
    transition: transform 400ms var(--ease-standard);

    &.searching {
      transform: translateY(calc(-100% - var(--space-8)));
    }
  }

  .tab-row {
    flex: none;
    transition: visibility 0s;

    &[inert] {
      visibility: hidden;
      transition: visibility 0s linear 400ms;
    }
  }

  // a search's results (or its "no results") fade in as it starts and as another tab is picked
  .list.searching,
  .empty.searching {
    animation: results-in var(--duration-base) var(--ease-out);
  }

  @keyframes results-in {
    from {
      opacity: 0;
    }
  }

  @include reduced-motion {
    .tab-track,
    .tab-row,
    .tab-row[inert] {
      transition: none;
    }

    .list.searching,
    .empty.searching {
      animation: none;
    }
  }

  // All's "+N more …": switches to the section's tab
  // TODO(design): its look; web/04 gives its words only
  .more {
    align-self: flex-start;
    margin: var(--space-2) 0 0;
    padding: var(--space-6) var(--space-8);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;

    &:hover {
      background: var(--overlay-1);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .threads {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    height: var(--control-xl);
    box-sizing: border-box;
    padding: 0 var(--space-12);
    border-radius: var(--radius-lg);
    cursor: pointer;
  }

  .threads:hover {
    background: var(--overlay-1);
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
    background: var(--ink-3);
    mask: var(--icon-threads) center/contain no-repeat;
  }

  .threads-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3);
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
    padding-top: var(--space-10);
  }

  .section-label {
    padding: 0 var(--space-8) var(--space-6);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3);
  }

  .section-count {
    color: var(--ink-4);
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
