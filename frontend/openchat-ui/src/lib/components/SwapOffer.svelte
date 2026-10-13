<!-- Generated from lib/SwapOffer.dc.html (source hash da54ba4f) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './SwapOffer.logic.js';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Props {
    side?: 'received' | 'sent';
    state?: 'open' | 'done' | 'expired';
    give?: { amount: string; symbol: string; mark?: string; usd?: string; gradient?: string };
    get?: { amount: string; symbol: string; mark?: string; usd?: string; gradient?: string };
    expiresIn?: string;
    doneText?: string;
    time?: string;
    lastInGroup?: boolean;
    onAccept?: () => void;
    onCancel?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:300px;max-width:100%;padding:4px;box-sizing:border-box;border-radius:{v.shellR};background:{v.bg};box-shadow:{v.ring};opacity:{v.op}">
  <div style="display:flex;flex-direction:column;gap:4px">
    <div style="padding:10px 10px 0"><span style="display:flex;align-items:center;gap:6px;font:500 12px/1 var(--font-sans);color:{v.soft}"><span style="width:12px;height:12px;background:currentColor;mask:var(--icon-swap) center/contain no-repeat"></span><span style="flex:1">Swap offer</span><span style="font-family:var(--font-mono);font-size:11.5px;color:{v.whenInk}">{t(v.when)}</span></span></div>
    <div style="position:relative;display:flex;flex-direction:column;gap:4px">
      {#each v.legs ?? [] as lg, i0}
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:6px;background:{v.seg}">
          <TokenAvatar symbol={lg.symbol} mark={lg.mark} gradient={lg.gradient} size={40}></TokenAvatar>
          <span style="flex:1;min-width:0;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font:700 18px/1 var(--font-sans);letter-spacing:-.01em;color:{lg.ink}">{t(lg.signed)}</span><span style="font:400 12.5px/1 var(--font-sans);color:{v.soft}">{t(lg.usd)}</span></span>
        </div>
      {/each}
      <span style="position:absolute;left:50%;top:50%;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:{v.bg};box-shadow:0 0 0 3px {v.bg};display:flex;align-items:center;justify-content:center" aria-hidden="true"><span style="width:14px;height:14px;background:{v.ink};mask:var(--icon-arrow-down) center/contain no-repeat"></span></span>
    </div>
    {#if v.hasAction}<span class="dc-p0" style="display:flex;align-items:center;justify-content:center;height:44px;border-radius:6px;background:{v.btnBg};font:600 13.5px/1 var(--font-sans);color:{v.btnInk};cursor:pointer" onclick={v.act} role="button" tabindex="0">{t(v.action)}</span>{/if}
    {#if v.isDone}<span style="display:flex;align-items:center;justify-content:center;gap:6px;height:44px;border-radius:6px;background:{v.seg};font:600 12.5px/1 var(--font-sans);color:var(--status-online,#2EE6A8)"><span style="width:13px;height:13px;background:currentColor;mask:var(--icon-check) center/contain no-repeat"></span>{t(v.doneText)}</span>{/if}
  </div>
  <div style="display:flex;justify-content:flex-end;padding:6px 10px 4px;font:400 11px/1 var(--font-mono);color:{v.soft}">{t(v.time)}</div>
</div>

<style>
  .dc-p0:hover{filter:brightness(1.08) !important}
</style>
