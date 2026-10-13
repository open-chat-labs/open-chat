<!-- Generated from lib/ThreadPanel.dc.html (source hash e35352d5) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ThreadPanel.logic.js';
  import type { MessageGroupItem } from '../../lib/types';
  import IconButton from '../../lib/components/IconButton.svelte';
  import MessageComposer from '../../lib/components/MessageComposer.svelte';
  import MessageGroup from '../../lib/components/MessageGroup.svelte';
  import UnreadDivider from '../../lib/components/UnreadDivider.svelte';

  interface Props {
    onAttach?: (kind: string) => void;
    chatName?: string;
    threadKey?: string;
    root?: {author:string,color:string,text:string,time:string};
    replies?: MessageGroupItem[];
    newReplies?: MessageGroupItem[];
    faces?: string[];
    following?: boolean;
    onFollowChange?: (on: boolean) => void;
    onJump?: () => void;
    onSend?: (text: string) => void;
    asModal?: boolean;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-1,#0e0e12)">
  <div style="flex:none;height:var(--header-h,66px);box-sizing:border-box;display:flex;align-items:center;gap:var(--space-6);padding:0 var(--space-12) 0 {v.headPadStart};border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
    {#if v.showBack}
      <div style="flex:none;display:flex"><IconButton label="Back to details" variant="ghost" icon="back" onClick={v.onClose}></IconButton></div>
    {/if}
    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)"><span style="font:var(--weight-bold) var(--text-lg)/1 var(--font-sans);color:var(--ink,#ECECF1)">Thread</span><span style="font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#9A9AA8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.chatName)}</span></span>
    {#if v.showClose}
      <div style="flex:none;display:flex"><IconButton label="Close thread" variant="ghost" icon="close" onClick={v.onClose}></IconButton></div>
    {/if}
  </div>
  <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-14) var(--space-14) var(--space-12);border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
    <div style="display:flex;flex-direction:column;align-items:flex-start;gap:var(--space-8);padding:var(--space-12) var(--space-14);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04))">
      <div style="align-self:stretch;display:flex;align-items:center;gap:var(--space-8)"><span style="flex:none;width:22px;height:22px;border-radius:var(--radius-pill);background:{v.rootGrad}"></span><span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.rootAuthor)}</span><span style="flex:none;font:var(--weight-regular) var(--text-xs)/1 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(v.rootTime)}</span></div>
      <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:{v.rootClamp};-webkit-box-orient:vertical;overflow:hidden">{t(v.rootText)}</span>
      <div style="display:flex;align-items:center;gap:var(--space-14)">
        <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent-bright,#FF8298);cursor:pointer;user-select:none" onclick={v.onJump} role="button" tabindex="0">Jump to message</span>
        {#if v.rootLong}<span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#9A9AA8);cursor:pointer;user-select:none" onclick={v.toggleRoot} role="button" tabindex="0">{t(v.rootMore)}</span>{/if}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:var(--space-10);padding:0 var(--space-4)">
      <span style="flex:none;display:flex">{#each v.faces ?? [] as f, i0}<span style="width:22px;height:22px;margin-inline-end:-6px;border-radius:var(--radius-pill);background:{f};box-shadow:0 0 0 2px var(--surface-1,#0e0e12)"></span>{/each}</span>
      <span style="flex:1;min-width:0;margin-inline-start:var(--space-6);font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.peopleLine)}</span>
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;gap:var(--space-6);height:30px;padding:0 11px;box-sizing:border-box;border-radius:var(--radius-pill);background:{v.followBg};box-shadow:inset 0 0 0 1px {v.followLine};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{v.followInk};cursor:pointer;user-select:none" onclick={v.toggleFollow} role="button" tabindex="0" aria-pressed={v.following}><span style="width:13px;height:13px;background:currentColor;mask:{v.bellMask}"></span>{t(v.followLabel)}</span>
    </div>
  </div>
  <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:var(--space-14);padding:var(--space-16) var(--space-14)" use:ref={v.listRef}>
    {#if v.isEmpty}
      <span style="margin:auto 0;padding:var(--space-24) var(--space-12);font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-4,#8A8A99);text-align:center">No replies yet. Start the thread below.</span>
    {/if}
    {#each v.replies ?? [] as r, i1}
      <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MessageGroup side={r.side} senderName={r.name} color={r.color} messages={r.messages}></MessageGroup></div>
    {/each}
    {#if v.hasNew}
      <div style="display:grid;grid-template-columns:minmax(0,1fr)"><UnreadDivider label="New" tone="accent"></UnreadDivider></div>
      {#each v.newReplies ?? [] as r, i2}
        <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MessageGroup side={r.side} senderName={r.name} color={r.color} messages={r.messages}></MessageGroup></div>
      {/each}
    {/if}
  </div>
  <div style="flex:none;padding:0 var(--space-14) var(--space-16);display:grid;grid-template-columns:minmax(0,1fr)"><MessageComposer placeholder={v.composerPlaceholder} onSend={v.onSend} onVoice={v.onVoice} onGif={v.onGif} onAttach={v.onAttach}></MessageComposer></div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>
