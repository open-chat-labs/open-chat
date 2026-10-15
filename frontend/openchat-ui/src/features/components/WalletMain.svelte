<!-- The wallet's main column: All activity (home), a token page, and in-place Send / Receive / Swap / Recipients.
     The host drives it with `request` ({ view, token, nonce }) from the wallet list on the left and hears back through
     onViewChange; a token request always opens that token's page, also from inside a flow (unless a send or swap is
     waiting on the host). Activity rows come from the host (`activity`); a confirmed send shows a pending row until the
     host's activity lists it, and leaving Send's receipt lands back on the token page with a toast. Saved recipients,
     swaps, sharing and the QR are all host-provided and passed through to the flows. An empty wallet shows All activity
     only. -->
<script lang="ts" module>
  import type { NetworkId } from './WalletReceive.svelte';

  /** One transaction in the wallet's activity (rows are sorted by timestamp, newest first). */
  export interface WalletActivity {
    id: string;
    symbol: string;
    kind: 'send' | 'receive' | 'swap';
    /** "Received from Lucy Linden", "Swapped to USDT" … */
    title: string;
    /** ms epoch */
    timestamp: number;
    /** Shown after the time: "direct chat", "in The Awesome Group" … */
    context?: string;
    /** Whole tokens, unsigned. */
    amount: number;
    /** USD value. */
    fiat: number;
    status?: 'pending' | 'sent' | 'failed';
  }

  /** A token you can receive without holding it yet. */
  export interface ReceivableToken {
    symbol: string;
    name: string;
    mark: string;
    grad: string;
    /** Networks it arrives on (Receive picks the address from these); a token without any isn't offered. */
    nets: NetworkId[];
  }
</script>

<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
  import { onDestroy, untrack } from 'svelte';
  import type { WalletToken } from '../../lib/types';
  import CopyButton from '../../lib/components/CopyButton.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import Pill from '../../lib/components/Pill.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import ShareBar from '../../lib/components/ShareBar.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';
  import TokenPicker from '../../lib/components/TokenPicker.svelte';
  import TransactionRow from '../../lib/components/TransactionRow.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';
  import type { Snippet } from 'svelte';
  import WalletReceive, { type ShareChat } from './WalletReceive.svelte';
  import WalletRecipients, { type Recipient, type RecipientDraft } from './WalletRecipients.svelte';
  import WalletSend, { type SendContact, type WalletSendRequest } from './WalletSend.svelte';
  import WalletSwap, { type SwapQuote, type SwapRequest } from './WalletSwap.svelte';
  const i18n = getI18n(); // number formatting follows the host locale

  type View = 'all' | 'token' | 'send' | 'receive' | 'swap' | 'recipients';
  type Kind = 'send' | 'receive' | 'swap';

  const mask = (n: string) => `var(--icon-${n}) center/contain no-repeat`;
  const num = (v: number, dp: number) => v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const usd = (v: number) => `$${num(v, 2)}`;
  const price = (v: number) =>
    v >= 100 ? `$${num(v, 2)}` : v < 1 ? `$${num(v, 4)}` : `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

  const FILTERS = ['ui.walletMain.filterAll', 'ui.walletMain.filterSent', 'ui.walletMain.filterReceived', 'ui.walletMain.filterSwaps'];

  interface Entry {
    id: string;
    symbol: string;
    title: string;
    /** Day bucket: 'today', 'yesterday' or a formatted date. */
    day: string;
    timestamp: number;
    /** Time and context under the title ("10:42 · direct chat"). */
    sub: string;
    /** 1 sent, 2 received, 3 swapped — the filter tabs' indexes. */
    kind: 1 | 2 | 3;
    amount: string;
    fiat: string;
    fresh?: boolean;
    status?: 'pending' | 'sent' | 'failed';
  }
  const KIND_NUM: Record<WalletActivity['kind'], 1 | 2 | 3> = { send: 1, receive: 2, swap: 3 };

  const DAY_MS = 86400000;
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const dayOf = (ts: number) => {
    const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY_MS);
    return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : new Date(ts).toLocaleDateString(i18n.locale ?? 'en', { day: 'numeric', month: 'short' });
  };
  const timeOf = (ts: number) => new Date(ts).toLocaleTimeString(i18n.locale ?? 'en', { hour: '2-digit', minute: '2-digit' });
  const dayLabel = (d: string) => (d === 'today' ? t('ui.walletMain.today') : d === 'yesterday' ? t('ui.walletMain.yesterday') : d).toUpperCase();
  const KIND: Record<number, Kind> = { 1: 'send', 2: 'receive', 3: 'swap' };

  export interface WalletRequest {
    view: View;
    token?: string;
    /** A new nonce re-applies the request. */
    nonce: number;
    /** Return to All activity when the flow ends. */
    fromAll?: boolean;
  }

  interface Props {
    tokens: WalletToken[];
    request?: WalletRequest | null;
    onViewChange?: (v: { view: View; token: string | null }) => void;
    /** Total number of activity entries, whenever it changes. */
    onCount?: (n: number) => void;
    balanceHidden?: boolean;
    /** Your OpenChat handle, shown on Receive. */
    handle?: string;
    /** Your receiving address per network, for Receive. */
    addresses?: Partial<Record<NetworkId, string>>;
    /** People to pick from on Send. */
    contacts?: SendContact[];
    /** Send's saved-address picker and QR scanner (see WalletSend). */
    onPickSaved?: () => Promise<string | null | undefined>;
    onScanQr?: () => Promise<string | null | undefined>;
    /** Make the transfer; reject (e.g. wrong PIN) to keep Send open with an error. Resolve with the transaction's { id }
     *  to show a pending row until `activity` lists it. */
    onSent?: (x: WalletSendRequest) => Promise<unknown> | void;
    /** Open the DM with the person a send went to: Send's "View in chat", or the toast's "Message" action. */
    onMessage?: (x: { userId: string; text: string }) => void;
    /** Transactions to show (all tokens); the host keeps statuses current. */
    activity?: WalletActivity[];
    /** Tokens offered on Receive that you don't hold yet. */
    receivable?: ReceivableToken[];
    /** Saved recipients, and their host-side add / edit / remove (see WalletRecipients). */
    recipients?: Recipient[];
    onAddRecipient?: (r: RecipientDraft) => Promise<Recipient>;
    onUpdateRecipient?: (r: Recipient) => Promise<unknown> | void;
    onRemoveRecipient?: (id: string) => Promise<unknown> | void;
    /** Send: user search and BTC route fees (see WalletSend). */
    onSearchUsers?: (query: string) => Promise<SendContact[]>;
    btcFees?: Partial<Record<'btc' | 'ckbtc', number>>;
    /** Swap: quote and execution (see WalletSwap). */
    onQuote?: (r: SwapRequest) => Promise<SwapQuote>;
    onSwap?: (r: { request: SwapRequest; quote: SwapQuote; onStep: (step: number) => void }) => Promise<{ out?: number } | void>;
    /** Receive: chats to share to, sharing, and the QR renderer (see WalletReceive). */
    chats?: ShareChat[];
    onShare?: (v: { chatId: string; message: string; symbol: string; network: NetworkId; address: string }) => Promise<unknown> | void;
    qr?: Snippet<[string]>;
  }

  let {
    tokens,
    request = null,
    onViewChange,
    onCount,
    balanceHidden = false,
    handle,
    addresses,
    contacts,
    onPickSaved,
    onScanQr,
    onSent,
    onMessage,
    activity = [],
    receivable = [],
    recipients = [],
    onAddRecipient,
    onUpdateRecipient,
    onRemoveRecipient,
    onSearchUsers,
    btcFees,
    onQuote,
    onSwap,
    chats,
    onShare,
    qr,
  }: Props = $props();
  const t = useT();

  let view = $state<View>('all');
  let sym = $state('');
  let fromAll = $state(false);
  let backToAll = $state(false);
  let backToRecipients = $state(false);
  let sendAddr = $state('');
  let extTok = $state<string | null>(null);
  let flowNonce = $state(0);
  // a send or swap waiting on the host: the flow must stay mounted until its result is in
  let flowBusy = $state(0);
  let filter = $state(0);
  let tokFilter = $state(0);
  let pick = $state<{ view: 'send' | 'receive' } | null>(null);
  // sends the host confirmed (with an id) but its activity doesn't list yet
  let sent = $state<Entry[]>([]);
  let toast = $state<{ id: number; message: string; userId: string | null } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(toastTimer));

  const isFlow = (v: View) => v === 'send' || v === 'swap' || v === 'receive';

  const rows = $derived(tokens.filter((t) => t.held > 0).map((t) => ({ ...t, value: t.price * t.held })));
  const total = $derived(rows.reduce((n, t) => n + t.value, 0));
  const raw = $derived(rows.find((t) => t.symbol === sym) ?? rows[0]);
  const pct = (v: number) => (total ? `${((v / total) * 100).toFixed(1)}%` : '0%');

  function report() {
    const flow = isFlow(view);
    onViewChange?.({ view, token: view === 'all' || view === 'recipients' || (flow && fromAll) ? null : sym });
  }

  function apply(r: WalletRequest) {
    extTok = null;
    const flow = isFlow(r.view);
    // no token yet (e.g. Send in the summary card): ask which one first
    if ((r.view === 'send' || r.view === 'receive') && !r.token) {
      pick = { view: r.view };
      return;
    }
    // receiving a token you don't hold yet (one of `receivable`)
    if (r.view === 'receive' && r.token && !rows.some((x) => x.symbol === r.token) && receivable.some((x) => x.symbol === r.token && x.nets.length)) extTok = r.token;
    const startFromAll = flow && !r.token && view === 'all';
    // a token-less flow opened from a token page acts on the token shown there (sym may name one with no balance)
    const shown = raw?.symbol;
    if (r.token && r.token !== sym) tokFilter = 0;
    // a request starts afresh: an open flow (e.g. a token click from inside Send) is left, with nothing to return to
    backToAll = backToRecipients = false;
    sendAddr = '';
    view = r.view || 'all';
    sym = r.token || (flow && !startFromAll && shown ? shown : sym);
    fromAll = flow ? startFromAll || !!r.fromAll : false;
    pinFlowSym();
    report();
  }

  // a flow opened on the shown token (sym still empty) records that token, so the flow stays on it even if its
  // balance reaches 0 and the shown token changes
  function pinFlowSym() {
    if (isFlow(view) && !fromAll && !sym && raw) sym = raw.symbol;
  }

  let lastNonce: number | undefined;
  $effect(() => {
    const r = request;
    if (!r || r.nonce === lastNonce) return;
    lastNonce = r.nonce;
    untrack(() => {
      // a send or swap in flight keeps its view (remounting it would lose the result); the host hears where we are
      if (flowBusy > 0) return report();
      apply(r);
    });
  });

  // runs a send / swap host call with the flow pinned in place
  async function pinned<T>(call: () => Promise<T>): Promise<T> {
    flowBusy++;
    try {
      return await call();
    } finally {
      flowBusy--;
    }
  }

  function go(next: Partial<{ view: View; sym: string; fromAll: boolean }>) {
    extTok = null;
    if (next.view) view = next.view;
    if (next.sym) sym = next.sym;
    pinFlowSym();
    if (next.fromAll !== undefined) fromAll = next.fromAll;
    report();
  }

  function leaveFlow() {
    extTok = null;
    view = backToRecipients ? 'recipients' : fromAll || backToAll ? 'all' : 'token';
    fromAll = backToAll = backToRecipients = false;
    sendAddr = '';
    report();
  }

  // a saved recipient's own token lock wins; otherwise the network's native token
  function sendToRecipient(r: Recipient & { network: string | null }) {
    const native: Record<string, string> = { BTC: 'BTC', ETH: 'ETH', XRP: 'XRP' };
    sym = r.token || (r.network ? native[r.network] : undefined) || 'ICP';
    view = 'send';
    fromAll = false;
    backToRecipients = true;
    sendAddr = r.address;
    flowNonce++;
    report();
  }

  // The host makes the transfer (a rejection propagates back to Send's PIN dialog); Send then shows its own receipt.
  // A result with the transaction's id adds a pending row straight away, which stays until the host's `activity`
  // lists that id (its status is the host's), whether or not the receipt is left through Done.
  async function handleSent(x: WalletSendRequest) {
    const res = await pinned(async () => onSent?.(x));
    addPending(x, res);
    return res;
  }

  const sentAmount = (x: WalletSendRequest) => `${num(x.amount, Math.min(x.dp, 8))} ${x.symbol}`;

  function addPending(x: WalletSendRequest, res: unknown) {
    const txId = res && typeof res === 'object' && 'id' in res && typeof res.id === 'string' ? res.id : null;
    if (!txId || sent.some((e) => e.id === txId)) return;
    const amt = sentAmount(x);
    sent = [
      { id: txId, symbol: x.symbol, title: t('ui.walletMain.sentTo', { name: x.toLabel }), day: 'today', timestamp: Date.now(), sub: t('ui.walletMain.justNow'), kind: 1, amount: `\u2212${amt}`, fiat: usd(x.fiat), fresh: true, status: 'pending' },
      ...sent,
    ];
  }

  // Leaving Send's receipt (Done, Back or "View in chat") lands back on the token page (or All activity when the send
  // started there) with a toast; "View in chat" opens the DM instead of the toast.
  function handleDone({ request: x, result, openChat }: { request: WalletSendRequest; result: unknown; openChat: boolean }) {
    addPending(x, result);
    if (view !== 'send') return;
    view = fromAll || backToAll ? 'all' : 'token';
    // the next send starts fresh: no pre-filled recipient, and Back no longer returns to Recipients
    fromAll = backToAll = backToRecipients = false;
    sendAddr = '';
    sym = x.symbol;
    report();
    const message = t('ui.walletMain.sentToast', { amount: sentAmount(x), name: x.toLabel });
    if (openChat && x.userId && onMessage) {
      toast = null;
      onMessage({ userId: x.userId, text: message });
      return;
    }
    const tid = Date.now();
    toast = { id: tid, message, userId: x.person ? (x.userId ?? null) : null };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast?.id === tid) toast = null;
    }, 6000);
  }

  function pickToken(s: string) {
    const flow = pick?.view ?? 'send';
    pick = null;
    backToAll = view === 'all';
    view = flow;
    sym = s;
    extTok = rows.some((r) => r.symbol === s) ? null : s;
    fromAll = false;
    flowNonce = Date.now();
    report();
  }

  const tokenFor = (symbol: string) => tokens.find((tk) => tk.symbol === symbol);
  const toEntry = (a: WalletActivity): Entry | null => {
    const tk = tokenFor(a.symbol);
    if (!tk) return null;
    return {
      id: a.id,
      symbol: a.symbol,
      title: a.title,
      day: dayOf(a.timestamp),
      timestamp: a.timestamp,
      sub: [timeOf(a.timestamp), a.context].filter(Boolean).join(' · '),
      kind: KIND_NUM[a.kind],
      amount: `${a.kind === 'receive' ? '+' : '\u2212'}${num(a.amount, tk.dp)} ${tk.symbol}`,
      fiat: usd(a.fiat),
      status: a.status,
    };
  };

  // the host's activity, newest first; local pending sends until the host lists them
  const entries = $derived.by(() => {
    const known = new Set(activity.map((a) => a.id));
    const host = activity
      .map(toEntry)
      .filter((e): e is Entry => !!e)
      .sort((a, b) => b.timestamp - a.timestamp);
    return [...sent.filter((e) => !known.has(e.id)), ...host];
  });

  // day buckets in the order they first appear (entries are newest first)
  const groupByDay = <T extends { day: string }>(list: T[]) => {
    const days: string[] = [];
    for (const e of list) if (!days.includes(e.day)) days.push(e.day);
    return days.map((day) => ({ label: dayLabel(day), items: list.filter((e) => e.day === day) }));
  };

  let lastCount: number | undefined;
  $effect(() => {
    const count = entries.length;
    if (count === lastCount) return;
    lastCount = count;
    untrack(() => setTimeout(() => onCount?.(count)));
  });

  const allGroups = $derived(groupByDay(entries.filter((e) => !filter || e.kind === filter).map((e) => ({ ...e, tk: tokenFor(e.symbol)! }))));

  // token page: that token's activity (with status), grouped by day, filterable
  const tokGroups = $derived.by(() => {
    if (!raw) return [];
    const shown = entries.filter((e) => e.symbol === raw.symbol && (!tokFilter || e.kind === tokFilter));
    return groupByDay(shown).map((g) => ({
      ...g,
      items: g.items.map((x, i) => ({ ...x, divider: i > 0 && !x.fresh, kindName: KIND[x.kind] ?? 'receive', sub: x.sub || t('ui.walletMain.justNow') })),
    }));
  });

  // empty token history per filter tab: keys take { symbol }
  const EMPTY: Record<number, { icon: Kind; title: string; body: string }> = {
    1: { icon: 'send', title: 'ui.walletMain.emptySentTitle', body: 'ui.walletMain.emptySentBody' },
    2: { icon: 'receive', title: 'ui.walletMain.emptyReceivedTitle', body: 'ui.walletMain.emptyReceivedBody' },
    3: { icon: 'swap', title: 'ui.walletMain.emptySwapsTitle', body: 'ui.walletMain.emptySwapsBody' },
  };

  const change = $derived(raw?.change24h);
  const ledger = $derived(raw?.ledger);
  // keyed on the chosen symbol, not the shown row: a token whose balance reaches 0 (e.g. sending all of it) leaves
  // `rows`, and keying on that would remount a send or swap the host is still working on
  const flowSym = $derived(sym || raw?.symbol || '');
  const flowKey = $derived(`${view}:${fromAll ? '-' : flowSym}:${flowNonce}`);
  const flowToken = $derived(extTok && view === 'receive' ? extTok : fromAll ? '' : flowSym);
  // Receive also offers tokens you don't hold yet, on their own networks
  const receiveTokens = $derived<WalletToken[]>([
    ...tokens,
    ...receivable
      .filter((x) => x.nets.length && !tokens.some((tk) => tk.symbol === x.symbol))
      .map((x) => ({ symbol: x.symbol, name: x.name, mark: x.mark, grad: x.grad, held: 0, price: 0, dp: 4, nets: x.nets })),
  ]);
  const swapPinned = $derived(onSwap ? (r: Parameters<NonNullable<typeof onSwap>>[0]) => pinned(() => onSwap(r)) : undefined);
  const showToken = $derived(view === 'token' && !!raw);

  const pickTokens = $derived(
    rows
      .map((tk) => ({ symbol: tk.symbol, name: tk.name, mark: tk.mark, gradient: tk.grad, owned: true, held: `${num(tk.held, tk.dp)} ${tk.symbol}`, note: usd(tk.value) }))
      .concat(pick?.view === 'receive' ? receivable.filter((x) => x.nets.length && !rows.some((r) => r.symbol === x.symbol)).map((x) => ({ symbol: x.symbol, name: x.name, mark: x.mark, gradient: x.grad, owned: false, held: '', note: '' })) : []),
  );
</script>

<div class="main" data-screen-label="Wallet main">
  {#if view === 'send'}{#key flowKey}<WalletSend
        {tokens}
        token={flowToken}
        address={sendAddr}
        {contacts}
        {onSearchUsers}
        {btcFees}
        {onPickSaved}
        {onScanQr}
        onClose={leaveFlow}
        onSent={onSent ? handleSent : undefined}
        onDone={handleDone}
      />{/key}{/if}
  {#if view === 'receive'}{#key flowKey}<WalletReceive tokens={receiveTokens} token={flowToken} {handle} {addresses} {chats} {onShare} {qr} onClose={leaveFlow} />{/key}{/if}
  {#if view === 'swap'}{#key flowKey}<WalletSwap {tokens} token={flowToken} {onQuote} onSwap={swapPinned} onClose={leaveFlow} />{/key}{/if}
  {#if view === 'recipients'}
    <WalletRecipients
      {tokens}
      {recipients}
      onAdd={onAddRecipient}
      onUpdate={onUpdateRecipient}
      onRemove={onRemoveRecipient}
      onSend={sendToRecipient}
      onClose={() => go({ view: 'all' })}
    />
  {/if}
  {#if view === 'all' || view === 'token'}
    <PageHeader
      title={showToken ? raw.name : t('ui.walletMain.allActivity')}
      onBack={showToken ? () => go({ view: 'all' }) : undefined}
      backLabel={t('ui.walletMain.backToAll')}
      avatarMark={showToken ? raw.mark : ''}
      avatarGradient={raw?.grad}
    />
    <div class="scroll">
      <div class="column">
        {#if !showToken}
          <div class="tabs"><SegmentedTabs labels={FILTERS.map((k) => t(k))} selectedIndex={filter} dotOnLast={false} onSelect={(i) => (filter = i)} /></div>
          {#each allGroups as g}
            <div class="day">
              <ListSectionLabel label={g.label} inset={true} />
              <div class="day-rows">
                {#each g.items as e}
                  {@const k = e.kind}
                  <TransactionRow
                    hidden={balanceHidden}
                    title={e.title}
                    sub="{e.tk.symbol} · {e.fresh ? t('ui.walletMain.justNowInline') : e.sub}"
                    amount={e.amount}
                    fiat={e.fiat}
                    kind={k === 2 ? 'receive' : k === 1 ? 'send' : 'swap'}
                    symbol={e.tk.symbol}
                    mark={e.tk.mark}
                    gradient={e.tk.grad}
                    fresh={e.fresh}
                    onClick={() => go({ view: 'token', sym: e.symbol })}
                  />
                {/each}
              </div>
            </div>
          {/each}
          {#if allGroups.length === 0}<span class="none">{t('ui.walletMain.noneOfType')}</span>{/if}
        {:else}
          {@const tokenEmpty = EMPTY[tokFilter]}
          <div class="token-page">
            <div class="summary">
              <div class="summary-top">
                <div class="hero">
                  <TokenAvatar size={52} symbol={raw.symbol} mark={raw.mark} gradient={raw.grad} />
                  <div class="hero-text">
                    <span class="held veilable" class:veiled={balanceHidden}>{num(raw.held, raw.dp)} <span class="held-symbol">{raw.symbol}</span></span>
                    <span class="value-line"
                      ><span class="veilable" class:veiled={balanceHidden}>{usd(raw.value)}</span>{#if change !== undefined}<Pill
                          size="md"
                          label={t('ui.walletMain.changeToday', { change: `${change > 0 ? '+' : change < 0 ? '\u2212' : ''}${Math.abs(change).toFixed(1)}%` })}
                          tone={change > 0 ? 'success' : change < 0 ? 'danger' : 'neutral'}
                        />{/if}</span
                    >
                  </div>
                </div>
                <div class="actions">
                  {#each [['ui.walletMain.sendSymbol', 'send', 'wallet-send'], ['ui.walletMain.receiveSymbol', 'receive', 'receive'], ['ui.walletMain.swapSymbol', 'swap', 'swap']] as [label, target, icon], i}
                    <span class="action" class:primary={i === 0} onclick={() => go({ view: target as View, sym: raw.symbol, fromAll: false })} role="button" tabindex="0"
                      ><span class="action-icon" style:mask={mask(icon)}></span><span class="action-label">{t(label, { symbol: raw.symbol })}</span></span
                    >
                  {/each}
                </div>
              </div>
              <div class="facts">
                <div class="fact"><span class="fact-label">{t('ui.walletMain.price')}</span><span class="fact-value">{price(raw.price)}</span></div>
                {#if raw.fee !== undefined}<div class="fact"><span class="fact-label">{t('ui.walletMain.transferFee')}</span><span class="fact-value">{num(raw.fee, raw.dp)} {raw.symbol}</span></div>{/if}
                {#if raw.standard}<div class="fact"><span class="fact-label">{t('ui.walletMain.standard')}</span><span class="fact-value">{raw.standard}</span></div>{/if}
                {#if ledger}<div class="fact">
                    <span class="fact-label">{t('ui.walletMain.ledger')}</span><span class="fact-value"
                      >{`${ledger.slice(0, 5)}\u2026${ledger.slice(-4)}`}<span class="fact-copy"><CopyButton value={ledger} label="ui.walletMain.copyLedgerId" /></span></span
                    >
                  </div>{/if}
              </div>
              <div class="share">
                <span class="share-label">{t('ui.walletMain.shareOfWallet')}</span>
                <div class="share-bar"><ShareBar share={balanceHidden ? 33 : total ? (raw.value / total) * 100 : 0} gradient={raw.grad} thickness={4} /></div>
                <span class="share-value">{balanceHidden ? '••••' : pct(raw.value)}</span>
              </div>
            </div>
            <div class="activity">
              <div class="tabs"><SegmentedTabs labels={FILTERS.map((k) => t(k))} selectedIndex={tokFilter} dotOnLast={false} onSelect={(i) => (tokFilter = i)} /></div>
              {#each tokGroups as g}
                <div class="day">
                  <ListSectionLabel label={g.label} />
                  <div class="day-list">
                    {#each g.items as x}<TransactionRow
                        hidden={balanceHidden}
                        title={x.title}
                        sub={x.sub}
                        amount={x.amount}
                        fiat={x.fiat}
                        kind={x.kindName}
                        status={x.status ? t(x.status === 'pending' ? 'ui.walletMain.statusPending' : x.status === 'failed' ? 'ui.walletMain.statusFailed' : 'ui.walletMain.statusSent') : undefined}
                        statusTone={x.status === 'pending' ? 'warning' : x.status === 'failed' ? 'danger' : 'success'}
                        divider={x.divider}
                        fresh={x.fresh}
                      />{/each}
                  </div>
                </div>
              {/each}
              {#if tokGroups.length === 0}
                <EmptyState
                  icon={tokenEmpty?.icon}
                  title={t(tokenEmpty ? tokenEmpty.title : 'ui.walletMain.emptyTitle', { symbol: raw.symbol })}
                  body={t(tokenEmpty ? tokenEmpty.body : 'ui.walletMain.emptyBody', { symbol: raw.symbol })}
                  actionLabel=""
                />
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  {#if pick}
    <DialogShell title={pick.view === 'receive' ? 'ui.walletMain.receiveWhich' : 'ui.walletMain.sendWhich'} onClose={() => (pick = null)}
      ><TokenPicker
        tokens={pickTokens}
        placeholder={t(pick.view === 'receive' ? 'ui.walletMain.searchAnyToken' : 'ui.walletMain.searchYourTokens')}
        ownedHeading={t('ui.walletMain.inYourWallet')}
        otherHeading={t(pick.view === 'receive' ? 'ui.walletMain.allSupportedTokens' : 'ui.walletMain.allTokens')}
        onSelect={pickToken}
      /></DialogShell
    >
  {/if}
  {#if toast}
    <div class="toast">
      <div class="toast-box">
        {#key toast.id}<UndoToast
            shown={true}
            tone="success"
            size="lg"
            icon="check"
            message={toast.message}
            actionLabel={t(toast.userId && onMessage ? 'ui.walletMain.message' : 'ui.walletMain.view')}
            onAction={() => {
              const done = toast;
              toast = null;
              go({ view: 'token' });
              if (done?.userId) onMessage?.({ userId: done.userId, text: done.message });
            }}
            onClose={() => (toast = null)}
          />{/key}
      </div>
    </div>
  {/if}
</div>

<style>
  .main {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1, #0e0e12);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-32, 32px) var(--space-24);
  }

  .column {
    width: 100%;
    max-width: 700px;
    display: flex;
    flex-direction: column;
    gap: var(--space-24, 24px);
  }

  .tabs {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .day {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .day-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .day-list {
    display: flex;
    flex-direction: column;
  }

  .none {
    padding: var(--space-32, 32px) 0;
    text-align: center;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .token-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-20, 20px);
  }

  .summary {
    border-radius: 18px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    overflow: hidden;
  }

  .summary-top {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px 22px 20px;
  }

  .hero {
    display: flex;
    align-items: center;
    gap: var(--space-16, 16px);
  }

  .hero-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .held {
    font: 700 30px/1.1 var(--font-sans);
    letter-spacing: -0.02em;
    color: var(--ink, #ececf1);
    overflow-wrap: anywhere;
  }

  .held-symbol {
    color: var(--ink-4, #8a8a99);
  }

  .veilable {
    filter: none;
    transition: filter var(--duration-base, 200ms) var(--ease-out);
    user-select: auto;
  }

  .veilable.veiled {
    filter: blur(8px);
    user-select: none;
  }

  .value-line {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-10);
    font: var(--weight-medium) 13.5px / 1 var(--font-mono);
    color: var(--ink-2, #c9c9d4);
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-8);
  }

  .action {
    --action-ink: var(--ink, #ececf1);
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: 46px;
    padding: 0 10px;
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-2, rgba(255, 255, 255, 0.06));
    font: var(--weight-bold, 700) 13.5px / 1 var(--font-sans);
    color: var(--action-ink);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }

  .action:hover {
    filter: brightness(1.1);
  }

  .action.primary {
    --action-ink: var(--on-accent, #2e0512);
    background: var(--accent, #ff5672);
  }

  .action-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--action-ink);
  }

  .action-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .fact {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 14px 18px;
    box-shadow: inset 1px 0 0 var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .fact-label {
    font: var(--weight-medium) 10px/1 var(--font-mono);
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--ink-4, #8a8a99);
  }

  .fact-value {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 600 13.5px/1.2 var(--font-mono);
    color: var(--ink, #ececf1);
    white-space: nowrap;
  }

  .fact-copy {
    display: flex;
    margin: -6px 0;
  }

  .share {
    display: flex;
    align-items: center;
    gap: var(--space-12, 12px);
    padding: 12px 18px 14px;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .share-label {
    flex: none;
    font: var(--weight-medium) 12.5px/1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .share-bar {
    flex: 1;
    min-width: 0;
  }

  .share-value {
    flex: none;
    font: 600 12.5px/1 var(--font-mono);
    color: var(--ink, #ececf1);
  }

  .activity {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-20, 20px);
  }

  .toast {
    position: absolute;
    left: 0;
    right: 0;
    bottom: var(--space-24, 24px);
    z-index: 30;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .toast-box {
    pointer-events: auto;
    width: min(480px, calc(100% - 48px));
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
</style>
