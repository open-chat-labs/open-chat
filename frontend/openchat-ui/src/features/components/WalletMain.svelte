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
    /** The token's id (WalletToken `id`) when tokens share a symbol; defaults to the symbol. */
    token?: string;
    /** `own`: between two of your own wallets, neither in nor out (listed under All only, unsigned). */
    kind: 'send' | 'receive' | 'swap' | 'own';
    /** "Received from Lucy Linden", "Swapped to USDT" …; without it, worded from `kind` and `party`. */
    title?: string;
    /** The other side ("@lucy", a saved name, an account), for the worded title. */
    party?: string;
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
  import type { MenuItem, WalletToken } from '../../lib/types';
  import ContextMenu from '../../lib/components/ContextMenu.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import { copyText } from '../../lib/clipboard';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import Button from '../../lib/components/Button.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import ShareBar from '../../lib/components/ShareBar.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';
  import TokenPicker from '../../lib/components/TokenPicker.svelte';
  import TransactionRow from '../../lib/components/TransactionRow.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';
  import type { Snippet } from 'svelte';
  import WalletReceive, { type ReceiveNetwork, type ShareChat } from './WalletReceive.svelte';
  import WalletRecipients, { type Recipient, type RecipientDraft } from './WalletRecipients.svelte';
  import WalletSend, { type SendContact, type WalletSendRequest } from './WalletSend.svelte';
  import { flowReturn, pickedFlow, txIdOf, type WalletPlace } from '../../lib/wallet';
  import WalletSwap, { type SwapQuote, type SwapRequest } from './WalletSwap.svelte';
  const i18n = getI18n(); // number formatting follows the host locale

  type View = 'all' | 'token' | 'send' | 'receive' | 'swap' | 'recipients';
  type Kind = 'send' | 'receive' | 'swap' | 'own';

  const mask = (n: string) => `var(--icon-${n}) center/contain no-repeat`;
  const num = (v: number, dp: number) => v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const usd = (v: number) => `$${num(v, 2)}`;
  const price = (v: number) =>
    v >= 100 ? `$${num(v, 2)}` : v < 1 ? `$${num(v, 4)}` : `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

  const FILTERS = ['ui.walletMain.filterAll', 'ui.walletMain.filterSent', 'ui.walletMain.filterReceived', 'ui.walletMain.filterSwaps'];

  interface Entry {
    id: string;
    /** The token's id. */
    token: string;
    title: string;
    /** Day bucket: 'today', 'yesterday' or a formatted date. */
    day: string;
    timestamp: number;
    /** Time and context under the title ("10:42 · direct chat"). */
    sub: string;
    /** 1 sent, 2 received, 3 swapped — the filter tabs' indexes; 0 between your own wallets (All only). */
    kind: 0 | 1 | 2 | 3;
    amount: string;
    fiat: string;
    fresh?: boolean;
    status?: 'pending' | 'sent' | 'failed';
  }
  const KIND_NUM: Record<WalletActivity['kind'], 0 | 1 | 2 | 3> = { own: 0, send: 1, receive: 2, swap: 3 };

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
  // between your own wallets reads with the swap arrows
  const KIND: Record<number, Kind> = { 0: 'own', 1: 'send', 2: 'receive', 3: 'swap' };

  export interface WalletRequest {
    /** `browse`: the Supported tokens picker. `ledger`: copy `token`'s ledger ID (the view stays). */
    view: View | 'browse' | 'ledger';
    token?: string;
    /** A new nonce re-applies the request. */
    nonce: number;
    /** Return to All activity when the flow ends. */
    fromAll?: boolean;
  }

  interface Props {
    /** The catalogue, held or not: a token you don't hold still gets its page, at zero. */
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
    onShare?: (v: { chatId: string; message: string; symbol: string; network: string; address: string }) => Promise<unknown> | void;
    qr?: Snippet<[string]>;
    /** Receive: the host's networks for the token received, the chosen one and its pick (see WalletReceive). */
    receiveNetworks?: ReceiveNetwork[];
    receiveNetwork?: string;
    onReceiveNetwork?: (id: string) => void;
    /** The token page's history as the host loads it: the first page loading or failed (with `onRetryHistory`), or
     *  loaded, with older entries to load (`more`, `onMoreHistory`) or loading; `unavailable` for a token whose
     *  transactions can't be listed. Without it, `activity` is all there is. */
    history?: { state: 'loading' | 'failed' | 'loaded' | 'unavailable'; more?: boolean; loadingMore?: boolean };
    onMoreHistory?: () => void;
    onRetryHistory?: () => void;
    /** An activity row clicked (its id), e.g. to open it on the token's explorer; on All activity a row opens its token. */
    onActivity?: (id: string) => void;
    /** In place of All activity's list, when the host can't list activity across tokens: resource keys (or text). */
    allActivityNote?: { title: string; body: string };
    /** The host is still loading `tokens`: a token's page waits (neither the page nor "Token not found" yet). */
    tokensLoading?: boolean;
    /** The token page's eye: the shared wallet veil. Without it there's no eye. */
    onBalanceHiddenChange?: (hidden: boolean) => void;
    /** The flows the host offers: requests, picks and menu items for the others are left out, and their buttons (the
     *  token page's, the welcome's Receive card) do nothing. All three without it. */
    flows?: ('send' | 'receive' | 'swap')[];
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
    receiveNetworks,
    receiveNetwork,
    onReceiveNetwork,
    history,
    onMoreHistory,
    onRetryHistory,
    onActivity,
    allActivityNote,
    onBalanceHiddenChange,
    flows = ['send', 'receive', 'swap'],
    tokensLoading = false,
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
  let pick = $state<{ view: 'send' | 'receive' | 'browse' } | null>(null);
  // sends the host confirmed (with an id) but its activity doesn't list yet
  let sent = $state<Entry[]>([]);
  // `notice`: a plain message, with no action (a copied ledger ID or username)
  let toast = $state<{ id: number; message: string; userId: string | null; notice?: boolean } | null>(null);
  let tokMenu = $state<{ left: number; right: number; top: number; bottom: number } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(toastTimer));

  const isFlow = (v: View) => v === 'send' || v === 'swap' || v === 'receive';

  // a token's identity (`sym` holds it): several ledgers can share a symbol. Send, Receive and Swap still pick their
  // token by symbol, so they get the shown token's symbol and their results map back to the first token with it
  const idOf = (tk: { id?: string; symbol: string }) => tk.id ?? tk.symbol;
  const valued = $derived(tokens.map((t) => ({ ...t, value: t.price * t.held })));
  const rows = $derived(valued.filter((t) => t.held > 0));
  const total = $derived(rows.reduce((n, t) => n + t.value, 0));
  // nothing owned yet: All activity is the welcome
  const empty = $derived(rows.length === 0);
  // a token you don't hold (an empty wallet, or one opened from Supported tokens) still gets its page, at zero
  const raw = $derived(rows.find((t) => idOf(t) === sym) ?? valued.find((t) => idOf(t) === sym) ?? rows[0] ?? valued[0]);
  // a page asked for a token that isn't in `tokens`: it says so, rather than showing another token's page (once the host
  // has loaded them)
  const missing = $derived(!!sym && !tokensLoading && !valued.some((t) => idOf(t) === sym));
  const offers = (flow: 'send' | 'receive' | 'swap') => flows.includes(flow) && (!raw?.actions || raw.actions.includes(flow));
  const idForSymbol = (symbol: string) => {
    const tk = tokens.find((t) => t.symbol === symbol);
    return tk ? idOf(tk) : symbol;
  };
  const symbolOf = (id: string) => tokens.find((t) => idOf(t) === id)?.symbol ?? id;
  const pct = (v: number) => (total ? `${((v / total) * 100).toFixed(1)}%` : '0%');

  function report() {
    const flow = isFlow(view);
    // receiving a token outside `tokens` reports that token; the page shown (`sym`) is only where Receive goes back to
    const token = view === 'receive' && extTok ? extTok : view === 'all' || view === 'recipients' || (flow && fromAll) ? null : sym || null;
    onViewChange?.({ view, token });
  }

  function apply(r: WalletRequest) {
    if (r.view === 'ledger') {
      if (r.token) copyLedger(r.token);
      return;
    }
    if (r.view === 'browse') {
      pick = { view: 'browse' };
      return;
    }
    // a flow the host doesn't offer: its token's page, if it names one
    if (isFlow(r.view) && !flows.includes(r.view as 'send' | 'receive' | 'swap')) {
      if (r.token) apply({ view: 'token', token: r.token, nonce: r.nonce });
      return;
    }
    const view0: View = r.view;
    const flow = isFlow(view0);
    // no token yet (e.g. Send in the summary card): ask which one first. What's open stays as it is (an extra token's
    // Receive keeps its token) until a token is picked
    if ((r.view === 'send' || r.view === 'receive') && !r.token) {
      pick = { view: r.view };
      return;
    }
    extTok = null;
    // receiving a token outside `tokens` (one of `receivable`): only received, so the page shown stays for Receive to go
    // back to (All activity if it was opened there)
    if (r.view === 'receive' && r.token && !valued.some((x) => idOf(x) === r.token) && receivable.some((x) => x.symbol === r.token && x.nets.length)) extTok = r.token;
    const startFromAll = flow && !r.token && view === 'all';
    // where it goes back to: a request naming a token from the wallet goes back to that token's page (from anywhere, as a
    // token request opens its page); an extra token, which has no page, where it was opened (lib/wallet's flowReturn, as
    // for one picked in the token picker)
    const backTo = extTok ? flowReturn(here(), false) : 'token';
    // a token-less flow opened from a token page acts on the token shown there (sym may name one with no balance)
    const shown = raw ? idOf(raw) : undefined;
    if (r.token && r.token !== sym) tokFilter = 0;
    // an open flow (e.g. a token click from inside Send) is left; the new one goes back to where it was opened (a page
    // request has nowhere to go back to)
    backToAll = flow && backTo === 'all';
    backToRecipients = flow && backTo === 'recipients';
    sendAddr = '';
    // ... and a flow requested again (e.g. Send for the token whose receipt is showing) remounts as a fresh form
    if (flow) flowNonce++;
    view = view0 || 'all';
    sym = extTok ? sym : r.token || (flow && !startFromAll && shown ? shown : sym);
    fromAll = flow ? startFromAll || !!r.fromAll : false;
    pinFlowSym();
    report();
  }

  // a flow opened on the shown token (sym still empty) records that token, so the flow stays on it even if its
  // balance reaches 0 and the shown token changes
  function pinFlowSym() {
    if (isFlow(view) && !fromAll && !sym && raw) sym = idOf(raw);
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
    sym = idForSymbol(r.token || (r.network ? native[r.network] : undefined) || 'ICP');
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
    const txId = txIdOf(res);
    if (!txId || sent.some((e) => e.id === txId)) return;
    const amt = sentAmount(x);
    sent = [
      { id: txId, token: idForSymbol(x.symbol), title: t('ui.walletMain.sentTo', { name: x.toLabel }), day: 'today', timestamp: Date.now(), sub: t('ui.walletMain.justNow'), kind: 1, amount: `\u2212${amt}`, fiat: usd(x.fiat), fresh: true, status: 'pending' },
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
    sym = idForSymbol(x.symbol);
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

  // one place that knows ledger IDs: both kebabs (the list's and the token page's) copy through here
  async function copyLedger(id: string) {
    const tk = tokens.find((x) => idOf(x) === id);
    if (!tk?.ledger) return;
    if (await copyText(tk.ledger)) notify(t('ui.walletMain.ledgerCopied', { symbol: tk.symbol }));
  }

  async function copyHandle() {
    if (handle && (await copyText(handle))) notify(t('ui.walletMain.usernameCopied'));
  }

  function notify(message: string) {
    const tid = Date.now();
    toast = { id: tid, message, userId: null, notice: true };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast?.id === tid) toast = null;
    }, 4000);
  }

  // `s` is a token's id, or the symbol of a receivable token not in `tokens`
  // where the user is now, for where a flow opened from here goes back to (lib/wallet)
  const here = (): WalletPlace => ({ view, fromAll, backToAll, backToRecipients, sym });

  function pickToken(s: string) {
    const tk = tokens.find((x) => idOf(x) === s);
    // browse (Supported tokens): a token in the wallet's catalogue opens its page; anything else goes to Receive
    if (pick?.view === 'browse') {
      pick = null;
      if (tk) {
        go({ view: 'token', sym: s, fromAll: false });
        return;
      }
      if (!flows.includes('receive')) return;
      pick = { view: 'receive' };
    }
    const flow: 'send' | 'receive' = pick?.view === 'receive' ? 'receive' : 'send';
    pick = null;
    // the flow, where it goes back to, the token shown and an extra token (lib/wallet's pickedFlow)
    ({ view, sym, extTok, fromAll, backToAll, backToRecipients, sendAddr } = pickedFlow(here(), { id: s, inTokens: !!tk, flow }));
    flowNonce = Date.now();
    report();
  }

  const tokenFor = (id: string) => tokens.find((tk) => idOf(tk) === id);
  // a host that gives the other side and not a title: "Received from @lucy", "Sent to …", "Between your wallets"
  const activityTitle = (a: WalletActivity) =>
    a.kind === 'own'
      ? t('ui.walletMain.betweenYourWallets')
      : t(a.kind === 'receive' ? 'ui.walletMain.receivedFrom' : a.kind === 'swap' ? 'ui.walletMain.swappedTo' : 'ui.walletMain.sentTo', {
          name: a.party ?? '',
          symbol: a.party ?? '',
        });
  const toEntry = (a: WalletActivity): Entry | null => {
    const tk = tokenFor(a.token ?? a.symbol);
    if (!tk) return null;
    return {
      id: a.id,
      token: idOf(tk),
      title: a.title ?? activityTitle(a),
      day: dayOf(a.timestamp),
      timestamp: a.timestamp,
      sub: [timeOf(a.timestamp), a.context].filter(Boolean).join(' · '),
      kind: KIND_NUM[a.kind],
      amount: `${a.kind === 'receive' ? '+' : a.kind === 'own' ? '' : '\u2212'}${num(a.amount, tk.dp)} ${tk.symbol}`,
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

  const allGroups = $derived(groupByDay(entries.filter((e) => !filter || e.kind === filter).map((e) => ({ ...e, tk: tokenFor(e.token)! }))));

  // token page: that token's activity (with status), grouped by day, filterable
  const tokGroups = $derived.by(() => {
    if (!raw) return [];
    const shown = entries.filter((e) => e.token === idOf(raw) && (!tokFilter || e.kind === tokFilter));
    return groupByDay(shown).map((g) => ({
      ...g,
      items: g.items.map((x, i) => ({ ...x, divider: i > 0 && !x.fresh, kindName: KIND[x.kind] ?? 'receive', sub: x.sub || t('ui.walletMain.justNow') })),
    }));
  });

  // empty token history per filter tab: keys take { symbol }
  const EMPTY: Record<number, { icon: 'send' | 'receive' | 'swap'; title: string; body: string }> = {
    1: { icon: 'send', title: 'ui.walletMain.emptySentTitle', body: 'ui.walletMain.emptySentBody' },
    2: { icon: 'receive', title: 'ui.walletMain.emptyReceivedTitle', body: 'ui.walletMain.emptyReceivedBody' },
    3: { icon: 'swap', title: 'ui.walletMain.emptySwapsTitle', body: 'ui.walletMain.emptySwapsBody' },
  };

  // keyed on the chosen symbol, not the shown row: a token whose balance reaches 0 (e.g. sending all of it) leaves
  // `rows`, and keying on that would remount a send or swap the host is still working on
  const flowSym = $derived(sym || (raw ? idOf(raw) : ''));
  const flowKey = $derived(`${view}:${fromAll ? '-' : flowSym}:${flowNonce}`);
  const flowToken = $derived(fromAll ? '' : symbolOf(flowSym));
  // Receive also offers tokens you don't hold yet, on their own networks
  const receiveTokens = $derived<WalletToken[]>([
    ...tokens,
    ...receivable
      .filter((x) => x.nets.length && !tokens.some((tk) => tk.symbol === x.symbol))
      .map((x) => ({ symbol: x.symbol, name: x.name, mark: x.mark, grad: x.grad, held: 0, price: 0, dp: 4, nets: x.nets })),
  ]);
  const swapPinned = $derived(onSwap ? (r: Parameters<NonNullable<typeof onSwap>>[0]) => pinned(() => onSwap(r)) : undefined);
  const showToken = $derived(view === 'token' && !!raw && !missing);
  const notFound = $derived(view === 'token' && missing);
  // a token's page asked for while the host is loading the tokens (a reload of it): neither the page nor "not found" yet
  const pending = $derived(view === 'token' && !!sym && tokensLoading && !valued.some((t) => idOf(t) === sym));

  // sending: the tokens you hold. Receiving or browsing: yours first, then the rest of the catalogue, then the extra
  // receivable tokens (only while Receive is offered), no symbol twice
  // sending: the tokens you hold. Receiving or browsing: yours first, then the rest of the catalogue, then the extra
  // receivable tokens (only while Receive is offered) whose symbol the catalogue doesn't have. Rows are keyed by the
  // token's id, so two tokens sharing a symbol both show and each opens its own page
  const pickTokens = $derived.by(() => {
    const anyToken = pick?.view === 'receive' || pick?.view === 'browse';
    const owned = rows.map((tk) => ({ id: idOf(tk), symbol: tk.symbol, name: tk.name, mark: tk.mark, gradient: tk.grad, owned: true, held: `${num(tk.held, tk.dp)} ${tk.symbol}`, note: usd(tk.value) }));
    if (!anyToken) return owned;
    const rest = valued.filter((tk) => !(tk.held > 0)).map((tk) => ({ id: idOf(tk), symbol: tk.symbol, name: tk.name, mark: tk.mark, gradient: tk.grad, owned: false, held: '', note: '' }));
    const known = new Set(tokens.map((tk) => tk.symbol));
    const extra = flows.includes('receive')
      ? receivable
          .filter((x) => x.nets.length && !known.has(x.symbol))
          .filter((x, i, all) => all.findIndex((y) => y.symbol === x.symbol) === i)
          .map((x) => ({ symbol: x.symbol, name: x.name, mark: x.mark, gradient: x.grad, owned: false, held: '', note: '' }))
      : [];
    return [...owned, ...rest, ...extra];
  });

  // the token page's actions: Send / Receive / Swap when held; at zero, Receive leads and Send and Swap wait for funds
  const heroActions = $derived.by(() => {
    if (!raw) return [];
    // as designed whatever the host offers; one it doesn't does nothing
    const all = [
      { target: 'send' as const, label: 'ui.walletMain.sendSymbol', icon: 'wallet-send' },
      { target: 'receive' as const, label: 'ui.walletMain.receiveSymbol', icon: 'receive' },
      { target: 'swap' as const, label: 'ui.walletMain.swapSymbol', icon: 'swap' },
    ];
    if (raw.held > 0) return all.map((a, i) => ({ ...a, primary: i === 0, disabled: false }));
    const receive = all.filter((a) => a.target === 'receive').map((a) => ({ ...a, primary: true, disabled: false }));
    return [...receive, ...all.filter((a) => a.target !== 'receive').map((a) => ({ ...a, primary: false, disabled: true }))];
  });

  // the token page's kebab: its flows (Receive only at zero), then Copy ledger ID when it has a ledger
  const tokMenuItems = $derived.by((): MenuItem[] => {
    if (!raw) return [];
    const flowItems = (raw.held > 0 ? (['send', 'receive', 'swap'] as const) : (['receive'] as const))
      .filter((f) => offers(f))
      .map((f) => ({
        label: t(f === 'send' ? 'ui.walletMain.sendSymbol' : f === 'receive' ? 'ui.walletMain.receiveSymbol' : 'ui.walletMain.swapSymbol', { symbol: raw.symbol }),
        mask: mask(f === 'send' ? 'wallet-send' : f),
        onSelect: () => {
          tokMenu = null;
          go({ view: f, sym: idOf(raw), fromAll: false });
        },
      }));
    const ledgerItems = raw.ledger
      ? [
          ...(flowItems.length ? [{ label: '', variant: 'separator' as const }] : []),
          {
            label: t('ui.walletMain.copyLedgerId'),
            mask: mask('copy'),
            onSelect: () => {
              tokMenu = null;
              copyLedger(idOf(raw));
            },
          },
        ]
      : [];
    return [...flowItems, ...ledgerItems];
  });

  function openTokMenu(e?: Event) {
    const el = e?.currentTarget as Element | null | undefined;
    const r = el?.getBoundingClientRect();
    tokMenu = r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : { left: 0, right: 0, top: 0, bottom: 0 };
  }
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
        canOpenChat={!!onMessage}
      />{/key}{/if}
  {#if view === 'receive'}{#key flowKey}<WalletReceive
        tokens={receiveTokens}
        token={extTok ?? (fromAll ? '' : flowSym)}
        {handle}
        {addresses}
        {chats}
        {onShare}
        {qr}
        networks={receiveNetworks}
        network={receiveNetwork}
        onNetwork={onReceiveNetwork}
        onClose={leaveFlow}
      />{/key}{/if}
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
      title={pending ? '' : showToken ? raw.name : notFound ? t('ui.walletMain.tokenNotFoundTitle') : t(empty ? 'ui.walletMain.wallet' : 'ui.walletMain.allActivity')}
      onBack={showToken || notFound || pending ? () => go({ view: 'all' }) : undefined}
      backLabel={t('ui.walletMain.backToAll')}
      avatarMark={showToken ? raw.mark : ''}
      avatarLogo={showToken ? raw.logo : undefined}
      avatarGradient={raw?.grad}
      titleTag={showToken ? price(raw.price) : undefined}
      >{#if showToken && tokMenuItems.length}<IconButton icon="more" label="ui.walletMain.tokenOptions" onClick={openTokMenu} />{/if}</PageHeader
    >
    <div class="scroll">
      <div class="column">
        {#if pending}
          <div class="history-note"><Skeleton variant="token" count={3} /></div>
        {:else if notFound}
          <EmptyState icon="search" title={t('ui.walletMain.tokenNotFoundTitle')} body={t('ui.walletMain.tokenNotFoundBody')} actionLabel="" />
        {:else if !showToken && empty}
          <div class="welcome">
            <span class="welcome-tile"><span class="welcome-icon"></span></span>
            <span class="welcome-text">
              <span class="welcome-title">{t('ui.walletMain.welcomeTitle')}</span>
              <span class="welcome-body">{t('ui.walletMain.welcomeBody')}</span>
            </span>
            <div class="welcome-cards">
                <div class="welcome-card" onclick={flows.includes('receive') ? () => (pick = { view: 'receive' }) : undefined} role="button" tabindex="0">
                  <span class="card-icon" style:mask={mask('receive')}></span>
                  <span class="card-title">{t('ui.walletMain.receiveTokensTitle')}</span>
                  <span class="card-body">{t('ui.walletMain.receiveTokensBody')}</span>
                  <span class="card-link">{t('ui.walletMain.showMyAddress')}</span>
                </div>
                {#if handle}
                <div class="welcome-card" onclick={copyHandle} role="button" tabindex="0">
                  <span class="card-icon" style:mask={mask('share')}></span>
                  <span class="card-title">{t('ui.walletMain.getPaidTitle')}</span>
                  <span class="card-body">{t('ui.walletMain.getPaidBody')}</span>
                  <span class="card-link">{t('ui.walletMain.copyUsername', { handle })}</span>
                </div>
                {/if}
              </div>
          </div>
        {:else if !showToken && allActivityNote}
          <EmptyState icon="receive" title={t(allActivityNote.title)} body={t(allActivityNote.body)} actionLabel="" />
        {:else if !showToken}
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
                    kind={KIND[k] ?? 'receive'}
                    positive={k === 2}
                    symbol={e.tk.symbol}
                    mark={e.tk.mark}
                    gradient={e.tk.grad}
                    fresh={e.fresh}
                    onClick={() => go({ view: 'token', sym: e.token })}
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
              <div class="hero">
                <TokenAvatar size={52} symbol={raw.symbol} mark={raw.mark} gradient={raw.grad} logo={raw.logo} />
                <div class="hero-text">
                  <span class="held-line"
                    ><span class="held veilable" class:veiled={balanceHidden}>{num(raw.held, raw.dp)} <span class="held-symbol">{raw.symbol}</span></span
                    >{#if onBalanceHiddenChange}<span
                        class="eye"
                        onclick={() => onBalanceHiddenChange(!balanceHidden)}
                        role="button"
                        tabindex="0"
                        aria-label={t(balanceHidden ? 'ui.balanceCard.showBalance' : 'ui.balanceCard.hideBalance')}
                        title={t(balanceHidden ? 'ui.balanceCard.showBalance' : 'ui.balanceCard.hideBalance')}
                        ><span class="eye-icon" style:mask={mask(balanceHidden ? 'eye-off' : 'eye')}></span></span
                      >{/if}</span
                  >
                  <span class="value-line veilable" class:veiled={balanceHidden}>≈ {usd(raw.value)}</span>
                </div>
              </div>
              {#if raw.held > 0}
                <div class="share">
                  <span class="share-head"
                    ><span class="share-label">{t('ui.walletMain.shareOfWallet')}</span><span class="share-value">{balanceHidden ? '••••' : pct(raw.value)}</span></span
                  >
                  <ShareBar share={balanceHidden ? 33 : total ? (raw.value / total) * 100 : 0} gradient={raw.grad} thickness={4} />
                </div>
              {/if}
              {#if heroActions.length}
                <div class="actions">
                  {#each heroActions as a (a.target)}
                    <span
                      class="action"
                      class:primary={a.primary}
                      class:disabled={a.disabled}
                      onclick={a.disabled || !offers(a.target) ? undefined : () => go({ view: a.target, sym: idOf(raw), fromAll: false })}
                      role="button"
                      tabindex="0"
                      aria-disabled={a.disabled}
                      title={a.disabled ? t('ui.balanceCard.addFundsFirst') : undefined}
                      data-tip={a.disabled ? t('ui.balanceCard.addFundsFirst') : undefined}
                      ><span class="action-icon" style:mask={mask(a.icon)}></span><span class="action-label">{t(a.label, { symbol: raw.symbol })}</span></span
                    >
                  {/each}
                </div>
              {/if}
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
                        positive={x.kind === 2}
                        onClick={onActivity ? () => onActivity(x.id) : undefined}
                      />{/each}
                  </div>
                </div>
              {/each}
              {#if history?.state === 'loading'}
                <div class="history-note"><Skeleton variant="token" count={4} /></div>
              {:else if history?.state === 'unavailable'}
                <EmptyState icon="receive" title={t('ui.walletMain.noHistoryTitle')} body={t('ui.walletMain.noHistoryBody', { symbol: raw.symbol })} actionLabel="" />
              {:else if history?.state === 'failed'}
                <EmptyState
                  icon="receive"
                  title={t('ui.walletMain.historyFailedTitle')}
                  body={t('ui.walletMain.historyFailedBody', { symbol: raw.symbol })}
                  actionLabel={onRetryHistory ? t('ui.emptyState.tryAgain') : ''}
                  actionHandler={onRetryHistory}
                />
              {:else if tokGroups.length === 0 && !history?.more}
                <EmptyState
                  icon={tokenEmpty?.icon}
                  title={t(tokenEmpty ? tokenEmpty.title : 'ui.walletMain.emptyTitle', { symbol: raw.symbol })}
                  body={t(tokenEmpty ? tokenEmpty.body : 'ui.walletMain.emptyBody', { symbol: raw.symbol })}
                  actionLabel=""
                />
              {/if}
              {#if history?.state === 'loaded' && history.more && onMoreHistory}
                <div class="more-history">
                  <Button label={history.loadingMore ? 'ui.walletMain.loadingOlder' : 'ui.walletMain.loadOlder'} variant="secondary" disabled={history.loadingMore} onClick={onMoreHistory} />
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  <ContextMenu open={!!tokMenu} items={tokMenuItems} anchor={tokMenu} align="end" onClose={() => (tokMenu = null)} />
  {#if pick}
    <DialogShell
      title={pick.view === 'browse' ? 'ui.walletMain.supportedTokens' : pick.view === 'receive' ? 'ui.walletMain.receiveWhich' : 'ui.walletMain.sendWhich'}
      onClose={() => (pick = null)}
      ><TokenPicker
        tokens={pickTokens}
        placeholder={t(pick.view === 'send' ? 'ui.walletMain.searchYourTokens' : 'ui.walletMain.searchAnyToken')}
        ownedHeading={t('ui.walletMain.inYourWallet')}
        otherHeading={t(pick.view === 'send' ? 'ui.walletMain.allTokens' : 'ui.walletMain.allSupportedTokens')}
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
            onAction={toast.notice ? undefined : () => {
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
    background: var(--surface-1);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-32) var(--space-24);
  }

  .column {
    width: 100%;
    max-width: 700px;
    display: flex;
    flex-direction: column;
    gap: var(--space-24);
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
    padding: var(--space-32) 0;
    text-align: center;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4);
  }

  .history-note {
    padding: var(--space-8) 0;
  }

  .more-history {
    display: flex;
    justify-content: center;
    padding: var(--space-16) 0;
  }

  .token-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-20, 20px);
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px 22px 20px;
    border-radius: 18px;
    background: var(--overlay-1);
  }

  .hero {
    display: flex;
    align-items: center;
    gap: var(--space-16);
  }

  .hero-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .held-line {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .held {
    min-width: 0;
    font: 700 30px/1.1 var(--font-sans);
    letter-spacing: -0.02em;
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .held-symbol {
    color: var(--ink-4);
  }

  .eye {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .eye:hover {
    background: var(--overlay-2);
  }

  .eye-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-4);
  }

  .veilable {
    filter: none;
    transition: filter var(--duration-base) var(--ease-out);
    user-select: auto;
  }

  .veilable.veiled {
    filter: blur(8px);
    user-select: none;
  }

  .value-line {
    font: var(--weight-medium) 13.5px / 1 var(--font-mono);
    color: var(--ink-2);
  }

  .share {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .share-head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .share-label {
    flex: 1;
    font: var(--weight-medium) 12.5px/1 var(--font-sans);
    color: var(--ink-3);
  }

  .share-value {
    flex: none;
    font: 600 12.5px/1 var(--font-mono);
    color: var(--ink);
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-8);
  }

  .action {
    --action-ink: var(--ink);
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: 46px;
    padding: 0 10px;
    border-radius: var(--radius-md);
    background: var(--overlay-2);
    font: var(--weight-bold) 13.5px / 1 var(--font-sans);
    color: var(--action-ink);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }

  .action:hover {
    filter: brightness(1.1);
  }

  .action.primary {
    --action-ink: var(--on-accent);
    background: var(--accent);
  }

  .action.disabled {
    --action-ink: var(--ink-4);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    cursor: not-allowed;
  }

  .action.disabled:hover {
    filter: none;
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

  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    padding: 24px 0 8px;
    text-align: center;
  }

  .welcome-tile {
    width: 144px;
    height: 144px;
    border-radius: 40px;
    background: var(--accent-soft);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .welcome-icon {
    width: 64px;
    height: 64px;
    background: var(--accent);
    mask: var(--icon-wallet) center/contain no-repeat;
  }

  .welcome-text {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 520px;
  }

  .welcome-title {
    font: 800 26px/1.15 var(--font-sans);
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .welcome-body {
    font: 400 15px/1.55 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .welcome-cards {
    align-self: stretch;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
    margin-top: 18px;
    text-align: start;
  }

  .welcome-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px;
    border-radius: 16px;
    background: var(--overlay-1);
    cursor: pointer;
  }

  .welcome-card:hover {
    background: var(--overlay-2);
  }

  .card-icon {
    width: 20px;
    height: 20px;
    background: var(--ink-2);
  }

  .card-title {
    font: 700 15px/1.2 var(--font-sans);
    color: var(--ink);
  }

  .card-body {
    font: 400 13px/1.45 var(--font-sans);
    color: var(--ink-3);
  }

  .card-link {
    margin-top: 4px;
    font: 700 13.5px/1 var(--font-sans);
    color: var(--accent-bright);
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
    bottom: var(--space-24);
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
