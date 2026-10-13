<!-- Generated from lib/WalletReceive.dc.html (source hash 2b04c83d) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './WalletReceive.logic.js';
  import ChatPicker from '../../lib/components/ChatPicker.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';

  interface Props {
    token?: string;
    handle?: string;
    onShare?: (v: { chat: string, symbol: string, network: string, address: string }) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:absolute;inset:0;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-1,#0e0e12)" use:ref={v.rootRef} data-screen-label="Wallet receive">
  <PageHeader title="Receive {v.tok.symbol}" onBack={v.back} avatarMark={v.tok.mark} avatarGradient={v.tok.grad}></PageHeader>
  <div style="flex:1;min-height:0;overflow-y:auto;display:grid;grid-template-columns:{v.cols};align-items:stretch;align-content:start;gap:28px;padding:{v.pad}">
    <div style="display:flex;flex-direction:column;gap:32px;min-width:0;order:{v.formOrder}">
      <div style="display:flex;flex-direction:column;gap:10px">
        <ListSectionLabel label="NETWORK"></ListSectionLabel>
        {#if v.multi}
          <div style="position:relative">
            <div class="dc-p0" style="display:flex;align-items:center;gap:12px;height:56px;padding:0 14px 0 16px;border-radius:var(--radius-md,12px);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px {v.netLine};cursor:pointer;user-select:none" onclick={v.toggleNet} tabindex="0" role="button" aria-expanded={v.netOpen}>
              <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.net.label)}</span>
              <span style="flex:none;font:var(--weight-medium) 12.5px/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(v.net.time)}</span>
              <span style="flex:none;width:13px;height:13px;background:var(--ink-3,#9A9AA8);mask:{v.m.caret};transform:{v.caret}"></span>
            </div>
            {#if v.netOpen}
              <div style="position:fixed;inset:0;z-index:4" onclick={v.toggleNet}></div>
              <div style="position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:5;display:flex;flex-direction:column;padding:6px;border-radius:var(--radius-md,12px);background:var(--surface-2,#1b1b22);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 18px 40px rgba(0,0,0,.5)">
                {#each v.nets ?? [] as n, i0}<div class="dc-p1" style="display:flex;align-items:center;gap:12px;min-height:56px;padding:0 12px;border-radius:9px;cursor:pointer" onclick={n.pick} tabindex="0" role="option" aria-selected={n.on}><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(n.label)}</span><span style="font:var(--weight-regular) var(--text-xs)/1.3 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(n.short)}</span></span><span style="flex:none;font:var(--weight-semibold) 12.5px/1 var(--font-mono);color:var(--ink-2,#C9C9D4)">{t(n.time)}</span><span style="flex:none;width:16px;height:16px;background:{n.tick};mask:{v.m.check}"></span></div>{/each}
              </div>
            {/if}
          </div>
        {/if}
        {#if v.single}
          <div style="display:flex;align-items:center;gap:12px;height:56px;padding:0 16px;border-radius:var(--radius-md,12px);background:var(--overlay-1,rgba(255,255,255,.04))"><span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.net.label)}</span><span style="flex:none;font:var(--weight-medium) 12.5px/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(v.net.time)}</span></div>
        {/if}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <ListSectionLabel label="YOUR ADDRESS"></ListSectionLabel>
        <div style="display:flex;align-items:center;gap:12px;padding:14px 12px 14px 18px;border-radius:var(--radius-md,12px);background:var(--overlay-1,rgba(255,255,255,.04))">
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
            <span style="font:var(--weight-medium) 16px/1.6 var(--font-mono);color:var(--ink,#ECECF1);word-break:break-all">{t(v.addrHead)}<span style="color:var(--ink-3,#9A9AA8)">{t(v.addrMid)}</span>{t(v.addrTail)}</span>
          </div>
          <div style="flex:none;display:flex;align-items:center;gap:6px">
            <span class="dc-p2" style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:{v.copyBg};cursor:pointer" onclick={v.copy} role="button" tabindex="0" title={v.copyTitle} aria-label={v.copyTitle}><span style="width:16px;height:16px;background:{v.copyInk};mask:{v.copyMask}"></span></span>
            <span class="dc-p3" style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--overlay-2,rgba(255,255,255,.07));cursor:pointer" onclick={v.openShare} role="button" tabindex="0" title="Share to chat" aria-label="Share to chat"><span style="width:16px;height:16px;background:var(--ink,#ECECF1);mask:{v.m.share}"></span></span>
          </div>
        </div>
        </div>
      <div style="display:flex;gap:12px;margin-top:-20px;padding:14px 16px;border-radius:var(--radius-md,12px);background:rgba(255,176,61,.08)"><span style="flex:none;width:16px;height:16px;margin-top:1px;background:var(--status-gold,#FFB03D);mask:{v.m.alert}"></span><span style="font:var(--weight-regular) 13px/1.5 var(--font-sans);color:var(--ink-2,#E8D6B8);text-wrap:pretty">{t(v.warn)}</span></div>
      <span style="flex:1"></span>
      <div style="display:flex;flex-direction:column;gap:10px">
        <ListSectionLabel label="FROM OPENCHAT"></ListSectionLabel>
        <div style="display:flex;align-items:center;gap:14px;padding:14px 12px 14px 16px;border-radius:var(--radius-md,12px);background:var(--overlay-1,rgba(255,255,255,.04))">
          <span style="flex:none;width:36px;height:36px;border-radius:var(--radius-pill);background:linear-gradient(140deg,#b06bff,#5b2a86)"></span>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
            <span style="display:flex;align-items:center;gap:8px;font:var(--weight-semibold) 15px/1.2 var(--font-mono);color:var(--ink,#ECECF1)">{t(v.handle)}{#if v.hCopied}<span style="display:flex;align-items:center;gap:5px;font:var(--weight-semibold) 12px/1 var(--font-sans);color:var(--status-online,#2EE6A8)"><span style="width:12px;height:12px;background:currentColor;mask:{v.m.check}"></span>Copied</span>{/if}</span>
            <span style="font:var(--weight-regular) 12.5px/1.4 var(--font-sans);color:var(--ink-4,#8A8A99);text-wrap:pretty">Other OpenChat users can pay you from any chat. No address or network needed.</span>
          </div>
          <span class="dc-p4" style="flex:none;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:{v.hBg};cursor:pointer" onclick={v.copyHandle} role="button" tabindex="0" title="Copy username" aria-label="Copy username"><span style="width:16px;height:16px;background:{v.hInk};mask:{v.hMask}"></span></span>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px;border-radius:var(--radius-md,12px);background:var(--overlay-1,rgba(255,255,255,.04));order:{v.qrOrder}">
      <span style="align-self:flex-start;font:var(--weight-semibold) 11.5px/1 var(--font-mono);letter-spacing:.08em;color:var(--ink-4,#8A8A99)">SCAN TO PAY</span>
      <div style="width:240px;height:240px;margin-top:10px;border-radius:18px;background:#fff;display:flex;align-items:center;justify-content:center"><span style="width:204px;height:204px;border-radius:8px;background:repeating-linear-gradient(0deg,#0b0b10 0 9px,transparent 9px 18px),repeating-linear-gradient(90deg,#0b0b10 0 9px,transparent 9px 18px);opacity:.85;display:flex;align-items:center;justify-content:center"><span style="width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:{v.tok.grad};box-shadow:0 0 0 6px #fff;font:700 20px/1 var(--font-sans);color:#0b0b10">{t(v.tok.mark)}</span></span></div>
      <span style="font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1);text-align:center">{t(v.tok.symbol)} on {t(v.net.label)}</span>
      <span style="font:var(--weight-regular) 12.5px/1.5 var(--font-sans);color:var(--ink-4,#8A8A99);text-align:center;text-wrap:pretty">{t(v.net.blurb)}</span>
    </div>
  </div>
  {#if v.shareOpen}
    <ChatPicker title="Share to chat" previewLabel="SHARING YOUR ADDRESS" item={v.shareItem} chats={v.shareChats} onSend={v.onShareSend} onClose={v.closeShare}></ChatPicker>
  {/if}
  {#if v.hasToast}
    <div style="position:absolute;left:0;right:0;bottom:24px;z-index:30;display:flex;justify-content:center;pointer-events:none">
      <div style="pointer-events:auto;width:min(480px, calc(100% - 48px));display:grid;grid-template-columns:minmax(0,1fr)">{#key v.toastKey}<UndoToast shown={true} tone="success" size="lg" icon="check" message={v.toastMessage} onClose={v.dismissToast}></UndoToast>{/key}</div>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.06)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.07)) !important}
  .dc-p2:hover{background:var(--btn-hover,rgba(255,255,255,.12)) !important}
  .dc-p3:hover{background:var(--btn-hover,rgba(255,255,255,.12)) !important}
  .dc-p4:hover{background:var(--btn-hover,rgba(255,255,255,.12)) !important}
</style>
