<!-- Generated from lib/TransferMessage.dc.html (source hash 06196d3d) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './TransferMessage.logic.js';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Props {
    side?: 'received' | 'sent';
    amount?: string;
    symbol?: string;
    mark?: string;
    gradient?: string;
    usd?: string;
    caption?: string;
    time?: string;
    lastInGroup?: boolean;
    onOpen?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:280px;max-width:100%;padding:4px;box-sizing:border-box;border-radius:{v.shellR};background:{v.bg};box-shadow:{v.ring}">
  <div style="display:flex;flex-direction:column;border-radius:2px 18px 6px 6px;background:{v.card};overflow:hidden">
    <div style="display:flex;align-items:center;gap:12px;padding:14px 14px 12px">
      <TokenAvatar symbol={v.symbol} mark={v.mark} gradient={v.gradient} badge={v.badge} size={40}></TokenAvatar>
      <span style="flex:1;min-width:0;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font:700 19px/1 var(--font-sans);letter-spacing:-.01em;color:{v.amountInk}">{t(v.signed)}</span><span style="font:400 12.5px/1 var(--font-sans);color:{v.soft}">{t(v.usd)}</span></span>
    </div>
    <span class="dc-p0" style="display:flex;align-items:center;justify-content:space-between;height:36px;padding:0 14px;border-top:1px solid {v.line};font:600 12.5px/1 var(--font-sans);color:{v.soft};cursor:pointer;--dc-p0-0:{v.ink};" onclick={v.onOpen} role="button" tabindex="0">View transaction<span style="width:12px;height:12px;background:currentColor;mask:var(--icon-chevron-right) center/contain no-repeat"></span></span>
  </div>
  {#if v.hasCaption}<p style="position:relative;margin:0;padding:10px 10px 8px;font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:{v.ink};text-wrap:pretty">{t(v.caption)}<span style="display:inline-flex;visibility:hidden;align-items:center;gap:4px;margin-left:9px;font:400 11px/1 var(--font-mono);color:{v.soft}" aria-hidden="true">{t(v.time)}</span><span style="position:absolute;right:10px;bottom:8px;display:inline-flex;align-items:center;gap:4px;font:400 11px/1 var(--font-mono);color:{v.soft}">{t(v.time)}</span></p>{/if}
  {#if v.noCaption}<div style="display:flex;justify-content:flex-end;padding:6px 10px 4px;font:400 11px/1 var(--font-mono);color:{v.soft}">{t(v.time)}</div>{/if}
</div>

<style>
  .dc-p0:hover{color:var(--dc-p0-0) !important}
</style>
