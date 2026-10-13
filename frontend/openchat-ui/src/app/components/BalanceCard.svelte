<!-- Generated from lib/BalanceCard.dc.html (source hash 34499a8e) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './BalanceCard.logic.js';

  interface Props {
    label?: string;
    amount?: string;
    fiat?: string;
    veiled?: boolean;
    spinning?: boolean;
    allocation?: {share:number,gradient:string,ring?:string,label?:string,tipLabel?:string,tipValue?:string}[];
    onToggleVeil?: () => void;
    onRefresh?: () => void;
    onSend?: () => void;
    onReceive?: () => void;
    onSwap?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column;gap:var(--space-14);padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg,14px);background:var(--overlay-1,rgba(255,255,255,.045));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))">
  <div style="display:flex;align-items:center;gap:var(--space-8)">
    <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(v.label)}</span>
    {#if v.hasVeilToggle}
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onToggleVeil} role="button" tabindex="0" aria-label={v.veilTitle} title={v.veilTitle}>
        <span style="width:15px;height:15px;background:var(--ink-4,#7C7C8C);mask:{v.eyeMask}"></span>
      </span>
    {/if}
    {#if v.hasRefresh}
      <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onRefresh} role="button" tabindex="0" aria-label="Refresh balances" title="Refresh balances">
        <span style="width:15px;height:15px;background:var(--ink-4,#7C7C8C);mask:{v.cycleMask};animation:{v.spin}"></span>
      </span>
    {/if}
  </div>

  <div style="display:flex;align-items:flex-end;gap:var(--space-12);min-width:0">
    <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-3xl,30px)/1.1 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);filter:{v.veilBlur};transition:filter var(--duration-base,200ms) var(--ease-out)">{t(v.amount)}</span>
    {#if v.hasFiat}
      <span style="flex:none;font:var(--weight-semibold) var(--text-lg)/1.3 var(--font-mono);color:var(--accent,#FF5672);filter:{v.veilBlur};transition:filter var(--duration-base,200ms) var(--ease-out)">{t(v.fiat)}</span>
    {/if}
  </div>

  {#if v.hasAllocation}
    <div style="position:relative;display:flex;gap:3px;height:8px;min-width:0">
      {#each v.segments ?? [] as s, i0}
        <span class="dc-p2" style="flex:{s.share};min-width:6px;border-radius:var(--radius-pill);background:{s.gradient};box-shadow:{s.ring};transition:flex var(--duration-slow,280ms) var(--ease-out),filter var(--duration-fast,120ms) var(--ease-out)" onmouseenter={s.onEnter} onmouseleave={v.onLeaveSegment}></span>
      {/each}
      {#if v.tipShown}
        <div style="position:absolute;z-index:5;inset-block-end:calc(100% + 7px);inset-inline-start:{v.tipLeft};width:158px;box-sizing:border-box;display:flex;flex-direction:column;gap:3px;padding:6px var(--space-10);border-radius:var(--radius-sm);background:var(--surface-2,#1b1b22);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 10px 24px rgba(0,0,0,.5);pointer-events:none;animation:oc-tip-in 90ms var(--ease-out) both">
          <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0">
            <span style="flex:none;width:8px;height:8px;border-radius:var(--radius-pill);background:{v.tipGradient};box-shadow:{v.tipRing}"></span>
            <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-sm)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.tipLabel)}</span>
          </div>
          <span style="font:var(--weight-medium) var(--text-sm)/1.2 var(--font-mono);color:var(--ink-3,#9A9AA8);white-space:nowrap">{t(v.tipValue)}</span>
        </div>
      {/if}
    </div>
  {/if}

  <div style="display:flex;align-items:center;gap:var(--space-6)">
    <span class="dc-p3" style="flex:1;display:flex;align-items:center;justify-content:center;gap:var(--space-6);height:36px;border-radius:var(--radius-md);background:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onSend} role="button" tabindex="0">
      <span style="width:14px;height:14px;background:var(--on-accent,#2E0512);mask:{v.sendMask}"></span>
      <span style="font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#2E0512)">Send</span>
    </span>
    <span class="dc-p4" style="flex:1;display:flex;align-items:center;justify-content:center;gap:var(--space-6);height:36px;border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));cursor:pointer;user-select:none" onclick={v.onReceive} role="button" tabindex="0">
      <span style="width:14px;height:14px;background:var(--ink-2,#C9C9D4);mask:{v.receiveMask}"></span>
      <span style="font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Receive</span>
    </span>
    <span class="dc-p5" style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));cursor:pointer;user-select:none" onclick={v.onSwap} role="button" tabindex="0" aria-label="Swap" title="Swap">
      <span style="width:14px;height:14px;background:var(--ink-2,#C9C9D4);mask:{v.swapMask}"></span>
    </span>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{filter:brightness(1.18) !important}
  .dc-p3:hover{filter:brightness(1.08) !important}
  .dc-p4:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p5:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>
