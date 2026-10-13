<!-- Generated from lib/WalletSwap.dc.html (source hash 9e10abdb) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './WalletSwap.logic.js';
  import AmountCard from '../../lib/components/AmountCard.svelte';
  import Banner from '../../lib/components/Banner.svelte';
  import DetailRow from '../../lib/components/DetailRow.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import Pill from '../../lib/components/Pill.svelte';
  import ProgressTimeline from '../../lib/components/ProgressTimeline.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import SideCard from '../../lib/components/SideCard.svelte';
  import Spinner from '../../lib/components/Spinner.svelte';
  import StepIndicator from '../../lib/components/StepIndicator.svelte';
  import TokenPicker from '../../lib/components/TokenPicker.svelte';

  interface Props {
    token?: string;
    onClose?: () => void;
    onSwapped?: (s: { from: string, to: string, amount: number, out: number, fiat: number }) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:absolute;inset:0;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-1,#0e0e12)" use:ref={v.rootRef} data-screen-label="Wallet swap">
  <PageHeader title={v.title} onBack={v.back} avatarMark={v.q.from.mark} avatarGradient={v.q.from.grad}><StepIndicator steps={v.w.stepLabels} current={v.w.stepIdx} complete={v.w.isDone} compact={v.w.compactSteps}></StepIndicator></PageHeader>
  <div style="flex:1;min-height:0;overflow-y:auto">
    <div style="box-sizing:border-box;max-width:1024px;margin:0 auto;display:grid;grid-template-columns:{v.cols};gap:28px;padding:{v.pad}">
      <div style="display:flex;flex-direction:column;gap:20px;min-width:0;opacity:{v.w.formDim};pointer-events:{v.w.formHits}">
        <div style="display:flex;flex-direction:column">
          <AmountCard label="YOU PAY" meta="Balance {v.q.fromBal}" value={v.q.amt} onChange={v.q.onAmt} tone={v.q.amtTone} note={v.q.fromFiat} symbol={v.q.from.symbol} mark={v.q.from.mark} gradient={v.q.from.grad} onTokenClick={v.q.cycleFrom} onQuickSelect={v.q.onChip} position="top"></AmountCard>
          <div style="height:8px;display:flex;align-items:center;justify-content:center;z-index:1"><span class="dc-p0" style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2);cursor:pointer" onclick={v.q.flip} tabindex="0" aria-label="Flip" role="button" title="Flip"><span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.m.swap}"></span></span></div>
          <AmountCard label={v.w.getLabel} meta="Balance {v.q.toBal}" value={v.w.outVal} note={v.w.outFiat} symbol={v.q.to.symbol} mark={v.q.to.mark} gradient={v.q.to.grad} onTokenClick={v.q.cycleTo} position="bottom"></AmountCard>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
          <div style="display:flex;flex-direction:column;gap:6px"><ListSectionLabel label="MAX SLIPPAGE"></ListSectionLabel><span style="font:400 12.5px/1.5 'Plus Jakarta Sans',sans-serif;color:var(--ink-3,#9A9AA8);text-wrap:pretty">How far the price can move against you before the swap runs. If it moves more, the swap is cancelled and your tokens stay put.</span></div>
          <SegmentedTabs labels={v.q.slipLabels} selectedIndex={v.q.slipIdx} onSelect={v.q.onSlip} dotOnLast={false}></SegmentedTabs>
        </div>
        {#if v.w.isQuoted}<Banner tone="info" text="Changing the amount or tokens drops this quote." actionLabel=""></Banner>{/if}
      </div>
      <div style="min-width:0;align-self:start;position:sticky;top:0"><SideCard minHeight={v.panelMin}>
        {#if v.w.isForm}
          <ListSectionLabel label="QUOTE"></ListSectionLabel>
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:28px 8px">
            <span style="width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--overlay-2)"><span style="width:20px;height:20px;background:var(--ink-3,#9A9AA8);mask:{v.m.swap}"></span></span>
            <span style="font:600 15px/1.3 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">No quote yet</span>
            <span style="font:400 13px/1.5 'Plus Jakarta Sans',sans-serif;color:var(--ink-4,#8A8A99);text-wrap:pretty">Get a quote to see the rate, fees and the minimum you'll receive. Quotes last 30 seconds.</span>
          </div>
          <span style="flex:none;display:flex;align-items:center;justify-content:center;height:46px;border-radius:12px;background:{v.w.qBg};font:700 14px/1 'Plus Jakarta Sans',sans-serif;color:{v.w.qInk};cursor:{v.w.qCursor};user-select:none" onclick={v.w.getQuote} tabindex="0" role="button" aria-disabled={v.w.qDisabled}>{t(v.w.qLabel)}</span>
        {/if}
        {#if v.w.isQuoting}
          <ListSectionLabel label="QUOTE"></ListSectionLabel>
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px 0">
            <Spinner size={36} label="Finding the best rate"></Spinner>
            <span style="font:600 14px/1.3 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">Finding the best rate…</span>
            <span style="font:400 12.5px/1.5 'Plus Jakarta Sans',sans-serif;color:var(--ink-4,#8A8A99)">Checking KongSwap, ICPSwap and Sonic</span>
          </div>
        {/if}
        {#if v.w.isQuoted}
          <div style="display:flex;align-items:center"><ListSectionLabel label="QUOTE"></ListSectionLabel><span style="flex:1"></span><Pill size="md" label={v.w.timer} tone={v.w.timerTone}></Pill></div>
          <div style="display:flex;flex-direction:column;gap:8px;padding:20px 0 22px"><span style="font:700 24px/1.15 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1);overflow-wrap:anywhere">{t(v.q.pair)}</span><span style="font:500 13px/1 'JetBrains Mono',monospace;color:var(--ink-3,#9A9AA8)">{t(v.q.rate)}</span></div>
          <div style="display:flex;flex-direction:column;border-top:1px solid var(--line-1)">
            <DetailRow label="Max slippage" value={v.q.slip} rule="bottom"></DetailRow>
            {#each v.q.rows ?? [] as r, i0}<DetailRow label={r.k} value={r.v} valueColor={r.ink} rule={r.rule}></DetailRow>{/each}
          </div>
          <span style="flex:1;min-height:20px"></span>
          {#if v.w.live}<span style="flex:none;display:flex;align-items:center;justify-content:center;height:46px;border-radius:12px;background:var(--accent,#FF5672);font:700 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.w.swap} tabindex="0" role="button">Swap</span>{/if}
          {#if v.w.expired}<span style="flex:none;display:flex;align-items:center;justify-content:center;gap:8px;height:46px;border-radius:12px;background:var(--overlay-2);font:700 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.w.getQuote} tabindex="0" role="button"><span style="width:14px;height:14px;background:var(--ink,#ECECF1);mask:{v.m.refresh}"></span>Quote expired · get a new one</span>{/if}
        {/if}
        {#if v.w.isProgress}
          <ListSectionLabel label={v.w.progKicker}></ListSectionLabel>
          <div style="display:flex;flex-direction:column;gap:8px;padding:20px 0 22px"><span style="font:700 22px/1.2 var(--font-sans);letter-spacing:-.01em;color:var(--ink,#ECECF1);overflow-wrap:anywhere;text-wrap:pretty">{t(v.w.progHead)}</span><span style="font:400 12.5px/1.5 var(--font-sans);color:var(--ink-4,#8A8A99);text-wrap:pretty">{t(v.w.progNote)}</span></div>
          <ProgressTimeline phases={v.w.phases} density="compact" collapseDone={true}></ProgressTimeline>
          <span style="flex:1;min-height:20px"></span>
          {#if v.w.isDone}<span style="flex:none;display:flex;align-items:center;justify-content:center;height:46px;border-radius:12px;background:var(--accent,#FF5672);font:700 14px/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.w.finish} role="button" tabindex="0">Done</span>{/if}
          {#if v.w.running}<span style="flex:none;font:400 12px/1.5 var(--font-sans);color:var(--ink-4,#8A8A99);text-align:center;text-wrap:pretty">You can leave this page. We'll notify you when it's done.</span>{/if}
        {/if}
      </SideCard></div>
    </div>
  </div>
  {#if v.pickOpen}
    <DialogShell title={v.pickTitle} onClose={v.cancelPick}><TokenPicker tokens={v.pickTokens} placeholder={v.pickPlaceholder} ownedHeading={v.pickHeadings[0]} otherHeading={v.pickHeadings[1]} onSelect={v.onPickToken}></TokenPicker></DialogShell>
  {/if}
</div>

<style>
  .dc-p0:hover{box-shadow:inset 0 0 0 1px var(--line-3) !important}
</style>
