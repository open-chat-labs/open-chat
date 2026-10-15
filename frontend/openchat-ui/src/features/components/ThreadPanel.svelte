<!-- An open thread: the root stays pinned as a compact card above the replies, with who's in it and a Follow toggle.
     Lives in the right side panel on wide windows (back arrow) and in a modal on narrow ones (asModal: close button).
     Scrolls to the newest reply on open, on a new threadKey and when replies arrive. Sends carry the threadKey; a send that
     returns a promise keeps the draft until it resolves. Follow flips at once and rolls back if onFollowChange rejects. -->
<script lang="ts">
  import { Optimistic } from '../../lib/behaviours/optimistic.svelte';
  import { untrack } from 'svelte';
  import type { MessageGroupItem } from '../../lib/types';
  import IconButton from '../../lib/components/IconButton.svelte';
  import MessageComposer from '../../lib/components/MessageComposer.svelte';
  import MessageGroup from '../../lib/components/MessageGroup.svelte';
  import UnreadDivider from '../../lib/components/UnreadDivider.svelte';
  import { useT } from '../../lib/i18n';

  const GRADIENTS: Record<string, string> = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    rose: 'linear-gradient(140deg,#ff7a9c,#d6336c)',
    plum: 'linear-gradient(140deg,#b06bff,#5b2a86)',
    slate: 'linear-gradient(140deg,#8a93a6,#3b4252)',
  };
  const grad = (c: string) => GRADIENTS[c] || GRADIENTS.violet;

  interface Props {
    /** Conversation the thread belongs to. */
    chatName: string;
    /** Identifies the thread; a new key resets the card and scrolls to the end. */
    threadKey?: string;
    root: { author: string; color: string; text: string; time: string };
    replies?: MessageGroupItem[];
    /** Replies since you last looked, below a "New" divider. */
    newReplies?: MessageGroupItem[];
    /** Participant colours (first four shown). */
    faces?: string[];
    following?: boolean;
    /** Rolls the toggle back if it rejects. */
    onFollowChange?: (on: boolean) => Promise<unknown> | void;
    onJump?: () => void;
    /** A text reply. Reject to keep the draft (with an error). */
    onSend?: (r: { threadKey?: string; text: string }) => Promise<unknown> | void;
    /** The GIF picked in the composer's picker (the host resolves and sends it). */
    onGif?: (r: { threadKey?: string; query: string }) => void;
    /** A recorded voice reply; voice is hidden without it. Reject to keep the take. */
    onVoice?: (r: { threadKey?: string; blob: Blob; duration: number; mimeType: string }) => Promise<unknown> | void;
    onAttach?: (kind: 'media' | 'file' | 'poll' | 'prize' | 'crypto' | 'swap' | 'memeFighter') => void;
    asModal?: boolean;
    onClose?: () => void;
  }

  let {
    chatName,
    threadKey,
    root,
    replies = [],
    newReplies = [],
    faces = [],
    following = false,
    onFollowChange,
    onJump,
    onSend,
    onGif,
    onVoice,
    onAttach,
    asModal = false,
    onClose,
  }: Props = $props();
  const t = useT();

  let list: HTMLDivElement;
  let rootOpen = $state(false);
  // optimistic follow (lib/behaviours/optimistic.svelte.ts); a new thread starts from the host's value
  let followState = $state.raw(new Optimistic(() => following));
  const on = $derived(followState.current);

  const total = $derived(replies.length + newReplies.length);
  const firstName = $derived(root.author.split(' ')[0]);

  function toBottom() {
    requestAnimationFrame(() => {
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  // a different thread starts collapsed, with its own follow state
  let lastKey = untrack(() => threadKey);
  $effect(() => {
    const key = threadKey;
    untrack(() => {
      if (key !== lastKey) {
        lastKey = key;
        rootOpen = false;
        followState = new Optimistic(() => following);
      }
    });
  });

  $effect(() => {
    void threadKey;
    void replies.length;
    toBottom();
  });

  async function send(text: string) {
    const result = onSend?.({ threadKey, text });
    toBottom();
    await result;
  }

  // the host's `following` is followed again once nothing is in flight
  $effect.pre(() => {
    void following;
    untrack(() => followState.sync());
  });

  function follow() {
    const next = !on;
    followState.set(next, () => onFollowChange?.(next));
  }
</script>

<div class="thread">
  <div class="header" class:modal={asModal}>
    {#if !asModal}
      <div class="icon-slot"><IconButton label="ui.threadPanel.backToDetails" variant="ghost" icon="back" onClick={() => onClose?.()} /></div>
    {/if}
    <span class="heading"><span class="title">{t('ui.threadPanel.title')}</span><span class="chat">{chatName}</span></span>
    {#if asModal}
      <div class="icon-slot"><IconButton label="ui.threadPanel.closeThread" variant="ghost" icon="close" onClick={() => onClose?.()} /></div>
    {/if}
  </div>
  <div class="summary">
    <div class="root">
      <div class="root-line"><span class="root-face" style:background={grad(root.color)}></span><span class="root-author">{root.author}</span><span class="root-time">{root.time}</span></div>
      <span class="root-text" style:-webkit-line-clamp={rootOpen ? 'unset' : '2'}>{root.text}</span>
      <div class="root-actions">
        <span class="jump" onclick={() => onJump?.()} role="button" tabindex="0">{t('ui.threadPanel.jumpToMessage')}</span>
        {#if root.text.length > 110}<span class="more" onclick={() => (rootOpen = !rootOpen)} role="button" tabindex="0">{t(rootOpen ? 'ui.common.less' : 'ui.common.more')}</span>{/if}
      </div>
    </div>
    <div class="people">
      <span class="faces">{#each faces.slice(0, 4) as f}<span class="face" style:background={grad(f)}></span>{/each}</span>
      <span class="people-line">{t('ui.threadPanel.peopleAndReplies', { people: faces.length, replies: total })}</span>
      <span
        class="follow"
        class:on
        onclick={follow}
        role="button"
        tabindex="0"
        aria-pressed={on}><span class="bell"></span>{t(on ? 'ui.threadPanel.following' : 'ui.threadPanel.follow')}</span
      >
    </div>
  </div>
  <div class="replies" bind:this={list}>
    {#if total === 0}
      <span class="empty">{t('ui.threadPanel.empty')}</span>
    {/if}
    {#each replies as r}
      <div class="cell"><MessageGroup side={r.side} senderName={r.name ?? ''} color={r.color} messages={r.messages} /></div>
    {/each}
    {#if newReplies.length > 0}
      <div class="cell"><UnreadDivider label={t('ui.threadPanel.new')} tone="accent" /></div>
      {#each newReplies as r}
        <div class="cell"><MessageGroup side={r.side} senderName={r.name ?? ''} color={r.color} messages={r.messages} /></div>
      {/each}
    {/if}
  </div>
  <div class="composer">
    <MessageComposer
      placeholder={t('ui.threadPanel.replyTo', { name: firstName })}
      onSend={send}
      onGif={onGif ? (query) => onGif({ threadKey, query }) : undefined}
      onVoice={onVoice ? (r) => onVoice({ threadKey, ...r }) : undefined}
      {onAttach}
    />
  </div>
</div>

<style>
  .thread {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1, #0e0e12);
  }

  /* side panel: back to the details, like pinned messages; modal (narrow): close only */
  .header {
    flex: none;
    height: var(--header-h, 66px);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: 0 var(--space-12) 0 var(--space-8);
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .header.modal {
    padding-left: var(--space-18);
  }

  .icon-slot {
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
    color: var(--ink, #ececf1);
  }

  .chat {
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .summary {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-14) var(--space-14) var(--space-12);
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .root {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-8);
    padding: var(--space-12) var(--space-14);
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .root-line {
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .root-face {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-pill);
  }

  .root-author {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .root-time {
    flex: none;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .root-text {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .root-actions {
    display: flex;
    align-items: center;
    gap: var(--space-14);
  }

  .jump,
  .more {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent-bright, #ff8298);
    cursor: pointer;
    user-select: none;
  }

  .more {
    color: var(--ink-3, #9a9aa8);
  }

  .people {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding: 0 var(--space-4);
  }

  .faces {
    flex: none;
    display: flex;
  }

  .face {
    width: 22px;
    height: 22px;
    margin-inline-end: -6px;
    border-radius: var(--radius-pill);
    box-shadow: 0 0 0 2px var(--surface-1, #0e0e12);
  }

  .people-line {
    flex: 1;
    min-width: 0;
    margin-inline-start: var(--space-6);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .follow {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 30px;
    padding: 0 11px;
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
    user-select: none;
  }

  .follow.on {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
    color: var(--accent-bright, #ff8298);
  }

  .follow:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .bell {
    width: 13px;
    height: 13px;
    background: currentColor;
    mask: var(--icon-bell) center/contain no-repeat;
  }

  .replies {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    padding: var(--space-16) var(--space-14);
  }

  .empty {
    margin: auto 0;
    padding: var(--space-24) var(--space-12);
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-align: center;
  }

  .cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .composer {
    flex: none;
    padding: 0 var(--space-14) var(--space-16);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
</style>
