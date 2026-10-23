<!-- Bottom of a conversation: optional status banner, who is typing, then the MessageComposer. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import Banner from './Banner.svelte';
  import MessageComposer from './MessageComposer.svelte';
  import TypingIndicator from './TypingIndicator.svelte';

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
</script>

<div class="bar">
  {#if bannerText}
    <Banner tone={bannerTone} text={bannerText} actionLabel={bannerAction} />
  {/if}
  {#if typingNames.length > 0}
    <div class="typing"><TypingIndicator names={typingNames} {ringColor} /></div>
  {/if}
  <MessageComposer {...composer} {attachment} {context} />
</div>

<style>
  .bar {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-12) var(--space-14);
    background: var(--surface-1);
  }

  .typing {
    padding-left: 4px;
  }
</style>
