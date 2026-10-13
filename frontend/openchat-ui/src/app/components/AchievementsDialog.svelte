<!-- Generated from lib/AchievementsDialog.dc.html (source hash 0faa1b00) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './AchievementsDialog.logic.js';

  interface Props {
    onBack?: () => void;
    onClose?: () => void;
    unlocked?: string[];
    highlight?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:73;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" data-screen-label="Achievements" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onClose} aria-hidden="true"></div>

  <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:620px;height:760px;max-height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-24) var(--space-32);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;margin-inline-start:-10px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onBack} role="button" tabindex="0" aria-label="Back to CHIT" title="Back to CHIT">
        <span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.backMask}"></span>
      </span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Ways to earn CHIT</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.subtitle)}</span>
      </div>
      <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onClose} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:var(--space-26);padding:var(--space-26) var(--space-32) var(--space-32)">

      {#if v.hasNext}
        <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-12)">
          <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">NEXT UP</span>
          <div style="display:flex;gap:var(--space-10)">
            {#each v.next ?? [] as n, i0}
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-16) var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg);background:{n.bg};box-shadow:{n.ring}">
                <span style="width:20px;height:20px;background:{n.ink};mask:{n.mask}"></span>
                <span style="flex:1;font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">{t(n.label)}</span>
                <span style="font:var(--weight-bold) var(--text-sm)/1 var(--font-mono);color:{n.ink}">{t(n.reward)}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-8)">
        <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">EVERYTHING ELSE</span>
        {#each v.groups ?? [] as g, i1}
          <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);background:{g.bg};box-shadow:{g.ring};overflow:hidden">
            <div class="dc-p2" style="display:flex;align-items:center;gap:var(--space-12);min-height:52px;padding:var(--space-10) var(--space-12);box-sizing:border-box;cursor:pointer" onclick={g.onToggle} role="button" tabindex="0">
              <span style="flex:none;width:17px;height:17px;background:{g.ink};mask:{g.mask}"></span>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
                <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(g.label)}</span>
                <div style="height:4px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.09));overflow:hidden">
                  <div style="width:{g.pct};height:100%;background:{g.ink};transition:width var(--duration-slow,280ms) var(--ease-out)"></div>
                </div>
              </div>
              <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(g.count)}</span>
              <span style="flex:none;width:13px;height:13px;background:var(--ink-4,#7C7C8C);mask:{v.chevronMask};transform:{g.chevronTurn};transition:transform var(--duration-base,200ms) var(--ease-out)"></span>
            </div>
            {#if g.open}
              <div style="display:flex;flex-direction:column;gap:2px;padding:0 var(--space-12) var(--space-12)">
                {#each g.rows ?? [] as r, i2}
                  <div style="display:flex;align-items:center;gap:var(--space-10);min-height:36px;padding:0 var(--space-8);box-sizing:border-box;border-radius:var(--radius-sm);background:{r.rowBg};box-shadow:{r.rowRing}" data-ach-hl={r.hl}>
                    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:var(--radius-pill);background:{r.markBg};box-shadow:{r.markRing}">
                      <span style="width:10px;height:10px;background:var(--status-online,#2EE6A8);mask:{v.checkMask};opacity:{r.markOpacity}"></span>
                    </span>
                    <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-md)/1.3 var(--font-sans);color:{r.labelInk};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(r.label)}</span>
                    <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:{r.rewardInk}">{t(r.reward)}</span>
                  </div>
                {/each}
                {#if g.empty}
                  <span style="padding:var(--space-8);font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(g.emptyLine)}</span>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>
