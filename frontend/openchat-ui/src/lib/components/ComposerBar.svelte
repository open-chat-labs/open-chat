<!-- Bottom of a conversation: optional status banner, then the MessageComposer. Who is typing is a 24px strip resting
     on the bar (over its top padding) that rises into the messages: it takes no row, so the bar never changes height. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import Banner from './Banner.svelte';
  import MessageComposer from './MessageComposer.svelte';
  import { useT } from '../i18n';

  type ComposerProps = ComponentProps<typeof MessageComposer>;

  interface Props {
    /** Resource key (or literal text), passed to the composer. */
    placeholder?: string;
    /** The draft to start from, passed to the composer. */
    text?: ComposerProps['text'];
    onInput?: ComposerProps['onInput'];
    enterSends?: ComposerProps['enterSends'];
    autofocus?: ComposerProps['autofocus'];
    typingNames?: string[];
    /** The typing strip's background: the colour behind the bar (default --surface-1). */
    ringColor?: string;
    /** Resource key (or literal text). */
    bannerText?: string;
    bannerTone?: 'info' | 'warning' | 'danger' | 'offline';
    /** Resource key (or literal text). */
    bannerAction?: string;
    onSend?: ComposerProps['onSend'];
    onAttach?: ComposerProps['onAttach'];
    onGif?: ComposerProps['onGif'];
    onVoice?: ComposerProps['onVoice'];
    attachment?: ComposerProps['attachment'];
    onEditAttachment?: () => void;
    onRemoveAttachment?: () => void;
    onAddMedia?: () => void;
    onRemoveMediaItem?: (index: number) => void;
    context?: ComposerProps['context'];
    onCancelContext?: () => void;
    onSubmitEdit?: ComposerProps['onSubmitEdit'];
    onJumpContext?: () => void;
    /** Native hosts: passed to the composer (see MessageComposer). */
    plusPlacement?: ComposerProps['plusPlacement'];
    emojiPlacement?: ComposerProps['emojiPlacement'];
    onPlus?: ComposerProps['onPlus'];
    plusActive?: ComposerProps['plusActive'];
    onEmoji?: ComposerProps['onEmoji'];
    emojiActive?: ComposerProps['emojiActive'];
    onInputFocus?: ComposerProps['onInputFocus'];
    insert?: ComposerProps['insert'];
  }

  let {
    typingNames = [],
    ringColor = 'var(--surface-1)',
    bannerText = '',
    bannerTone = 'offline',
    bannerAction = '',
    attachment = null,
    context = null,
    ...composer
  }: Props = $props();
  const t = useT();

  // the strip keeps the last names while it fades out (their text follows the locale like any other)
  let lastNames = $state<string[]>([]);
  $effect(() => {
    if (typingNames.length > 0) lastNames = typingNames;
  });
  const shownNames = $derived(typingNames.length > 0 ? typingNames : lastNames);
  const typingText = $derived(
    shownNames.length > 0 ? t('ui.typingIndicator.typing', { count: shownNames.length, name: shownNames[0], second: shownNames[1] ?? '' }) : '',
  );
</script>

<div class="bar">
  {#if bannerText}
    <Banner tone={bannerTone} text={bannerText} actionLabel={bannerAction} />
  {/if}
  <div class="typing" class:shown={typingNames.length > 0} style:background={ringColor} aria-live="polite" aria-hidden={typingNames.length > 0 ? undefined : 'true'}>
    <span class="dots" aria-hidden="true"><span class="dot" data-oc-dot></span><span class="dot" data-oc-dot></span><span class="dot" data-oc-dot></span></span>
    <span class="typing-text">{typingText}</span>
  </div>
  <MessageComposer {...composer} {attachment} {context} />
</div>

<style lang="scss">
  .bar {
    position: relative;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-12) var(--space-14);
    background: var(--surface-1);
  }

  .typing {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% - 6px);
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 16px;
    box-sizing: border-box;
    pointer-events: none;
    font: var(--weight-medium) var(--text-xs) / 16px var(--font-sans);
    color: var(--accent-bright);
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity 0.2s ease,
      transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .typing.shown {
    opacity: 1;
    transform: none;
  }

  .dots {
    flex: none;
    display: flex;
    align-items: center;
    gap: 3px;
    height: 16px;
  }

  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    animation: oc-typing 1.2s infinite;
  }

  .dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  .typing-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .typing {
      transition: none;
    }
  }
</style>
