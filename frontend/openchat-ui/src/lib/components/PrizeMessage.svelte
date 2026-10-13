<!-- Generated from lib/PrizeMessage.dc.html (source hash 44eff81b) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './PrizeMessage.logic.js';
  import Confetti from './Confetti.svelte';
  import RequirementChip from './RequirementChip.svelte';
  import TokenCoin from '../../app/components/TokenCoin.svelte';

  interface Props {
    token?: { symbol: string; mark?: string; gradient?: string; edge?: string; edge2?: string };
    winners?: number;
    claimed?: number;
    endsIn?: string;
    endingSoon?: boolean;
    gates?: { label: string; met: boolean }[];
    state?: 'open' | 'claimed' | 'ended';
    wonAmount?: string;
    note?: string;
    time?: string;
    lastInGroup?: boolean;
    onClaim?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:320px;max-width:100%;padding:4px;box-sizing:border-box;border-radius:{v.shellR};background:var(--bubble-recv-bg,#191921);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));opacity:{v.op}">
  <div style="display:flex;flex-direction:column;gap:4px">
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:22px 16px 18px;border-radius:2px 18px 6px 6px;background:radial-gradient(120% 120% at 50% 0%,color-mix(in oklch,var(--accent,#FF5672) 28%,transparent),transparent 65%),var(--overlay-1,rgba(255,255,255,.045))">
      <span style="width:96px;height:96px;display:flex;align-items:center;justify-content:center"><TokenCoin symbol={v.coinSym} mark={v.coinMark} gradient={v.coinGrad} edge={v.coinEdge} edge2={v.coinEdge2} size={80}></TokenCoin></span>
      <span style="margin-top:6px;font:600 11.5px/1 var(--font-sans);color:var(--accent-bright,#FF8298)">Prize</span>
      <span style="font:700 26px/1 var(--font-sans);letter-spacing:-.02em;color:var(--ink,#ECECF1)">{t(v.headline)}</span>
      <span style="display:flex;align-items:center;gap:6px;font:500 12.5px/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.winnersLine)}<span style="width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.6"></span><span style="display:flex;align-items:center;gap:4px;color:{v.endsInk}"><span style="width:12px;height:12px;background:currentColor;mask:var(--icon-clock) center/contain no-repeat"></span>{t(v.endsLine)}</span></span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:6px;background:var(--overlay-1,rgba(255,255,255,.045))">
      <div style="display:flex;justify-content:space-between;font:500 12px/1 var(--font-sans);color:var(--ink-3,#9A9AA8)"><span>{t(v.left)}</span><span style="font-family:var(--font-mono)">{t(v.claimedLabel)}</span></div>
      <div style="height:6px;border-radius:3px;background:var(--overlay-2,rgba(255,255,255,.08));overflow:hidden"><span style="display:block;height:100%;width:{v.w};border-radius:3px;background:var(--accent,#FF5672);transition:width .5s"></span></div>
    </div>
    {#if v.hasGates}
      <div style="display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:6px;background:var(--overlay-1,rgba(255,255,255,.045))">
        <span style="font:600 10.5px/1 var(--font-mono);letter-spacing:.06em;color:var(--ink-4,#8A8A99)">TO CLAIM</span>
        <div style="display:flex;flex-wrap:wrap;gap:6px" role="list">{#each v.gates ?? [] as gt, i0}<RequirementChip label={gt.label} state={gt.state}></RequirementChip>{/each}</div>
      </div>
    {/if}
    <div style="position:relative;height:0" aria-hidden="true"><div style="position:absolute;left:0;right:0;top:0;height:52px;pointer-events:none"><Confetti fire={v.burst}></Confetti></div></div>
    {#if v.canClaim}<span class="dc-p0" style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:6px;background:var(--accent,#FF5672);font:700 14px/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.claim} role="button" tabindex="0"><span style="width:16px;height:16px;background:currentColor;mask:var(--icon-gift) center/contain no-repeat"></span>Claim prize</span>{/if}
    {#if v.isBlocked}<span style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:6px;background:var(--overlay-2,rgba(255,255,255,.08));font:600 13px/1 var(--font-sans);color:var(--ink-3,#9A9AA8)" aria-disabled="true"><span style="width:14px;height:14px;background:currentColor;mask:var(--icon-lock) center/contain no-repeat"></span>Requirements not met</span>{/if}
    {#if v.isEnded}<span style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:6px;background:var(--overlay-2,rgba(255,255,255,.08));font:600 13px/1 var(--font-sans);color:var(--ink-3,#9A9AA8)"><span style="width:14px;height:14px;background:currentColor;mask:var(--icon-clock) center/contain no-repeat"></span>This prize has ended</span>{/if}
    {#if v.isWon}<span style="display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:6px;background:color-mix(in oklch,var(--status-online,#2EE6A8) 13%,transparent);font:600 13.5px/1 var(--font-sans);color:var(--status-online,#2EE6A8)"><span style="width:14px;height:14px;background:currentColor;mask:var(--icon-check) center/contain no-repeat"></span>{t(v.wonText)}</span>{/if}
  </div>
  {#if v.noNote}<div style="display:flex;justify-content:flex-end;padding:6px 10px 4px;font:400 11px/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.time)}</div>{/if}
  {#if v.hasNote}<p style="position:relative;margin:0;padding:10px 10px 8px;font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:var(--bubble-recv-text,#E4E4EC)">{t(v.note)}<span style="visibility:hidden;margin-left:9px;font:400 11px/1 var(--font-mono)" aria-hidden="true">{t(v.time)}</span><span style="position:absolute;right:10px;bottom:8px;font:400 11px/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.time)}</span></p>{/if}
</div>

<style>
  .dc-p0:hover{filter:brightness(1.07) !important}
  .dc-p0:active{transform:scale(.98) !important}
</style>
