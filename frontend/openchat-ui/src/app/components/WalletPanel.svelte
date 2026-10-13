<!-- Generated from lib/WalletPanel.dc.html (source hash 464ebf46) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './WalletPanel.logic.js';
  import BalanceCard from './BalanceCard.svelte';
  import ContextMenu from '../../lib/components/ContextMenu.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import ShareBar from '../../lib/components/ShareBar.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';

  interface Props {
    onAction?: (kind: string) => void;
    onToken?: (symbol: string) => void;
    loading?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-14);padding:var(--space-10);overflow:hidden;background:var(--surface-1,#0e0e12)" use:ref={v.awayRef} data-screen-label="Wallet">

  <div style="flex:none;display:flex;align-items:center;gap:var(--space-10);min-height:var(--control-md,34px);padding:var(--space-10) 0 var(--space-10) var(--space-10)">
    <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-xl)/1.2 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1)">Wallet</span>
    <span class="dc-p0" style="flex:none;display:flex;align-items:center;gap:var(--space-4);height:var(--control-md,34px);padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-sm);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));cursor:pointer;user-select:none" onclick={v.onOpenCurrency} role="button" tabindex="0" aria-label="Display currency" title="Display currency">
      <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);color:var(--ink-2,#C9C9D4)">{t(v.currency)}</span>
      <span style="width:11px;height:11px;background:var(--ink-4,#7C7C8C);mask:{v.chevronMask}"></span>
    </span>
    <div style="flex:none;display:flex"><IconButton icon="more" onClick={v.onOpenMenu}></IconButton></div>
  </div>

  <div style="flex:none;display:grid;grid-template-columns:minmax(0,1fr)"><BalanceCard label="TOTAL BALANCE" amount={v.totalLabel} veiled={v.veiled} spinning={v.spinning} allocation={v.allocation} onToggleVeil={v.onToggleHidden} onRefresh={v.onRefreshAll} onSend={v.onSend} onReceive={v.onReceive} onSwap={v.onSwap}></BalanceCard></div>

  <div style="flex:1;min-width:0;min-height:0;margin-block-start:var(--space-10);display:flex;flex-direction:column;gap:var(--space-8)">
    {#if v.hasHome}
      <div class="dc-p1" style="flex:none;display:flex;align-items:center;gap:var(--space-12);margin:0 var(--space-2,2px) var(--space-10);padding:var(--space-10);border-radius:var(--radius-md,12px);background:{v.homeBg};cursor:pointer;user-select:none" onclick={v.onHome} role="button" tabindex="0" aria-current={v.homeOn}>
        <span style="flex:none;width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:var(--accent-soft,rgba(255,86,114,.12))"><span style="width:16px;height:16px;background:var(--accent-bright,#FF8298);mask:{v.listMask}"></span></span>
        <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">All activity</span>
        <span style="flex:none;font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.homeCount)}</span>
      </div>
    {/if}
    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-12) 0 var(--space-10)">
      <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(v.tokensHeading)}</span>
      <span class="dc-p2" style="flex:none;display:flex;align-items:center;gap:var(--space-4);cursor:pointer;user-select:none" onclick={v.onToggleSort} role="button" tabindex="0" aria-label={v.sortTitle} title={v.sortTitle}>
        <span style="font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.sortLabel)}</span>
        <span style="width:11px;height:11px;background:var(--ink-4,#7C7C8C);mask:{v.chevronMask}"></span>
      </span>
      <span class="dc-p3" style="flex:none;display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onToggleDir} role="button" tabindex="0" aria-label={v.dirTitle} title={v.dirTitle}>
        <span style="width:13px;height:13px;background:var(--ink-4,#7C7C8C);mask:{v.dirMask}"></span>
      </span>
    </div>

  <div style="flex:1;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:var(--space-8,8px)">
    {#if v.loading}<Skeleton variant="token" count={5}></Skeleton>{/if}
{#each v.loadedOr.tokens ?? [] as tk, i0}
      <div class="dc-p4" style="outline-offset:-2px;display:flex;align-items:center;gap:var(--space-14,14px);min-width:0;padding:var(--space-14,14px) var(--space-10);border-radius:var(--radius-md);cursor:pointer;background:{tk.bg}" onclick={tk.onPress} role="button" oncontextmenu={tk.onMenu} onmouseenter={tk.onEnter} onmouseleave={tk.onLeave} onpointerdown={tk.onPDown} onpointerup={tk.onPUp} onpointercancel={tk.onPUp} onpointermove={tk.onPMove} onkeydown={tk.onKey} onfocus={tk.onEnter} tabindex="0">
        <TokenAvatar size={40} symbol={tk.symbol} mark={tk.mark} gradient={tk.gradient}></TokenAvatar>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:baseline;gap:var(--space-8)"><span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(tk.symbol)}</span><span style="flex:none;font:var(--weight-semibold) var(--text-md)/1.2 var(--font-mono);color:var(--ink,#ECECF1)">{t(tk.value)}</span></div>
          <div style="display:flex;align-items:center;gap:var(--space-8)"><span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(tk.price)}</span><span style="flex:none;font:var(--weight-regular) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(tk.holdings)}</span></div>
          <ShareBar share={tk.shareNum} veiled={tk.veiled} gradient={tk.gradient}></ShareBar>
        </div>
        <span class="dc-p5" style="flex:none;visibility:{tk.kebabVis};display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:var(--radius-sm)" onclick={tk.onKebab} role="button" tabindex="0" aria-label="Token options" onpointerdown={v.stopEv} title="Token options" aria-haspopup="menu">
          <span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.kebabMask}"></span>
        </span>
      </div>
    {/each}

  </div>
  </div>

  <div style="position:absolute;z-index:50;inset-block-end:var(--space-12);inset-inline:var(--space-10);display:grid;grid-template-columns:minmax(0,1fr)"><UndoToast icon="hide" shown={v.undoShown} message={v.undoLabel} onAction={v.onUndoRemove} onClose={v.onDismissUndo}></UndoToast></div>

  <ContextMenu open={v.menuOpen} items={v.menuItems} point={v.menuPoint} anchor={v.menuAnchor} align={v.menuAlign} onClose={v.onCloseMenu}></ContextMenu>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p2:hover{filter:brightness(1.4) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p5:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>
