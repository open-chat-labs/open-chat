<!-- Generated from lib/ChatBubble.dc.html (source hash 1c51c112) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ChatBubble.logic.js';

  interface Props {
    text?: string;
    time?: string;
    failedText?: string;
    forwarded?: boolean;
    edited?: boolean;
    deleted?: boolean;
    maxReactionRows?: number;
    onShowAllReactions?: () => void;
    threadCount?: number;
    threadLastAt?: string;
    onOpenThread?: () => void;
    lastInGroup?: boolean;
    status?: string;
    side?: string;
    quoteName?: string;
    quoteText?: string;
    reactions?: {emoji: string, count: number}[];
    onToggleReaction?: (emoji: string) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;display:flex;justify-content:flex-start">
  {#if v.isDeleted}
    <div style="max-width:675px;min-width:0;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-12) var(--space-14);box-sizing:border-box;border-radius:{v.deletedRadius};box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
      <span style="flex:none;width:14px;height:14px;background:var(--ink-4,#6E6E7C);mask:{v.trashMask}"></span>
      <span style="font:var(--weight-regular) var(--text-base)/1.4 var(--font-sans);font-style:italic;color:var(--ink-4,#6E6E7C)">{t(v.deletedText)}</span>
      <span style="flex:none;margin-inline-start:var(--space-6);font:var(--weight-regular) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#6E6E7C)">{t(v.time)}</span>
    </div>
  {/if}
  {#if v.isSent}
    <div style="max-width:675px;min-width:0;display:flex;flex-direction:column;align-items:flex-start">
      <div style="text-align:start;background:var(--bubble-send-bg,#B83E52);border-start-start-radius:{v.rSS};border-start-end-radius:{v.rSE};border-end-end-radius:{v.rEE};border-end-start-radius:{v.rES};padding:var(--space-12) var(--space-14)" data-oc-bubble>
        {#if v.hasQuote}
          <div style="display:flex;gap:var(--space-8);padding:var(--space-8) var(--space-10);border-radius:var(--radius-md);background:var(--bubble-reply,#8C2A3D);margin:-5px -6px 8px">
            <span style="flex:none;width:4px;border-radius:var(--radius-pill);background:var(--bubble-text-soft,rgba(255,255,255,.6))"></span>
            <div style="min-width:0">
              <div style="font:var(--weight-bold) var(--text-sm)/1.3 var(--font-sans);color:var(--bubble-text,#fff)">{t(v.quoteName)}</div>
              <div style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--bubble-text-soft,rgba(255,255,255,.78));overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.quoteText)}</div>
            </div>
          </div>
        {/if}
        {#if v.forwarded}
          <div style="display:flex;align-items:center;gap:var(--space-4);margin-bottom:var(--space-6)">
            <span style="flex:none;width:12px;height:12px;background:var(--bubble-text-soft,rgba(255,255,255,.82));mask:{v.forwardMask}"></span>
            <span style="font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);font-style:italic;color:var(--bubble-text-soft,rgba(255,255,255,.82))">Forwarded</span>
          </div>
        {/if}
        {#if v.hasCode}
          <pre style="margin:0 0 var(--space-6);padding:var(--space-10) var(--space-12);border-radius:var(--radius-md);background:rgba(0,0,0,.28);max-width:100%;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere;font:var(--weight-regular) var(--text-sm)/1.55 var(--font-mono);color:var(--bubble-text,#fff)">{t(v.code)}</pre>
        {/if}
        <p style="position:relative;margin:0;font:var(--weight-regular) {v.textSize}/{v.textLeading} var(--font-sans);color:var(--bubble-text,#fff);text-wrap:pretty;overflow-wrap:anywhere">{t(v.text)}<span style="display:inline-flex;visibility:hidden;align-items:flex-end;vertical-align:bottom;gap:var(--space-4);margin:0 0 -1px 9px;font:var(--weight-regular) var(--text-xs)/1 var(--font-mono);color:var(--bubble-text-soft,rgba(255,255,255,.82))" aria-hidden="true">{t(v.editedMark)}{t(v.time)}<span style="width:14px;height:14px;margin-bottom:-2px;background:{v.statusColor};mask:{v.statusMask}"></span></span><span style="position:absolute;right:0;bottom:0;display:inline-flex;align-items:flex-end;gap:var(--space-4);font:var(--weight-regular) var(--text-xs)/1 var(--font-mono);color:var(--bubble-text-soft,rgba(255,255,255,.82))">{t(v.editedMark)}{t(v.time)}<span style="width:14px;height:14px;margin-bottom:-2px;background:{v.statusColor};mask:{v.statusMask}"></span></span></p>
      </div>
      {#if v.isFailed}
        <div style="display:flex;align-items:center;gap:var(--space-6);margin-top:var(--space-6);padding-inline-end:var(--space-14)">
          <span style="font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--status-danger,#F5493D)">{t(v.failedText)}</span>
          <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--status-danger,#F5493D);text-decoration:underline;cursor:pointer" onclick={v.retryAction} role="button" tabindex="0">Retry</span>
        </div>
      {/if}
      {#if v.hasThread}
        <div class="dc-p0" style="display:flex;align-items:center;gap:var(--space-6);margin-top:var(--space-6);min-height:var(--control-sm,30px);padding:var(--space-6) var(--space-10);box-sizing:border-box;border-radius:var(--radius-sm);cursor:pointer;align-self:{v.threadAlign}" onclick={v.onOpenThread} role="button" tabindex="0">
          <span style="flex:none;width:14px;height:14px;background:var(--accent,#FF5672);mask:{v.replyMask}" data-oc-flip></span>
          <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);white-space:nowrap">{t(v.threadLabel)}</span>
          <span style="font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#8A8A99);white-space:nowrap">{t(v.threadMeta)}</span>
        </div>
      {/if}
      {#if v.hasReactions}
        <div style="width:0;min-width:100%;box-sizing:border-box;padding-inline-start:8px;display:flex;flex-wrap:wrap;justify-content:flex-start;gap:var(--space-4);margin-top:{v.reactionsShift};position:relative;z-index:2" use:ref={v.reactionsRef}>
          {#each v.reactions ?? [] as r, i0}
            <span class="dc-p1" style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-6) var(--space-8);border-radius:var(--radius-pill);background:{r.bg};box-shadow:{r.ring};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{r.ink};cursor:pointer;user-select:none" data-oc-chip onclick={r.toggle} role="button" tabindex="0" aria-pressed={r.mineStr} aria-label={r.aria}>{t(r.emoji)} {t(r.count)}</span>
          {/each}
          {#if v.hasMoreReactions}
            <span class="dc-p2" style="display:flex;align-items:center;padding:var(--space-6) var(--space-8);border-radius:var(--radius-pill);background:var(--card-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#B9B9C6);cursor:pointer;white-space:nowrap" data-oc-more onclick={v.onShowAllReactions} role="button" tabindex="0">{t(v.moreReactionsLabel)}</span>
          {/if}
          {#if v.isExpanded}
            <span class="dc-p3" style="display:flex;align-items:center;justify-content:center;height:24px;min-width:24px;box-sizing:border-box;border-radius:var(--radius-pill);background:var(--card-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));cursor:pointer" onclick={v.onCollapseReactions} role="button" tabindex="0">
              <span style="width:10px;height:10px;background:var(--ink-2,#B9B9C6);mask:{v.closeMask}"></span>
            </span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
  {#if v.isReceived}
    <div style="max-width:675px;min-width:0;display:flex;flex-direction:column;align-items:flex-start">
      <div style="text-align:start;background:var(--bubble-recv-bg,#191921);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));border-start-start-radius:{v.rSS};border-start-end-radius:{v.rSE};border-end-end-radius:{v.rEE};border-end-start-radius:{v.rES};padding:var(--space-12) var(--space-14)" data-oc-bubble>
        {#if v.forwarded}
          <div style="display:flex;align-items:center;gap:var(--space-4);margin-bottom:var(--space-6)">
            <span style="flex:none;width:12px;height:12px;background:var(--ink-3,#8A8A99);mask:{v.forwardMask}"></span>
            <span style="font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);font-style:italic;color:var(--ink-3,#8A8A99)">Forwarded</span>
          </div>
        {/if}
        {#if v.hasCode}
          <pre style="margin:0 0 var(--space-6);padding:var(--space-10) var(--space-12);border-radius:var(--radius-md);background:rgba(0,0,0,.28);max-width:100%;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere;font:var(--weight-regular) var(--text-sm)/1.55 var(--font-mono);color:var(--status-online,#2EE6A8)">{t(v.code)}</pre>
        {/if}
        <p style="position:relative;margin:0;font:var(--weight-regular) {v.textSize}/{v.textLeading} var(--font-sans);color:var(--bubble-recv-text,#E4E4EC);text-wrap:pretty;overflow-wrap:anywhere">{t(v.text)}<span style="display:inline-flex;visibility:hidden;align-items:flex-end;vertical-align:bottom;margin:0 0 -1px 9px;font:var(--weight-regular) var(--text-xs)/1 var(--font-mono);color:var(--meta,#9393A2)" aria-hidden="true">{t(v.editedMark)}{t(v.time)}</span><span style="position:absolute;right:0;bottom:0;display:inline-flex;align-items:flex-end;font:var(--weight-regular) var(--text-xs)/1 var(--font-mono);color:var(--meta,#9393A2)">{t(v.editedMark)}{t(v.time)}</span></p>
      </div>
      {#if v.isFailed}
        <div style="display:flex;align-items:center;gap:var(--space-6);margin-top:var(--space-6);padding-inline-start:var(--space-14)">
          <span style="font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--status-danger,#F5493D)">{t(v.failedText)}</span>
          <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--status-danger,#F5493D);text-decoration:underline;cursor:pointer" onclick={v.retryAction} role="button" tabindex="0">Retry</span>
        </div>
      {/if}
      {#if v.hasThread}
        <div class="dc-p4" style="display:flex;align-items:center;gap:var(--space-6);margin-top:var(--space-6);min-height:var(--control-sm,30px);padding:var(--space-6) var(--space-10);box-sizing:border-box;border-radius:var(--radius-sm);cursor:pointer;align-self:{v.threadAlign}" onclick={v.onOpenThread} role="button" tabindex="0">
          <span style="flex:none;width:14px;height:14px;background:var(--accent,#FF5672);mask:{v.replyMask}" data-oc-flip></span>
          <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);white-space:nowrap">{t(v.threadLabel)}</span>
          <span style="font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#8A8A99);white-space:nowrap">{t(v.threadMeta)}</span>
        </div>
      {/if}
      {#if v.hasReactions}
        <div style="width:0;min-width:100%;box-sizing:border-box;padding-inline-start:8px;display:flex;flex-wrap:wrap;justify-content:flex-start;gap:var(--space-4);margin-top:{v.reactionsShift};position:relative;z-index:2" use:ref={v.reactionsRef}>
          {#each v.reactions ?? [] as r, i1}
            <span class="dc-p5" style="display:flex;align-items:center;gap:var(--space-4);padding:var(--space-6) var(--space-8);border-radius:var(--radius-pill);background:{r.bg};box-shadow:{r.ring};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{r.ink};cursor:pointer;user-select:none" data-oc-chip onclick={r.toggle} role="button" tabindex="0" aria-pressed={r.mineStr} aria-label={r.aria}>{t(r.emoji)} {t(r.count)}</span>
          {/each}
          {#if v.hasMoreReactions}
            <span class="dc-p6" style="display:flex;align-items:center;padding:var(--space-6) var(--space-8);border-radius:var(--radius-pill);background:var(--card-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#B9B9C6);cursor:pointer;white-space:nowrap" data-oc-more onclick={v.onShowAllReactions} role="button" tabindex="0">{t(v.moreReactionsLabel)}</span>
          {/if}
          {#if v.isExpanded}
            <span class="dc-p7" style="display:flex;align-items:center;justify-content:center;height:24px;min-width:24px;box-sizing:border-box;border-radius:var(--radius-pill);background:var(--card-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));cursor:pointer" onclick={v.onCollapseReactions} role="button" tabindex="0">
              <span style="width:10px;height:10px;background:var(--ink-2,#B9B9C6);mask:{v.closeMask}"></span>
            </span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p1:hover{filter:brightness(1.15) !important}
  .dc-p1:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p5:hover{filter:brightness(1.15) !important}
  .dc-p5:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p6:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p7:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>
