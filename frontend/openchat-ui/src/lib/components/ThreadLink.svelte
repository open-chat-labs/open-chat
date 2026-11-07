<!-- A message's thread: "N replies" and when the last came, opening the thread. ChatBubble's thread line as its own
     component, so MessageGroup shows it under every kind of message. -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    /** Replies in the thread. */
    count: number;
    /** When the last reply came, e.g. "2:14 pm"; nothing shown without it. */
    lastAt?: string;
    onOpen?: () => void;
  }

  let { count, lastAt = '', onOpen }: Props = $props();
  const t = useT();

  function key(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onOpen?.();
  }
</script>

<div class="thread" onclick={onOpen} onkeydown={key} role="button" tabindex="0">
  <span class="thread-icon" data-oc-flip></span>
  <span class="thread-count">{t('ui.chatBubble.replies', { count })}</span>
  <span class="thread-meta">{lastAt ? t('ui.chatBubble.lastReply', { when: lastAt }) : ''}</span>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .thread {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    margin-top: var(--space-6);
    min-height: var(--control-sm);
    padding: var(--space-6) var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    cursor: pointer;
    align-self: flex-start;

    &:hover {
      background: var(--overlay-1);
    }
  }

  .thread-icon {
    @include icon(reply, 14px, var(--accent));
  }

  .thread-count,
  .thread-meta {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent);
    white-space: nowrap;
  }

  .thread-meta {
    font-weight: var(--weight-regular);
    color: var(--ink-3);
  }
</style>
