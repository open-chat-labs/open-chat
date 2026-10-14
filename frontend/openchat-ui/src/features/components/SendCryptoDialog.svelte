<!-- Send crypto (composer + → Send crypto). Recipient at the top: fixed in a DM (`recipient`), picked from `members` in a group.
     Token pill + amount with live USD, quick chips, fee in the hint; irreversibility line by the button.
     "Attach" → onAttach(transfer): host puts it in the composer as a chip; caption + Send posts it. `initial` edits a previous value.
     Esc closes the open picker, then the dialog; Cmd/Ctrl+Enter attaches. -->
<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
  import { cleanAmount, parseAmount } from '../../lib/amount';
  import { onMount } from 'svelte';
  import type { Transfer } from '../../lib/types';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import QuickAmountChips from '../../lib/components/QuickAmountChips.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';

  // sample balances and prices until the wallet is wired
  const TOK = {
    CHAT: { symbol: 'CHAT', mark: 'C', gradient: 'linear-gradient(140deg,#ff5f9e,#ffb03d)', bal: 132.332136, fee: 0.001, min: 0.01, usd: 0.053, dp: 4 },
    ICP: { symbol: 'ICP', mark: '∞', gradient: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', bal: 4.2153, fee: 0.0001, min: 0.0001, usd: 4.8, dp: 4 },
    ckBTC: { symbol: 'ckBTC', mark: '₿', gradient: 'linear-gradient(140deg,#ffb03d,#f7931a)', bal: 0.00213, fee: 0.0000001, min: 0.0000001, usd: 62000, dp: 8 },
    ckUSDC: { symbol: 'ckUSDC', mark: '$', gradient: 'linear-gradient(140deg,#2775ca,#1FB6FF)', bal: 48.5, fee: 0.01, min: 0.01, usd: 1, dp: 2 },
  };
  type Sym = keyof typeof TOK;
  const DEFAULT_GRAD = 'linear-gradient(140deg,#2EE6A8,#1FB6FF)';

  const fmt = (n: number, dp: number) => Number(n.toFixed(dp)).toLocaleString(i18n.locale ?? 'en', { maximumFractionDigits: dp });
  const usdFmt = (v: number) => (v === 0 ? '$0.00' : v < 0.01 ? '<$0.01' : `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  interface Member {
    name: string;
    handle: string;
    /** Avatar background. */
    grad?: string;
  }

  interface Props {
    z?: number;
    /** Fixed recipient (a DM). */
    recipient?: Member | null;
    /** Pickable recipients (a group), when there is no fixed one. */
    members?: Member[];
    initial?: Transfer | null;
    onAttach?: (transfer: Transfer) => void;
    onClose?: () => void;
  }

  let { z = 80, recipient = null, members = [], initial = null, onAttach, onClose }: Props = $props();
  const t = useT();
  const i18n = getI18n();

  const draft = initial?.draft;
  let tok = $state<Sym>((draft?.tok as Sym) in TOK ? (draft?.tok as Sym) : 'CHAT');
  let amt = $state(draft?.amt ?? '');
  let to = $state<string | null>(draft?.to ?? null);
  let toOpen = $state(false);
  let tokOpen = $state(false);
  let query = $state('');
  let amountInput: HTMLInputElement;
  let searchInput = $state<HTMLInputElement>();

  onMount(() => {
    const t = setTimeout(() => amountInput?.focus(), 60);
    return () => clearTimeout(t);
  });

  const T = $derived(TOK[tok]);
  const F = (n: number) => fmt(n, T.dp);
  const canPick = $derived(!recipient && members.length > 0);
  const toMember = $derived(recipient ?? members.find((m) => m.handle === to) ?? null);
  const a = $derived(parseAmount(amt));
  const max = $derived(Math.max(0, T.bal - T.fee));
  // why Attach is disabled: a resource key ('' = ready) and its params
  const reason = $derived(
    !toMember
      ? 'chooseRecipient'
      : !a
        ? 'enterAmount'
        : a < T.min
          ? 'minimum'
          : a > max
            ? 'notEnough'
            : '',
  );
  const ok = $derived(!reason);
  const needle = $derived(query.trim().toLowerCase());
  const shownMembers = $derived(members.filter((m) => !needle || `${m.name} ${m.handle}`.toLowerCase().includes(needle)));
  const title = $derived(t(initial ? 'ui.sendCryptoDialog.editTitle' : 'ui.sendCryptoDialog.title'));

  function attach() {
    if (!ok || !toMember || !onAttach) return;
    const usd = a * T.usd;
    onAttach({
      type: 'transfer',
      token: { symbol: T.symbol, mark: T.mark, gradient: T.gradient },
      amount: a,
      amountText: `${F(a)} ${T.symbol}`,
      usd,
      usdText: usdFmt(usd),
      recipient: { name: toMember.name, handle: toMember.handle },
      fee: T.fee,
      feeText: `${F(T.fee)} ${T.symbol}`,
      totalText: `${F(a + T.fee)} ${T.symbol}`,
      title: `${F(a)} ${T.symbol}`,
      summary: t('ui.sendCryptoDialog.summary', { handle: toMember.handle, usd: usdFmt(usd) }),
      draft: { tok, amt, to: toMember.handle },
    });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (toOpen) toOpen = false;
      else if (tokOpen) tokOpen = false;
      else onClose?.();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      attach();
    }
  }

  function toggleTo() {
    if (!canPick) return;
    toOpen = !toOpen;
    query = '';
    setTimeout(() => searchInput?.focus(), 0);
  }

  const initialOf = (name: string) => (name || '?')[0];
</script>

<div class="layer" style:z-index={z}>
  <div class="scrim" onclick={() => onClose?.()} aria-hidden="true"></div>
  <div class="dialog" data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label={title} onkeydown={onKey}>
    <div class="header">
      <span class="title">{title}</span>
      <IconButton variant="ghost" icon="close" label="ui.common.close" onClick={() => onClose?.()} />
    </div>
    <div class="body">
      <div class="recipient">
        <div
          class="to"
          class:pickable={canPick}
          onclick={toggleTo}
          role={canPick ? 'button' : 'group'}
          tabindex={canPick ? 0 : -1}
          aria-haspopup={canPick ? 'listbox' : undefined}
          aria-expanded={canPick && toOpen}
          aria-label={canPick ? t(toMember ? 'ui.sendCryptoDialog.recipientNamed' : 'ui.sendCryptoDialog.recipientNone', { name: toMember?.name ?? '' }) : t('ui.sendCryptoDialog.recipient')}
        >
          <span class="to-label">{t('ui.sendCryptoDialog.to')}</span>
          {#if toMember}
            <span class="avatar" style:background={toMember.grad || DEFAULT_GRAD}>{initialOf(toMember.name)}</span>
            <div class="to-text"><span class="to-name">{toMember.name}</span><span class="to-handle">{toMember.handle}</span></div>
          {:else}
            <span class="avatar" style:background="var(--overlay-2,rgba(255,255,255,.1))">?</span>
            <div class="to-text"><span class="to-name empty">{t('ui.sendCryptoDialog.chooseMember')}</span><span class="to-handle">{t('ui.sendCryptoDialog.anyoneInChat')}</span></div>
          {/if}
          {#if canPick}<span class="chevron"></span>{/if}
        </div>
        {#if canPick && toOpen}
          <div class="members" role="listbox" aria-label={t('ui.sendCryptoDialog.members')}>
            <input class="member-search" bind:this={searchInput} bind:value={query} placeholder={t('ui.sendCryptoDialog.searchMembers')} aria-label={t('ui.sendCryptoDialog.searchMembers')} />
            {#each shownMembers as m}
              {@const sel = !!toMember && m.handle === toMember.handle}
              <div
                class="member"
                class:sel
                onclick={() => {
                  to = m.handle;
                  toOpen = false;
                }}
                role="option"
                tabindex="0"
                aria-selected={sel}
              >
                <span class="avatar small" style:background={m.grad || DEFAULT_GRAD}>{initialOf(m.name)}</span>
                <span class="member-name">{m.name}</span><span class="member-handle">{m.handle}</span>
              </div>
            {/each}
            {#if shownMembers.length === 0}<span class="no-members">{t('ui.sendCryptoDialog.noMembers')}</span>{/if}
          </div>
        {/if}
      </div>
      <div class="amount-card">
        <div class="token" onclick={() => (tokOpen = true)} role="button" tabindex="0" aria-label={t('ui.sendCryptoDialog.changeToken')} aria-haspopup="dialog">
          <TokenAvatar symbol={T.symbol} mark={T.mark} gradient={T.gradient} size={28} />
          <span class="token-symbol">{T.symbol}</span>
          <span class="token-balance">{F(T.bal)} {T.symbol}</span>
          <span class="chevron"></span>
        </div>
        <input
          class="amount"
          bind:this={amountInput}
          value={amt}
          oninput={(e) => (amt = cleanAmount(e.currentTarget.value))}
          inputmode="decimal"
          placeholder="0"
          aria-label={t('ui.sendCryptoDialog.amount')}
        />
        <span class="usd">≈ {usdFmt(a * T.usd)}</span>
        <QuickAmountChips size="sm" onSelect={(f) => (amt = String(Number((max * f).toFixed(T.dp))))} />
        <span class="hint" class:warn={!ok && reason !== 'enterAmount' && reason !== 'chooseRecipient'}
          >{t('ui.sendCryptoDialog.' + (ok ? 'feeAdded' : reason), { fee: F(T.fee), min: F(T.min), max: F(max), symbol: T.symbol })}</span
        >
      </div>
    </div>
    <div class="footer">
      <span class="warn-icon"></span>
      <span class="footer-text">{t('ui.sendCryptoDialog.irreversible')}</span>
      <Button label={initial ? 'ui.sendCryptoDialog.update' : 'ui.sendCryptoDialog.attach'} disabled={!ok} onClick={attach} />
    </div>
    {#if tokOpen}
      <div class="token-layer">
        <div class="token-dialog" role="dialog" aria-label={t('ui.sendCryptoDialog.token')}>
          <div class="token-head"><span class="token-title">{t('ui.sendCryptoDialog.token')}</span><IconButton variant="ghost" icon="close" label="ui.common.close" onClick={() => (tokOpen = false)} /></div>
          <div class="token-list">
            {#each Object.values(TOK) as tk}
              <div
                class="token-row"
                class:sel={tk.symbol === T.symbol}
                onclick={() => {
                  tok = tk.symbol as Sym;
                  tokOpen = false;
                }}
                role="button"
                tabindex="0"
              >
                <TokenAvatar symbol={tk.symbol} mark={tk.mark} gradient={tk.gradient} size={40} />
                <span class="token-row-symbol">{tk.symbol}</span>
                <span class="token-row-balance">{fmt(tk.bal, tk.dp)}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .dialog {
    position: relative;
    width: 100%;
    max-width: 480px;
    max-height: 100%;
    outline: none;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl, 22px);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 24px 64px rgba(0, 0, 0, 0.45);
  }

  .header {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    height: var(--header-h, 66px);
    box-sizing: border-box;
    padding: 0 12px 0 22px;
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .title {
    flex: 1;
    font: 700 17px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px 22px 22px;
  }

  .recipient {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .to {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 14px 0 10px;
    border-radius: 14px;
    background: var(--surface-2, #15151b);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    cursor: default;
  }

  .to.pickable {
    cursor: pointer;
  }

  .to-label {
    font: 600 12.5px/1 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    width: 22px;
    text-align: center;
  }

  .avatar {
    width: 34px;
    height: 34px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font: 700 13px/1 var(--font-sans);
    color: #fff;
  }

  .avatar.small {
    width: 30px;
    height: 30px;
    font-size: 12px;
  }

  .to-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .to-name {
    font: 600 14px/1.1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .to-name.empty {
    color: var(--ink-3, #9a9aa8);
  }

  .to-handle,
  .member-handle {
    font: 400 12px/1 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .chevron {
    width: 14px;
    height: 14px;
    background: var(--ink-3, #9a9aa8);
    -webkit-mask: var(--icon-chevron-down) center/contain no-repeat;
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .members {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    max-height: 300px;
    overflow-y: auto;
    padding: 6px;
    border-radius: 14px;
    background: var(--surface-2, #191921);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-panel, 0 8px 24px rgba(0, 0, 0, 0.4));
  }

  .member-search {
    flex: none;
    height: 38px;
    margin: 2px 2px 6px;
    padding: 0 12px;
    border: 0;
    border-radius: 10px;
    outline: none;
    background: var(--field, #14141a);
    font: 500 13.5px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .member {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
  }

  .member.sel,
  .member:hover,
  .token-row.sel,
  .token-row:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .member-name {
    flex: 1;
    font: 600 13.5px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .no-members {
    padding: 14px 10px;
    font: 400 13px/1.4 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .amount-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 16px 18px;
    border-radius: 18px;
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .token {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px 6px 6px;
    border-radius: 999px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    cursor: pointer;
  }

  .token:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
  }

  .token-symbol {
    font: 700 14px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .token-balance {
    font: 500 12px/1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }

  .amount {
    width: 100%;
    border: 0;
    outline: none;
    background: transparent;
    text-align: center;
    font: 700 40px/1.1 var(--font-sans);
    letter-spacing: -0.02em;
    color: var(--ink, #ececf1);
  }

  .usd {
    font: 500 13px/1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .hint {
    font: 400 12px/1.4 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-align: center;
  }

  .hint.warn {
    color: var(--status-warning, #ffb03d);
  }

  .footer {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .warn-icon {
    width: 15px;
    height: 15px;
    flex: none;
    background: var(--status-warning, #ffb03d);
    -webkit-mask: var(--icon-warning) center/contain no-repeat;
    mask: var(--icon-warning) center/contain no-repeat;
  }

  .footer-text {
    flex: 1;
    min-width: 0;
    font: 500 12.5px/1.35 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .token-layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    border-radius: var(--radius-xl, 22px);
    background: var(--scrim, rgba(0, 0, 0, 0.5));
    backdrop-filter: blur(4px);
  }

  .token-dialog {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    background: var(--surface-2, #15151b);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 16px 40px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .token-head {
    display: flex;
    align-items: center;
    padding: 0 8px 0 18px;
    height: 54px;
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .token-title {
    flex: 1;
    font: 700 15px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .token-list {
    display: flex;
    flex-direction: column;
    padding: 6px;
  }

  .token-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
  }

  .token-row-symbol {
    flex: 1;
    font: 600 14px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .token-row-balance {
    font: 500 13px/1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .to:focus-visible,
  .member:focus-visible,
  .token:focus-visible,
  .token-row:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }
</style>
