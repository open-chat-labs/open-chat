<!-- Generated from lib/AmountCard.dc.html (source hash 39ed836c) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './AmountCard.logic.js';
  import ListSectionLabel from './ListSectionLabel.svelte';
  import QuickAmountChips from './QuickAmountChips.svelte';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Props {
    label?: string;
    meta?: string;
    value?: string;
    note?: string;
    tone?: string;
    muted?: boolean;
    symbol?: string;
    mark?: string;
    gradient?: string;
    position?: string;
    onChange?: (e) => void;
    onQuickSelect?: (fraction: number) => void;
    onTokenClick?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column;gap:12px;padding:{v.pad};box-sizing:border-box;border-radius:12px;background:var(--overlay-1,rgba(255,255,255,.04))">
  <ListSectionLabel label={v.label} meta={v.meta}></ListSectionLabel>
  <div style="display:flex;align-items:center;gap:12px">
    {#if v.editable}<input style="flex:1;min-width:0;border:0;outline:0;padding:0;background:transparent;font:700 32px/1 var(--font-sans);color:{v.valueInk}" value={v.value} oninput={v.onChange} inputmode="decimal" placeholder="0" aria-label={v.label} />{/if}
    {#if v.readOnly}<span style="flex:1;min-width:0;font:700 32px/1 var(--font-sans);color:{v.valueInk};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.shown)}</span>{/if}
    <span class="dc-p0" style="flex:none;display:flex;align-items:center;gap:8px;height:40px;padding:0 10px 0 6px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));cursor:pointer;user-select:none;" onclick={v.onPickToken} aria-label="Change token" role="button" tabindex="0" title="Change token"><TokenAvatar size={28} symbol={v.symbol} mark={v.mark} gradient={v.gradient}></TokenAvatar><span style="font:700 14px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.symbol)}</span><span style="width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:{v.caret}"></span></span>
  </div>
  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
    <span style="flex:1;min-width:120px;font:500 12.5px/1 var(--font-mono);color:{v.noteInk}">{t(v.note)}</span>
    {#if v.hasChips}<QuickAmountChips onSelect={v.onChip}></QuickAmountChips>{/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--btn-hover) !important}
</style>
