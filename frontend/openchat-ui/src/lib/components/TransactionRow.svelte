<!-- Generated from lib/TransactionRow.dc.html (source hash 235ffaf2) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './TransactionRow.logic.js';
  import Pill from './Pill.svelte';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Props {
    hidden?: boolean;
    title?: string;
    sub?: string;
    amount?: string;
    fiat?: string;
    kind?: string;
    positive?: boolean;
    symbol?: string;
    mark?: string;
    gradient?: string;
    status?: string;
    statusTone?: string;
    divider?: boolean;
    fresh?: boolean;
    onClick?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div class="dc-p0" style="display:flex;align-items:center;gap:var(--space-12);min-height:{v.minH};padding:0 {v.padX};box-sizing:border-box;border-top:{v.divider};border-radius:{v.radius};background:{v.bg};cursor:{v.cursor};--dc-p0-0:{v.hover || v.bg};" onclick={v.onPress} role={v.role} tabindex={v.tab}>
  {#if v.hasToken}<TokenAvatar size={40} symbol={v.symbol} mark={v.mark} gradient={v.gradient} badge={v.kind}></TokenAvatar>{/if}
  {#if v.hasIcon}<span style="flex:none;width:40px;height:40px;border-radius:var(--radius-pill);display:flex;align-items:center;justify-content:center;background:var(--overlay-2,rgba(255,255,255,.06))"><span style="width:15px;height:15px;background:var(--ink-2,#C9C9D4);mask:{v.iconMask}"></span></span>{/if}
  <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
    <span style="font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.title)}</span>
    <span style="display:flex;align-items:center;gap:var(--space-8);min-width:0;font:var(--weight-regular) var(--text-xs)/1 var(--font-sans);color:var(--ink-4,#8A8A99)"><span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.sub)}</span>{#if v.hasStatus}<Pill label={v.status} tone={v.statusTone} dot={true}></Pill>{/if}</span>
  </span>
  <span style="flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:5px" aria-label={v.amountAria}><span style="font:var(--weight-semibold) var(--text-md)/1 var(--font-mono);color:{v.amountInk}">{t(v.amount)}</span><span style="font:var(--weight-regular) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.fiat)}</span></span>
</div>

<style>
  .dc-p0:hover{background:var(--dc-p0-0) !important}
</style>
