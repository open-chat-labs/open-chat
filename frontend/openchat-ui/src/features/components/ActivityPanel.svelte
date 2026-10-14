<!-- Activity feed: reactions, mentions, replies and payments, grouped by day, filtered by All / Mentions / Payments.
     Opening a row marks it read and calls onOpen(chat, item) — every row lands on the message in its chat, payments included. -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import ActivityRow from '../../lib/components/ActivityRow.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';

  interface ActivityItem {
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
    chat?: string;
  }

  interface Props {
    items: ActivityItem[];
    onOpen?: (chat: string | undefined, item: ActivityItem) => void;
    loading?: boolean;
  }

  let { items, onOpen, loading = false }: Props = $props();
  const t = useT();

  let tab = $state(0);
  // titles opened (or marked) here
  let read = $state<string[]>([]);

  const isUnread = (it: ActivityItem) => !!it.unread && !read.includes(it.title);
  const shown = $derived(items.filter((it) => tab === 0 || (tab === 1 && it.type === 'mention') || (tab === 2 && it.type === 'payment')));
  const counts = $derived([items.length, items.filter((i) => i.type === 'mention').length, items.filter((i) => i.type === 'payment').length]);
  const hasUnread = $derived(items.some(isUnread));

  function open(it: ActivityItem) {
    if (!read.includes(it.title)) read = [...read, it.title];
    onOpen?.(it.chat, it);
  }
</script>

<div class="panel" data-screen-label="Activity">
  <div class="top">
    <div class="title-row">
      <span class="title">{t('ui.activityPanel.title')}</span>
      {#if hasUnread}
        <span class="mark-all" onclick={() => (read = items.map((i) => i.title))} role="button" tabindex="0">{t('ui.activityPanel.markAllRead')}</span>
      {/if}
    </div>
    <div class="tabs"><SegmentedTabs labels={[t('ui.activityPanel.tabAll'), t('ui.activityPanel.tabMentions'), t('ui.activityPanel.tabPayments')]} {counts} selectedIndex={tab} dotOnLast={false} onSelect={(i) => (tab = i)} /></div>
  </div>

  <div class="feed">
    {#if loading}
      <Skeleton variant="activity" count={7} />
    {:else}
      {#each shown as it, i}
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
