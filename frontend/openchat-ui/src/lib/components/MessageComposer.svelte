<!-- Generated from lib/MessageComposer.dc.html (source hash 4f18c46b) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './MessageComposer.logic.js';
  import EmojiPicker from './EmojiPicker.svelte';
  import Menu from './Menu.svelte';
  import SegmentedTabs from './SegmentedTabs.svelte';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Props {
    demo?: string;
    placeholder?: string;
    onSend?: (text: string) => void;
    onAttach?: (kind: 'file' | 'poll' | 'prize' | 'crypto' | 'memeFighter') => void;
    onGif?: (query: string) => void;
    onVoice?: (r: { duration: number }) => void;
    attachment?: { type: 'prize' | 'transfer' | 'file' | 'media'; title?: string; summary?: string; token?: object; tint?: string; items?: { kind: 'image' | 'video'; src?: string; bg?: string; dur?: string }[] } | null;
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

<div style="position:relative;width:100%" use:ref={v.rootRef} onkeydown={v.onRootKey}>
  {#if v.plusOpen}
    <div style="position:absolute;left:0;bottom:calc(100% + 8px);z-index:20">
      <Menu heading="ADD TO MESSAGE" minWidth="232px" items={v.plusItems}></Menu>
    </div>
  {/if}
  {#if v.pickerOpen}
    <div style="position:absolute;left:0;bottom:calc(100% + 8px);z-index:20;width:min(360px,100%);height:400px;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-10);border-radius:var(--radius-lg);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-panel,0 8px 24px rgba(0,0,0,.28))" role="dialog" aria-label={v.pickerLabel}>
      <SegmentedTabs labels={v.pickerTabs} selectedIndex={v.pickerIndex} onSelect={v.onPickerTab}></SegmentedTabs>
      {#if v.isGifTab}
      <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);height:38px;padding:0 var(--space-12);border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
        <span style="flex:none;width:15px;height:15px;background:var(--ink-4,#8A8A99);mask:var(--icon-search) center/contain no-repeat"></span>
        <input style="flex:1;min-width:0;height:100%;padding:0;border:0;outline:none;background:transparent;font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink,#ECECF1)" use:ref={v.searchRef} value={v.query} oninput={v.onQuery} placeholder={v.searchPlaceholder} aria-label={v.searchPlaceholder}>
      </div>
      {/if}
      {#if v.isEmojiTab}
        <div style="flex:1;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);grid-template-columns:minmax(0,1fr);margin:0 calc(var(--space-10) * -1) calc(var(--space-10) * -1)">
          <div style="min-height:0;height:100%"><EmojiPicker onPick={v.pickEmoji} onClose={v.closePicker} autoFocus={v.pickerAutoFocus}></EmojiPicker></div>
        </div>
      {/if}

      {#if v.isGifTab}
        <div style="flex:none;display:flex;gap:var(--space-6);overflow-x:auto">
          {#each v.gifCats ?? [] as c, i0}
            <span style="flex:none;display:flex;align-items:center;height:28px;padding:0 var(--space-10);border-radius:var(--radius-pill);background:{c.bg};font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:{c.ink};cursor:pointer;user-select:none" onclick={c.pick} role="button" tabindex="0" aria-pressed={c.pressed}>{t(c.label)}</span>
          {/each}
        </div>
        <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden"><div style="column-count:2;column-gap:var(--space-6)">
          {#each v.gifs ?? [] as gf, i1}
            <span class="dc-p0" style="position:relative;display:block;break-inside:avoid;margin-bottom:var(--space-6);height:{gf.h};border-radius:var(--radius-md);background:{gf.bg};overflow:hidden;cursor:pointer" onclick={gf.pick} role="button" tabindex="0" aria-label={gf.label}>
              <span style="position:absolute;left:8px;bottom:7px;padding:3px 6px;border-radius:5px;background:rgba(0,0,0,.45);font:var(--weight-semibold) 10.5px/1 var(--font-sans);color:#fff">{t(gf.label)}</span>
            </span>
          {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:var(--space-8);row-gap:var(--space-12,12px);min-height:52px;box-sizing:border-box;padding:var(--space-8);border-radius:var(--radius-xl);background:var(--field,#14141a);box-shadow:{v.barRing};transition:box-shadow var(--duration-fast,.12s)">
    {#if v.hasMediaTray}
      <div style="flex:1 0 100%;min-width:0;display:flex;flex-wrap:wrap;gap:var(--space-8);padding:2px">
        {#each v.trayItems ?? [] as m, i2}
          <div style="position:relative;flex:none;width:72px;height:72px;border-radius:var(--radius-md,12px);overflow:hidden;background:{m.bg}">
            {#if m.hasVideo}<video style="width:100%;height:100%;object-fit:cover;display:block" src={m.src} muted playsinline preload="metadata"></video>{/if}
            {#if m.isVideo}<span style="position:absolute;left:5px;bottom:5px;display:flex;align-items:center;gap:3px;padding:3px 5px;border-radius:5px;background:rgba(0,0,0,.55);font:600 10.5px/1 var(--font-mono);color:#fff"><span style="width:8px;height:8px;background:#fff;mask:var(--icon-play) center/contain no-repeat"></span>{t(m.dur)}</span>{/if}
            <span class="dc-p1" style="position:absolute;top:4px;right:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(0,0,0,.6);cursor:pointer" onclick={m.onRemove} role="button" tabindex="0" aria-label={m.removeLabel} title="Remove"><span style="width:10px;height:10px;background:#fff;mask:var(--icon-close) center/contain no-repeat"></span></span>
          </div>
        {/each}
        {#if v.trayCanAdd}
          <span class="dc-p2" style="flex:none;width:72px;height:72px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-md,12px);box-shadow:inset 0 0 0 1.5px var(--line-2,rgba(255,255,255,.14));cursor:pointer" onclick={v.addMedia} role="button" tabindex="0" aria-label="Add photos or videos" title="Add more"><span style="width:20px;height:20px;background:var(--ink-3,#9A9AA8);mask:var(--icon-plus) center/contain no-repeat"></span></span>
        {/if}
      </div>
    {/if}
    {#if v.hasCtx}
      <div style="flex:1 0 100%;min-width:0;display:flex;align-items:center;gap:10px;min-height:44px;box-sizing:border-box;padding:4px 4px 4px 6px;border-radius:16px;background:var(--surface-2,#191921)" role="status" aria-label={v.ctxLabel}>
        <span class="dc-p3" style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;cursor:pointer;border-radius:12px" onclick={v.jumpCtx} role="button" tabindex="0" title="Show original message">
          {#if v.ctxHasThumb}<span style="flex:none;width:36px;height:36px;border-radius:10px;background:{v.ctxThumb}"></span>{/if}
          {#if v.ctxNoThumb}<span style="flex:none;width:32px;height:32px;border-radius:50%;background:{v.ctxIconBg};display:flex;align-items:center;justify-content:center"><span style="width:15px;height:15px;background:{v.ctxInk};mask:{v.ctxMask}"></span></span>{/if}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font:600 12.5px/1.1 var(--font-sans);color:{v.ctxInk}">{t(v.ctxLabel)}</span><span style="font:400 13px/1.2 var(--font-sans);color:var(--ink-3,#A3A3B2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.ctxQuote)}</span></span>
        </span>
        <span class="dc-p4" style="width:32px;height:32px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer" onclick={v.cancelCtx} role="button" tabindex="0" aria-label={v.ctxCancel} data-tip={v.ctxCancel}><span style="width:13px;height:13px;background:var(--ink-2,#C9C9D4);mask:var(--icon-close) center/contain no-repeat"></span></span>
      </div>
    {/if}
    {#if v.hasChip}
      <div style="flex:1 0 100%;min-width:0;display:flex;align-items:center;gap:10px;height:44px;box-sizing:border-box;padding:0 6px;border-radius:999px;background:color-mix(in oklch,var(--accent,#FF5672) 14%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 32%,transparent)">
        {#if v.attIsFile}<span style="width:32px;height:32px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;background:{v.attTint}"><span style="width:15px;height:15px;background:#fff;mask:var(--icon-file) center/contain no-repeat"></span></span>{/if}
        {#if v.attHasPair}<div style="flex:none;display:flex"><TokenAvatar symbol={v.attA.symbol} mark={v.attA.mark} gradient={v.attA.gradient} size={28}></TokenAvatar><div style="margin-left:-8px;border-radius:50%;box-shadow:0 0 0 2px var(--field,#14141a)"><TokenAvatar symbol={v.attB.symbol} mark={v.attB.mark} gradient={v.attB.gradient} size={28}></TokenAvatar></div></div>{/if}
        {#if v.attHasToken}<TokenAvatar symbol={v.att.token.symbol} mark={v.att.token.mark} gradient={v.att.token.gradient} size={28}></TokenAvatar>{/if}
        <span style="flex:none;font:var(--weight-bold,700) 14px/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap">{t(v.attLabel)}</span>
        <span style="flex:1;min-width:0;font:var(--weight-medium,500) 13px/1 var(--font-sans);color:var(--ink-3,#9A9AA8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title={v.attTitle}>{t(v.attMeta)}</span>
        {#if v.attEditable}<span class="dc-p5" style="flex:none;padding:6px 8px;border-radius:var(--radius-sm);font:var(--weight-semibold,600) 13px/1 var(--font-sans);color:var(--accent-bright,#FF8298);cursor:pointer" onclick={v.editAttachment} role="button" tabindex="0">Edit</span>{/if}
        <span class="dc-p6" style="width:32px;height:32px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer" onclick={v.removeAttachment} role="button" tabindex="0" aria-label={v.attRemove} title={v.attRemove}><span style="width:13px;height:13px;background:var(--ink-2,#C9C9D4);mask:var(--icon-close) center/contain no-repeat"></span></span>
      </div>
    {/if}
    {#if v.isCompose}
      <div style="flex:none;display:flex;gap:var(--space-2)">
        {#if v.showPlus}<span class="dc-p7" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:{v.plusBg};cursor:pointer" onclick={v.togglePlus} role="button" tabindex="0" aria-label="Add to message" aria-expanded={v.plusExpanded} aria-haspopup="menu" title="Add file, poll, prize, crypto or game">
          <span style="width:18px;height:18px;background:{v.plusInk};mask:var(--icon-plus) center/contain no-repeat;transform:{v.plusRotate};transition:transform var(--duration-base,.2s)"></span></span>
        {/if}
        <span class="dc-p8" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:{v.emojiBg};cursor:pointer" onclick={v.togglePicker} role="button" tabindex="0" aria-label="Emoji and GIFs" aria-expanded={v.pickerExpanded} aria-haspopup="dialog" title="Emoji and GIFs">
          <span style="width:18px;height:18px;background:{v.emojiInk};mask:var(--icon-emoji) center/contain no-repeat"></span>
        </span>
      </div>
      <div style="flex:1;min-width:0;display:flex;align-items:center;min-height:36px;padding:0 var(--space-4)">
        <textarea style="flex:1;min-width:0;height:22px;max-height:160px;padding:7px 0;box-sizing:content-box;border:0;outline:none;resize:none;overflow-y:hidden;scrollbar-width:thin;background:transparent;font:var(--weight-regular) var(--text-base)/22px var(--font-sans);color:var(--ink,#ECECF1)" use:ref={v.inputRef} rows="1" value={v.draft} oninput={v.onDraft} onkeydown={v.onKey} onfocus={v.onFocus} onblur={v.onBlur} placeholder={v.placeholder} aria-label={v.placeholder}></textarea>
      </div>
      {#if v.showMic}
        <span class="dc-p9" style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));cursor:pointer" onclick={v.startRec} role="button" tabindex="0" aria-label="Record voice message" title="Record voice message">
          <span style="width:18px;height:18px;background:var(--ink-2,#C9C9D4);mask:var(--icon-mic) center/contain no-repeat"></span>
        </span>
      {/if}
      {#if v.showSend}
        <span class="dc-p10" style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:var(--accent,#FF5672);cursor:pointer" onclick={v.send} role="button" tabindex="0" aria-label={v.sendLabel} title={v.sendTitle}>
          <span style="width:17px;height:17px;background:var(--on-accent,#2E0512);mask:{v.sendMask}"></span>
        </span>
      {/if}
    {/if}

    {#if v.isVoice}
      <span class="dc-p11" style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);cursor:pointer" onclick={v.cancelRec} role="button" tabindex="0" aria-label="Delete recording" title="Delete (Esc)">
        <span style="width:18px;height:18px;background:var(--status-danger,#FF4D4D);mask:var(--icon-trash) center/contain no-repeat"></span>
      </span>
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:var(--space-10);height:36px;padding:0 var(--space-4)">
        {#if v.isRecording}
          <span style="flex:none;width:9px;height:9px;border-radius:50%;background:var(--status-danger,#FF4D4D);animation:ocRecPulse 1.2s ease-in-out infinite" aria-hidden="true"></span>
        {/if}
        {#if v.isReview}
          <span class="dc-p12" style="flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--overlay-2,rgba(255,255,255,.1));cursor:pointer" onclick={v.togglePlay} role="button" tabindex="0" aria-label={v.playLabel}>
            <span style="width:12px;height:12px;background:var(--ink,#ECECF1);mask:{v.playMask}"></span>
          </span>
        {/if}
        <span style="flex:none;min-width:36px;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap;color:{v.timeInk}" aria-live="off">{t(v.timeLabel)}</span>
        <div class="dc-p13" style="position:relative;flex:1;min-width:0;height:32px;display:flex;align-items:center;justify-content:space-between;gap:0;overflow:hidden;border-radius:6px;outline:none;cursor:{v.waveCursor};touch-action:none" use:ref={v.waveRef} role={v.waveRole} tabindex={v.waveTab} aria-label={v.waveLabel} aria-valuemin={v.waveMin} aria-valuemax={v.waveMax} aria-valuenow={v.waveNow} aria-valuetext={v.waveText} aria-hidden={v.waveHidden} onpointerdown={v.onSeekStart} onkeydown={v.onSeekKey}>
          {#each v.bars ?? [] as b, i3}
            <span style="flex:none;width:3px;height:{b.h};border-radius:2px;background:{b.bg};transition:height .12s;pointer-events:none"></span>
          {/each}
          {#if v.isReview}
            <span style="position:absolute;top:0;bottom:0;left:{v.handleLeft};width:0;pointer-events:none" aria-hidden="true">
              <span style="position:absolute;top:2px;bottom:2px;left:-1px;width:2px;border-radius:1px;background:var(--ink,#ECECF1)"></span>
              <span style="position:absolute;top:50%;left:-6px;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:var(--ink,#ECECF1);box-shadow:0 0 0 2px var(--field,#14141a),0 1px 4px rgba(0,0,0,.4);transform:scale({v.handleScale});transition:transform var(--duration-fast,.12s)"></span>
            </span>
          {/if}
        </div>
      </div>
      {#if v.isRecording}
        <span class="dc-p14" style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));cursor:pointer" onclick={v.stopRec} role="button" tabindex="0" aria-label="Stop recording" title="Stop and review">
          <span style="width:12px;height:12px;border-radius:3px;background:var(--ink-2,#C9C9D4)"></span>
        </span>
      {/if}
      <span class="dc-p15" style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:var(--accent,#FF5672);cursor:pointer" onclick={v.sendVoice} role="button" tabindex="0" aria-label="Send voice message" title="Send voice message">
        <span style="width:17px;height:17px;background:var(--on-accent,#2E0512);mask:var(--icon-send) center/contain no-repeat"></span>
      </span>
    {/if}
  </div>
  {#if v.isRecording}
    <span style="position:absolute;left:0;right:0;top:calc(100% + 6px);text-align:center;font:var(--weight-regular) var(--text-xs)/1 var(--font-sans);color:var(--ink-4,#8A8A99)">Recording · Esc to delete · stop to listen back</span>
  {/if}
</div>

<style>
  .dc-p0:hover{filter:brightness(1.12) !important}
  .dc-p0:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p1:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p2:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p2:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p3:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p4:hover{background:var(--overlay-2,rgba(255,255,255,.1)) !important}
  .dc-p4:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p5:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p5:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p6:hover{background:var(--overlay-2,rgba(255,255,255,.1)) !important}
  .dc-p6:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p7:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p7:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p8:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p8:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p9:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p9:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p10:hover{filter:brightness(1.08) !important}
  .dc-p10:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p11:hover{background:var(--status-danger-soft,rgba(255,77,77,.12)) !important}
  .dc-p11:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p12:hover{background:var(--btn-hover,rgba(255,255,255,.14)) !important}
  .dc-p12:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p13:focus-visible{box-shadow:var(--focus-ring) !important}
  .dc-p14:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p14:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p15:hover{filter:brightness(1.08) !important}
  .dc-p15:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
</style>
