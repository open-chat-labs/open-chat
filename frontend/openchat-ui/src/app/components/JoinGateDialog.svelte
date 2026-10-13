<!-- Generated from lib/JoinGateDialog.dc.html (source hash 3a62b79a) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './JoinGateDialog.logic.js';
  import Button from '../../lib/components/Button.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import Spinner from '../../lib/components/Spinner.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';

  interface Props {
    community?: { name: string; members?: number; grad?: string };
    rule?: "all" | "any";
    gates?: Array<{ kind: "pay" | "balance" | "neuron" | "diamond"; symbol?: string; amount?: number; label?: string; detail?: string; confirm?: string }>;
    tokens?: Array<{ symbol: string; held: number; mark: string; grad: string }>;
    chatBalance?: number;
    isDiamond?: boolean;
    isLifetime?: boolean;
    recheckDays?: number;
    ownerShare?: number;
    z?: number;
    onGetDiamond?: () => void;
    onJoin?: (r: { paid: { symbol: string; amount: number }[] }) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<DialogShell title={v.title} width={520} height="auto" flush={true} z={v.z} onClose={v.close}>
  <div style="min-height:0;overflow-y:auto;display:flex;flex-direction:column">
    <div style="display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-18) var(--space-22,22px) var(--space-12)">
      <div style="display:flex;align-items:center;gap:var(--space-12)">
        <span style="flex:none;width:40px;height:40px;border-radius:12px;background:{v.grad}"></span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
          <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.name)}</span>
          <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(v.meta)}</span>
        </div>
        <span style="flex:none;display:flex;align-items:center;height:24px;padding:0 10px;border-radius:var(--radius-pill);background:{v.ruleBg};font:var(--weight-bold) var(--text-xs)/1 var(--font-sans);color:{v.ruleInk}">{t(v.rule)}</span>
      </div>
      <span style="font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.intro)}</span>
      {#if v.showBar}
        <div style="display:flex;align-items:center;gap:var(--space-10)">
          <span style="flex:1;display:flex;gap:4px">{#each v.bar ?? [] as seg, i0}<span style="flex:1;height:4px;border-radius:2px;background:{seg.bg};transition:background var(--duration-base,.2s)"></span>{/each}</span>
          <span style="flex:none;font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(v.barLabel)}</span>
        </div>
      {/if}
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--space-8);padding:var(--space-4) var(--space-14) var(--space-16)" role={v.listRole} aria-label="Requirements">
      {#each v.rows ?? [] as r, i1}
        <div class="dc-p0" style="display:flex;flex-direction:column;border-radius:14px;background:var(--surface-2,#191921);box-shadow:{r.ring};opacity:{r.op};cursor:{r.cursor};outline:none;transition:box-shadow var(--duration-fast,.12s),opacity var(--duration-base,.2s)" role={r.role} aria-checked={r.ariaChecked} tabindex={r.tab} onclick={r.select}>
          <div style="display:flex;align-items:center;gap:var(--space-12);min-height:64px;box-sizing:border-box;padding:var(--space-10) var(--space-14) var(--space-10) var(--space-12)">
            {#if r.isAny}<span style="flex:none;width:18px;height:18px;border-radius:50%;box-sizing:border-box;box-shadow:{r.radioRing};display:flex;align-items:center;justify-content:center" aria-hidden="true"><span style="width:8px;height:8px;border-radius:50%;background:{r.radioDot}"></span></span>{/if}
            {#if r.isToken}<TokenAvatar symbol={r.symbol} mark={r.mark} gradient={r.grad} size={40}></TokenAvatar>{/if}
            {#if r.isIcon}<span style="flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--overlay-2,rgba(255,255,255,.08))"><span style="width:19px;height:19px;background:{r.iconInk};mask:{r.iconMask}"></span></span>{/if}
            <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
              <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(r.title)}</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:{r.detailInk}">{t(r.detail)}</span>
            </span>
            <span style="flex:none;display:flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:var(--radius-pill);background:{r.chipBg};font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:{r.chipInk}"><span style="display:{r.chipIconShow};width:12px;height:12px;background:currentColor;mask:{r.chipMask}"></span>{t(r.chip)}</span>
          </div>
          {#if r.showBalance}
            <div style="display:flex;flex-direction:column;gap:var(--space-10);padding:0 var(--space-14) var(--space-14) 64px">
              <span style="font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(r.topUp)}</span>
              <div style="display:flex;align-items:center;gap:var(--space-8);height:40px;padding:0 6px 0 12px;border-radius:10px;background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-2,#C9C9D4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.address)}</span>
                <IconButton variant="ghost" icon={v.copyIcon} label={v.copyLabel} onClick={v.copy}></IconButton>
              </div>
              <div style="display:flex;align-items:center;gap:var(--space-8);flex-wrap:wrap">
                <span style="display:flex;align-items:center;gap:6px;font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent-bright,#FF8298);cursor:pointer;user-select:none" onclick={v.recheck} role="button" tabindex="0"><span style="width:14px;height:14px;background:currentColor;mask:var(--icon-refresh) center/contain no-repeat;transform:{v.spin};transition:transform .6s"></span>{t(v.recheckLabel)}</span>
                <span style="font:var(--weight-regular) var(--text-xs)/1.3 var(--font-sans);color:var(--ink-4,#8A8A99)">Also re-checked when you come back to this tab</span>
              </div>
            </div>
          {/if}
          {#if r.showNeuron}
            <div style="display:flex;flex-direction:column;gap:var(--space-10);padding:0 var(--space-14) var(--space-14) 64px">
              <div style="display:flex;gap:var(--space-10);align-items:flex-start;padding:var(--space-12);border-radius:10px;background:var(--overlay-1,rgba(255,255,255,.04))">
                <Toggle on={v.confirmed} label="" onChange={v.toggleConfirm}></Toggle>
                <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">{t(r.confirmText)}</span>
              </div>
              <span style="font:var(--weight-regular) var(--text-xs)/1.5 var(--font-sans);color:var(--ink-4,#8A8A99);text-wrap:pretty">Checked when you join. If it isn't true, joining fails and nothing is charged.</span>
            </div>
          {/if}
          {#if r.showDiamond}
            <div style="display:flex;align-items:center;gap:var(--space-12);flex-wrap:wrap;padding:0 var(--space-14) var(--space-14) 64px">
              <span style="flex:1 1 180px;min-width:0;font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">60 CHAT, once. Unlocks every Diamond perk, not just this community.</span>
              <Button label="Get Lifetime Diamond" variant="secondary" onClick={v.getDiamond}></Button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-14) var(--space-22,22px) var(--space-22,22px);border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.hasPay}
        <div style="display:flex;flex-direction:column;gap:var(--space-8)">
          <div style="display:flex;align-items:baseline;gap:var(--space-10)"><span style="flex:1;font:var(--weight-semibold) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4)">Charged when you join</span><span style="font:var(--weight-bold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.payTotal)}</span></div>
          {#each v.split ?? [] as sp, i2}<div style="display:flex;gap:var(--space-10)"><span style="flex:1;font:var(--weight-regular) var(--text-xs)/1.3 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(sp.label)}</span><span style="font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(sp.value)}</span></div>{/each}
        </div>
      {/if}
      <div style="display:flex;align-items:center;gap:var(--space-12)">
        <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-sm)/1.4 var(--font-sans);color:{v.reasonInk};text-wrap:pretty" aria-live="polite">{t(v.reason)}</span>
        <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;gap:var(--space-8);min-width:148px;height:40px;box-sizing:border-box;padding:0 var(--space-18);border-radius:var(--radius-md);background:{v.ctaBg};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.ctaInk};cursor:{v.ctaCursor};user-select:none;transition:background var(--duration-fast,.12s);--dc-p1-0:{v.ctaHover};" onclick={v.join} role="button" tabindex={v.ctaTab} aria-disabled={v.ctaAriaDisabled} aria-busy={v.busy}>
          {#if v.busy}<Spinner size={16} tone="ink" label="Joining"></Spinner>{/if}
          {#if v.idle}<span>{t(v.cta)}</span>{/if}
        </span>
      </div>
    </div>
  </div>
</DialogShell>

<style>
  .dc-p0:focus-visible{box-shadow:var(--focus-ring) !important}
  .dc-p1:hover{filter:var(--dc-p1-0) !important}
  .dc-p1:focus-visible{box-shadow:var(--focus-ring) !important}
</style>
