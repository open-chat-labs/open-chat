<!-- Send in the wallet main column, in two steps (Details → Send). Details: recipient (OpenChat user or address, with
     network detection), amount (token or USD, quick chips), optional message, and summary rows with the Send button, in
     one column. Send opens a PIN dialog over the form; confirming makes the transfer through onSent while a receipt shows
     "Sending" (a rejection, e.g. a wrong PIN, reopens the PIN dialog with its error). Once the host resolves, the receipt
     reads "Sent"; Done, Back or "View in chat" hand back through onDone. Contacts, saved addresses and QR scanning come
     from the host; Paste reads the clipboard. -->
<script lang="ts" module>
  export interface SendContact {
    userId: string;
    name: string;
    handle: string;
    /** Avatar background. */
    grad?: string;
  }

  export interface WalletSendRequest {
    /** The sent token's id (WalletToken.id, else its symbol): two tokens can share a symbol. */
    token: string;
    symbol: string;
    amount: number;
    fee: number;
    fiat: number;
    /** Full destination: the wallet address, or the user id in user mode. */
    to: string;
    /** Set when sending to an OpenChat user. */
    userId?: string;
    /** Display name for the recipient (person's name or shortened address). Display only. */
    toLabel: string;
    /** openchat | icp | btc | ckbtc | eth | xrpl */
    network: string;
    memo?: string;
    /** The 6-digit PIN the user typed, for the host to verify ('' with `hostPin`). */
    pin: string;
    /** The amount as a plain decimal in whole tokens ("1.5"): the digits typed when typed in the token, for the host to
     *  turn into ledger units exactly. */
    amountText: string;
    /** The whole available balance was picked (Max): the host sends what's left after the fee, exactly. */
    max: boolean;
    dp: number;
    person: boolean;
  }
</script>

<script lang="ts">
  import type { WalletToken } from '../../lib/types';
  import DetailRow from '../../lib/components/DetailRow.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import QuickAmountChips from '../../lib/components/QuickAmountChips.svelte';
  import Spinner from '../../lib/components/Spinner.svelte';
  import StepIndicator from '../../lib/components/StepIndicator.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';
  import { getI18n, useT } from '../../lib/i18n';
  import { amountText, cleanAmount, floorTo, fromUnits, parseAmount, plain, toUnits, usdText } from '../../lib/amount';
  import { detectNetwork, type AddressNetwork } from '../../lib/networks';
  import { onDestroy, tick } from 'svelte';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { txIdOf } from '../../lib/wallet';

  const mask = (n: string) => `var(--icon-${n}) center/contain no-repeat`;
  const PIN_LENGTH = 6;
  const FALLBACK_GRAD = 'linear-gradient(140deg,#8B7BFF,#5B3FD9)';
  // label / short / time: resource keys (or literal text, e.g. network names); the fees themselves come from the host
  const NETS = [
    { id: 'btc', label: 'Bitcoin', short: 'ui.walletSend.nativeBtc', time: 'ui.walletSend.btcTime' },
    { id: 'ckbtc', label: 'ui.walletSend.ckBtcOnIcp', short: 'ui.walletSend.needsIcpWallet', time: 'ui.walletSend.seconds' },
  ] as const;
  const MODES = [
    ['user', 'ui.walletSend.openChatUser', 'user'],
    ['address', 'ui.walletSend.walletAddress', 'wallet'],
  ];
  const STEPS = ['ui.walletSend.stepDetails', 'ui.walletSend.stepSend'];
  type Chain = AddressNetwork;
  const NET_NAME: Record<Chain, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', XRP: 'XRP Ledger', ICP: 'Internet Computer' };
  const ADDR_NAME: Record<Chain, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', XRP: 'XRP', ICP: 'ICP' };
  // detected address chain → the network ids WalletToken.nets uses
  const CHAIN_NET: Record<Chain, string> = { BTC: 'btc', ETH: 'eth', XRP: 'xrpl', ICP: 'icp' };

  const fmt = (v: number, dp: number) => v.toLocaleString(i18n.locale ?? 'en', { maximumFractionDigits: dp });
  const money = (v: number) => `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  interface Props {
    tokens: WalletToken[];
    /** Token to send, by its id (WalletToken.id) or symbol; falls back to ICP. */
    token?: string;
    /** Pre-fills the address mode, e.g. from a saved recipient. */
    address?: string;
    /** People to pick from in "OpenChat user" mode. Without any, only the address mode is useful. */
    contacts?: SendContact[];
    /** Search all OpenChat users by name or handle. Without it, only `contacts` can be picked. */
    onSearchUsers?: (query: string) => Promise<SendContact[]>;
    /** Current fee (in BTC) for sending BTC to a Bitcoin address natively or as ckBTC; a route without a fee can't be used. */
    btcFees?: Partial<Record<'btc' | 'ckbtc', number>>;
    /** The routes the host can send BTC to a Bitcoin address over (e.g. only `btc`: a ckBTC transfer can't reach one);
     *  both without it. */
    btcRoutes?: ('btc' | 'ckbtc')[];
    /** Opens the host's saved-address picker; resolve with the chosen address (or nothing to cancel). Hidden without it. */
    onPickSaved?: () => Promise<string | null | undefined>;
    /** Opens the host's QR scanner; resolve with the scanned address. Hidden without it. */
    onScanQr?: () => Promise<string | null | undefined>;
    onClose?: () => void;
    /** Make the transfer, when the PIN is submitted. Reject (e.g. wrong PIN) to reopen the PIN dialog with an error.
     *  Resolve when it's done, optionally with `{ id }` (shown as the receipt's transaction). Without it nothing can be sent. */
    onSent?: (v: WalletSendRequest) => Promise<unknown> | void;
    /** After a completed send, when the user leaves the receipt: Done or Back (openChat false), or "View in chat"
     *  (openChat true; offered for sends to a person when canOpenChat). `result` is what onSent resolved with. Without
     *  it, these close. */
    onDone?: (v: { request: WalletSendRequest; result: unknown; openChat: boolean }) => void;
    /** The host can open the DM with the recipient from onDone's openChat: offers "View in chat" on the receipt. */
    canOpenChat?: boolean;
    /** The host asks for the PIN itself (or none is set): Send makes the transfer straight away, with no PIN step, and a
     *  failure shows under the form. onSent resolving `false` means nothing was sent and there's nothing to say (the
     *  user dismissed the host's PIN prompt): the form stays as it was. */
    hostPin?: boolean;
    /** The host's say on an address for a token (e.g. not the user's own, on a network the send can reach); without it,
     *  the detected network and the token's `nets` decide. */
    checkAddress?: (address: string, symbol: string) => boolean;
  }

  let { tokens, token, address: initialAddress = '', contacts = [], onSearchUsers, btcFees = {}, btcRoutes, onPickSaved, onScanQr, onClose, onSent, onDone, canOpenChat = false, hostPin = false, checkAddress }: Props = $props();
  const t = useT();
  const i18n = getI18n();

  const held = $derived(tokens.filter((tok) => tok.held > 0));
  // a token is its id: two can share a symbol
  const idOf = (tok: WalletToken) => tok.id ?? tok.symbol;
  const startId = (() => {
    const list = tokens.filter((tok) => tok.held > 0);
    const start = list.find((x) => idOf(x) === token) ?? list.find((x) => x.symbol === token) ?? list.find((x) => x.symbol === 'ICP') ?? list[0];
    return start ? idOf(start) : '';
  })();

  const sel = $state(startId);
  let mode = $state<'user' | 'address'>(initialAddress ? 'address' : 'user');
  let picked = $state<SendContact | null>(null);
  let userQuery = $state('');
  let userResults = $state<SendContact[]>([]);
  let searching = $state(false);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchRun = 0;
  onDestroy(() => {
    clearTimeout(searchTimer);
    searchRun++;
  });
  let address = $state(initialAddress);
  let amt = $state('');
  // a chip picks an exact token amount; in USD mode the field shows it rounded down to cents,
  // but the picked amount is what's sent, so Max stays the whole balance. Typing replaces it.
  let exact = $state<{ text: string; sym: string; n: number } | null>(null);
  let msg = $state('');
  let msgOpen = $state(false);
  let inUsd = $state(false);
  let netOpen = $state(false);
  let net = $state(0);
  // form → pin (dialog over the form) → sending (receipt, the host's call in flight) → done (receipt)
  let step = $state<'form' | 'pin' | 'sending' | 'done'>('form');
  let pinText = $state('');
  // the PIN step's host call: busy while sending (nothing reopens, closes or resubmits), failed after a rejection
  const pinFlow = new DialogFlow();
  let pinInput = $state<HTMLInputElement>();
  const pin = $derived(pinText.length);
  // the receipt shows the transfer as it was asked for, and what the host resolved with
  let sent = $state<{ request: WalletSendRequest; at: number; doneAt?: number; result?: unknown } | null>(null);
  let finished = false;
  let width = $state(0);

  const narrow = $derived(width > 0 && width < 760);
  // the chosen token stays the chosen token even if its balance reaches 0 (e.g. while sending all of it)
  const tk = $derived(tokens.find((x) => idOf(x) === sel) ?? held[0]);
  // decimals the amount accepts: inputDp when the token has more than people type (an 18-decimal token)
  const inDp = $derived(tk ? Math.min(tk.inputDp ?? tk.dp, tk.dp) : 0);
  const typed = $derived(parseAmount(amt));
  // amounts never carry more decimals than the input accepts (rounded down, so a max send stays within balance)
  const n = $derived(tk ? (exact && exact.text === amt && exact.sym === idOf(tk) ? exact.n : floorTo(inUsd ? typed / tk.price : typed, inDp)) : 0);
  const det = $derived(mode === 'address' ? detectNetwork(address) : null);
  // the routes offered: the host's, else both
  const routes = $derived(btcRoutes ? NETS.filter((x) => btcRoutes.includes(x.id)) : NETS);
  const multi = $derived(mode === 'address' && tk?.symbol === 'BTC' && det === 'BTC');
  const routeFee = $derived(multi ? btcFees[routes[net].id] : undefined);
  const fee = $derived(multi ? (routeFee ?? 0) : mode === 'user' ? (tk?.userFee ?? tk?.fee ?? 0) : (tk?.fee ?? 0));
  // a BTC route without a fee from the host can't be priced, so it can't be sent
  const feeKnown = $derived(!multi || routeFee !== undefined);
  const person = $derived(picked ? { name: picked.name, handle: picked.handle, grad: picked.grad ?? FALLBACK_GRAD } : null);
  const first = $derived(person ? person.name.split(' ')[0] : '');
  // a token can go to any network it lists in `nets` (CHAT and ckBTC-style sends to an ICP principal, USDT to ETH …);
  // tokens without `nets` are ICP ledger tokens
  const tokenNets = $derived(tk?.nets?.length ? tk.nets : ['icp']);
  const wrongNet = $derived(
    !!det && det !== 'unknown' && (!tokenNets.includes(CHAIN_NET[det]) || (!!checkAddress && !!tk && !checkAddress(address.trim(), tk.symbol))),
  );
  const badAddress = $derived(det === 'unknown' || wrongNet);
  const recipOk = $derived(mode === 'user' ? !!person : !!det && det !== 'unknown' && !wrongNet);
  // compared in whole units: float sums are off by a hair for many-decimal tokens and large balances
  const over = $derived(!!tk && toUnits(n, tk.dp) + toUnits(fee, tk.dp) > toUnits(tk.held, tk.dp));
  const ok = $derived(recipOk && n > 0 && !over && feeKnown && !!onSent);
  const avail = $derived.by(() => {
    if (!tk) return 0;
    const units = toUnits(tk.held, tk.dp) - toUnits(fee, tk.dp);
    return units > 0n ? fromUnits(units, tk.dp) : 0;
  });
  const shortAddress = $derived(address ? `${address.slice(0, 10)}…${address.slice(-6)}` : '');
  const toLabel = $derived(mode === 'user' ? (person ? person.name : '—') : shortAddress || '—');
  const receipt = $derived(step === 'sending' || step === 'done');

  // the summary under the form: network, fee, what they receive, total
  const rows = $derived([
    { k: t('ui.walletSend.network'), v: mode === 'user' ? 'OpenChat' : multi ? t(routes[net].label) : det && det !== 'unknown' ? NET_NAME[det] : '—', ink: 'var(--ink)' },
    { k: t('ui.walletSend.networkFee'), v: `${fmt(fee, tk?.dp ?? 0)} ${tk?.symbol}`, ink: 'var(--ink)' },
    { k: mode === 'user' && person ? t('ui.walletSend.nameReceives', { name: first }) : t('ui.walletSend.theyReceive'), v: `${fmt(n, inDp)} ${tk?.symbol}`, ink: n > 0 ? 'var(--ink)' : 'var(--ink-5,#6E6E7C)' },
    { k: t('ui.walletSend.total'), v: `${fmt(n + fee, tk?.dp ?? 0)} ${tk?.symbol}`, ink: over ? 'var(--status-danger)' : 'var(--ink)' },
  ]);
  const network = $derived(mode === 'user' ? 'openchat' : multi ? routes[net].id : det && det !== 'unknown' ? CHAIN_NET[det] : '');

  const ctaLabel = $derived(
    ok
      ? t('ui.walletSend.sendTo', { amount: fmt(n, inDp), symbol: tk?.symbol ?? '', name: mode === 'user' ? first : toLabel })
      : t(
          !recipOk
            ? mode === 'user'
              ? 'ui.walletSend.chooseRecipient'
              : 'ui.walletSend.addValidAddress'
            : n <= 0
              ? 'ui.walletSend.enterAmount'
              : over
                ? 'ui.walletSend.tooHigh'
                : !feeKnown
                  ? 'ui.walletSend.feeUnavailable'
                  : 'ui.walletSend.cantSend',
        ),
  );

  // the receipt: what was asked for, then what the host resolved with
  const rc = $derived.by(() => {
    if (!sent || !tk) return null;
    const r = sent.request;
    const amount = `${fmt(r.amount, inDp)} ${r.symbol}`;
    const name = r.person ? first : r.toLabel;
    const id = txIdOf(sent.result);
    const secs = sent.doneAt ? Math.max(1, Math.round((sent.doneAt - sent.at) / 1000)) : 0;
    const rcRows = [
      { k: t('ui.walletSend.networkFee'), v: `${fmt(r.fee, tk.dp)} ${r.symbol}` },
      { k: t('ui.walletSend.total'), v: `${fmt(r.amount + r.fee, tk.dp)} ${r.symbol}` },
      ...(r.memo ? [{ k: t('ui.walletSend.message'), v: r.memo }] : []),
      ...(step === 'done' && id ? [{ k: t('ui.walletSend.transaction'), v: `#${id}` }] : []),
    ];
    return {
      amount,
      fiat: money(r.fiat),
      to: r.person ? (person?.name ?? r.toLabel) : r.toLabel,
      toSub: r.person ? (person?.handle ?? '') : t('ui.walletSend.walletAddress'),
      rows: rcRows,
      status:
        step === 'done'
          ? r.person
            ? t('ui.walletSend.statusReceived', { name, amount })
            : t('ui.walletSend.statusSent', { amount })
          : t('ui.walletSend.statusSending', { amount, name }),
      took: secs ? t('ui.walletSend.took', { time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` }) : '',
      slow: r.network === 'btc',
    };
  });

  function searchUsers(q: string) {
    userQuery = q;
    clearTimeout(searchTimer);
    const mine = ++searchRun;
    if (!onSearchUsers || !q.trim()) {
      userResults = [];
      searching = false;
      return;
    }
    searching = true;
    searchTimer = setTimeout(async () => {
      try {
        const found = await onSearchUsers(q.trim());
        if (mine === searchRun) userResults = found;
      } catch {
        if (mine === searchRun) userResults = [];
      } finally {
        if (mine === searchRun) searching = false;
      }
    }, 250);
  }

  function pickUser(c: SendContact) {
    picked = c;
    userQuery = '';
    userResults = [];
  }

  // typed amounts keep at most the decimals the unit accepts (cents in USD)
  function typeAmount(input: HTMLInputElement) {
    let v = cleanAmount(input.value);
    const cap = inUsd ? 2 : inDp;
    const at = v.search(/[.,]/);
    if (at >= 0) v = cap > 0 ? v.slice(0, at + 1 + cap) : v.slice(0, at);
    input.value = v;
    amt = v;
  }

  function toggleUnit() {
    if (!tk) return;
    const v = n;
    inUsd = !inUsd;
    if (typed > 0) pick(v);
    else amt = '';
  }

  // shows a token amount in the current unit and keeps it as the amount sent
  function pick(v: number) {
    if (!tk) return;
    amt = inUsd ? usdText(v * tk.price) : amountText(v, inDp);
    exact = { text: amt, sym: idOf(tk), n: v };
  }

  function chooseFraction(k: number) {
    if (!tk) return;
    pick(floorTo(avail * k, inDp));
  }

  // the PIN dialog can't be reopened while a send is in flight, so a send can never run twice
  function openPin() {
    if (!ok || pinFlow.busy || step !== 'form') return;
    // the host asks for the PIN itself: Send makes the transfer now
    if (hostPin) return void send();
    pinText = '';
    pinFlow.failed = false;
    step = 'pin';
  }

  function closePin() {
    if (pinFlow.busy) return;
    step = 'form';
    pinText = '';
    pinFlow.failed = false;
  }

  // "View in chat" only where it can open one: a send to a person, with onDone and a host that opens DMs
  const chatOffered = $derived(!!sent?.request.person && !!onDone && canOpenChat);

  // leaving the receipt: once, through onDone (or onClose without it)
  function finish(openChat: boolean) {
    if (step !== 'done' || !sent || finished) return;
    finished = true;
    if (onDone) onDone({ request: sent.request, result: sent.result, openChat });
    else onClose?.();
  }

  function back() {
    if (step === 'sending') return; // the transfer is in flight; the receipt stays until the host answers
    if (step === 'pin') return closePin();
    if (step === 'done') return finish(false);
    onClose?.();
  }

  // Paste reads the clipboard; Saved and QR ask the host
  async function fill(source: 'paste' | 'saved' | 'qr') {
    let next: string | null | undefined;
    try {
      next = source === 'paste' ? await navigator.clipboard.readText() : source === 'saved' ? await onPickSaved?.() : await onScanQr?.();
    } catch {
      return; // clipboard permission denied, picker cancelled …
    }
    if (!next?.trim()) return;
    address = next.trim();
    net = 0;
  }

  const tools = $derived(
    [
      ['paste', 'ui.walletSend.paste', 'paste'],
      ...(onPickSaved ? [['saved', 'ui.walletSend.saved', 'bookmark']] : []),
      ...(onScanQr ? [['qr', 'ui.walletSend.scanQr', 'qr']] : []),
    ] as ['paste' | 'saved' | 'qr', string, string][],
  );

  function typedPin(value: string) {
    pinText = value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (pinFlow.failed) pinFlow.failed = false;
  }

  // submitting the PIN makes the transfer: the receipt shows "Sending" until the host answers;
  // a rejection (e.g. a wrong PIN) reopens the PIN dialog with its error
  async function confirmPin() {
    if (!tk || pin < PIN_LENGTH || pinFlow.busy || step !== 'pin') {
      pinInput?.focus();
      return;
    }
    await send();
  }

  // a send through the host's own PIN (hostPin) that failed: said under the form
  let sendFailed = $state(false);

  // the transfer, through onSent: the receipt shows "Sending" until the host answers
  async function send() {
    if (!tk || !onSent || pinFlow.busy) return;
    sendFailed = false;
    const request: WalletSendRequest = {
      token: idOf(tk),
      symbol: tk.symbol,
      amount: n,
      fee,
      fiat: n * tk.price,
      to: mode === 'user' ? (picked?.userId ?? '') : address.trim(),
      userId: mode === 'user' ? picked?.userId : undefined,
      toLabel,
      network,
      memo: msg.trim() || undefined,
      pin: hostPin ? '' : pinText,
      // the digits typed (already cut to the token's decimals), not the float: the host turns them into units exactly
      amountText: inUsd ? plain(n) : cleanAmount(amt).replace(',', '.'),
      max: !!exact && exact.text === amt && exact.sym === idOf(tk) && exact.n === floorTo(avail, inDp) && n > 0,
      dp: tk.dp,
      person: mode === 'user' && !!person,
    };
    const sending = onSent;
    sent = { request, at: Date.now() };
    step = 'sending';
    const outcome = await pinFlow.run(() => sending(request));
    if (outcome.ok && outcome.value === false) {
      // nothing sent, nothing to say: back to the form as it was
      sent = null;
      step = 'form';
      return;
    }
    if (outcome.ok) {
      sent = { ...sent, doneAt: Date.now(), result: outcome.value };
      step = 'done';
      return;
    }
    sent = null;
    if (hostPin) {
      step = 'form';
      sendFailed = pinFlow.failed;
      return;
    }
    step = 'pin';
    pinText = '';
    await tick(); // the dialog is back on the next render
    pinInput?.focus();
  }

  $effect(() => {
    if (step === 'pin') pinInput?.focus();
  });
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
              <span class="icon-button" onclick={() => (picked = null)} role="button" tabindex="0" aria-label={t('ui.walletSend.clear')} title={t('ui.walletSend.clear')}><span class="icon-button-icon" style:mask={mask('close')}></span></span>
            </div>
          {:else if onSearchUsers}
            <div class="search">
              <span class="search-icon"></span><input
                class="search-input"
                value={userQuery}
                oninput={(e) => searchUsers(e.currentTarget.value)}
                placeholder={t('ui.walletSend.searchUsers')}
                aria-label={t('ui.walletSend.searchUsers')}
              />
            </div>
            {#if userQuery.trim()}
              <div class="results" role="listbox" aria-busy={searching}>
                {#each userResults as c (c.userId)}
                  <span class="result" onclick={() => pickUser(c)} role="option" aria-selected="false" tabindex="0"
                    ><span class="quick-avatar" style:background={c.grad ?? FALLBACK_GRAD}></span><span class="person-text"
                      ><span class="person-name">{c.name}</span><span class="person-handle">{c.handle}</span></span
                    ></span
                  >
                {/each}
                {#if !searching && !userResults.length}<span class="no-results">{t('ui.walletSend.noUsersFound')}</span>{/if}
              </div>
            {/if}
          {/if}
          {#if contacts.length}
            <div class="quick">
              {#each contacts as c (c.userId)}
                <span class="quick-person" class:on={picked?.userId === c.userId} onclick={() => pickUser(c)} tabindex="0" role="button"
                  ><span class="quick-avatar" style:background={c.grad ?? FALLBACK_GRAD}></span><span class="quick-name">{c.name.split(' ')[0]}</span></span
                >
              {/each}
            </div>
          {/if}
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
            {#each tools as [source, label, icon]}
              <span class="tool" onclick={() => fill(source)} tabindex="0" role="button"><span class="tool-icon" style:mask={mask(icon)}></span>{t(label)}</span>
            {/each}
          </div>
        {/if}
      </div>
      {#if multi}
        <div class="group">
          <ListSectionLabel label={t('ui.walletSend.networkKicker')} />
          <div class="net-picker">
            <div class="net-select" class:open={netOpen} onclick={() => (netOpen = !netOpen)} tabindex="0" role="button" aria-expanded={netOpen}>
              <span class="net-label">{t(routes[net].label)}</span>
              <span class="net-meta">{t(routes[net].time)} · {routeFee !== undefined ? `${fmt(routeFee, 8)} BTC` : t('ui.walletSend.feeUnknown')}</span>
              <span class="caret" class:open={netOpen}></span>
            </div>
            {#if netOpen}
              <div class="away" onclick={() => (netOpen = false)} role="presentation"></div>
              <div class="net-options">
                {#each routes as x, i}
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
                    <span class="net-fee">{btcFees[x.id] !== undefined ? `${fmt(btcFees[x.id] ?? 0, 8)} BTC` : t('ui.walletSend.feeUnknown')}</span>
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
                oninput={(e) => typeAmount(e.currentTarget)}
                inputmode="decimal"
                placeholder="0"
                aria-label={t('ui.walletSend.amount')}
              />
            </div>
            <span class="amount-note" class:over
              >{over
                ? t('ui.walletSend.moreThanYouCan')
                : n > 0
                  ? `≈ ${inUsd ? `${fmt(n, inDp)} ${tk.symbol}` : money(n * tk.price)}`
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
      <div class="summary">
        <div class="summary-rows">
          {#each rows as r, i}<DetailRow label={r.k} value={r.v} valueColor={r.ink} size="sm" rule={i === rows.length - 1 ? 'none' : 'bottom'} />{/each}
        </div>
        <span class="cta" class:blocked={!ok} onclick={openPin} tabindex="0" role="button" aria-disabled={!ok}>{ctaLabel}</span>
        {#if sendFailed}<span class="send-error" role="alert">{t('ui.walletSend.sendFailed')}</span>{/if}
        <span class="cta-hint">{t(ok ? (hostPin ? 'ui.walletSend.confirmHintHostPin' : 'ui.walletSend.confirmHint') : 'ui.walletSend.summaryHint')}</span>
      </div>
    </div>
  {/if}
{/snippet}

<div class="send" bind:clientWidth={width} data-screen-label="Wallet send">
  {#if tk}
    <PageHeader title={t('ui.walletSend.title', { symbol: tk.symbol })} onBack={back} avatarMark={step === 'done' ? '' : tk.mark} avatarGradient={tk.grad}
      ><StepIndicator steps={STEPS} current={receipt ? 1 : 0} complete={step === 'done'} compact={narrow} /></PageHeader
    >
    {#if !receipt}
      <div class="scroll"><div class="page" class:narrow>{@render column()}</div></div>
    {/if}
    {#if step === 'pin'}
      <DialogShell title="ui.walletSend.enterPin" width={420} height="auto" flush={true} onClose={pinFlow.busy ? undefined : closePin}>
        <form
          class="pin"
          onsubmit={(e) => {
            e.preventDefault();
            confirmPin();
          }}
        >
          <span class="pin-sub">{t('ui.walletSend.confirmSending', { amount: fmt(n, inDp), symbol: tk.symbol, to: toLabel })}</span>
          <!-- one real input under the boxes: typing, paste and one-time-code autofill all work -->
          <label class="pin-dots">
            <input
              class="pin-input"
              bind:this={pinInput}
              value={pinText}
              oninput={(e) => typedPin(e.currentTarget.value)}
              type="password"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength={PIN_LENGTH}
              aria-label={t('ui.walletSend.enterPin')}
              aria-invalid={pinFlow.failed}
            />
            {#each Array.from({ length: PIN_LENGTH }, (_, i) => i) as i}<span class="pin-box" class:current={i === pin} aria-hidden="true"><span class="pin-dot" class:filled={i < pin}></span></span>{/each}
          </label>
          {#if pinFlow.failed}<span class="pin-error" role="alert">{t('ui.walletSend.pinFailed')}</span>{/if}
          <button class="cta pin-cta" class:blocked={pin < PIN_LENGTH} type="submit" aria-disabled={pin < PIN_LENGTH}>{t(pin < PIN_LENGTH ? 'ui.walletSend.typePin' : 'ui.common.send')}</button>
        </form>
      </DialogShell>
    {/if}
    {#if receipt && rc}
      <div class="scroll">
        <div class="page receipt" class:narrow>
          <div class="tag-line"><span class="tag" class:done={step === 'done'}>{t(step === 'done' ? 'ui.walletSend.receiptSent' : 'ui.walletSend.receiptSending')}</span><span class="tag-rule"></span></div>
          <div class="rc-card">
            <div class="rc-row">
              <TokenAvatar mark={tk.mark} gradient={tk.grad} size={40} />
              <div class="rc-text"><span class="rc-kicker">{t('ui.walletSend.youSend')}</span><span class="rc-amount">{rc.amount}</span></div>
              <span class="rc-fiat">{rc.fiat}</span>
            </div>
            <div class="rc-row">
              {#if sent?.request.person}
                <span class="rc-avatar" style:background={person?.grad ?? FALLBACK_GRAD}></span>
              {:else}
                <span class="rc-avatar wallet"><span class="rc-wallet-icon"></span></span>
              {/if}
              <div class="rc-text">
                <span class="rc-kicker">{t('ui.walletSend.toKicker')}</span>
                <span class="rc-to">{rc.to}{#if rc.toSub}<span class="rc-to-sub">{rc.toSub}</span>{/if}</span>
              </div>
            </div>
            <div class="rc-rows">
              {#each rc.rows as r, i}<DetailRow label={r.k} value={r.v} size="sm" rule={i === rc.rows.length - 1 ? 'none' : 'bottom'} />{/each}
            </div>
          </div>
          <div class="status" class:done={step === 'done'} role="status">
            <span class="status-dot">
              {#if step === 'done'}<span class="status-check"></span>{:else}<Spinner size={14} tone="accent" label="ui.walletSend.sending" />{/if}
            </span>
            <span class="status-text">{rc.status}</span>
            <span class="status-time">{rc.took}</span>
          </div>
          {#if step === 'done'}
            <div class="done-actions" class:two={chatOffered}>
              {#if chatOffered}<span class="done-button" onclick={() => finish(true)} role="button" tabindex="0">{t('ui.walletSend.viewInChat')}</span>{/if}
              <span class="done-button primary" onclick={() => finish(false)} role="button" tabindex="0">{t('ui.common.done')}</span>
            </div>
          {:else}
            <span class="sending-note">{t(rc.slow ? 'ui.walletSend.btcSlow' : 'ui.walletSend.arrivesFast')}</span>
          {/if}
        </div>
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
    background: var(--surface-1);
    --sans: 'Plus Jakarta Sans', sans-serif;
    --mono: 'JetBrains Mono', monospace;
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
    --mode-ink: var(--ink-3);
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
    --mode-ink: var(--ink);
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
    color: var(--ink-4);
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
    box-shadow: inset 0 0 0 1px var(--accent);
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
    color: var(--ink);
  }

  .person-handle {
    font: 400 12px/1 var(--mono);
    color: var(--ink-4);
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
    background: var(--ink-3);
  }

  .search {
    gap: 10px;
    padding: 0 14px;
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .search-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-4);
    mask: var(--icon-search) center/contain no-repeat;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: none;
    background: transparent;
    padding: 0;
    font: 500 14px/1 var(--sans);
    color: var(--ink);
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-block-start: 6px;
  }

  .result {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: 10px;
    cursor: pointer;
  }

  .result:hover {
    background: var(--overlay-2);
  }

  .no-results {
    padding: 8px 10px;
    font: 400 13px/1.4 var(--sans);
    color: var(--ink-4);
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
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .quick-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
  }

  .quick-name {
    font: 600 12.5px/1 var(--sans);
    color: var(--ink);
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
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .address-box.bad {
    box-shadow: inset 0 0 0 1px var(--status-danger);
  }

  .address-input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    font: 500 13.5px/1.5 var(--mono);
    color: var(--ink);
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
    --detect-ink: var(--status-danger);
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
    color: var(--ink-2);
    cursor: pointer;
  }

  .tool-icon {
    width: 14px;
    height: 14px;
    background: var(--ink-2);
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
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .net-label {
    flex: 1;
    min-width: 0;
    font: 600 14px/1 var(--sans);
    color: var(--ink);
  }

  .net-meta,
  .net-fee {
    flex: none;
    font: 500 12.5px/1 var(--mono);
    color: var(--ink-3);
  }

  .caret {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--ink-3);
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
    background: var(--surface-2);
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
    color: var(--ink-4);
  }

  .net-time {
    flex: none;
    width: 80px;
    text-align: end;
    font: 600 12.5px/1 var(--mono);
    color: var(--ink-2);
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
    background: var(--accent);
  }

  .amount-head {
    display: flex;
    align-items: center;
  }

  .available {
    font: 500 12px/1 var(--mono);
    color: var(--ink-4);
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
    box-shadow: inset 0 0 0 1px var(--status-danger);
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
    color: var(--ink-3);
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
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .amount-note {
    font: 500 13px/1 var(--mono);
    color: var(--ink-3);
  }

  .amount-note.over {
    color: var(--status-danger);
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
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }

  .unit:hover {
    background: var(--btn-hover);
  }

  .unit-icon {
    width: 13px;
    height: 13px;
    background: var(--ink-3);
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
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .add-message:hover {
    background: var(--overlay-1);
  }

  .add-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2);
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
    color: var(--ink);
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
    color: var(--ink-3);
    text-align: center;
    text-wrap: pretty;
  }

  .pin-dots {
    position: relative;
    display: flex;
    gap: 10px;
    cursor: text;
  }

  /* the real input covers the boxes,
  invisible,
  so a tap anywhere on them focuses it */
  .pin-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    border: 0;
    padding: 0;
    font-size: 16px;
    caret-color: transparent;
  }

  .pin-dots:focus-within .pin-box.current {
    box-shadow:
      inset 0 0 0 1px var(--accent),
      0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .pin-error {
    margin-block-start: -10px;
    font: 500 13px/1.4 var(--sans);
    color: var(--status-danger);
  }

  .send-error {
    font: 500 13px/1.4 var(--font-sans);
    color: var(--status-danger);
  }

  .pin-box {
    width: 44px;
    height: 52px;
    border-radius: 12px;
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--btn-hover);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pin-box.current {
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .pin-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: transparent;
  }

  .pin-dot.filled {
    background: var(--ink);
  }

  .pin-cta {
    align-self: stretch;
    border: 0;
    padding: 0;
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .page {
    box-sizing: content-box;
    max-width: 700px;
    margin: 0 auto;
    padding: 28px 32px;
    display: flex;
    flex-direction: column;
  }

  .page.narrow {
    padding: 24px 22px 28px;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .summary-rows {
    padding: 4px 16px;
    border-radius: 14px;
    background: var(--overlay-1);
  }

  .cta {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 52px;
    padding: 0 16px;
    border-radius: 12px;
    background: var(--accent);
    font: 700 14.5px/1 var(--sans);
    color: var(--on-accent);
    text-align: center;
    cursor: pointer;
    user-select: none;
  }

  .cta:not(.blocked):hover {
    filter: brightness(1.08);
  }

  .cta.blocked {
    background: var(--overlay-2);
    color: #7c7c8c;
    cursor: default;
  }

  .cta-hint {
    font: 400 12.5px/1.5 var(--sans);
    color: var(--ink-4);
    text-align: center;
    text-wrap: pretty;
  }

  .receipt {
    gap: 22px;
  }

  .tag-line {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .tag {
    font: 500 10px/1 var(--mono);
    letter-spacing: 0.09em;
    color: var(--accent-bright);
  }

  .tag.done {
    color: var(--status-online);
  }

  .tag-rule {
    flex: 1;
    height: 1px;
    background: var(--line-1);
  }

  .rc-card {
    border-radius: 16px;
    background: var(--overlay-1);
    overflow: hidden;
  }

  .rc-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--line-1);
  }

  .rc-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rc-kicker {
    font: 500 10px/1 var(--mono);
    letter-spacing: 0.09em;
    color: var(--ink-4);
  }

  .rc-amount {
    font: 700 18px/1.15 var(--sans);
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .rc-fiat {
    flex: none;
    font: 500 12.5px/1 var(--mono);
    color: var(--ink-3);
  }

  .rc-avatar {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  .rc-avatar.wallet {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-2);
  }

  .rc-wallet-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-3);
    mask: var(--icon-wallet) center/contain no-repeat;
  }

  .rc-to {
    font: 700 16px/1.2 var(--sans);
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .rc-to-sub {
    margin-inline-start: 6px;
    font: 400 12.5px/1 var(--mono);
    color: var(--ink-4);
  }

  .rc-rows {
    display: flex;
    flex-direction: column;
    padding: 2px 16px 6px;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--overlay-1);
  }

  .status-dot {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-soft);
  }

  .status.done .status-dot {
    background: rgba(46, 230, 168, 0.14);
  }

  .status-check {
    width: 13px;
    height: 13px;
    background: var(--status-online);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .status-text {
    flex: 1;
    min-width: 0;
    font: 600 13px/1.35 var(--sans);
    color: var(--ink);
  }

  .status-time {
    font: 500 11.5px/1 var(--mono);
    color: var(--ink-4);
  }

  .done-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .done-actions.two {
    grid-template-columns: 1fr 1fr;
  }

  .done-button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 52px;
    border-radius: 12px;
    background: var(--overlay-2);
    font: 600 14px/1 var(--sans);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }

  .done-button:hover {
    background: var(--btn-hover);
  }

  .done-button.primary {
    background: var(--accent);
    font: 700 14.5px/1 var(--sans);
    color: var(--on-accent);
  }

  .done-button.primary:hover {
    filter: brightness(1.08);
  }

  .sending-note {
    font: 400 12.5px/1.5 var(--sans);
    color: var(--ink-4);
  }
</style>
