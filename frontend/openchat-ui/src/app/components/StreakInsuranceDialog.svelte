<!-- Generated from lib/StreakInsuranceDialog.dc.html (source hash ba4875a6) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './StreakInsuranceDialog.logic.js';

  interface Props {
    streak?: number;
    insured?: number;
    used?: number;
    balance?: number;
    onBuy?: (days: number, cost: number) => void;
    onBack?: () => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:73;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" data-screen-label="Streak insurance" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onClose} aria-hidden="true"></div>

  <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;max-height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-24) var(--space-32);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;margin-inline-start:-10px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onBack} role="button" tabindex="0" aria-label="Back to CHIT" title="Back to CHIT">
        <span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.backMask}"></span>
      </span>
      <span style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-md);background:var(--accent-soft,rgba(255,86,114,.12))">
        <span style="width:18px;height:18px;background:var(--accent,#FF5672);mask:{v.shieldMask}"></span>
      </span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Streak insurance</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.subtitle)}</span>
      </div>
      <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onClose} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:var(--space-26);padding:var(--space-26) var(--space-32) var(--space-32)">

      <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-10)">
        <div style="display:flex;gap:var(--space-8)">
          {#each v.cells ?? [] as c, i0}
            <div class="dc-p2" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:var(--space-8);padding:14px 0 12px;border-radius:var(--radius-md);background:{c.bg};box-shadow:{c.ring};cursor:{c.cursor};user-select:none" onclick={c.onPress} role="button" tabindex="0" aria-label={c.title} title={c.title}>
              <span style="width:19px;height:19px;background:{c.ink};mask:{v.shieldMask};opacity:{c.iconOpacity}"></span>
              <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);color:{c.ink}">{t(c.label)}</span>
            </div>
          {/each}
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-16);padding:2px var(--space-10) 0">
          <span style="display:flex;align-items:center;gap:var(--space-6);font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)"><span style="width:8px;height:8px;border-radius:var(--radius-pill);background:var(--accent,#FF5672)"></span>Already covered</span>
          <span style="display:flex;align-items:center;gap:var(--space-6);font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)"><span style="width:8px;height:8px;border-radius:var(--radius-pill);background:var(--status-chit,#FF9F45)"></span>Adding now</span>
          <span style="display:flex;align-items:center;gap:var(--space-6);font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)"><span style="width:8px;height:8px;border-radius:var(--radius-pill);box-shadow:inset 0 0 0 1px var(--line-3,rgba(255,255,255,.24))"></span>Tap to add</span>
        </div>
      </div>

      <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-18);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.045));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.summaryTitle)}</span>
          <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.summaryHint)}</span>
        </div>
        <span style="flex:none;font:var(--weight-bold) var(--text-lg)/1.2 var(--font-mono);color:var(--ink,#ECECF1)">{t(v.totalLabel)}</span>
      </div>
    </div>

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-10);padding:var(--space-18) var(--space-32);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:{v.balanceInk};text-wrap:pretty">{t(v.balanceLine)}</span>
      <span class="dc-p3" style="flex:none;display:flex;align-items:center;height:40px;padding:0 var(--space-18);box-sizing:border-box;border-radius:var(--radius-md);background:{v.payBg};opacity:{v.payOpacity};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.payInk};white-space:nowrap;cursor:{v.payCursor};user-select:none" onclick={v.onPay} role="button" tabindex="0">{t(v.payLabel)}</span>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{filter:brightness(1.25) !important}
  .dc-p3:hover{filter:brightness(1.07) !important}
</style>
