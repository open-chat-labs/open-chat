<!-- All threads you've replied in or follow, grouped by conversation (chats) or by channel (a community). All / Unread filter. -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import IconButton from '../../lib/components/IconButton.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';

  interface Thread {
    author: string;
    /** Author avatar background. */
    grad: string;
    time: string;
    text: string;
    /** e.g. "4 replies". */
    count: string;
    /** New replies since you last looked. */
    unread?: number;
    /** You follow it without having replied. */
    followOnly?: boolean;
    selected?: boolean;
    onOpen?: () => void;
  }

  interface Props {
    /** Where the threads come from, under the title. */
    /** Resource key (or literal text). */
    scopeLabel?: string;
    groups: { name: string; grad: string; radius: string; threads: Thread[] }[];
    /** Match the chat list header: 54px plain, 62px with the community avatar. */
    headerHeight?: string;
    onBack?: () => void;
  }

  let { scopeLabel = 'ui.threadList.scopeChats', groups, headerHeight = '54px', onBack }: Props = $props();
  const t = useT();

  let filter = $state(0);

  const unreadCount = $derived(groups.reduce((n, g) => n + g.threads.filter((th) => th.unread).length, 0));
  const shown = $derived(groups.map((g) => ({ ...g, threads: filter === 1 ? g.threads.filter((th) => th.unread) : g.threads })).filter((g) => g.threads.length > 0));
</script>

<div class="threads">
  <div class="header" style:height={headerHeight}>
    <div class="back"><IconButton label="ui.threadList.backToChats" variant="ghost" icon="back" onClick={() => onBack?.()} /></div>
    <span class="heading"><span class="title">{t('ui.threadList.title')}</span><span class="scope">{t(scopeLabel)}</span></span>
  </div>
  <div class="filter">
    <SegmentedTabs labels={[t('ui.threadList.all'), t('ui.threadList.unread')]} counts={[null, unreadCount || null]} dotOnLast={false} selectedIndex={filter} onSelect={(i) => (filter = i)} />
  </div>
  <div class="list">
    {#each shown as g}
      <div class="group">
        <div class="group-head">
          <span class="group-mark" style:border-radius={g.radius} style:background={g.grad}></span>
          <span class="group-name">{g.name}</span>
          <span class="group-count">{g.threads.length}</span>
        </div>
        {#each g.threads as th}
          <div class="thread" class:selected={th.selected} onclick={th.onOpen} role="button" tabindex="0" aria-current={th.selected}>
            <span class="face" style:background={th.grad}></span>
            <span class="body">
              <span class="line"><span class="author">{th.author}</span><span class="time">{th.time}</span></span>
              <span class="text">{th.text}</span>
              <span class="meta"
                >{th.count}{#if th.unread}<span class="new"><span class="dot"></span>{t('ui.threadList.newCount', { count: th.unread })}</span>{/if}{#if th.followOnly}<span class="following">· {t('ui.threadList.following')}</span>{/if}</span
              >
            </span>
          </div>
        {/each}
      </div>
    {/each}
    {#if shown.length === 0}
      <span class="empty">{t(filter === 1 ? 'ui.threadList.caughtUp' : 'ui.threadList.empty')}</span>
    {/if}
  </div>
</div>

<style>
  .threads {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    flex: none;
    margin: var(--space-10) var(--space-10) 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-4) 0 0;
  }

  .back {
    flex: none;
    display: flex;
  }

  .heading {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1 var(--font-sans);
    color: var(--ink);
  }

  .scope {
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filter {
    flex: none;
    padding: var(--space-10) var(--space-10) var(--space-4);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-18);
    padding: var(--space-14) var(--space-10) var(--space-16);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .group-head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-8) var(--space-4);
  }

  .group-mark {
    flex: none;
    width: 18px;
    height: 18px;
  }

  .group-name {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .group-count {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .thread {
    display: flex;
    gap: var(--space-10);
    padding: var(--space-10);
    border-radius: var(--radius-md);
    cursor: pointer;
    background: transparent;
  }

  .thread.selected {
    background: var(--overlay-2);
  }

  .thread:hover {
    background: var(--overlay-1);
  }

  .face {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-pill);
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .author {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .time {
    flex: none;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .text {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent-bright);
  }

  .new {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: var(--weight-medium);
    color: var(--ink-2);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }

  .following {
    font-weight: var(--weight-medium);
    color: var(--ink-4);
  }

  .empty {
    padding: var(--space-24) var(--space-12);
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4);
    text-align: center;
  }
</style>
