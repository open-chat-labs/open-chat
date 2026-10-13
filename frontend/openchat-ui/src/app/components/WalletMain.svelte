<!-- Generated from lib/WalletMain.dc.html (source hash abda06dc) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './WalletMain.logic.js';
  import DetailRow from '../../lib/components/DetailRow.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import Pill from '../../lib/components/Pill.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import ShareBar from '../../lib/components/ShareBar.svelte';
  import SideCard from '../../lib/components/SideCard.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';
  import TokenPicker from '../../lib/components/TokenPicker.svelte';
  import TransactionRow from '../../lib/components/TransactionRow.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';
  import WalletReceive from './WalletReceive.svelte';
  import WalletRecipients from './WalletRecipients.svelte';
  import WalletSend from './WalletSend.svelte';
  import WalletSwap from './WalletSwap.svelte';

  interface Props {
    request?: { view: 'all'|'token'|'send'|'receive'|'swap', token?: string, nonce: number };
    onViewChange?: (v: { view: string, token: string | null }) => void;
    onCount?: (n: number) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-1,#0e0e12)" data-screen-label="Wallet main">
  {#if v.isSendView}{#key v.flowKey}<WalletSend tokens={v.allTokens} token={v.flowToken} address={v.sendAddress} onClose={v.leaveFlow} onSent={v.onSent}></WalletSend>{/key}{/if}
  {#if v.isReceiveView}{#key v.flowKey}<WalletReceive tokens={v.allTokens} token={v.flowToken} onClose={v.leaveFlow}></WalletReceive>{/key}{/if}
  {#if v.isSwapView}{#key v.flowKey}<WalletSwap tokens={v.allTokens} token={v.flowToken} onClose={v.leaveFlow}></WalletSwap>{/key}{/if}
  {#if v.isRecipientsView}<WalletRecipients tokens={v.allTokens} recipients={v.recipients} onChange={v.onRecipients} onSend={v.sendToRecipient} onClose={v.leaveRecipients}></WalletRecipients>{/if}
  {#if v.notFlow}
  <PageHeader title={v.title} onBack={v.headBack} backLabel={v.backLabel} avatarMark={v.headMark} avatarGradient={v.sel.grad}></PageHeader>
  <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:var(--space-32,32px) var(--space-24)">
    <div style="width:100%;max-width:{v.colMax};display:flex;flex-direction:column;gap:var(--space-24,24px)">

      {#if v.isAll}
        <div style="display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.filterTabs} selectedIndex={v.filterIdx} dotOnLast={false} onSelect={v.onFilter}></SegmentedTabs></div>
        {#each v.allGroups ?? [] as g, i0}
          <div style="display:flex;flex-direction:column;gap:var(--space-6)">
            <ListSectionLabel label={g.label} inset={true}></ListSectionLabel>
            <div style="display:flex;flex-direction:column;gap:2px">
              {#each g.items ?? [] as x, i1}
                <TransactionRow hidden={v.veiled} title={x.title} sub={x.sub} amount={x.amount} fiat={x.fiat} kind={x.badge} symbol={x.symbol} mark={x.mark} gradient={x.grad} fresh={x.fresh} onClick={x.pick}></TransactionRow>
              {/each}
            </div>
          </div>
        {/each}
        {#if v.allEmpty}<span style="padding:var(--space-32,32px) 0;text-align:center;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-4,#8A8A99)">No transactions of this type yet.</span>{/if}
      {/if}

      {#if v.isToken}
        <div style="display:flex;flex-wrap:wrap-reverse;align-items:flex-end;gap:28px">
          <div style="flex:999 1 360px;min-width:0;display:flex;flex-direction:column;gap:var(--space-20,20px)">
            <div style="display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.filterTabs} selectedIndex={v.tokFilterIdx} dotOnLast={false} onSelect={v.onTokFilter}></SegmentedTabs></div>
            {#each v.tokGroups ?? [] as g, i2}
              <div style="display:flex;flex-direction:column;gap:var(--space-6)">
                <ListSectionLabel label={g.label}></ListSectionLabel>
                <div style="display:flex;flex-direction:column">{#each g.items ?? [] as x, i3}<TransactionRow hidden={v.veiled} title={x.title} sub={x.sub} amount={x.amount} fiat={x.fiat} kind={x.kind} status={x.status} statusTone={x.statusTone} divider={x.hasDivider} fresh={x.fresh}></TransactionRow>{/each}</div>
              </div>
            {/each}
            {#if v.tokEmpty}<EmptyState icon={v.tokEmptyIcon} title={v.tokEmptyTitle} body={v.tokEmptyBody} actionLabel=""></EmptyState>{/if}
          </div>
          <div style="flex:1 1 300px;min-width:0;position:sticky;top:0"><SideCard gap="var(--space-20,20px)" pad="24px 22px 22px">
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-10);text-align:center;padding:4px 0 2px">
              <TokenAvatar size={52} symbol={v.sel.symbol} mark={v.sel.mark} gradient={v.sel.grad}></TokenAvatar>
              <span style="margin-top:4px;max-width:100%;font:700 34px/1.05 var(--font-sans);letter-spacing:-.025em;color:var(--ink,#ECECF1);overflow-wrap:anywhere"><span style="display:inline-block;filter:{v.veilFilter};transition:filter var(--duration-base,200ms) var(--ease-out);user-select:{v.veilSelect}">{t(v.sel.heldNum)}</span> <span style="color:var(--ink-4,#8A8A99)">{t(v.sel.symbol)}</span></span>
              <span style="display:flex;align-items:center;gap:var(--space-8);font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)"><span style="filter:{v.veilFilter};transition:filter var(--duration-base,200ms) var(--ease-out);user-select:{v.veilSelect}">{t(v.sel.value)}</span><Pill size="md" label={v.sel.changeToday} tone={v.sel.changeTone}></Pill></span>
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--space-8)">
              {#each v.actions ?? [] as b, i4}<span style="display:flex;align-items:center;justify-content:center;gap:7px;height:42px;border-radius:var(--radius-md,12px);background:{b.bg};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{b.ink};cursor:pointer;user-select:none" onclick={b.go} role="button" tabindex="0"><span style="width:15px;height:15px;background:{b.ink};mask:{b.mask}"></span><span>{t(b.fullLabel)}</span></span>{/each}
            </div>
            <div style="display:flex;flex-direction:column">
              <div style="display:flex;flex-direction:column;gap:var(--space-8);padding:4px 0 14px"><div style="display:flex;align-items:center"><span style="flex:1;font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">Share of wallet</span><span style="font:600 13px/1 var(--font-mono);color:var(--ink,#ECECF1)">{t(v.selShare)}</span></div><ShareBar share={v.selShareShown} gradient={v.sel.grad} thickness={4}></ShareBar></div>
              {#each v.sel.facts ?? [] as f, i5}<DetailRow label={f.k} value={f.v} size="sm" copyValue={f.copyValue} copyLabel="Copy ledger ID"></DetailRow>{/each}
            </div>
          </SideCard></div>
        </div>
      {/if}

    </div>
  </div>
  {/if}
  {#if v.pickOpen}
    <DialogShell title={v.pickTitle} onClose={v.cancelPick}><TokenPicker tokens={v.pickTokens} placeholder={v.pickPlaceholder} ownedHeading={v.pickHeadings[0]} otherHeading={v.pickHeadings[1]} onSelect={v.onPickToken}></TokenPicker></DialogShell>
  {/if}
  {#if v.hasToast}
    <div style="position:absolute;left:0;right:0;bottom:var(--space-24,24px);z-index:30;display:flex;justify-content:center;pointer-events:none">
      <div style="pointer-events:auto;width:min(480px, calc(100% - 48px));display:grid;grid-template-columns:minmax(0,1fr)">{#key v.toastKey}<UndoToast shown={true} tone="success" size="lg" icon="check" message={v.toastMessage} actionLabel={v.toastAction} onAction={v.onToastAction} onClose={v.dismissToast}></UndoToast>{/key}</div>
    </div>
  {/if}
</div>
