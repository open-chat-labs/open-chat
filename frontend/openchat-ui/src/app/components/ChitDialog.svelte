<!-- Generated from lib/ChitDialog.dc.html (source hash 556edac8) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ChitDialog.logic.js';
  import DailyPuzzleCard from './DailyPuzzleCard.svelte';

  interface Props {
    streak?: number;
    balance?: number;
    earned?: number;
    daily?: number;
    claimable?: boolean;
    countdown?: string;
    onClaim?: (amount: number) => void;
    onAction?: (kind: string) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:72;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" data-screen-label="CHIT" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onClose} aria-hidden="true"></div>

  <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;max-height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-24) var(--space-32);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.hasBack}
        <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;margin-inline-start:-10px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onBack} role="button" tabindex="0" aria-label={v.backTitle} title={v.backTitle}>
          <span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.backMask}"></span>
        </span>
      {/if}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Daily CHIT</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.subtitle)}</span>
      </div>
      <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onSettings} role="button" tabindex="0" aria-label="CHIT settings" title="CHIT settings">
        <span style="width:17px;height:17px;background:var(--ink-3,#9A9AA8);mask:var(--icon-gear) center/contain no-repeat"></span>
      </span>
      <span class="dc-p2" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onLeaderboard} role="button" tabindex="0" aria-label={v.boardHint} title={v.boardHint}>
        <span style="width:17px;height:17px;background:var(--ink-3,#9A9AA8);mask:{v.trophyMask}"></span>
      </span>
      <span class="dc-p3" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onClose} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:var(--space-22);padding:var(--space-26) var(--space-32) var(--space-32)">

      <div style="flex:none;display:flex;align-items:center;gap:var(--space-22);min-width:0">
        <div style="flex:none;position:relative;width:136px;height:136px;border-radius:var(--radius-pill);background:{v.ringGradient};animation:{v.ringAnim}">
          <div style="position:absolute;inset:14px;border-radius:var(--radius-pill);background:var(--surface-1,#0e0e12);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px">
            <span style="font:var(--weight-bold) var(--text-3xl,34px)/1 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1)">{t(v.streak)}</span>
            <span style="font:var(--weight-semibold) var(--text-2xs,10px)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">DAY STREAK</span>
          </div>
        </div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-6)">
          <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">COLLECTED</span>
          <span style="font:var(--weight-bold) var(--text-3xl,34px)/1.1 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1)">{t(v.balance)}</span>
          <span style="font:var(--weight-regular) var(--text-sm)/1.35 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.earnedLine)}</span>
        </div>
      </div>

      <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-14);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.045));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))">
        <div style="display:flex;align-items:baseline;gap:var(--space-10);min-width:0;margin:0 10px">
          <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.milestoneTitle)}</span>
          <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(v.nextRate)}</span>
        </div>
        <div style="position:relative;margin:0 10px">
          <div style="position:relative;height:8px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.09));overflow:hidden">
            <div style="position:absolute;inset-block:0;inset-inline-start:0;width:{v.progress};background:linear-gradient(90deg,var(--accent,#FF5672),var(--status-chit,#FF9F45));transition:width var(--duration-slow,280ms) var(--ease-out)"></div>
          </div>
          {#each v.notches ?? [] as m, i0}
            <span style="position:absolute;top:-1px;inset-inline-start:{m.pos};width:2px;height:10px;border-radius:1px;background:var(--surface-1,#0e0e12);transform:translateX(-50%)"></span>
          {/each}
          <div style="position:relative;height:18px;margin-block-start:var(--space-8)">
            {#each v.milestones ?? [] as m, i1}
              <span style="position:absolute;inset-inline-start:{m.pos};transform:translateX(-50%);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);color:{m.ink};white-space:nowrap">{t(m.label)}</span>
            {/each}
          </div>
        </div>
      </div>

      <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-8)">
        {#if v.claimable}
          <div class="dc-p4" style="display:flex;align-items:center;justify-content:center;gap:var(--space-8);height:46px;border-radius:var(--radius-md);background:linear-gradient(100deg,var(--accent,#FF5672),var(--status-chit,#FF9F45));cursor:pointer;user-select:none" onclick={v.onClaim} role="button" tabindex="0">
            <span style="width:17px;height:17px;background:var(--on-accent,#2E0512);mask:{v.flameMask}"></span>
            <span style="font:var(--weight-bold) var(--text-base)/1 var(--font-sans);color:var(--on-accent,#2E0512)">{t(v.claimLabel)}</span>
          </div>
        {/if}
        {#if v.claimed}
          <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-8);height:46px;border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));user-select:none">
            <span style="width:15px;height:15px;background:var(--status-online,#2EE6A8);mask:{v.checkMask}"></span>
            <span style="font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(v.countdownLabel)}</span>
          </div>
        {/if}
        {#if v.claimable}
          <span style="padding-block-start:var(--space-4);font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C);text-align:center;text-wrap:pretty">The longer you maintain your streak the more daily CHIT you can claim!</span>
        {/if}
        {#if v.claimed}
          <span style="padding-block-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1.5 var(--font-sans);color:var(--ink,#ECECF1);text-align:center;text-wrap:pretty">Come back tomorrow to extend your streak!</span>
        {/if}
      </div>

      <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-12);margin-block-start:var(--space-4);padding-block-start:var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
        <DailyPuzzleCard state={v.pzState} sub={v.pzSubProp} countdown={v.pzCountdown} remind={v.pzRemindB} onAction={v.pzAction}></DailyPuzzleCard>
        <div class="dc-p5" style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-14);border-radius:var(--radius-lg);background:{v.coverBg};box-shadow:{v.coverRing};cursor:pointer;transition:background var(--duration-fast,120ms) var(--ease-out),filter var(--duration-fast,120ms) var(--ease-out)" onclick={v.onInsurance} role="button" tabindex="0">
          <span style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-md);background:{v.coverTileBg}">
            <span style="width:18px;height:18px;background:{v.coverInk};mask:{v.coverMask}"></span>
          </span>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
            <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.coverTitle)}</span>
            <span style="font:var(--weight-regular) var(--text-sm)/1.35 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.coverHint)}</span>
          </div>
          {#if v.hasCover}
            <span style="flex:none;display:flex;align-items:center;gap:3px">
              {#each v.coverPips ?? [] as p, i2}
                <span style="width:13px;height:13px;background:{p.ink};mask:{v.coverMask}"></span>
              {/each}
            </span>
          {/if}
          <span style="flex:none;width:14px;height:14px;background:{v.coverInk};mask:{v.chevronMask}"></span>
        </div>
        {#each v.links ?? [] as l, i3}
          <div class="dc-p6" style="display:flex;align-items:center;gap:var(--space-12);padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg);cursor:{l.cursor};transition:background var(--duration-fast,120ms) var(--ease-out)" onclick={l.onPress} role="button" tabindex="0">
            <span style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.07))">
              <span style="width:18px;height:18px;background:var(--ink-3,#9A9AA8);mask:{l.mask}"></span>
            </span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(l.label)}</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.35 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(l.hint)}</span>
            </div>
            {#if l.actionable}
              <span style="flex:none;width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.chevronMask}"></span>
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
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{filter:brightness(1.06) !important}
  .dc-p5:hover{filter:brightness(1.14) !important}
  .dc-p6:hover{background:var(--overlay-1,rgba(255,255,255,.045)) !important}
</style>
