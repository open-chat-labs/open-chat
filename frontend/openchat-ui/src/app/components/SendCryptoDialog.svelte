<!-- Generated from lib/SendCryptoDialog.dc.html (source hash 71f44ae8) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './SendCryptoDialog.logic.js';
  import type { Transfer } from '../../lib/types';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import QuickAmountChips from '../../lib/components/QuickAmountChips.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';

  interface Props {
    z?: number;
    recipient?: { name: string; handle: string; grad?: string } | null;
    members?: { name: string; handle: string; grad?: string }[];
    initial?: Transfer | null;
    onAttach?: (transfer: Transfer) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:{v.z};display:flex;align-items:center;justify-content:center;padding:24px">
  <div style="position:absolute;inset:0;background:var(--scrim);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)" onclick={v.onClose} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:480px;max-height:100%;outline:none;display:flex;flex-direction:column;border-radius:var(--radius-xl,22px);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 24px 64px rgba(0,0,0,.45)" use:ref={v.boxRef} data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label={v.title} onkeydown={v.onKey}>
    <div style="flex:none;display:flex;align-items:center;gap:12px;height:var(--header-h,66px);box-sizing:border-box;padding:0 12px 0 22px;border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:1;font:700 17px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.title)}</span>
      <IconButton variant="ghost" icon="close" label="Close" onClick={v.onClose}></IconButton>
    </div>
    <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:16px;padding:20px 22px 22px">
      <div style="position:relative;display:flex;flex-direction:column">
        <div class="dc-p0" style="display:flex;align-items:center;gap:12px;height:56px;padding:0 14px 0 10px;border-radius:14px;background:var(--surface-2,#15151b);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));cursor:{v.toCursor}" onclick={v.toggleTo} role={v.toRole} tabindex={v.toTab} aria-haspopup={v.toPopup} aria-expanded={v.toOpen} aria-label={v.toAria}>
          <span style="font:600 12.5px/1 var(--font-sans);color:var(--ink-4,#8A8A99);width:22px;text-align:center">To</span>
          <span style="width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;background:{v.to.grad};font:700 13px/1 var(--font-sans);color:#fff">{t(v.to.initial)}</span>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font:600 14px/1.1 var(--font-sans);color:{v.to.ink}">{t(v.to.name)}</span><span style="font:400 12px/1 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(v.to.handle)}</span></div>
          {#if v.canPick}<span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);-webkit-mask:var(--icon-chevron-down) center/contain no-repeat;mask:var(--icon-chevron-down) center/contain no-repeat"></span>{/if}
        </div>
        {#if v.toOpen}
          <div style="position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:5;display:flex;flex-direction:column;max-height:300px;overflow-y:auto;padding:6px;border-radius:14px;background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-panel,0 8px 24px rgba(0,0,0,.4))" role="listbox" aria-label="Members">
            <input style="flex:none;height:38px;margin:2px 2px 6px;padding:0 12px;border:0;border-radius:10px;outline:none;background:var(--field,#14141a);font:500 13.5px/1 var(--font-sans);color:var(--ink,#ECECF1)" use:ref={v.qRef} value={v.q} oninput={v.onQ} placeholder="Search members" aria-label="Search members">
            {#each v.members ?? [] as m, i0}
              <div class="dc-p1" style="display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:10px;background:{m.bg};cursor:pointer" onclick={m.onClick} role="option" tabindex="0" aria-selected={m.sel}>
                <span style="width:30px;height:30px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:50%;background:{m.grad};font:700 12px/1 var(--font-sans);color:#fff">{t(m.initial)}</span>
                <span style="flex:1;font:600 13.5px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(m.name)}</span><span style="font:400 12px/1 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(m.handle)}</span>
              </div>
            {/each}
            {#if v.noMembers}<span style="padding:14px 10px;font:400 13px/1.4 var(--font-sans);color:var(--ink-4,#8A8A99)">No members match</span>{/if}
          </div>
        {/if}
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px 16px 18px;border-radius:18px;background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
        <div class="dc-p2" style="display:flex;align-items:center;gap:10px;padding:6px 12px 6px 6px;border-radius:999px;background:var(--overlay-1,rgba(255,255,255,.05));cursor:pointer" onclick={v.openTok} role="button" tabindex="0" aria-label="Change token" aria-haspopup="dialog">
          <TokenAvatar symbol={v.tok.symbol} mark={v.tok.mark} gradient={v.tok.gradient} size={28}></TokenAvatar>
          <span style="font:700 14px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.tok.symbol)}</span>
          <span style="font:500 12px/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.balText)}</span>
          <span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);-webkit-mask:var(--icon-chevron-down) center/contain no-repeat;mask:var(--icon-chevron-down) center/contain no-repeat"></span>
        </div>
        <input style="width:100%;border:0;outline:none;background:transparent;text-align:center;font:700 40px/1.1 var(--font-sans);letter-spacing:-.02em;color:var(--ink,#ECECF1)" use:ref={v.amtRef} value={v.amt} oninput={v.onAmt} inputmode="decimal" placeholder="0" aria-label="Amount">
        <span style="font:500 13px/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(v.usd)}</span>
        <QuickAmountChips size="sm" onSelect={v.onQuick}></QuickAmountChips>
        <span style="font:400 12px/1.4 var(--font-sans);color:{v.hintInk};text-align:center">{t(v.hint)}</span>
      </div>
    </div>
    <div style="flex:none;display:flex;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="width:15px;height:15px;flex:none;background:var(--status-warning,#FFB03D);-webkit-mask:var(--icon-warning) center/contain no-repeat;mask:var(--icon-warning) center/contain no-repeat"></span>
      <span style="flex:1;min-width:0;font:500 12.5px/1.35 var(--font-sans);color:var(--ink-3,#9A9AA8)">Transfers can't be reversed. Only send to people you trust.</span>
      <Button label={v.cta} disabled={v.notOk} onClick={v.attach}></Button>
    </div>
    {#if v.tokOpen}
      <div style="position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;padding:24px;border-radius:var(--radius-xl,22px);background:var(--scrim,rgba(0,0,0,.5));backdrop-filter:blur(4px)">
        <div style="width:100%;max-width:360px;display:flex;flex-direction:column;border-radius:18px;background:var(--surface-2,#15151b);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 16px 40px rgba(0,0,0,.4);overflow:hidden" role="dialog" aria-label="Token">
          <div style="display:flex;align-items:center;padding:0 8px 0 18px;height:54px;border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))"><span style="flex:1;font:700 15px/1 var(--font-sans);color:var(--ink,#ECECF1)">Token</span><IconButton variant="ghost" icon="close" label="Close" onClick={v.closeTok}></IconButton></div>
          <div style="display:flex;flex-direction:column;padding:6px">
            {#each v.toks ?? [] as tk, i1}
              <div class="dc-p3" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:{tk.bg};cursor:pointer" onclick={tk.onClick} role="button" tabindex="0">
                <TokenAvatar symbol={tk.symbol} mark={tk.mark} gradient={tk.gradient} size={40}></TokenAvatar>
                <span style="flex:1;font:600 14px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(tk.symbol)}</span>
                <span style="font:500 13px/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(tk.bal)}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p1:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.1)) !important}
  .dc-p2:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p3:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p3:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
</style>
