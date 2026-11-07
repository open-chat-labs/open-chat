<!-- A message's thread (design pass 8, ChatBubble's thread link): a bordered pill under the message and its reactions:
     up to three overlapping faces of those in the thread (or the reply arrow without them), "N replies", "· N new" and
     when the last reply came, opening the thread. On the accent while it's the thread open beside the conversation.
     Its own component, by hand, so MessageGroup shows the same link under every other kind of message. -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    /** Replies in the thread. */
    count: number;
    /** When the last reply came, e.g. "2:14 pm"; nothing shown without it. */
    lastAt?: string;
    /** Those in the thread, as CSS backgrounds (colours or gradients): up to three show; the reply arrow without them. */
    faces?: string[];
    /** Unread replies: "· N new" after the count. */
    newCount?: number;
    /** It's the thread open (beside the conversation): the accent border on the soft accent. */
    active?: boolean;
    /** Right-aligned layouts (native sent bubbles): the link at the inline end, under the message. */
    mirror?: boolean;
    onOpen?: () => void;
  }

  let { count, lastAt = '', faces = [], newCount = 0, active = false, mirror = false, onOpen }: Props = $props();
  const t = useT();

  const shown = $derived(faces.slice(0, 3));
  const replies = $derived(t('ui.chatBubble.replies', { count }));
  const label = $derived(
    newCount > 0 ? t('ui.chatBubble.openThreadNew', { replies, fresh: newCount }) : t('ui.chatBubble.openThread', { replies }),
  );

  function key(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onOpen?.();
  }
</script>

<div
  class="thread"
  class:active
  class:mirror
  class:faced={shown.length > 0}
  onclick={onOpen}
  onkeydown={key}
  role="button"
  tabindex="0"
  aria-label={label}
  aria-current={active || undefined}
  title={t('ui.chatBubble.openThreadTitle')}
>
  {#if shown.length > 0}
    <span class="faces">
      {#each shown as face}
        <span class="face" style:background={face}></span>
      {/each}
    </span>
  {:else}
    <span class="thread-icon" data-oc-flip></span>
  {/if}
  <span class="thread-count">{replies}</span>
  {#if newCount > 0}
    <span class="thread-new">{t('ui.chatBubble.threadNew', { count: newCount })}</span>
  {/if}
  {#if lastAt}
    <span class="thread-meta">{t('ui.chatBubble.lastReply', { when: lastAt })}</span>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .thread {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    /* under the message, as wide as what it says (a grid or column item would otherwise stretch) */
    justify-self: start;
    align-self: flex-start;
    width: fit-content;
    max-width: 100%;
    min-width: 0;
    margin-top: var(--space-6);
    height: 34px;
    padding: 0 var(--space-12) 0 var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2);
    cursor: pointer;
    user-select: none;
    transition:
      background 0.12s,
      box-shadow 0.12s;

    &.faced {
      padding-inline-start: var(--space-6);
    }

    &.mirror {
      justify-self: end;
      align-self: flex-end;
    }

    &.active {
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 1px var(--accent);
    }

    /* after .active: hovered, an open thread's link is --overlay-1 too, keeping its accent border (pass 8) */
    &:hover {
      background: var(--overlay-1);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .faces {
    display: flex;
    flex: none;
    margin-inline-end: var(--space-4);
  }

  .face {
    width: 22px;
    height: 22px;
    margin-inline-end: -6px;
    border-radius: var(--radius-pill);
    box-shadow: 0 0 0 2px var(--surface-1);
  }

  .thread-icon {
    flex: none;
    @include icon(reply, 14px, var(--accent-bright));
  }

  .thread-count,
  .thread-new,
  .thread-meta {
    white-space: nowrap;
  }

  .thread-count {
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--accent-bright);
  }

  .thread-new {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
  }

  .thread-meta {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }
</style>
