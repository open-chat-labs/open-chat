<!-- A message's thread: a compact card under the message and its reactions, as wide as what it says: who's in the
     thread (overlapping faces, "+N" past three), "N replies" and when the last came, opening the thread. Accent-outlined
     while it's the thread open beside the conversation. ChatBubble's thread line as its own component, so MessageGroup
     shows it under every kind of message. -->
<script lang="ts">
  import { useT } from '../i18n';
  import AvatarStack from './AvatarStack.svelte';

  interface Props {
    /** Replies in the thread. */
    count: number;
    /** When the last reply came, e.g. "2:14 pm"; nothing shown without it. */
    lastAt?: string;
    /** Those in the thread, as CSS backgrounds (AvatarStack's people); the reply icon shows without them. */
    faces?: string[];
    /** It's the thread open (beside the conversation): accent outline and tint. */
    selected?: boolean;
    onOpen?: () => void;
  }

  let { count, lastAt = '', faces = [], selected = false, onOpen }: Props = $props();
  const t = useT();

  function key(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onOpen?.();
  }
</script>

<div class="thread" class:selected onclick={onOpen} onkeydown={key} role="button" tabindex="0" aria-current={selected || undefined}>
  {#if faces.length > 0}
    <AvatarStack people={faces} max={4} size={20} ring="var(--thread-bg)" />
  {:else}
    <span class="thread-icon" data-oc-flip></span>
  {/if}
  <span class="thread-count">{t('ui.chatBubble.replies', { count })}</span>
  {#if lastAt}
    <span class="thread-meta">{t('ui.chatBubble.lastReply', { when: lastAt })}</span>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .thread {
    --thread-bg: var(--card);
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
    min-height: var(--control-sm);
    padding: var(--space-4) var(--space-12) var(--space-4) var(--space-6);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--thread-bg);
    box-shadow: inset 0 0 0 1px var(--line-2);
    cursor: pointer;
    user-select: none;
    transition:
      background 0.12s,
      box-shadow 0.12s;

    &:hover {
      --thread-bg: color-mix(in oklch, var(--ink) 5%, var(--card));
    }

    &.selected {
      --thread-bg: color-mix(in oklch, var(--accent) 12%, var(--card));
      box-shadow: inset 0 0 0 1px var(--accent);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .thread-icon {
    flex: none;
    margin-inline-start: var(--space-4);
    @include icon(reply, 14px, var(--accent));
  }

  .thread-count,
  .thread-meta {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent);
    white-space: nowrap;
  }

  .thread-meta {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: var(--weight-regular);
    color: var(--ink-3);
  }
</style>
