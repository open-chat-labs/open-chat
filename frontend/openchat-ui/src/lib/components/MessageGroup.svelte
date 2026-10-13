<!-- Generated from lib/MessageGroup.dc.html (source hash 39508894) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './MessageGroup.logic.js';
  import Avatar from './Avatar.svelte';
  import ChatBubble from './ChatBubble.svelte';
  import FileMessage from './FileMessage.svelte';
  import LinkPreview from './LinkPreview.svelte';
  import MediaMessage from './MediaMessage.svelte';
  import PollMessage from './PollMessage.svelte';
  import PrizeMessage from './PrizeMessage.svelte';
  import SwapOffer from './SwapOffer.svelte';
  import TransferMessage from './TransferMessage.svelte';
  import VoiceMessage from './VoiceMessage.svelte';

  interface Props {
    side?: string;
    senderName?: string;
    color?: string;
    showAvatar?: boolean;
    showName?: boolean;
    messages?: {kind?:'text'|'voice'|'image'|'album'|'video'|'gif'|'file'|'link'|'transfer'|'swap'|'poll'|'prize',text?:string,time:string,status?:string,forwarded?:boolean,edited?:boolean,deleted?:boolean}[];
    onThread?: (messageIndex: number) => void;
    onMessageMenu?: (index: number, pos: { point?: {x:number,y:number}, anchor?: {left:number,right:number,top:number,bottom:number}, align?: 'start'|'end' }) => void;
    activeMenu?: number;
    marked?: number;
    recentReactions?: string[];
    onReact?: (index: number, emoji: string) => void;
    onReactPicker?: (index: number, pos: object) => void;
    onReply?: (index: number) => void;
    onEdit?: (index: number) => void;
    onSwipeLeft?: (index: number) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;z-index:0;width:100%;box-sizing:border-box;display:flex;gap:var(--space-10);align-items:flex-start;flex-direction:{v.rowDirection}">
  {#if v.showAvatar}
    <span style="position:relative;z-index:1;flex:none;width:34px;height:34px;display:grid;place-items:center;overflow:visible;border-radius:50%;box-shadow:0 0 0 4px var(--surface-1,#0e0e12)"><Avatar size={34} color={v.color} online={false}></Avatar></span>
  {/if}
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-6);align-items:stretch;text-align:{v.columnText}">
    {#if v.showName}
      <span style="padding:0 var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(v.senderName)}</span>
    {/if}
    {#each v.messages ?? [] as msg, i0}
      <div style="position:relative;display:grid;grid-template-columns:minmax(0,1fr);border-radius:var(--radius-lg,14px);-webkit-touch-callout:none;touch-action:pan-y;z-index:{msg.markZ}" use:ref={msg.ref} data-msg="" onmousemove={msg.onMove} onmouseleave={msg.onLeave} onfocus={msg.onEnter} onblur={msg.onBlurOut} oncontextmenu={msg.onCtx} onkeydown={msg.onKey} onpointerdown={msg.onPDown} onpointermove={msg.onPMove} onpointerup={msg.onPUp} onpointercancel={msg.onPUp} onwheel={msg.onWheel} onclickcapture={msg.onClickCap} draggable="false" ondragstart={msg.noDrag}>
      <span style="position:absolute;top:-5px;bottom:-5px;inset-inline-start:-64px;inset-inline-end:-24px;z-index:-1;border-radius:0;background:color-mix(in oklch,var(--ink,#ECECF1) 2.5%,transparent);opacity:{msg.markOp};transition:opacity .2s ease-out;pointer-events:none" aria-hidden="true" data-msg-mark=""></span>
      <span style="position:absolute;top:50%;inset-inline-start:-48px;transition:transform .14s ease-out,background .14s;width:26px;height:26px;margin-top:-13px;border-radius:50%;background:var(--overlay-2,rgba(255,255,255,.1));display:none;align-items:center;justify-content:center;opacity:0;pointer-events:none" aria-hidden="true" data-swipe-hint=""><span style="width:14px;height:14px;background:var(--ink,#ECECF1);mask:{msg.rightMask}"></span></span>
      <span style="position:absolute;top:50%;inset-inline-end:-34px;transition:transform .14s ease-out,background .14s;width:26px;height:26px;margin-top:-13px;border-radius:50%;background:var(--overlay-2,rgba(255,255,255,.1));display:none;align-items:center;justify-content:center;opacity:0;pointer-events:none" aria-hidden="true" data-swipe-hint-end=""><span style="width:14px;height:14px;background:var(--ink,#ECECF1);mask:{msg.leftMask}"></span></span>
      {#if msg.isVoice}
        <VoiceMessage side={v.side} lastInGroup={msg.last} progress={msg.progress} elapsed={msg.elapsed} total={msg.total} time={msg.time}></VoiceMessage>
      {/if}
      {#if msg.isMedia}<MediaMessage side={v.side} lastInGroup={msg.last} kind={msg.kind} items={msg.items} caption={msg.caption} duration={msg.duration} size={msg.size} time={msg.time} status={msg.status}></MediaMessage>{/if}
      {#if msg.isFile}<FileMessage side={v.side} lastInGroup={msg.last} fileName={msg.fileName} size={msg.size} caption={msg.caption} time={msg.time}></FileMessage>{/if}
      {#if msg.isLink}<LinkPreview side={v.side} lastInGroup={msg.last} text={msg.text} url={msg.url} domain={msg.domain} title={msg.title} description={msg.description} imageBg={msg.imageBg} size={msg.size} time={msg.time}></LinkPreview>{/if}
      {#if msg.isTransfer}<TransferMessage side={v.side} lastInGroup={msg.last} amount={msg.amount} symbol={msg.symbol} mark={msg.mark} gradient={msg.gradient} usd={msg.usd} caption={msg.caption} time={msg.time}></TransferMessage>{/if}
      {#if msg.isSwap}<SwapOffer side={v.side} lastInGroup={msg.last} state={msg.state} give={msg.give} get={msg.get} expiresIn={msg.expiresIn} doneText={msg.doneText} time={msg.time}></SwapOffer>{/if}
      {#if msg.isPoll}<PollMessage side={v.side} lastInGroup={msg.last} question={msg.question} options={msg.options} multiple={msg.multiple} publicVotes={msg.publicVotes} endsIn={msg.endsIn} time={msg.time}></PollMessage>{/if}
      {#if msg.isPrize}<PrizeMessage lastInGroup={msg.last} token={msg.token} winners={msg.winners} claimed={msg.claimed} endsIn={msg.endsIn} endingSoon={msg.endingSoon} gates={msg.gates} wonAmount={msg.wonAmount} note={msg.note} time={msg.time}></PrizeMessage>{/if}
      {#if msg.isText}
        <ChatBubble side={v.side} lastInGroup={msg.last} text={msg.text} code={msg.code} time={msg.time} status={msg.status} forwarded={msg.forwarded} edited={msg.edited} deleted={msg.deleted} threadCount={msg.threadCount} threadLastAt={msg.threadLastAt} quoteName={msg.quoteName} quoteText={msg.quoteText} reactions={msg.reactions} failedText={msg.failedText} onToggleReaction={msg.onChip}></ChatBubble>
      {/if}
      {#if msg.showActs}
        <span style="position:absolute;top:-26px;left:{msg.actLeft};z-index:3;animation:ocActsIn .16s ease-out;display:flex;align-items:center;gap:2px;height:34px;padding:0 3px;border-radius:17px;background:var(--surface-3,#24242e);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 8px 20px rgba(0,0,0,.4)" data-msg-acts="" role="toolbar" aria-label="Message actions">
          {#each msg.quick ?? [] as q, i1}
            <span class="dc-p0" style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1;cursor:pointer;user-select:none;background:{q.bg};transition:transform .12s" onclick={q.pick} role="button" tabindex="0" aria-label={q.label} aria-pressed={q.onStr} onkeydown={q.key}>{t(q.char)}</span>
          {/each}
          <span class="dc-p1" style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-2,#C9C9D4)" use:ref={msg.emojiRef} onclick={msg.onEmoji} onkeydown={msg.onEmojiKey} role="button" tabindex="0" aria-label="More reactions" aria-haspopup="dialog" data-tip="React"><span style="width:15px;height:15px;background:currentColor;mask:var(--icon-emoji) center/contain no-repeat"></span></span>
          <span style="width:1px;height:16px;margin:0 3px;background:var(--line-2,rgba(255,255,255,.12))"></span>
          <span class="dc-p2" style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-2,#C9C9D4)" onclick={msg.onPrimary} onkeydown={msg.onPrimaryKey} role="button" tabindex="0" aria-label={msg.primaryLabel} data-tip={msg.primaryLabel}><span style="width:15px;height:15px;background:currentColor;mask:{msg.primaryMask}"></span></span>
          <span class="dc-p3" style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:{msg.moreBg};color:var(--ink-2,#C9C9D4);cursor:pointer" use:ref={msg.moreRef} onclick={msg.onMore} aria-label="More actions" aria-haspopup="menu" aria-expanded={msg.menuOpenStr} role="button" tabindex="0" onkeydown={msg.onMoreKey} data-tip="More"><span style="width:15px;height:15px;background:currentColor;mask:var(--icon-more) center/contain no-repeat"></span></span>
        </span>
      {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important;transform:scale(1.14) !important}
  .dc-p0:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p1:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p2:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p3:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
</style>
