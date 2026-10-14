<!-- Activity feed: reactions, mentions, replies and payments, grouped by day, filtered by All / Mentions / Payments.
     Opening a row calls onOpen(item) (chatId + messageId land on the message, payments included) and marks it read through
     onMarkRead; "Mark all read" calls onMarkAllRead. Read state comes from `unread` on each item; local marks are optimistic
     and roll back with an error if the host rejects. Items are identified by `id`, never by title. -->
<script lang="ts" module>
  export interface ActivityItem {
    id: string;
    /** Day heading the item sits under; consecutive items share it. */
    day: string;
    title: string;
    context: string;
    preview?: string;
    time: string;
    unread?: boolean;
    color?: 'violet' | 'blue' | 'teal' | 'amber' | 'plum';
    kind?: 'user' | 'group';
    reactions?: string[];
    type?: 'reaction' | 'mention' | 'reply' | 'payment';
    /** Chat to open. */
    chatId: string;
    /** Message to land on. */
    messageId?: string;
  }
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  import ActivityRow from '../../lib/components/ActivityRow.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';

  interface Props {
    items: ActivityItem[];
    onOpen?: (item: ActivityItem) => void;
    /** Mark these items read (opening one marks it). Rolls back if it rejects. */
    onMarkRead?: (ids: string[]) => Promise<unknown> | void;
    /** "Mark all read"; hidden without it (or onMarkRead). Rolls back if it rejects. */
    onMarkAllRead?: () => Promise<unknown> | void;
    loading?: boolean;
  }

  let { items, onOpen, onMarkRead, onMarkAllRead, loading = false }: Props = $props();
  const t = useT();

  let tab = $state(0);
  // ids marked read here, until the host's items catch up
  let read = $state<string[]>([]);
  let failed = $state(false);

  const isUnread = (it: ActivityItem) => !!it.unread && !read.includes(it.id);
  const shown = $derived(items.filter((it) => tab === 0 || (tab === 1 && it.type === 'mention') || (tab === 2 && it.type === 'payment')));
  const counts = $derived([items.length, items.filter((i) => i.type === 'mention').length, items.filter((i) => i.type === 'payment').length]);
  const hasUnread = $derived(items.some(isUnread));

  async function markRead(ids: string[], call: () => Promise<unknown> | void) {
    const fresh = ids.filter((id) => !read.includes(id));
    if (!fresh.length) return;
    failed = false;
    read = [...read, ...fresh];
    try {
      await call();
    } catch {
      read = read.filter((id) => !fresh.includes(id));
      failed = true;
    }
  }

  function open(it: ActivityItem) {
    if (isUnread(it) && onMarkRead) markRead([it.id], () => onMarkRead([it.id]));
    onOpen?.(it);
  }

  function markAll() {
    const ids = items.filter(isUnread).map((i) => i.id);
    if (onMarkAllRead) markRead(ids, onMarkAllRead);
    else if (onMarkRead) markRead(ids, () => onMarkRead(ids));
  }
</script>

<div class="panel" data-screen-label="Activity">
  <div class="top">
    <div class="title-row">
      <span class="title">{t('ui.activityPanel.title')}</span>
      {#if hasUnread && (onMarkAllRead || onMarkRead)}
        <span class="mark-all" onclick={markAll} role="button" tabindex="0">{t('ui.activityPanel.markAllRead')}</span>
      {/if}
    </div>
    {#if failed}<span class="failed" role="alert">{t('ui.activityPanel.markFailed')}</span>{/if}
    <div class="tabs"><SegmentedTabs labels={[t('ui.activityPanel.tabAll'), t('ui.activityPanel.tabMentions'), t('ui.activityPanel.tabPayments')]} {counts} selectedIndex={tab} dotOnLast={false} onSelect={(i) => (tab = i)} /></div>
  </div>

  <div class="feed">
    {#if loading}
      <Skeleton variant="activity" count={7} />
    {:else}
      {#each shown as it, i (it.id)}
        {#if i === 0 || shown[i - 1].day !== it.day}
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
            kind={it.kind ?? 'user'}
            reactions={it.reactions ?? []}
            onClick={() => open(it)}
          />
        </div>
      {/each}
    {/if}
    {#if shown.length === 0}
      <div class="empty">
        <EmptyState
          preset="no-results"
          title={t(tab === 1 ? 'ui.activityPanel.noMentions' : 'ui.activityPanel.noPayments')}
          body={t(tab === 1 ? 'ui.activityPanel.noMentionsBody' : 'ui.activityPanel.noPaymentsBody')}
        />
      </div>
    {/if}
  </div>
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
    overflow: hidden;
    background: var(--surface-1, #0e0e12);
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
    min-height: var(--control-md, 34px);
    padding: var(--space-10) 0 var(--space-10) var(--space-10);
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
  }

  .failed {
    padding: 0 var(--space-10);
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .mark-all {
    flex: none;
    display: inline-flex;
    align-items: center;
    height: var(--control-md, 34px);
    padding: 0 var(--space-8);
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .mark-all:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
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
    color: var(--ink-3, #8a8a99);
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
