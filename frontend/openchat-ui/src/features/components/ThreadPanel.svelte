<!-- An open thread: the root stays pinned as a compact card above the replies, with who's in it and a Follow toggle.
     Lives in the right side panel on wide windows (back arrow) and in a modal on narrow ones (asModal: close button).
     Scrolls to the newest reply on open, on a new threadKey and when replies arrive. Sends carry the threadKey; a send that
     returns a promise keeps the draft until it resolves. Follow shows a spinner (and takes no click) while onFollowChange
     is in flight, then the new state; it stays as it was if that rejects.
     A host with its own message list and composer passes them (`list`, `composer`) in place of the panel's own: the list
     then scrolls itself, and `replyCount` says how many replies there are. -->
<script lang="ts">
  import { Waited } from '../../lib/behaviours/waited.svelte';
  import { untrack, type Snippet } from 'svelte';
  import type { MessageGroupItem } from '../../lib/types';
  import IconButton from '../../lib/components/IconButton.svelte';
  import MessageComposer from '../../lib/components/MessageComposer.svelte';
  import MessageGroup from '../../lib/components/MessageGroup.svelte';
  import Spinner from '../../lib/components/Spinner.svelte';
  import UnreadDivider from '../../lib/components/UnreadDivider.svelte';
  import { useT } from '../../lib/i18n';
  import { AVATAR_GRADIENTS } from '../../lib/components/Avatar.svelte';

  const GRADIENTS: Record<string, string> = {
    // a person's, chat's or community's swatch is Avatar's, as everywhere (one gradient per name)
    ...AVATAR_GRADIENTS,
    rose: 'linear-gradient(140deg,#ff7a9c,#d6336c)',
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
    /** The host's own list of the replies, in place of `replies` / `newReplies`; it scrolls itself. */
    list?: Snippet;
    /** The host's own composer, in place of the panel's (`onSend`, `onGif`, `onVoice` and `onAttach` are then unused). */
    composer?: Snippet;
    /** How many replies there are, for "N people · N replies", when the host lists them (`list`). */
    replyCount?: number;
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
    list,
    composer,
    replyCount,
  }: Props = $props();
  const t = useT();

  let scroller: HTMLDivElement | undefined = $state();
  let rootOpen = $state(false);
  // follow, waited for (lib/behaviours/waited.svelte.ts); a new thread starts from the host's value
  let followState = $state.raw(new Waited(() => following));
  const on = $derived(followState.current);
  const busy = $derived(followState.pending);

  const total = $derived(replyCount ?? replies.length + newReplies.length);
  const firstName = $derived(root.author.split(' ')[0]);

  function toBottom() {
    requestAnimationFrame(() => {
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
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
        followState = new Waited(() => following);
      }
    });
  });

  // (a host's own list scrolls itself)
  $effect(() => {
    void threadKey;
    void replies.length;
    if (!list) toBottom();
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
    if (busy) return;
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
        class:busy
        onclick={follow}
        role="button"
        tabindex="0"
        aria-pressed={on}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        >{#if busy}<span class="wait"><Spinner size={13} tone={on ? 'accent' : 'ink'} /></span>{:else}<span class="bell"></span>{/if}{t(on ? 'ui.threadPanel.following' : 'ui.threadPanel.follow')}</span
      >
    </div>
  </div>
  {#if list}
    <div class="replies hosted">{@render list()}</div>
  {:else}
    <div class="replies" bind:this={scroller}>
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
  {/if}
  {#if composer}
    <div class="composer hosted">{@render composer()}</div>
  {:else}
    <div class="composer">
      <MessageComposer
        placeholder={t('ui.threadPanel.replyTo', { name: firstName })}
        onSend={send}
        onGif={onGif ? (query) => onGif({ threadKey, query }) : undefined}
        onVoice={onVoice ? (r) => onVoice({ threadKey, ...r }) : undefined}
        {onAttach}
      />
    </div>
  {/if}
</div>

<style lang="scss">
  .thread {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1);
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
    border-bottom: 1px solid var(--line-1);
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
    color: var(--ink);
  }

  .chat {
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
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
    border-bottom: 1px solid var(--line-1);
  }

  .root {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-8);
    padding: var(--space-12) var(--space-14);
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
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
    color: var(--ink);
  }

  .root-time {
    flex: none;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .root-text {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-2);
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
    color: var(--accent-bright);
    cursor: pointer;
    user-select: none;
  }

  .more {
    color: var(--ink-3);
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
    box-shadow: 0 0 0 2px var(--surface-1);
  }

  .people-line {
    flex: 1;
    min-width: 0;
    margin-inline-start: var(--space-6);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
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
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .follow.on {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent);
    color: var(--accent-bright);
  }

  .follow:hover {
    background: var(--overlay-2);
  }

  .follow.busy {
    cursor: default;
  }

  .wait {
    display: flex;
    width: 13px;
    height: 13px;
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

  /* a host's own list: it lays itself out and scrolls itself */
  .replies.hosted {
    position: relative;
    overflow: hidden;
    gap: 0;
    padding: 0;
  }

  .empty {
    margin: auto 0;
    padding: var(--space-24) var(--space-12);
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4);
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

  /* a host's own composer brings its own spacing */
  .composer.hosted {
    padding: 0;
  }
</style>
