<!-- The wallet's main column: All activity (home), a token page, and in-place Send / Receive / Swap / Recipients.
     The host drives it with `request` ({ view, token, nonce }) from the wallet list on the left and hears back through
     onViewChange. Activity rows come from the host (`activity`); a send lands back on the token page with a toast, and a
     pending row until the host's activity lists it. Saved recipients, swaps, sharing and the QR are all host-provided and
     passed through to the flows. An empty wallet shows All activity only. -->
<script lang="ts" module>
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
  }
</script>

<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
  import { onDestroy, untrack } from 'svelte';
  import type { WalletToken } from '../../lib/types';
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
  import type { Snippet } from 'svelte';
  import WalletReceive, { type ShareChat } from './WalletReceive.svelte';
  import WalletRecipients, { type Recipient, type RecipientDraft } from './WalletRecipients.svelte';
  import WalletSend, { type SendContact, type WalletSendRequest } from './WalletSend.svelte';
  import type { NetworkId } from './WalletReceive.svelte';
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
    /** Make the transfer; reject (e.g. wrong PIN) to keep Send open with an error. */
    onSent?: (x: WalletSendRequest) => Promise<unknown> | void;
    /** Toast "Message" action after sending to a person: open the DM with them. */
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
    /** Swap: DEX names, quote and execution (see WalletSwap). */
    dexes?: string[];
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
    dexes,
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
    const flow = isFlow(r.view);
    if (r.view === 'token' && r.token && isFlow(view)) {
      sym = r.token;
      fromAll = false;
      report();
      return;
    }
    // no token yet (e.g. Send in the summary card): ask which one first
    if ((r.view === 'send' || r.view === 'receive') && !r.token) {
      pick = { view: r.view };
      return;
    }
    const startFromAll = flow && !r.token && view === 'all';
    if (r.token && r.token !== sym) tokFilter = 0;
    view = r.view || 'all';
    sym = r.token || sym;
    fromAll = flow ? startFromAll || !!r.fromAll : false;
    report();
  }

  let lastNonce: number | undefined;
  $effect(() => {
    const r = request;
    if (!r || r.nonce === lastNonce) return;
    lastNonce = r.nonce;
    untrack(() => apply(r));
  });

  function go(next: Partial<{ view: View; sym: string; fromAll: boolean }>) {
    if (next.view) view = next.view;
    if (next.sym) sym = next.sym;
    if (next.fromAll !== undefined) fromAll = next.fromAll;
    report();
  }

  function leaveFlow() {
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

  // a send lands back on the token page with a toast; no done screen.
  // The host makes the transfer first (a rejection propagates back to Send's PIN dialog). If it resolves with the
  // transaction's id, a pending row shows until the host's `activity` lists that id; its status is the host's.
  async function handleSent(x: WalletSendRequest) {
    const res = await onSent?.(x);
    const tid = Date.now();
    const amt = `${num(x.amount, Math.min(x.dp, 8))} ${x.symbol}`;
    view = fromAll || backToAll ? 'all' : 'token';
    fromAll = backToAll = false;
    sym = x.symbol;
    toast = { id: tid, message: t('ui.walletMain.sentToast', { amount: amt, name: x.toLabel }), userId: x.person ? (x.userId ?? null) : null };
    const txId = res && typeof res === 'object' && 'id' in res && typeof res.id === 'string' ? res.id : null;
    if (txId) {
      const now = Date.now();
      sent = [
        { id: txId, symbol: x.symbol, title: t('ui.walletMain.sentTo', { name: x.toLabel }), day: 'today', timestamp: now, sub: t('ui.walletMain.justNow'), kind: 1, amount: `\u2212${amt}`, fiat: usd(x.fiat), fresh: true, status: 'pending' },
        ...sent,
      ];
    }
    report();
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
  const flowKey = $derived(`${view}:${fromAll ? '-' : raw?.symbol}:${flowNonce}`);
  const flowToken = $derived(extTok && view === 'receive' ? extTok : fromAll ? '' : (raw?.symbol ?? ''));
  const showToken = $derived(view === 'token' && !!raw);

  const pickTokens = $derived(
    rows
      .map((tk) => ({ symbol: tk.symbol, name: tk.name, mark: tk.mark, gradient: tk.grad, owned: true, held: `${num(tk.held, tk.dp)} ${tk.symbol}`, note: usd(tk.value) }))
      .concat(pick?.view === 'receive' ? receivable.map((x) => ({ symbol: x.symbol, name: x.name, mark: x.mark, gradient: x.grad, owned: false, held: '', note: '' })) : []),
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
      />{/key}{/if}
  {#if view === 'receive'}{#key flowKey}<WalletReceive {tokens} token={flowToken} {handle} {addresses} {chats} {onShare} {qr} onClose={leaveFlow} />{/key}{/if}
  {#if view === 'swap'}{#key flowKey}<WalletSwap {tokens} token={flowToken} {dexes} {onQuote} {onSwap} onClose={leaveFlow} />{/key}{/if}
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
      <div class="column" class:wide={showToken}>
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
            <div class="side">
              <SideCard gap="var(--space-20,20px)" pad="24px 22px 22px">
                <div class="hero">
                  <TokenAvatar size={52} symbol={raw.symbol} mark={raw.mark} gradient={raw.grad} />
                  <span class="held"><span class="veilable held-num" class:veiled={balanceHidden}>{num(raw.held, raw.dp)}</span> <span class="held-symbol">{raw.symbol}</span></span>
                  <span class="value-line"
                    ><span class="veilable" class:veiled={balanceHidden}>{usd(raw.value)}</span>{#if change !== undefined}<Pill
                        size="md"
                        label={t('ui.walletMain.changeToday', { change: `${change > 0 ? '+' : change < 0 ? '\u2212' : ''}${Math.abs(change).toFixed(1)}%` })}
                        tone={change > 0 ? 'success' : change < 0 ? 'danger' : 'neutral'}
                      />{/if}</span
                  >
                </div>
                <div class="actions">
                  {#each [['ui.walletMain.sendSymbol', 'send', 'wallet-send'], ['ui.walletMain.receiveSymbol', 'receive', 'receive'], ['ui.walletMain.swapSymbol', 'swap', 'swap']] as [label, target, icon], i}
                    <span class="action" class:primary={i === 0} onclick={() => go({ view: target as View, fromAll: false })} role="button" tabindex="0"
                      ><span class="action-icon" style:mask={mask(icon)}></span><span>{t(label, { symbol: raw.symbol })}</span></span
                    >
                  {/each}
                </div>
                <div class="facts">
                  <div class="share">
                    <div class="share-head"><span class="share-label">{t('ui.walletMain.shareOfWallet')}</span><span class="share-value">{balanceHidden ? '••••' : pct(raw.value)}</span></div>
                    <ShareBar share={balanceHidden ? 33 : total ? (raw.value / total) * 100 : 0} gradient={raw.grad} thickness={4} />
                  </div>
                  <DetailRow label={t('ui.walletMain.price')} value={price(raw.price)} size="sm" copyLabel={t('ui.walletMain.copyLedgerId')} />
                  {#if raw.fee !== undefined}<DetailRow label={t('ui.walletMain.transferFee')} value="{num(raw.fee, raw.dp)} {raw.symbol}" size="sm" copyLabel={t('ui.walletMain.copyLedgerId')} />{/if}
                  {#if raw.standard}<DetailRow label={t('ui.walletMain.standard')} value={raw.standard} size="sm" copyLabel={t('ui.walletMain.copyLedgerId')} />{/if}
                  {#if ledger}<DetailRow label={t('ui.walletMain.ledger')} value={`${ledger.slice(0, 5)}\u2026${ledger.slice(-4)}`} size="sm" copyValue={ledger} copyLabel={t('ui.walletMain.copyLedgerId')} />{/if}
                </div>
              </SideCard>
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
              view = 'token';
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
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: var(--space-24, 24px);
  }

  .column.wide {
    max-width: 960px;
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
    flex-wrap: wrap-reverse;
    align-items: flex-end;
    gap: 28px;
  }

  .activity {
    flex: 999 1 360px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-20, 20px);
  }

  .side {
    flex: 1 1 300px;
    min-width: 0;
    position: sticky;
    top: 0;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    text-align: center;
    padding: 4px 0 2px;
  }

  .held {
    margin-top: 4px;
    max-width: 100%;
    font: 700 34px/1.05 var(--font-sans);
    letter-spacing: -0.025em;
    color: var(--ink, #ececf1);
    overflow-wrap: anywhere;
  }

  .held-num {
    display: inline-block;
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
    display: flex;
    align-items: center;
    gap: var(--space-8);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .action {
    --action-ink: var(--ink, #ececf1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 42px;
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-2, rgba(255, 255, 255, 0.06));
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--action-ink);
    cursor: pointer;
    user-select: none;
  }

  .action.primary {
    --action-ink: var(--on-accent, #2e0512);
    background: var(--accent, #ff5672);
  }

  .action-icon {
    width: 15px;
    height: 15px;
    background: var(--action-ink);
  }

  .facts {
    display: flex;
    flex-direction: column;
  }

  .share {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: 4px 0 14px;
  }

  .share-head {
    display: flex;
    align-items: center;
  }

  .share-label {
    flex: 1;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .share-value {
    font: 600 13px/1 var(--font-mono);
    color: var(--ink, #ececf1);
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
