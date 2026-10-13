<!-- Generated from lib/DiamondDialog.dc.html (source hash 39751360) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './DiamondDialog.logic.js';
  import Toggle from '../../lib/components/Toggle.svelte';

  interface Props {
    plan?: string;
    isDiamond?: boolean;
    lifetime?: boolean;
    memberUntil?: string;
    balance?: number;
    onBack?: () => void;
    onClose?: () => void;
    onUpgrade?: (p: {lifetime: boolean, until: string|null, autoRenew: boolean, plan: string}) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:72;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" data-screen-label="Diamond" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onClose} aria-hidden="true"></div>

  <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:580px;height:770px;max-height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-24) var(--space-32);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.hasBack}
        <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;margin-inline-start:-10px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onBack} aria-label={v.backLabel} role="button" tabindex="0" title={v.backLabel}><span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.m.back}"></span></span>
      {/if}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Diamond membership</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.subtitle)}</span>
      </div>
      <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onClose} role="button" tabindex="0"><span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.m.close}"></span></span>
    </div>

    {#if v.isCompare}
    <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-24);padding:var(--space-26) var(--space-32) var(--space-32)">
      <div style="flex:none;display:flex;align-items:center;gap:var(--space-22)">
        <span style="flex:none;display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:var(--radius-lg);background:color-mix(in oklch,var(--accent,#FF5672) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 35%,transparent)"><span style="width:30px;height:30px;background:var(--accent,#FF5672);mask:{v.m.gem}"></span></span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
          <span style="font:var(--weight-bold) 22px/1.2 var(--font-sans);letter-spacing:-.015em;color:var(--ink,#ECECF1);text-wrap:balance">{t(v.heroTitle)}</span>
          <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.heroBody)}</span>
        </div>
      </div>

      <div style="flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
        {#each v.highlights ?? [] as h, i0}
          <div style="display:flex;flex-direction:column;gap:9px;padding:14px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
            <span style="font:var(--weight-bold) 19px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(h.value)}</span>
            <span style="font:var(--weight-medium) 11.5px/1.3 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(h.label)}</span>
          </div>
        {/each}
      </div>

      <div style="flex:none;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:12px;padding-inline:4px">
          <span style="flex:1;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">COMPARE PLANS</span>
          {#if v.showFilters}
          <div style="flex:none;display:flex;gap:2px;padding:3px;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
            {#each v.filters ?? [] as f, i1}
              <span style="display:flex;align-items:center;height:26px;padding:0 10px;border-radius:6px;background:{f.bg};font:var(--weight-semibold) 11.5px/1 var(--font-sans);color:{f.ink};cursor:pointer;user-select:none;white-space:nowrap" onclick={f.pick} role="button" tabindex="0">{t(f.label)}</span>
            {/each}
          </div>
          {/if}
        </div>

        <div style="position:relative;display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
          <div style="position:absolute;inset-block:0;inset-inline-end:0;width:128px;background:color-mix(in oklch,var(--accent,#FF5672) 7%,transparent);border-inline-start:1px solid color-mix(in oklch,var(--accent,#FF5672) 22%,transparent);pointer-events:none"></div>
          <div style="position:relative;display:grid;grid-template-columns:minmax(0,1fr) 112px 128px;align-items:center;height:48px;padding-inline-start:16px;border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span></span>
            <span style="text-align:center;font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#8A8A99)">Free</span>
            <span style="display:flex;align-items:center;justify-content:center;gap:6px;font:var(--weight-bold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672)"><span style="width:13px;height:13px;background:var(--accent,#FF5672);mask:{v.m.gem}"></span>Diamond</span>
          </div>
          {#each v.groups ?? [] as g, i2}
            <div style="position:relative;display:flex;align-items:flex-end;height:36px;padding:0 16px 8px;box-sizing:border-box;border-block-start:{g.divider}">
              <span style="font:var(--weight-semibold) 10.5px/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">{t(g.label)}</span>
            </div>
            {#each g.rows ?? [] as r, i3}
              <div style="position:relative;display:grid;grid-template-columns:minmax(0,1fr) 112px 128px;align-items:center;min-height:44px;padding-inline-start:16px">
                <span style="display:flex;align-items:center;gap:12px;min-width:0"><span style="flex:none;width:15px;height:15px;background:var(--ink-3,#8A8A99);mask:{r.mask}"></span><span style="font:var(--weight-medium) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#E4E4EC)">{t(r.label)}</span></span>
                <span style="display:flex;justify-content:center;text-align:center">
                  {#if r.freeCheck}<span style="width:15px;height:15px;background:var(--ink-3,#8A8A99);mask:{v.m.check}"></span>{/if}
                  {#if r.freeText}<span style="font:var(--weight-medium) 11.5px/1.25 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(r.free)}</span>{/if}
                  {#if r.freeNone}<span style="width:10px;height:1.5px;border-radius:2px;background:var(--ink-4,#5A5A66)"></span>{/if}
                </span>
                <span style="display:flex;justify-content:center;text-align:center">
                  {#if r.proCheck}<span style="width:16px;height:16px;background:var(--accent,#FF5672);mask:{v.m.check}"></span>{/if}
                  {#if r.proText}<span style="font:var(--weight-semibold) 11.5px/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(r.pro)}</span>{/if}
                </span>
              </div>
            {/each}
          {/each}
          <div style="height:8px"></div>
        </div>
      </div>
    </div>
    {/if}

    {#if v.isPlans}
    <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-24);padding:var(--space-26) var(--space-32) var(--space-32);animation:oc-step-in var(--duration-base,200ms) var(--ease-out) both">
      {#if v.isExtend}
        <span style="flex:none;font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Your membership ends in <span style="font-weight:var(--weight-semibold);color:var(--ink,#ECECF1)">{t(v.daysLeft)}</span>, on <span style="font-weight:var(--weight-semibold);color:var(--ink,#ECECF1)">{t(v.expiryText)}</span>. Extensions start from that date.</span>
      {/if}

      <div style="flex:none;display:flex;flex-direction:column;gap:10px">
        <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">PAY WITH</span>
        <div style="display:flex;gap:8px">
          <div style="position:relative;flex:1;min-width:0;display:flex">
            <div class="dc-p2" style="flex:1;min-width:0;display:flex;align-items:center;gap:14px;height:68px;padding:0 14px 0 16px;box-sizing:border-box;border-radius:var(--radius-md);background:{v.pickerBg};cursor:pointer;user-select:none" onclick={v.onPickToken} role="button" tabindex="0">
              <span style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-pill);background:{v.tok.grad};font:var(--weight-bold) var(--text-base)/1 var(--font-sans);color:#fff">{t(v.tok.mark)}</span>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
                <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.tok.symbol)}</span>
                <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-sans);color:var(--ink-3,#8A8A99);font-variant-numeric:tabular-nums">{t(v.balanceText)} available</span>
              </div>
              <span style="flex:none;width:16px;height:16px;background:var(--ink-3,#8A8A99);mask:{v.m.down};transform:{v.pickerRot};transition:transform var(--duration-base,200ms) var(--ease-out)"></span>
            </div>
            {#if v.pickerOpen}
              <div style="position:fixed;inset:0;z-index:4" onclick={v.onPickToken}></div>
              <div style="position:absolute;inset-inline:0;top:74px;z-index:5;display:flex;flex-direction:column;padding:6px;border-radius:var(--radius-md);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-pop,0 16px 40px rgba(0,0,0,.45));animation:oc-dlg-in var(--duration-base,200ms) var(--ease-out) both">
                {#each v.tokenList ?? [] as tk, i4}
                  <div class="dc-p3" style="display:flex;align-items:center;gap:12px;height:56px;padding:0 12px;border-radius:var(--radius-sm);background:{tk.bg};cursor:pointer;user-select:none" onclick={tk.pick} role="button" tabindex="0">
                    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-pill);background:{tk.grad};font:var(--weight-bold) var(--text-md)/1 var(--font-sans);color:#fff">{t(tk.mark)}</span>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                      <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(tk.symbol)}</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(tk.name)}</span>
                    </div>
                    <span style="flex:none;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);font-variant-numeric:tabular-nums">{t(tk.held)}</span>
                    <span style="flex:none;width:14px;height:14px;background:var(--accent,#FF5672);mask:{v.m.check};opacity:{tk.checkOpacity}"></span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          {#if v.isShort}
            <span class="dc-p4" style="flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:68px;height:68px;border-radius:var(--radius-md);background:{v.topUpBg};font:var(--weight-semibold) 10.5px/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.onTopUp} aria-label="Top up" role="button" tabindex="0" title="Top up"><span style="width:18px;height:18px;background:var(--ink-2,#C9C9D4);mask:{v.m.qr}"></span>Top up</span>
          {/if}
        </div>
        {#if v.topUpOpen}
          <div style="display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
            <span style="font:var(--weight-medium) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-3,#8A8A99)">Send {t(v.tok.symbol)} to your account address, then refresh your balance.</span>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink,#ECECF1)">{t(v.address)}</span>
              <span class="dc-p5" style="flex:none;display:flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.onCopy} role="button" tabindex="0"><span style="width:13px;height:13px;background:var(--ink,#ECECF1);mask:{v.copyMask}"></span>{t(v.copyLabel)}</span>
            </div>
          </div>
        {/if}
        {#if v.noneAffordable}
          <div style="display:flex;gap:12px;padding:14px 16px;border-radius:var(--radius-md);background:color-mix(in oklch,var(--status-warning,#FFB03D) 9%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--status-warning,#FFB03D) 30%,transparent)">
            <span style="flex:none;width:16px;height:16px;margin-top:1px;background:var(--status-warning,#FFB03D);mask:{v.m.alert}"></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
              <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--status-warning,#FFB03D)">Insufficient funds</span>
              <span style="font:var(--weight-regular) var(--text-md)/1.45 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">You need at least {t(v.cheapest)} to get Diamond. Pick another token, or use Top up to get your receiving address.</span>
            </div>
          </div>
        {/if}
      </div>

      <div style="flex:none;display:flex;flex-direction:column;gap:10px">
        <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">{t(v.plansLabel)}</span>
        <div style="display:flex;flex-direction:column;gap:6px">
          {#each v.plans ?? [] as o, i5}
            <div class="dc-p6" style="display:flex;align-items:center;gap:14px;height:68px;padding:0 14px 0 16px;box-sizing:border-box;border-radius:var(--radius-md);background:{o.bg};box-shadow:{o.ring};opacity:{o.opacity};cursor:{o.cursor};user-select:none;--dc-p6-0:{o.hover};" onclick={o.pick} role="button" tabindex={o.tab}>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
                <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:{o.ink}">{t(o.label)}</span>
                <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-sans);color:{o.subInk}">{t(o.sub)}</span>
              </div>
              <span style="flex:none;font:var(--weight-bold) var(--text-base)/1 var(--font-sans);color:{o.ink};font-variant-numeric:tabular-nums">{t(o.price)}</span>
              <span style="flex:none;width:14px;height:14px;background:var(--ink-3,#8A8A99);mask:{v.m.chev}"></span>
            </div>
          {/each}
        </div>
        {#if v.isShort}
          <span class="dc-p7" style="align-self:center;display:flex;align-items:center;gap:8px;height:38px;margin-top:6px;padding:0 14px;border-radius:var(--radius-sm);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onRefresh} role="button" tabindex="0"><span style="width:14px;height:14px;background:var(--accent,#FF5672);mask:{v.m.refresh};animation:{v.refreshSpin}"></span>{t(v.refreshLabel)}</span>
        {/if}
      </div>
    </div>
    {/if}

    {#if v.isConfirm}
    <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-24);padding:var(--space-26) var(--space-32) var(--space-32);animation:oc-step-in var(--duration-base,200ms) var(--ease-out) both">
      <div style="flex:none;display:flex;align-items:center;gap:var(--space-22)">
        <span style="flex:none;display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:var(--radius-lg);background:color-mix(in oklch,var(--accent,#FF5672) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 35%,transparent)"><span style="width:30px;height:30px;background:var(--accent,#FF5672);mask:{v.m.gem}"></span></span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
          <span style="font:var(--weight-bold) 22px/1.2 var(--font-sans);letter-spacing:-.015em;color:var(--ink,#ECECF1);text-wrap:balance">{t(v.cTitle)}</span>
          <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.cBody)}</span>
        </div>
      </div>

      {#if v.cTimed}
        <div style="flex:none;display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
          <div style="display:flex;align-items:center;gap:var(--space-14);padding:var(--space-16)">
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Auto-renew</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#8A8A99);text-wrap:pretty">{t(v.renewHelp)}</span>
            </div>
            <div style="flex:none;display:flex"><Toggle on={v.autoRenew} onChange={v.setAutoRenew}></Toggle></div>
          </div>
        </div>
        {#if v.showLossWarn}
          <div style="flex:none;display:flex;gap:12px;padding:14px 16px;border-radius:var(--radius-md);background:color-mix(in oklch,var(--status-warning,#FFB03D) 9%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--status-warning,#FFB03D) 30%,transparent)">
            <span style="flex:none;width:16px;height:16px;margin-top:1px;background:var(--status-warning,#FFB03D);mask:{v.m.alert}"></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
              <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--status-warning,#FFB03D)">Files and media may be lost</span>
              <span style="font:var(--weight-regular) var(--text-md)/1.45 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">When your membership ends you return to the free plan, and files and media you’ve posted may be removed.</span>
            </div>
          </div>
        {/if}
      {/if}

      <div style="flex:none;display:flex;flex-direction:column;padding:6px 0;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
        {#each v.summary ?? [] as s, i6}
          <div style="display:flex;align-items:center;gap:12px;min-height:40px;padding:0 16px">
            <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(s.label)}</span>
            <span style="flex:none;font:var(--weight-bold) var(--text-base)/1 var(--font-sans);color:{s.ink};font-variant-numeric:tabular-nums">{t(s.value)}</span>
          </div>
        {/each}
      </div>
    </div>
    {/if}

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-22) var(--space-32);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.footMember}
        <span style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;font:var(--weight-medium) var(--text-md)/1.35 var(--font-sans);color:var(--ink-2,#C9C9D4)"><span style="flex:none;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:var(--radius-pill);background:color-mix(in oklch,var(--status-online,#2EE6A8) 18%,transparent)"><span style="width:13px;height:13px;background:var(--status-online,#2EE6A8);mask:{v.m.check}"></span></span>{t(v.memberLine)}</span>
        {#if v.canExtend}
          <span class="dc-p8" style="flex:none;display:flex;align-items:center;justify-content:center;height:44px;padding:0 18px;border-radius:var(--radius-sm);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onExtend} role="button" tabindex="0">Extend</span>
        {/if}
        <span class="dc-p9" style="flex:none;display:flex;align-items:center;justify-content:center;height:44px;padding:0 22px;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.onClose} role="button" tabindex="0">Done</span>
      {/if}
      {#if v.footFree}
        <span class="dc-p10" style="flex:none;display:flex;align-items:center;justify-content:center;height:44px;padding:0 18px;border-radius:var(--radius-sm);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.onClose} role="button" tabindex="0">Maybe later</span>
        <span class="dc-p11" style="flex:1;display:flex;align-items:center;justify-content:center;gap:10px;height:44px;border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#fff);cursor:pointer;user-select:none" onclick={v.onUpgrade} role="button" tabindex="0"><span style="width:16px;height:16px;background:var(--on-accent,#fff);mask:{v.m.gem}"></span>Upgrade to Diamond</span>
      {/if}
      {#if v.footPlans}
        <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Payments go to the OpenChat SNS treasury.</span>
        <span class="dc-p12" style="flex:none;display:flex;align-items:center;justify-content:center;height:44px;padding:0 22px;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.onBack} role="button" tabindex="0">Back</span>
      {/if}
      {#if v.footConfirm}
        <span class="dc-p13" style="flex:none;display:flex;align-items:center;justify-content:center;height:44px;padding:0 18px;border-radius:var(--radius-sm);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:{v.cursor};opacity:{v.laterOpacity};user-select:none" onclick={v.onBack} role="button" tabindex="0">Back</span>
        <span class="dc-p14" style="flex:1;display:flex;align-items:center;justify-content:center;gap:10px;height:44px;border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#fff);cursor:{v.cursor};user-select:none" onclick={v.onPay} role="button" tabindex="0"><span style="width:16px;height:16px;background:var(--on-accent,#fff);mask:{v.payMask};animation:{v.paySpin}"></span>{t(v.payLabel)}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p5:hover{background:var(--overlay-3,rgba(255,255,255,.14)) !important}
  .dc-p6:hover{filter:var(--dc-p6-0) !important}
  .dc-p7:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p8:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p9:hover{background:var(--overlay-3,rgba(255,255,255,.14)) !important}
  .dc-p10:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p11:hover{filter:brightness(1.08) !important}
  .dc-p12:hover{background:var(--overlay-3,rgba(255,255,255,.14)) !important}
  .dc-p13:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p14:hover{filter:brightness(1.08) !important}
</style>
