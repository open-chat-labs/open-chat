<!-- Generated from lib/ComposerBar.dc.html (source hash 6f9180bd) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ComposerBar.logic.js';
  import type { Prize } from '../types';
  import Banner from './Banner.svelte';
  import MessageComposer from './MessageComposer.svelte';
  import TypingIndicator from './TypingIndicator.svelte';

  interface Props {
    placeholder?: string;
    value?: string;
    typingNames?: string[];
    ringColor?: string;
    bannerText?: string;
    bannerTone?: string;
    bannerAction?: string;
    onSend?: (text: string) => void;
    onAttach?: (kind: string) => void;
    onGif?: (query: string) => void;
    onVoice?: (r: { duration: number }) => void;
    attachment?: Prize | null;
    onEditAttachment?: () => void;
    onRemoveAttachment?: () => void;
    onAddMedia?: () => void;
    onRemoveMediaItem?: (index: number) => void;
    context?: { key: string; mode: 'reply' | 'edit'; name?: string; quote: string; thumb?: string; text?: string } | null;
    onCancelContext?: () => void;
    onSubmitEdit?: (text: string) => void;
    onJumpContext?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-12) var(--space-14);background:var(--surface-1,#0e0e12)">
  {#if v.hasBanner}
    <Banner tone={v.bannerTone} text={v.bannerText} actionLabel={v.bannerAction}></Banner>
  {/if}
  {#if v.isTyping}
    <div style="padding-left:4px"><TypingIndicator names={v.typingNames} ringColor={v.ringColor}></TypingIndicator></div>
  {/if}
  <MessageComposer placeholder={v.placeholder} attachment={v.attachment} onEditAttachment={v.onEditAttachment} onRemoveAttachment={v.onRemoveAttachment} onAddMedia={v.onAddMedia} onRemoveMediaItem={v.onRemoveMediaItem} onSend={v.onSend} onAttach={v.onAttach} onGif={v.onGif} onVoice={v.onVoice} context={v.context} onCancelContext={v.onCancelContext} onSubmitEdit={v.onSubmitEdit} onJumpContext={v.onJumpContext}></MessageComposer>
</div>
