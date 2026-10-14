<!-- The wallet's main column: All activity (home), a token page, and in-place Send / Receive / Swap / Recipients.
     The host drives it with `request` ({ view, token, nonce }) from the wallet list on the left and hears back through
     onViewChange. A send lands back on the token page with a pending row and a toast. An empty wallet shows All activity only. -->
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
  import WalletReceive from './WalletReceive.svelte';
  import WalletRecipients, { type Recipient } from './WalletRecipients.svelte';
  import WalletSend, { type SendContact, type WalletSendRequest } from './WalletSend.svelte';
  import type { NetworkId } from './WalletReceive.svelte';
  import WalletSwap from './WalletSwap.svelte';
  const i18n = getI18n(); // number formatting follows the host locale

  type View = 'all' | 'token' | 'send' | 'receive' | 'swap' | 'recipients';
  type Kind = 'send' | 'receive' | 'swap';

  const mask = (n: string) => `var(--icon-${n}) center/contain no-repeat`;
  const num = (v: number, dp: number) => v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const usd = (v: number) => `$${num(v, 2)}`;
  const price = (v: number) =>
    v >= 100 ? `$${num(v, 2)}` : v < 1 ? `$${num(v, 4)}` : `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

  // sample counterparties, history and ledger ids until the ledger index is wired
  const NAMES = ['Lucy Linden', 'Matt Rivers', 'Ana Ferreira', 'Ryan Rogers'];
  // tokens you can receive without holding them yet
  const RECEIVABLE: [string, string, string, string][] = [
    ['ckBTC', 'Chain-key Bitcoin', '\u20BF', 'linear-gradient(140deg,#F9C97E,#E07A2F)'],
    ['USDC', 'USD Coin', '$', 'linear-gradient(140deg,#7EB7FF,#2775CA)'],
    ['SOL', 'Solana', 'S', 'linear-gradient(140deg,#9CE7C8,#7B5BFF)'],
    ['LINK', 'Chainlink', 'L', 'linear-gradient(140deg,#8CB4FF,#2A5ADA)'],
    ['MATIC', 'Polygon', 'M', 'linear-gradient(140deg,#C9A8FF,#7B3FE4)'],
    ['AVAX', 'Avalanche', 'A', 'linear-gradient(140deg,#FF9A8B,#E84142)'],
    ['DOT', 'Polkadot', '\u2022', 'linear-gradient(140deg,#FF9AD1,#E6007A)'],
    ['DOGE', 'Dogecoin', 'D', 'linear-gradient(140deg,#F2D48A,#C2A633)'],
    ['SNS1', 'SNS-1', '1', 'linear-gradient(140deg,#9AE6FF,#3B82F6)'],
    ['KINIC', 'Kinic', 'K', 'linear-gradient(140deg,#FFC58A,#FF7A45)'],
  ];
  const LEDGER: Record<string, string> = {
    BTC: 'mxzaz-hqaaa-aaaar-qaada-cai',
    CHAT: '2ouva-viaaa-aaaaq-aaamq-cai',
    ETH: 'ss2fx-dyaaa-aaaar-qacoq-cai',
    ICP: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
    USDT: 'cngnf-vqaaa-aaaar-qag4q-cai',
    XRP: 'c6mxe-uqaaa-aaaar-qagnq-cai',
  };
  // sample history days: today / yesterday are copy, the two older days are sample dates
  type Day = 'today' | 'yesterday' | '28 Sep' | '21 Sep';
  const ORDER: Day[] = ['today', 'yesterday', '28 Sep', '21 Sep'];
  const FILTERS = ['ui.walletMain.filterAll', 'ui.walletMain.filterSent', 'ui.walletMain.filterReceived', 'ui.walletMain.filterSwaps'];

  interface Entry {
    title: string;
    day: Day;
    /** Time and context under the title ("10:42 · direct chat"). */
    sub: string;
    /** 1 sent, 2 received, 3 swapped — the filter tabs' indexes. */
    kind: 1 | 2 | 3;
    amount: string;
    fiat: string;
    fresh?: boolean;
    status?: 'pending' | 'sent';
  }

  const history = (tok: WalletToken, i: number): Entry[] => {
    const q = tok.symbol === 'BTC' ? 0.0012 : Math.max(1, Math.round(tok.held * 0.08 * 100) / 100);
    const rows: { title: string; day: Day; time: string; where: string; kind: Entry['kind']; sign: string; k: number }[] = [
      { title: t('ui.walletMain.receivedFrom', { name: NAMES[i % 4] }), day: 'today', time: '10:42', where: t('ui.walletMain.inChat', { name: 'The Awesome Group' }), kind: 2, sign: '+', k: 1 },
      { title: t('ui.walletMain.sentTo', { name: NAMES[(i + 1) % 4] }), day: 'yesterday', time: '18:05', where: t('ui.walletMain.directChat'), kind: 1, sign: '\u2212', k: 0.4 },
      { title: t('ui.walletMain.swappedTo', { symbol: tok.symbol === 'USDT' ? 'ICP' : 'USDT' }), day: '28 Sep', time: '09:12', where: '', kind: 3, sign: '\u2212', k: 0.6 },
      { title: t('ui.walletMain.receivedFrom', { name: NAMES[(i + 2) % 4] }), day: '21 Sep', time: '14:30', where: '#general', kind: 2, sign: '+', k: 2 },
    ];
    return rows
      .filter((x) => tok.symbol !== 'XRP' || x.sign === '+')
      .map((x) => {
        const a = q * x.k;
        const time = String((+x.time.slice(0, 2) + i) % 24).padStart(2, '0') + x.time.slice(2);
        return {
          title: x.title,
          day: x.day,
          sub: [time, x.where].filter(Boolean).join(' · '),
          kind: x.kind,
          amount: `${x.sign}${num(a, tok.dp)} ${tok.symbol}`,
          fiat: usd(a * tok.price),
        };
      });
  };
  const dayLabel = (d: Day) => (d === 'today' ? t('ui.walletMain.today') : d === 'yesterday' ? t('ui.walletMain.yesterday') : d).toUpperCase();
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
    /** Toast "Message" action after sending to a person. */
    onMessage?: (message: string) => void;
  }

  let { tokens, request = null, onViewChange, onCount, balanceHidden = false, handle, addresses, contacts, onPickSaved, onScanQr, onSent, onMessage }: Props = $props();
  const t = useT();

  let view = $state<View>('all');
  let sym = $state('CHAT');
  let fromAll = $state(false);
  let backToAll = $state(false);
  let backToRecipients = $state(false);
  let sendAddr = $state('');
  let extTok = $state<string | null>(null);
  let flowNonce = $state(0);
  let filter = $state(0);
  let tokFilter = $state(0);
  let pick = $state<{ view: 'send' | 'receive' } | null>(null);
  let recipients = $state<Recipient[]>([]);
  let sent = $state<{ id: number; sym: string; status: 'pending' | 'sent'; row: Entry }[]>([]);
  let toast = $state<{ id: number; message: string; person: boolean } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const statusTimers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => {
    clearTimeout(toastTimer);
    statusTimers.forEach(clearTimeout);
  });

  const isFlow = (v: View) => v === 'send' || v === 'swap' || v === 'receive';

  const rows = $derived(tokens.filter((t) => t.held > 0).map((t) => ({ ...t, value: t.price * t.held })));
  const total = $derived(rows.reduce((n, t) => n + t.value, 0));
  const raw = $derived(rows.find((t) => t.symbol === sym) ?? rows[0]);
  const idx = $derived(raw ? rows.indexOf(raw) : 0);
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

  // a send lands back on the token page: pending row at the top of Activity + a toast; no done screen
  // the host makes the transfer first; if it rejects, the error propagates back to Send's PIN dialog
  async function handleSent(x: WalletSendRequest) {
    await onSent?.(x);
    const id = Date.now();
    const amt = `${num(x.amount, Math.min(x.dp, 8))} ${x.symbol}`;
    view = fromAll || backToAll ? 'all' : 'token';
    fromAll = backToAll = false;
    sym = x.symbol;
    toast = { id, message: t('ui.walletMain.sentToast', { amount: amt, name: x.toLabel }), person: x.person };
    sent = [{ id, sym: x.symbol, status: 'pending', row: { title: t('ui.walletMain.sentTo', { name: x.toLabel }), day: 'today', sub: t('ui.walletMain.justNow'), kind: 1, amount: `\u2212${amt}`, fiat: usd(x.fiat) } }, ...sent];
    report();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast?.id === id) toast = null;
    }, 6000);
    statusTimers.push(
      setTimeout(
        () => {
          sent = sent.map((e) => (e.id === id ? { ...e, status: 'sent' } : e));
        },
        x.symbol === 'BTC' ? 8000 : 2500,
      ),
    );
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

  // All activity: your sends first, then two sample entries per token
  const entries = $derived.by(() => {
    const list: { sym: string; row: Entry; fresh: boolean }[] = sent.map((e) => ({ sym: e.sym, row: { ...e.row, sub: t('ui.walletMain.justNowInline') }, fresh: true }));
    rows.forEach((tk, i) => {
      const h = history(tk, i);
      [i % 4, (i + 1) % 4].forEach((a) => {
        if (h[a]) list.push({ sym: tk.symbol, row: h[a], fresh: false });
      });
    });
    return list;
  });

  let lastCount: number | undefined;
  $effect(() => {
    const count = entries.length;
    if (count === lastCount) return;
    lastCount = count;
    untrack(() => setTimeout(() => onCount?.(count)));
  });

  const allGroups = $derived(
    ORDER.map((day) => ({
      label: dayLabel(day),
      items: entries
        .filter((e) => !filter || e.row.kind === filter)
        .filter((e) => e.row.day === day)
        .map((e) => ({ ...e, tk: rows.find((r) => r.symbol === e.sym)! })),
    })).filter((g) => g.items.length),
  );

  // token page: your sends (with status) then sample history, grouped by day, filterable
  const tokGroups = $derived.by(() => {
    if (!raw) return [];
    const mine: Entry[] = sent.filter((e) => e.sym === raw.symbol).map((e) => ({ ...e.row, fresh: true, status: e.status }));
    const shown = mine.concat(history(raw, idx)).filter((x) => !tokFilter || x.kind === tokFilter);
    return ORDER.map((day) => ({
      label: dayLabel(day),
      items: shown
        .filter((x) => x.day === day)
        .map((x, i) => ({
          ...x,
          divider: i > 0 && !x.fresh,
          kind: KIND[x.kind] ?? 'receive',
          sub: x.sub || t('ui.walletMain.justNow'),
        })),
    })).filter((g) => g.items.length);
  });

  // empty token history per filter tab: keys take { symbol }
  const EMPTY: Record<number, { icon: Kind; title: string; body: string }> = {
    1: { icon: 'send', title: 'ui.walletMain.emptySentTitle', body: 'ui.walletMain.emptySentBody' },
    2: { icon: 'receive', title: 'ui.walletMain.emptyReceivedTitle', body: 'ui.walletMain.emptyReceivedBody' },
    3: { icon: 'swap', title: 'ui.walletMain.emptySwapsTitle', body: 'ui.walletMain.emptySwapsBody' },
  };

  const change = $derived([2.4, -0.8, 1.1, 3.2, 0.0, -1.6][idx % 6]);
  const ledger = $derived(raw ? LEDGER[raw.symbol] : undefined);
  const flowKey = $derived(`${view}:${fromAll ? '-' : raw?.symbol}:${flowNonce}`);
  const flowToken = $derived(extTok && view === 'receive' ? extTok : fromAll ? '' : (raw?.symbol ?? ''));
  const showToken = $derived(view === 'token' && !!raw);

  const pickTokens = $derived(
    rows
      .map((tk) => ({ symbol: tk.symbol, name: tk.name, mark: tk.mark, gradient: tk.grad, owned: true, held: `${num(tk.held, tk.dp)} ${tk.symbol}`, note: usd(tk.value) }))
      .concat(pick?.view === 'receive' ? RECEIVABLE.map((x) => ({ symbol: x[0], name: x[1], mark: x[2], gradient: x[3], owned: false, held: '', note: '' })) : []),
  );
</script>

<div class="main" data-screen-label="Wallet main">
  {#if view === 'send'}{#key flowKey}<WalletSend {tokens} token={flowToken} address={sendAddr} {contacts} {onPickSaved} {onScanQr} onClose={leaveFlow} onSent={handleSent} />{/key}{/if}
  {#if view === 'receive'}{#key flowKey}<WalletReceive {tokens} token={flowToken} {handle} {addresses} onClose={leaveFlow} />{/key}{/if}
  {#if view === 'swap'}{#key flowKey}<WalletSwap {tokens} token={flowToken} onClose={leaveFlow} />{/key}{/if}
  {#if view === 'recipients'}
    <WalletRecipients {tokens} {recipients} onChange={(list) => (recipients = list)} onSend={sendToRecipient} onClose={() => go({ view: 'all' })} />
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
                  {@const k = e.row.kind}
                  <TransactionRow
                    hidden={balanceHidden}
                    title={e.row.title}
                    sub="{e.tk.symbol} · {e.row.sub}"
                    amount={e.row.amount}
                    fiat={e.row.fiat}
                    kind={k === 2 ? 'receive' : k === 1 ? 'send' : 'swap'}
                    symbol={e.tk.symbol}
                    mark={e.tk.mark}
                    gradient={e.tk.grad}
                    fresh={e.fresh}
                    onClick={() => go({ view: 'token', sym: e.sym })}
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
                        kind={x.kind}
                        status={x.status ? t(x.status === 'pending' ? 'ui.walletMain.statusPending' : 'ui.walletMain.statusSent') : undefined}
                        statusTone={x.status === 'pending' ? 'warning' : 'success'}
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
                    ><span class="veilable" class:veiled={balanceHidden}>{usd(raw.value)}</span><Pill
                      size="md"
                      label={t('ui.walletMain.changeToday', { change: `${change > 0 ? '+' : change < 0 ? '\u2212' : ''}${Math.abs(change).toFixed(1)}%` })}
                      tone={change > 0 ? 'success' : change < 0 ? 'danger' : 'neutral'}
                    /></span
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
                  <DetailRow label={t('ui.walletMain.transferFee')} value="{raw.symbol === 'BTC' ? '0.0000001' : '0.0001'} {raw.symbol}" size="sm" copyLabel={t('ui.walletMain.copyLedgerId')} />
                  <DetailRow label={t('ui.walletMain.standard')} value="ICRC-1" size="sm" copyLabel={t('ui.walletMain.copyLedgerId')} />
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
            actionLabel={t(toast.person ? 'ui.walletMain.message' : 'ui.walletMain.view')}
            onAction={() => {
              const done = toast;
              toast = null;
              view = 'token';
              if (done?.person) onMessage?.(done.message);
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
