<!-- Activity feed: reactions, mentions, replies and payments, grouped by day, filtered by All / Mentions / Payments.
     By hand (web L3): each row's picture (`avatarUrl`) and tips.
     Opening a row calls onOpen(item) (chatId + messageId land on the message, payments included) and marks it read through
     onMarkRead; "Mark all read" calls onMarkAllRead. Read state comes from `unread` on each item; local marks are optimistic
     and roll back with an error if the host rejects. Items are identified by `id`, never by title. -->
<script lang="ts" module>
  // the item and the feed's rules are activityFeed's, shared with the native Activity tab
  export type { ActivityItem } from '../../lib/activityFeed.svelte';
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  import ActivityRow from '../../lib/components/ActivityRow.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import { ACTIVITY_TAB_LABELS, ActivityReadMarks, activityTabCounts, activityTabItems, startsDay, type ActivityItem as Item } from '../../lib/activityFeed.svelte';

  interface Props {
    items: Item[];
    onOpen?: (item: Item) => void;
    /** Mark these items read (opening one marks it). Rolls back if it rejects. */
    onMarkRead?: (ids: string[]) => Promise<unknown> | void;
    /** "Mark all read"; hidden without it (or onMarkRead). Rolls back if it rejects. */
    onMarkAllRead?: () => Promise<unknown> | void;
    loading?: boolean;
    /** A back button beside the title (the panel opened over another page); hidden without it. */
    onBack?: () => void;
  }

  let { items, onOpen, onMarkRead, onMarkAllRead, loading = false, onBack }: Props = $props();
  const t = useT();

  let tab = $state(0);
  // what an empty tab says: All has its own, rather than Payments'
  const EMPTY = [
    { title: 'ui.activityPanel.noActivity', body: 'ui.activityPanel.noActivityBody' },
    { title: 'ui.activityPanel.noMentions', body: 'ui.activityPanel.noMentionsBody' },
    { title: 'ui.activityPanel.noPayments', body: 'ui.activityPanel.noPaymentsBody' },
  ];
  // ids marked read here, until the host's items catch up (activityFeed, shared with the native tab)
  const marks = new ActivityReadMarks();

  const isUnread = (it: Item) => marks.isUnread(it);
  const shown = $derived(activityTabItems(items, tab));
  // each tab's new (unread) activity; none, no badge
  const counts = $derived(activityTabCounts(items, isUnread));
  const hasUnread = $derived(items.some(isUnread));

  function open(it: Item) {
    void marks.open(it, onMarkRead);
    onOpen?.(it);
  }

  function markAll() {
    void marks.markAll(items, onMarkAllRead, onMarkRead);
  }
</script>

<div class="panel" data-screen-label="Activity">
  <div class="top">
    <div class="title-row" class:with-back={!!onBack}>
      {#if onBack}
        <IconButton label="ui.common.back" variant="ghost" icon="back" onClick={onBack} />
      {/if}
      <span class="title">{t('ui.activityPanel.title')}</span>
      {#if hasUnread && (onMarkAllRead || onMarkRead)}
        <span class="mark-all" onclick={markAll} role="button" tabindex="0">{t('ui.activityPanel.markAllRead')}</span>
      {/if}
    </div>
    {#if marks.failed}<span class="failed" role="alert">{t('ui.activityPanel.markFailed')}</span>{/if}
    <div class="tabs"><SegmentedTabs labels={ACTIVITY_TAB_LABELS.map((key) => t(key))} {counts} selectedIndex={tab} dotOnLast={false} onSelect={(i) => (tab = i)} /></div>
  </div>

  <div class="feed">
    {#if loading}
      <Skeleton variant="activity" count={7} />
    {:else}
      {#each shown as it, i (it.id)}
        {#if startsDay(shown, i)}
          <span class="day" class:first={i === 0}>{it.day}</span>
        {/if}
        <div class="row">
          <ActivityRow
            title={it.title}
            context={it.context}
            preview={it.preview ?? ''}
            time={it.time}
            unread={isUnread(it)}
            color={it.color ?? 'violet'}
            avatarUrl={it.avatarUrl}
            kind={it.kind ?? 'user'}
            reactions={it.reactions ?? []}
            tips={it.tips ?? []}
            onClick={() => open(it)}
          />
        </div>
      {/each}
    {/if}
    {#if !loading && shown.length === 0}
      <div class="empty">
        <EmptyState
          preset="no-results"
          title={t(EMPTY[tab].title)}
          body={t(EMPTY[tab].body)}
        />
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .panel {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-10);
    overflow: hidden;
    background: var(--surface-1);
  }

  .top {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    min-height: var(--control-md);
    padding: var(--space-10) 0 var(--space-10) var(--space-10);
  }

  /* the back button sits where the title's inset was */
  .title-row.with-back {
    gap: var(--space-6);
    padding-inline-start: 0;
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink);
  }

  .failed {
    padding: 0 var(--space-10);
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger);
  }

  .mark-all {
    flex: none;
    display: inline-flex;
    align-items: center;
    height: var(--control-md);
    padding: 0 var(--space-8);
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .mark-all:hover {
    background: var(--accent-soft);
  }

  .tabs,
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .feed {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .day {
    padding: var(--space-26) var(--space-8) var(--space-6);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3);
  }

  .day.first {
    padding-top: var(--space-8);
  }

  .empty {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: center;
  }
</style>
