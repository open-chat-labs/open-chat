<!-- Send in the wallet main column: recipient (OpenChat user or address, with network detection), amount (token or USD,
     quick chips), optional message, and a live summary beside the form; below 760px the summary becomes a sticky footer.
     Continue opens a PIN dialog over the form; confirming hands the transfer back through onSent. -->
<script lang="ts">
  import type { WalletToken } from '../../lib/types';
  import DetailRow from '../../lib/components/DetailRow.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import QuickAmountChips from '../../lib/components/QuickAmountChips.svelte';
  import SideCard from '../../lib/components/SideCard.svelte';
  import { getI18n, useT } from '../../lib/i18n';

  const mask = (n: string) => `var(--icon-${n}) center/contain no-repeat`;
  // sample contacts and pasted addresses until the address book is wired
  const UG = [
    'linear-gradient(140deg,#FFB35C,#FF6B6B)',
    'linear-gradient(140deg,#8B7BFF,#FF6FD8)',
    'linear-gradient(140deg,#5CD0FF,#4B7BFF)',
    'linear-gradient(140deg,#63E6A8,#2AA6FF)',
    'linear-gradient(140deg,#FFD166,#F2795C)',
  ];
  const PEOPLE = ['Jane Doe', 'Annie Schwartz', 'Nikki Laudia', 'Chris Hanls', 'Neil Armstrong'];
  const HANDLES = ['@common_jane', '@anti_ice_cold', '@the_pineal', '@guru_of_thunder', '@i_walked_on_moon'];
  const SAMPLE: Record<string, string> = {
    ICP: '6fe2b-qpkus-3dzpo-iuc7d-nwyfk-7tqaf-2lhi4-cpm5c-ys7gz-wbf3a-dae',
    BTC: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    CHAT: '5sj6i-pqaaa-aaaaf-a3cmq-cai',
    ETH: '0x4E2a9F07c1B3dD58e7A9b2c06F1d3E8a5C7b9D21',
    USDT: '0x4E2a9F07c1B3dD58e7A9b2c06F1d3E8a5C7b9D21',
    XRP: 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY',
  };
  // label / short / time: resource keys (or literal text, e.g. network names)
  const NETS = [
    { label: 'Bitcoin', short: 'ui.walletSend.nativeBtc', time: 'ui.walletSend.btcTime', fee: '~0.0000042 BTC', f: 0.0000042 },
    { label: 'ui.walletSend.ckBtcOnIcp', short: 'ui.walletSend.needsIcpWallet', time: 'ui.walletSend.seconds', fee: '0.0000001 BTC', f: 0.0000001 },
  ];
  const MODES = [
    ['user', 'ui.walletSend.openChatUser', 'user'],
    ['address', 'ui.walletSend.walletAddress', 'wallet'],
  ];
  // address helpers: [label key, icon]; the QR one isn't wired yet
  const TOOLS = [
    ['ui.walletSend.paste', 'paste'],
    ['ui.walletSend.saved', 'bookmark'],
    ['ui.walletSend.scanQr', 'qr'],
  ];
  type Chain = 'BTC' | 'ETH' | 'XRP' | 'ICP';
  const NET_NAME: Record<Chain, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', XRP: 'XRP Ledger', ICP: 'Internet Computer' };
  const ADDR_NAME: Record<Chain, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', XRP: 'XRP', ICP: 'ICP' };

  const fmt = (v: number, dp: number) => v.toLocaleString(i18n.locale ?? 'en', { maximumFractionDigits: dp });
  const money = (v: number) => `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const detectNet = (a: string): Chain | 'unknown' | null => {
    const v = (a || '').trim();
    if (!v) return null;
    if (/^(bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(v)) return 'BTC';
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) return 'ETH';
    if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(v)) return 'XRP';
    if (/^([a-z0-9]{5}-){2,10}[a-z0-9]{3}$/.test(v) || /^[0-9a-f]{64}$/.test(v)) return 'ICP';
    return 'unknown';
  };

  interface Props {
    tokens: WalletToken[];
    /** Symbol to send; falls back to ICP. */
    token?: string;
    /** Pre-fills the address mode, e.g. from a saved recipient. */
    address?: string;
    onClose?: () => void;
    onSent?: (v: { symbol: string; amount: number; fiat: number; to: string; dp: number; person: boolean }) => void;
  }

  let { tokens, token, address: initialAddress = '', onClose, onSent }: Props = $props();
  const t = useT();
  const i18n = getI18n();

  const held = $derived(tokens.filter((tok) => tok.held > 0));
  const startSymbol = (() => {
    const list = tokens.filter((tok) => tok.held > 0);
    return (list.find((x) => x.symbol === token) ?? list.find((x) => x.symbol === 'ICP') ?? list[0])?.symbol ?? '';
  })();

  let sym = $state(startSymbol);
  let mode = $state<'user' | 'address'>(initialAddress ? 'address' : 'user');
  let user = $state<number | null>(null);
  let address = $state(initialAddress);
  let amt = $state('');
  let msg = $state('');
  let msgOpen = $state(false);
  let inUsd = $state(false);
  let netOpen = $state(false);
  let footOpen = $state(false);
  let net = $state(0);
  let step = $state<'form' | 'pin' | 'done'>('form');
  let pin = $state(0);
  let width = $state(0);

  const narrow = $derived(width > 0 && width < 760);
  const tk = $derived(held.find((x) => x.symbol === sym) ?? held[0]);
  const typed = $derived(parseFloat(amt.replace(/,/g, '')) || 0);
  const n = $derived(tk ? (inUsd ? typed / tk.price : typed) : 0);
  const det = $derived(mode === 'address' ? detectNet(address) : null);
  const multi = $derived(mode === 'address' && tk?.symbol === 'BTC' && det === 'BTC');
  const fee = $derived(multi ? NETS[net].f : (tk?.fee ?? 0));
  const person = $derived(user != null ? { name: PEOPLE[user], handle: HANDLES[user], grad: UG[user] } : null);
  const first = $derived(person ? person.name.split(' ')[0] : '');
  const wrongNet = $derived(!!det && det !== 'unknown' && det !== tk?.symbol);
  const badAddress = $derived(det === 'unknown' || wrongNet);
  const recipOk = $derived(mode === 'user' ? !!person : !!det && det !== 'unknown' && !wrongNet);
  const over = $derived(!!tk && n + fee > tk.held);
  const ok = $derived(recipOk && n > 0 && !over);
  const avail = $derived(tk ? Math.max(0, tk.held - fee) : 0);
  const shortAddress = $derived(address ? `${address.slice(0, 10)}…${address.slice(-6)}` : '');
  const toLabel = $derived(mode === 'user' ? (person ? person.name : '—') : shortAddress || '—');
  const toMain = $derived(mode === 'user' ? (person ? person.name : t('ui.walletSend.notChosen')) : shortAddress || t('ui.walletSend.notEntered'));
  const dpCap = $derived(Math.pow(10, Math.min(tk?.dp ?? 0, 6)));

  const rows = $derived([
    { k: t('ui.walletSend.network'), v: mode === 'user' ? 'OpenChat' : multi ? t(NETS[net].label) : det && det !== 'unknown' ? NET_NAME[det] : '—', ink: 'var(--ink,#ECECF1)' },
    { k: t('ui.walletSend.networkFee'), v: `${fmt(fee, tk?.dp ?? 0)} ${tk?.symbol}`, ink: 'var(--ink,#ECECF1)' },
    { k: mode === 'user' && person ? t('ui.walletSend.nameReceives', { name: first }) : t('ui.walletSend.theyReceive'), v: `${fmt(n, tk?.dp ?? 0)} ${tk?.symbol}`, ink: n > 0 ? 'var(--ink,#ECECF1)' : 'var(--ink-5,#6E6E7C)' },
  ]);

  const history = $derived.by(() => {
    if (!person || !tk) return [];
    const big = tk.held > 10;
    return [
      { label: t('ui.walletSend.youSent', { date: '28 Sep' }), sign: '−', v: big ? 50 : 0.002, mask: mask('arrow-up'), incoming: false },
      { label: t('ui.walletSend.nameSent', { name: first, date: '14 Sep' }), sign: '+', v: big ? 20 : 0.001, mask: mask('arrow-down'), incoming: true },
      { label: t('ui.walletSend.youSent', { date: '2 Sep' }), sign: '−', v: big ? 120 : 0.005, mask: mask('arrow-up'), incoming: false },
    ];
  });

  const ctaLabel = $derived(
    t(ok ? 'ui.common.continue' : !recipOk ? (mode === 'user' ? 'ui.walletSend.chooseRecipient' : 'ui.walletSend.addValidAddress') : n <= 0 ? 'ui.walletSend.enterAmount' : 'ui.walletSend.tooHigh'),
  );

  function toggleUnit() {
    if (!tk) return;
    amt = typed > 0 ? (inUsd ? String(Math.round(n * dpCap) / dpCap) : (n * tk.price).toFixed(2)) : '';
    inUsd = !inUsd;
  }

  function chooseFraction(k: number) {
    if (!tk) return;
    const v = Math.floor(avail * k * dpCap) / dpCap;
    amt = inUsd ? (v * tk.price).toFixed(2) : String(v);
  }

  function reuse(v: number) {
    if (!tk) return;
    amt = inUsd ? (v * tk.price).toFixed(2) : String(v);
  }

  function back() {
    if (step === 'pin') {
      step = 'form';
      pin = 0;
      return;
    }
    onClose?.();
  }

  // confirming hands back to the wallet, which shows the pending row and a toast
  function confirmPin() {
    if (!tk) return;
    if (pin < 6) {
      pin = 6;
      return;
    }
    if (onSent) onSent({ symbol: tk.symbol, amount: n, fiat: n * tk.price, to: toLabel, dp: tk.dp, person: mode === 'user' && !!person });
    else step = 'done';
  }
</script>

{#snippet column()}
  {#if tk}
    <div class="column">
      <div class="group">
        <div class="modes">
          {#each MODES as [key, label, icon]}
            <span class="mode" class:on={mode === key} onclick={() => (mode = key as 'user' | 'address')} tabindex="0" role="tab" aria-selected={mode === key}
              ><span class="mode-icon" style:mask={mask(icon)}></span>{t(label)}</span
            >
          {/each}
        </div>
        {#if mode === 'user'}
          <span class="kicker">{t('ui.walletSend.openChatUserKicker')}</span>
          {#if person}
            <div class="person">
              <span class="person-avatar" style:background={person.grad}></span>
              <span class="person-text"><span class="person-name">{person.name}</span><span class="person-handle">{person.handle}</span></span>
              <span class="icon-button" onclick={() => (user = null)} role="button" tabindex="0" aria-label={t('ui.walletSend.clear')} title={t('ui.walletSend.clear')}><span class="icon-button-icon" style:mask={mask('close')}></span></span>
            </div>
          {:else}
            <div class="search"><span class="search-icon"></span><span class="search-placeholder">{t('ui.walletSend.searchUsers')}</span></div>
          {/if}
          <div class="quick">
            {#each PEOPLE as name, i}
              <span class="quick-person" class:on={user === i} onclick={() => (user = i)} tabindex="0" role="button"
                ><span class="quick-avatar" style:background={UG[i]}></span><span class="quick-name">{name.split(' ')[0]}</span></span
              >
            {/each}
          </div>
        {:else}
          <span class="kicker">{t('ui.walletSend.addressKicker')}</span>
          <div class="address-box" class:bad={badAddress} class:good={!!det && !badAddress}>
            <input
              class="address-input"
              value={address}
              oninput={(e) => {
                address = e.currentTarget.value.trim();
                net = 0;
              }}
              placeholder={t('ui.walletSend.addressPlaceholder')}
              aria-label={t('ui.walletSend.destinationAddress')}
            />
            {#if det}
              <span class="detect" class:bad={badAddress}
                ><span class="detect-icon" style:mask={mask(badAddress ? 'close' : 'check')}></span>{det === 'unknown'
                  ? t('ui.walletSend.unrecognised')
                  : wrongNet
                    ? t('ui.walletSend.wrongNetwork', { chain: det, symbol: tk.symbol })
                    : t('ui.walletSend.chainAddress', { chain: ADDR_NAME[det] })}</span
              >
            {/if}
          </div>
          <div class="tools">
            {#each TOOLS as [label, icon]}
              <span
                class="tool"
                onclick={() => {
                  if (icon === 'qr') return;
                  address = SAMPLE[tk.symbol] ?? '';
                  net = 0;
                }}
                tabindex="0"
                role="button"><span class="tool-icon" style:mask={mask(icon)}></span>{t(label)}</span
              >
            {/each}
          </div>
        {/if}
      </div>
      {#if multi}
        <div class="group">
          <ListSectionLabel label={t('ui.walletSend.networkKicker')} />
          <div class="net-picker">
            <div class="net-select" class:open={netOpen} onclick={() => (netOpen = !netOpen)} tabindex="0" role="button" aria-expanded={netOpen}>
              <span class="net-label">{t(NETS[net].label)}</span>
              <span class="net-meta">{t(NETS[net].time)} · {NETS[net].fee}</span>
              <span class="caret" class:open={netOpen}></span>
            </div>
            {#if netOpen}
              <div class="away" onclick={() => (netOpen = false)} role="presentation"></div>
              <div class="net-options">
                {#each NETS as x, i}
                  <div
                    class="net-option"
                    onclick={() => {
                      net = i;
                      netOpen = false;
                    }}
                    tabindex="0"
                    role="option"
                    aria-selected={net === i}
                  >
                    <span class="net-option-text"><span class="net-label">{t(x.label)}</span><span class="net-short">{t(x.short)}</span></span>
                    <span class="net-time">{t(x.time)}</span>
                    <span class="net-fee">{x.fee}</span>
                    <span class="net-tick" class:on={net === i}></span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
      <div class="group">
        <div class="amount-head"><span class="kicker plain">{t('ui.walletSend.amountKicker')}</span><span class="available">{t('ui.walletSend.available', { amount: fmt(avail, tk.dp), symbol: tk.symbol })}</span></div>
        <div class="amount-box" class:over class:filled={n > 0 && !over}>
          <div class="amount-main">
            <div class="amount-line">
              {#if inUsd}<span class="dollar">$</span>{/if}<input
                class="amount-input"
                value={amt}
                oninput={(e) => (amt = e.currentTarget.value.replace(/[^0-9.,]/g, ''))}
                inputmode="decimal"
                placeholder="0"
                aria-label={t('ui.walletSend.amount')}
              />
            </div>
            <span class="amount-note" class:over
              >{over
                ? t('ui.walletSend.moreThanYouCan')
                : n > 0
                  ? `≈ ${inUsd ? `${fmt(n, tk.dp)} ${tk.symbol}` : money(n * tk.price)}`
                  : t('ui.walletSend.typeAmountIn', { unit: inUsd ? 'USD' : tk.symbol })}</span
            >
          </div>
          <span class="unit" onclick={toggleUnit} tabindex="0" aria-label={t('ui.walletSend.switchUnit')} role="button" title={t('ui.walletSend.switchUnit')}
            >{inUsd ? 'USD' : tk.symbol}<span class="unit-icon"></span></span
          >
        </div>
        <QuickAmountChips size="md" onSelect={chooseFraction} />
      </div>
      {#if !msgOpen && !msg}
        <span class="add-message" onclick={() => (msgOpen = true)} tabindex="0" role="button"><span class="add-icon"></span>{t('ui.walletSend.addMessage')}</span>
      {:else}
        <div class="group">
          <div class="message-head"><ListSectionLabel label={t('ui.walletSend.messageKicker')} /><span class="optional">{t('ui.walletSend.optional')}</span></div>
          <textarea
            class="message"
            bind:value={msg}
            placeholder={mode === 'user' && person ? t('ui.walletSend.notePerson', { name: first }) : t('ui.walletSend.noteSelf')}
            rows="5"
          ></textarea>
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

<div class="send" bind:clientWidth={width} data-screen-label="Wallet send">
  {#if tk}
    <PageHeader title={t('ui.walletSend.title', { symbol: tk.symbol })} onBack={back} avatarMark={step === 'done' ? '' : tk.mark} avatarGradient={tk.grad}
      >{#if step !== 'done'}<span class="balance">{fmt(tk.held, tk.dp)} {tk.symbol} · {money(tk.held * tk.price)}</span>{/if}</PageHeader
    >
    {#if step !== 'done' && !narrow}
      <div class="wide">
        {@render column()}
        <div class="summary-cell">
          <SideCard>
            <ListSectionLabel label={t('ui.walletSend.summaryKicker')} />
            <div class="summary-amount">
              <span class="summary-mark" style:background={tk.grad}>{tk.mark}</span>
              <div class="summary-figures"
                ><span class="summary-value" class:empty={n <= 0}>{n > 0 ? `${fmt(n, tk.dp)} ${tk.symbol}` : `0 ${tk.symbol}`}</span><span class="summary-fiat">≈ {money(n * tk.price)}</span></div
              >
            </div>
            <div class="summary-rows">
              <div class="to-row">
                <span class="to-label">{t('ui.walletSend.to')}</span>
                <span class="to-value">
                  {#if mode === 'user' && person}<span class="to-avatar" style:background={person.grad}></span>{/if}
                  <span class="to-text"
                    ><span class="to-main" class:empty={!recipOk}>{toMain}</span>{#if mode === 'user' ? !!person : !!det && det !== 'unknown'}<span class="to-sub"
                        >{mode === 'user' ? (person?.handle ?? '') : t('ui.walletSend.walletAddress')}</span
                      >{/if}</span
                  >
                </span>
              </div>
              {#each rows as r}<DetailRow label={r.k} value={r.v} valueColor={r.ink} size="lg" rule="bottom" />{/each}
              {#if msg.trim()}<div class="summary-message"><span class="summary-message-label">{t('ui.walletSend.message')}</span><span class="summary-message-text">{msg}</span></div>{/if}
              <div class="total-row">
                <span class="total-label">{t('ui.walletSend.total')}</span><span class="total-figures"
                  ><span class="total" class:over>{fmt(n + fee, tk.dp)} {tk.symbol}</span><span class="total-fiat">≈ {money((n + fee) * tk.price)}</span></span
                >
              </div>
            </div>
            {#if mode === 'user' && person}
              <div class="history">
                <ListSectionLabel label={t('ui.walletSend.between', { name: first.toUpperCase() })} />
                <div class="history-rows">
                  {#each history as h}
                    <div class="history-row" onclick={() => reuse(h.v)} tabindex="0" aria-label={t('ui.walletSend.useAmount')} role="button" title={t('ui.walletSend.useAmount')}>
                      <span class="history-badge"><span class="history-icon" style:mask={h.mask}></span></span>
                      <span class="history-label">{h.label}</span>
                      <span class="history-amount" class:incoming={h.incoming}>{h.sign}{fmt(h.v, tk.dp)} {tk.symbol}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
            <span class="grow"></span>
            <span class="cta" class:blocked={!ok} onclick={() => ok && ((step = 'pin'), (pin = 0))} tabindex="0" role="button" aria-disabled={!ok}>{ctaLabel}</span>
            <span class="cta-hint">{t(ok ? 'ui.walletSend.confirmHint' : 'ui.walletSend.summaryHint')}</span>
          </SideCard>
        </div>
      </div>
    {/if}
    {#if step !== 'done' && narrow}
      <div class="narrow">{@render column()}</div>
      <div class="foot">
        {#if footOpen}
          <div class="foot-rows">
            {#each rows as r}<DetailRow label={r.k} value={r.v} valueColor={r.ink} size="sm" rule="bottom" />{/each}
          </div>
        {/if}
        <div class="foot-bar">
          <span class="foot-summary" onclick={() => (footOpen = !footOpen)} tabindex="0" role="button"
            ><span class="foot-total" class:over>{fmt(n + fee, tk.dp)} {tk.symbol}<span class="foot-caret" class:open={footOpen}></span></span><span class="foot-to">{t('ui.walletSend.toWho', { name: toMain })}</span></span
          >
          <span class="cta foot-cta" class:blocked={!ok} onclick={() => ok && ((step = 'pin'), (pin = 0))} tabindex="0" role="button">{ctaLabel}</span>
        </div>
      </div>
    {/if}
    {#if step === 'pin'}
      <DialogShell
        title="ui.walletSend.enterPin"
        width={420}
        height="auto"
        flush={true}
        onClose={() => {
          step = 'form';
          pin = 0;
        }}
      >
        <div class="pin">
          <span class="pin-sub">{t('ui.walletSend.confirmSending', { amount: fmt(n, tk.dp), symbol: tk.symbol, to: toLabel })}</span>
          <div class="pin-dots">
            {#each [0, 1, 2, 3, 4, 5] as i}<span class="pin-box" class:current={i === pin}><span class="pin-dot" class:filled={i < pin}></span></span>{/each}
          </div>
          <span class="cta pin-cta" onclick={confirmPin} tabindex="0" role="button">{t(pin < 6 ? 'ui.walletSend.typePin' : 'ui.common.send')}</span>
        </div>
      </DialogShell>
    {/if}
    {#if step === 'done'}
      <div class="done">
        <span class="done-badge"><span class="done-icon"></span></span>
        <span class="done-title">{t('ui.walletSend.sent', { amount: fmt(n, tk.dp), symbol: tk.symbol, to: toLabel })}</span>
        <span class="done-sub">{t(multi && net === 0 ? 'ui.walletSend.btcSlow' : 'ui.walletSend.arrivesFast')}</span>
        <span class="done-back" onclick={() => onClose?.()} tabindex="0" role="button">{t('ui.walletSend.backTo', { symbol: tk.symbol })}</span>
      </div>
    {/if}
  {:else}
    <PageHeader title={t('ui.common.send')} onBack={() => onClose?.()} />
  {/if}
</div>

<style>
  .send {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1, #0e0e12);
    --sans: 'Plus Jakarta Sans', sans-serif;
    --mono: 'JetBrains Mono', monospace;
  }

  .balance {
    font: 500 12.5px/1 var(--mono);
    color: var(--ink-4, #8a8a99);
  }

  .wide {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    grid-auto-rows: auto;
    align-content: start;
    gap: 28px;
    padding: 28px max(32px, calc((100% - 960px) / 2));
    align-items: stretch;
  }

  .narrow {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px 22px 28px;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 32px;
    min-width: 0;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .modes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 5px;
    border-radius: 14px;
    background: var(--overlay-1);
  }

  .mode {
    --mode-ink: var(--ink-3, #9a9aa8);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    height: 44px;
    border-radius: 10px;
    background: transparent;
    font: 600 14px/1 var(--sans);
    color: var(--mode-ink);
    cursor: pointer;
  }

  .mode.on {
    --mode-ink: var(--ink, #ececf1);
    background: var(--btn-hover);
  }

  .mode-icon {
    width: 14px;
    height: 14px;
    background: var(--mode-ink);
  }

  .kicker {
    margin-top: 22px;
    font: 600 11.5px/1 var(--mono);
    letter-spacing: 0.08em;
    color: var(--ink-4, #8a8a99);
  }

  .kicker.plain {
    flex: 1;
    margin-top: 0;
  }

  .person,
  .search {
    display: flex;
    align-items: center;
    height: 56px;
    border-radius: 12px;
    background: var(--overlay-1);
  }

  .person {
    gap: 12px;
    padding: 0 10px 0 14px;
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .person-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  .person-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .person-name {
    font: 600 14px/1 var(--sans);
    color: var(--ink, #ececf1);
  }

  .person-handle {
    font: 400 12px/1 var(--mono);
    color: var(--ink-4, #8a8a99);
  }

  .icon-button {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .icon-button-icon {
    width: 14px;
    height: 14px;
    background: var(--ink-3, #9a9aa8);
  }

  .search {
    gap: 10px;
    padding: 0 14px;
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .search-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-4, #8a8a99);
    mask: var(--icon-search) center/contain no-repeat;
  }

  .search-placeholder {
    flex: 1;
    font: 400 14px/1 var(--sans);
    color: var(--ink-5, #6e6e7c);
  }

  .quick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .quick-person {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 12px 0 4px;
    border-radius: 999px;
    background: var(--overlay-1);
    cursor: pointer;
  }

  .quick-person.on {
    background: rgba(255, 86, 114, 0.1);
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .quick-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
  }

  .quick-name {
    font: 600 12.5px/1 var(--sans);
    color: var(--ink, #ececf1);
  }

  .address-box {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding: 10px 10px 10px 14px;
    box-sizing: border-box;
    border-radius: 12px;
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--overlay-2);
  }

  .address-box.good {
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .address-box.bad {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  .address-input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    font: 500 13.5px/1.5 var(--mono);
    color: var(--ink, #ececf1);
  }

  .detect {
    --detect-ink: #2ee6a8;
    flex: none;
    height: 24px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    border-radius: 7px;
    background: rgba(46, 230, 168, 0.12);
    font: 600 11.5px/1 var(--sans);
    color: var(--detect-ink);
    white-space: nowrap;
  }

  .detect.bad {
    --detect-ink: var(--status-danger, #f5493d);
    background: rgba(245, 73, 61, 0.12);
  }

  .detect-icon {
    width: 11px;
    height: 11px;
    background: var(--detect-ink);
  }

  .tools {
    display: flex;
    gap: 6px;
  }

  .tool {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 12px;
    border-radius: 10px;
    background: var(--overlay-1);
    font: 600 12.5px/1 var(--sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
  }

  .tool-icon {
    width: 14px;
    height: 14px;
    background: var(--ink-2, #c9c9d4);
  }

  .icon-button:hover,
  .quick-person:hover,
  .tool:hover,
  .net-select:hover,
  .net-option:hover {
    background: var(--overlay-2);
  }

  .net-picker {
    position: relative;
  }

  .net-select {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 14px 0 16px;
    border-radius: 12px;
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--overlay-2);
    cursor: pointer;
    user-select: none;
  }

  .net-select.open {
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .net-label {
    flex: 1;
    min-width: 0;
    font: 600 14px/1 var(--sans);
    color: var(--ink, #ececf1);
  }

  .net-meta,
  .net-fee {
    flex: none;
    font: 500 12.5px/1 var(--mono);
    color: var(--ink-3, #9a9aa8);
  }

  .caret {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .caret.open {
    transform: rotate(180deg);
  }

  .away {
    position: fixed;
    inset: 0;
    z-index: 9;
  }

  .net-options {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    padding: 6px;
    border-radius: 12px;
    background: var(--surface-2, #1b1b22);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 18px 40px rgba(0, 0, 0, 0.5);
  }

  .net-option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 12px;
    border-radius: 9px;
    cursor: pointer;
  }

  .net-option-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .net-short {
    font: 400 12px/1.3 var(--sans);
    color: var(--ink-4, #8a8a99);
  }

  .net-time {
    flex: none;
    width: 80px;
    text-align: end;
    font: 600 12.5px/1 var(--mono);
    color: var(--ink-2, #c9c9d4);
  }

  .net-fee {
    width: 110px;
    text-align: end;
  }

  .net-tick {
    flex: none;
    width: 16px;
    height: 16px;
    background: transparent;
    mask: var(--icon-check) center/contain no-repeat;
  }

  .net-tick.on {
    background: var(--accent, #ff5672);
  }

  .amount-head {
    display: flex;
    align-items: center;
  }

  .available {
    font: 500 12px/1 var(--mono);
    color: var(--ink-4, #8a8a99);
  }

  .amount-box {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 92px;
    padding: 0 14px 0 20px;
    border-radius: 14px;
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--overlay-2);
  }

  .amount-box.filled {
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  }

  .amount-box.over {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  .amount-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .amount-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .dollar {
    font: 700 34px/1 var(--sans);
    color: var(--ink-3, #9a9aa8);
  }

  .amount-input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    padding: 0;
    background: transparent;
    font: 700 34px/1 var(--sans);
    letter-spacing: -0.02em;
    color: var(--ink, #ececf1);
    font-variant-numeric: tabular-nums;
  }

  .amount-note {
    font: 500 13px/1 var(--mono);
    color: var(--ink-3, #9a9aa8);
  }

  .amount-note.over {
    color: var(--status-danger, #f5493d);
  }

  .unit {
    flex: none;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 40px;
    padding: 0 12px;
    border-radius: 10px;
    background: var(--overlay-2);
    font: 700 14px/1 var(--sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .unit:hover {
    background: var(--btn-hover);
  }

  .unit-icon {
    width: 13px;
    height: 13px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-swap) center/contain no-repeat;
  }

  .add-message {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 12px 0 8px;
    margin-top: -8px;
    border-radius: 10px;
    font: 600 13.5px/1 var(--sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
    user-select: none;
  }

  .add-message:hover,
  .history-row:hover {
    background: var(--overlay-1);
  }

  .add-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2, #c9c9d4);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .message-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .optional {
    font: 500 11.5px/1 var(--mono);
    color: var(--ink-5, #6e6e7c);
  }

  .message {
    resize: none;
    min-height: 124px;
    padding: 16px 18px;
    box-sizing: border-box;
    border: 0;
    outline: 0;
    border-radius: 12px;
    background: var(--overlay-1);
    font: 400 14px/1.5 var(--sans);
    color: var(--ink, #ececf1);
  }

  .summary-cell {
    min-width: 0;
    align-self: stretch;
    display: grid;
  }

  .summary-amount {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 22px 0 24px;
  }

  .summary-mark {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 700 19px/1 var(--sans);
    color: #0b0b10;
  }

  .summary-figures {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .summary-value {
    font: 700 30px/1.05 var(--sans);
    letter-spacing: -0.02em;
    color: var(--ink, #ececf1);
    word-break: break-word;
  }

  .summary-value.empty,
  .to-main.empty {
    color: var(--ink-5, #6e6e7c);
  }

  .summary-fiat {
    font: 500 13px/1 var(--mono);
    color: var(--ink-3, #9a9aa8);
  }

  .summary-rows {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--line-1);
  }

  .to-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    border-bottom: 1px solid var(--line-1);
  }

  .to-label {
    flex: none;
    font: 500 13.5px/1 var(--sans);
    color: var(--ink-3, #9a9aa8);
  }

  .to-value {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }

  .to-avatar {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }

  .to-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .to-main {
    max-width: 100%;
    font: 600 14px/1.2 var(--sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .to-sub {
    font: 400 12px/1 var(--mono);
    color: var(--ink-4, #8a8a99);
  }

  .summary-message {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 0;
    border-bottom: 1px solid var(--line-1);
  }

  .summary-message-label {
    font: 500 13.5px/1 var(--sans);
    color: var(--ink-3, #9a9aa8);
  }

  .summary-message-text {
    font: 400 13.5px/1.5 var(--sans);
    color: var(--ink-2, #c9c9d4);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .total-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 64px;
  }

  .total-label {
    flex: none;
    font: 700 14.5px/1 var(--sans);
    color: var(--ink, #ececf1);
  }

  .total-figures {
    flex: 1;
    min-width: 0;
    text-align: end;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
  }

  .total,
  .foot-total {
    font: 700 15px/1.2 var(--mono);
    color: var(--ink, #ececf1);
  }

  .total.over,
  .foot-total.over {
    color: var(--status-danger, #f5493d);
  }

  .total-fiat {
    font: 400 12px/1 var(--mono);
    color: var(--ink-4, #8a8a99);
  }

  .history {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 24px;
  }

  .history-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .history-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 10px;
    margin: 0 -10px;
    border-radius: 10px;
    cursor: pointer;
  }

  .history-badge {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-2);
  }

  .history-icon {
    width: 11px;
    height: 11px;
    background: var(--ink-2, #c9c9d4);
  }

  .history-label {
    flex: 1;
    min-width: 0;
    font: 500 13px/1.2 var(--sans);
    color: var(--ink-2, #c9c9d4);
  }

  .history-amount {
    flex: none;
    font: 600 12.5px/1 var(--mono);
    color: var(--ink, #ececf1);
  }

  .history-amount.incoming {
    color: #2ee6a8;
  }

  .grow {
    flex: 1;
    min-height: 24px;
  }

  .cta {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 46px;
    border-radius: 12px;
    background: var(--accent, #ff5672);
    font: 700 14px/1 var(--sans);
    color: var(--on-accent, #2e0512);
    cursor: pointer;
    user-select: none;
  }

  .cta.blocked {
    background: var(--overlay-2);
    color: #7c7c8c;
    cursor: default;
  }

  .cta-hint {
    margin-top: 14px;
    font: 400 12px/1.5 var(--sans);
    color: var(--ink-4, #8a8a99);
    text-align: center;
    text-wrap: pretty;
  }

  .foot {
    flex: none;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--line-1);
    background: #121217;
  }

  .foot-rows {
    display: flex;
    flex-direction: column;
    padding: 6px 22px 0;
  }

  .foot-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 80px;
    padding: 0 22px;
  }

  .foot-summary {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    cursor: pointer;
  }

  .foot-total {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .foot-caret {
    width: 12px;
    height: 12px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-chevron-down) center/contain no-repeat;
    transform: rotate(180deg);
  }

  .foot-caret.open {
    transform: none;
  }

  .foot-to {
    font: 400 12px/1 var(--sans);
    color: var(--ink-4, #8a8a99);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .foot-cta {
    flex: none;
    min-width: 160px;
    padding: 0 16px;
    white-space: nowrap;
    user-select: auto;
  }

  .pin {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    padding: 28px 24px 24px;
  }

  .pin-sub {
    font: 400 14px/1.5 var(--sans);
    color: var(--ink-3, #9a9aa8);
    text-align: center;
    text-wrap: pretty;
  }

  .pin-dots {
    display: flex;
    gap: 10px;
  }

  .pin-box {
    width: 44px;
    height: 52px;
    border-radius: 12px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--btn-hover);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pin-box.current {
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .pin-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: transparent;
  }

  .pin-dot.filled {
    background: var(--ink, #ececf1);
  }

  .pin-cta {
    align-self: stretch;
  }

  .done {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 32px;
    text-align: center;
  }

  .done-badge {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(46, 230, 168, 0.12);
  }

  .done-icon {
    width: 28px;
    height: 28px;
    background: var(--status-online);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .done-title {
    margin-top: 6px;
    font: 700 24px/1.25 var(--sans);
    color: var(--ink, #ececf1);
    max-width: 480px;
    text-wrap: pretty;
  }

  .done-sub {
    font: 400 14px/1.5 var(--sans);
    color: var(--ink-3, #9a9aa8);
  }

  .done-back {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 220px;
    height: 46px;
    border-radius: 12px;
    background: var(--overlay-2);
    font: 600 14px/1 var(--sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
  }
</style>
