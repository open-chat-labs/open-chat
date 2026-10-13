<!-- Generated from lib/SwapOfferDialog.dc.html (source hash 35fa8254) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './SwapOfferDialog.logic.js';
  import type { SwapOffer } from '../../lib/types';
  import AmountCard from '../../lib/components/AmountCard.svelte';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import TokenPicker from '../../lib/components/TokenPicker.svelte';

  interface Props {
    z?: number;
    initial?: SwapOffer | null;
    onAttach?: (offer: SwapOffer) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:{v.z};display:flex;align-items:center;justify-content:center;padding:24px">
  <div style="position:absolute;inset:0;background:var(--scrim);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)" onclick={v.onClose} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:500px;max-height:100%;outline:none;display:flex;flex-direction:column;border-radius:var(--radius-xl,22px);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 24px 64px rgba(0,0,0,.45)" use:ref={v.boxRef} data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label={v.title} onkeydown={v.onKey}>
        <div style="flex:none;display:flex;align-items:center;gap:12px;height:var(--header-h,66px);box-sizing:border-box;padding:0 12px 0 22px;border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
          <span style="flex:1;font:700 17px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.title)}</span>
          <IconButton variant="ghost" icon="close" label="Close" onClick={v.onClose}></IconButton>
        </div>
        <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:28px;padding:20px 22px 24px">
          <div style="display:flex;flex-direction:column">
            <AmountCard label="YOU OFFER" meta="Balance {v.giveBal}" value={v.amt} onChange={v.onAmt} tone={v.amtTone} note={v.giveNote} symbol={v.give.symbol} mark={v.give.mark} gradient={v.give.gradient} onTokenClick={v.pickGive} onQuickSelect={v.onQuick} position="top"></AmountCard>
            <div style="height:8px;display:flex;align-items:center;justify-content:center;z-index:1"><span class="dc-p0" style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));cursor:pointer" onclick={v.flip} tabindex="0" aria-label="Flip" role="button" title="Flip"><span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:var(--icon-swap) center/contain no-repeat;-webkit-mask:var(--icon-swap) center/contain no-repeat"></span></span></div>
            <AmountCard label="YOU WANT" meta="You hold {v.getBal}" value={v.want} onChange={v.onWant} note={v.getNote} symbol={v.get.symbol} mark={v.get.mark} gradient={v.get.gradient} onTokenClick={v.pickGet} position="bottom"></AmountCard>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px"><label style="font:600 13px/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Price</label><span style="font:600 12.5px/1 var(--font-sans);color:{v.vsInk}">{t(v.vs)}</span></div>
            <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">
              {#each v.prices ?? [] as p, i0}
                <button style="height:36px;border:0;border-radius:10px;background:{p.bg};box-shadow:inset 0 0 0 1px {p.ring};color:{p.ink};font:600 13px/1 var(--font-sans);cursor:pointer" onclick={p.onClick} aria-pressed={p.sel}>{t(p.label)}</button>
              {/each}
            </div>
            <span style="font:500 12.5px/1.3 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.rate)}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <label style="font:600 13px/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Offer expires after</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              {#each v.durs ?? [] as d, i1}
                <button style="height:34px;padding:0 14px;border:0;border-radius:999px;background:{d.bg};box-shadow:inset 0 0 0 1px {d.ring};color:{d.ink};font:600 13px/1 var(--font-sans);cursor:pointer" onclick={d.onClick} aria-pressed={d.sel}>{t(d.label)}</button>
              {/each}
            </div>
          </div>
        </div>
        <div style="flex:none;display:flex;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
          <span style="width:15px;height:15px;flex:none;background:var(--ink-3,#9A9AA8);-webkit-mask:var(--icon-lock) center/contain no-repeat;mask:var(--icon-lock) center/contain no-repeat"></span>
          <span style="flex:1;min-width:0;font:500 12.5px/1.4 var(--font-sans);color:{v.footInk};text-wrap:pretty">{t(v.foot)}</span>
          <Button label={v.cta} disabled={v.notOk} onClick={v.attach}></Button>
        </div>
      
    {#if v.pickerOpen}
      <div style="position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;padding:20px;border-radius:var(--radius-xl,22px);background:var(--scrim,rgba(0,0,0,.55));backdrop-filter:blur(4px)">
        <div style="width:100%;max-width:400px;height:min(520px,100%);display:flex;flex-direction:column;border-radius:18px;background:var(--surface-2,#15151b);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 16px 40px rgba(0,0,0,.4);overflow:hidden" role="dialog" aria-label={v.pickerTitle}>
          <div style="flex:none;display:flex;align-items:center;height:54px;padding:0 8px 0 18px;border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))"><span style="flex:1;font:700 15px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.pickerTitle)}</span><IconButton variant="ghost" icon="close" label="Close" onClick={v.closePicker}></IconButton></div>
          <div style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:var(--space-14,14px) var(--space-16,16px) var(--space-16,16px)"><div style="flex:1;min-height:0;position:relative"><div style="position:absolute;inset:0"><TokenPicker tokens={v.pickerTokens} onSelect={v.onPicked}></TokenPicker></div></div></div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{box-shadow:inset 0 0 0 1px var(--line-3,rgba(255,255,255,.22)) !important}
</style>
