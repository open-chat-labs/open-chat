<!-- The wallet's main column: All activity (home), a token page, and in-place Send / Receive / Swap / Recipients.
     The host drives it with `request` ({ view, token, nonce }) from the wallet list on the left and hears back through
     onViewChange. A send lands back on the token page with a pending row and a toast. An empty wallet shows All activity only. -->
<script lang="ts">
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
  import WalletSend from './WalletSend.svelte';
  import WalletSwap from './WalletSwap.svelte';

  type View = 'all' | 'token' | 'send' | 'receive' | 'swap' | 'recipients';
  type Kind = 'send' | 'receive' | 'swap';

  const mask = (n: string) => `var(--icon-${n}) center/contain no-repeat`;
  const num = (v: number, dp: number) => v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const usd = (v: number) => `$${num(v, 2)}`;
  const price = (v: number) =>
    v >= 100 ? `$${num(v, 2)}` : v < 1 ? `$${num(v, 4)}` : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

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
  const ORDER = ['Today', 'Yesterday', '28 Sep', '21 Sep'];
  const FILTERS = ['All', 'Sent', 'Received', 'Swaps'];

  interface Entry {
    title: string;
    when: string;
    amount: string;
    fiat: string;
    fresh?: boolean;
    status?: 'pending' | 'sent';
  }

  const history = (t: WalletToken, i: number): Entry[] => {
    const q = t.symbol === 'BTC' ? 0.0012 : Math.max(1, Math.round(t.held * 0.08 * 100) / 100);
    return [
      { title: `Received from ${NAMES[i % 4]}`, when: 'Today, 10:42 · in The Awesome Group', sign: '+', k: 1 },
      { title: `Sent to ${NAMES[(i + 1) % 4]}`, when: 'Yesterday, 18:05 · direct chat', sign: '\u2212', k: 0.4 },
      { title: `Swapped to ${t.symbol === 'USDT' ? 'ICP' : 'USDT'}`, when: '28 Sep, 09:12', sign: '\u2212', k: 0.6 },
      { title: `Received from ${NAMES[(i + 2) % 4]}`, when: '21 Sep, 14:30 · #general', sign: '+', k: 2 },
    ]
      .filter((x) => t.symbol !== 'XRP' || x.sign === '+')
      .map((x) => {
        const a = q * x.k;
        return {
          title: x.title,
          when: x.when.replace(/\d\d:\d\d/, (m) => String((+m.slice(0, 2) + i) % 24).padStart(2, '0') + m.slice(2)),
          amount: `${x.sign}${num(a, t.dp)} ${t.symbol}`,
          fiat: usd(a * t.price),
        };
      });
  };
  // 1 sent, 2 received, 3 swapped — the filter tabs' indexes
  const kindOf = (title: string) => (title.startsWith('Received') ? 2 : title.startsWith('Sent') ? 1 : 3);
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
    onSent?: (x: { symbol: string; amount: number; fiat: number; to: string; dp: number; person: boolean }) => void;
    /** Toast "Message" action after sending to a person. */
    onMessage?: (message: string) => void;
  }

  let { tokens, request = null, onViewChange, onCount, balanceHidden = false, handle, onSent, onMessage }: Props = $props();

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
  function handleSent(x: { symbol: string; amount: number; fiat: number; to: string; dp: number; person: boolean }) {
    const id = Date.now();
    const amt = `${num(x.amount, Math.min(x.dp, 8))} ${x.symbol}`;
    view = fromAll || backToAll ? 'all' : 'token';
    fromAll = backToAll = false;
    sym = x.symbol;
    toast = { id, message: `Sent ${amt} to ${x.to}`, person: x.person };
    sent = [{ id, sym: x.symbol, status: 'pending', row: { title: `Sent to ${x.to}`, when: 'Just now', amount: `\u2212${amt}`, fiat: usd(x.fiat) } }, ...sent];
    // the host hears about the send before the view change, as the prototype did
    onSent?.(x);
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
    const list: { sym: string; row: Entry; fresh: boolean }[] = sent.map((e) => ({ sym: e.sym, row: { ...e.row, when: 'Today, just now' }, fresh: true }));
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
    ORDER.map((label) => ({
      label: label.toUpperCase(),
      items: entries
        .filter((e) => !filter || kindOf(e.row.title) === filter)
        .filter((e) => e.row.when.split(',')[0] === label)
        .map((e) => ({ ...e, tk: rows.find((r) => r.symbol === e.sym)! })),
    })).filter((g) => g.items.length),
  );

  // token page: your sends (with status) then sample history, grouped by day, filterable
  const tokGroups = $derived.by(() => {
    if (!raw) return [];
    const mine: Entry[] = sent.filter((e) => e.sym === raw.symbol).map((e) => ({ ...e.row, fresh: true, status: e.status }));
    const shown = mine.concat(history(raw, idx)).filter((x) => !tokFilter || kindOf(x.title) === tokFilter);
    const dayOf = (x: Entry) => {
      const d = String(x.when || '').split(',')[0];
      return ORDER.includes(d) ? d : 'Today';
    };
    return ORDER.map((label) => ({
      label: label.toUpperCase(),
      items: shown
        .filter((x) => dayOf(x) === label)
        .map((x, i) => ({
          ...x,
          divider: i > 0 && !x.fresh,
          kind: KIND[kindOf(x.title)] ?? 'receive',
          sub: x.when.includes(',') ? x.when.split(',').slice(1).join(',').trim() : x.when || 'Just now',
        })),
    })).filter((g) => g.items.length);
  });

  const EMPTY: Record<number, { icon: Kind; title: (s: string) => string; body: (s: string) => string }> = {
    1: { icon: 'send', title: (s) => `No ${s} sent yet`, body: (s) => `${s} you send to people or addresses will show up here.` },
    2: { icon: 'receive', title: (s) => `No ${s} received yet`, body: (s) => `${s} people send you will show up here.` },
    3: { icon: 'swap', title: (s) => `No ${s} swaps yet`, body: (s) => `Swaps from or into ${s} will show up here.` },
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
  {#if view === 'send'}{#key flowKey}<WalletSend {tokens} token={flowToken} address={sendAddr} onClose={leaveFlow} onSent={handleSent} />{/key}{/if}
  {#if view === 'receive'}{#key flowKey}<WalletReceive {tokens} token={flowToken} {handle} onClose={leaveFlow} />{/key}{/if}
  {#if view === 'swap'}{#key flowKey}<WalletSwap {tokens} token={flowToken} onClose={leaveFlow} />{/key}{/if}
  {#if view === 'recipients'}
    <WalletRecipients {tokens} {recipients} onChange={(list) => (recipients = list)} onSend={sendToRecipient} onClose={() => go({ view: 'all' })} />
  {/if}
  {#if view === 'all' || view === 'token'}
    <PageHeader
      title={showToken ? raw.name : 'All activity'}
      onBack={showToken ? () => go({ view: 'all' }) : undefined}
      backLabel="Back to All activity"
      avatarMark={showToken ? raw.mark : ''}
      avatarGradient={raw?.grad}
    />
    <div class="scroll">
      <div class="column" class:wide={showToken}>
        {#if !showToken}
          <div class="tabs"><SegmentedTabs labels={FILTERS} selectedIndex={filter} dotOnLast={false} onSelect={(i) => (filter = i)} /></div>
          {#each allGroups as g}
            <div class="day">
              <ListSectionLabel label={g.label} inset={true} />
              <div class="day-rows">
                {#each g.items as e}
                  {@const k = kindOf(e.row.title)}
                  <TransactionRow
                    hidden={balanceHidden}
                    title={e.row.title}
                    sub="{e.tk.symbol} · {e.row.when.split(',').slice(1).join(',').trim()}"
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
          {#if allGroups.length === 0}<span class="none">No transactions of this type yet.</span>{/if}
        {:else}
          {@const tokenEmpty = EMPTY[tokFilter]}
          <div class="token-page">
            <div class="activity">
              <div class="tabs"><SegmentedTabs labels={FILTERS} selectedIndex={tokFilter} dotOnLast={false} onSelect={(i) => (tokFilter = i)} /></div>
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
                        status={x.status ? (x.status === 'pending' ? 'Pending' : 'Sent') : undefined}
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
                  title={tokenEmpty ? tokenEmpty.title(raw.symbol) : 'No activity yet'}
                  body={tokenEmpty ? tokenEmpty.body(raw.symbol) : `Transactions for ${raw.symbol} will show up here.`}
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
                      label="{change > 0 ? '+' : change < 0 ? '\u2212' : ''}{Math.abs(change).toFixed(1)}% today"
                      tone={change > 0 ? 'success' : change < 0 ? 'danger' : 'neutral'}
                    /></span
                  >
                </div>
                <div class="actions">
                  {#each [['Send', 'send', 'wallet-send'], ['Receive', 'receive', 'receive'], ['Swap', 'swap', 'swap']] as [label, target, icon], i}
                    <span class="action" class:primary={i === 0} onclick={() => go({ view: target as View, fromAll: false })} role="button" tabindex="0"
                      ><span class="action-icon" style:mask={mask(icon)}></span><span>{label} {raw.symbol}</span></span
                    >
                  {/each}
                </div>
                <div class="facts">
                  <div class="share">
                    <div class="share-head"><span class="share-label">Share of wallet</span><span class="share-value">{balanceHidden ? '••••' : pct(raw.value)}</span></div>
                    <ShareBar share={balanceHidden ? 33 : total ? (raw.value / total) * 100 : 0} gradient={raw.grad} thickness={4} />
                  </div>
                  <DetailRow label="Price" value={price(raw.price)} size="sm" copyLabel="Copy ledger ID" />
                  <DetailRow label="Transfer fee" value="{raw.symbol === 'BTC' ? '0.0000001' : '0.0001'} {raw.symbol}" size="sm" copyLabel="Copy ledger ID" />
                  <DetailRow label="Standard" value="ICRC-1" size="sm" copyLabel="Copy ledger ID" />
                  {#if ledger}<DetailRow label="Ledger" value={`${ledger.slice(0, 5)}\u2026${ledger.slice(-4)}`} size="sm" copyValue={ledger} copyLabel="Copy ledger ID" />{/if}
                </div>
              </SideCard>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  {#if pick}
    <DialogShell title={pick.view === 'receive' ? 'Receive which token?' : 'Send which token?'} onClose={() => (pick = null)}
      ><TokenPicker
        tokens={pickTokens}
        placeholder={pick.view === 'receive' ? 'Search any token' : 'Search your tokens'}
        ownedHeading="IN YOUR WALLET"
        otherHeading={pick.view === 'receive' ? 'ALL SUPPORTED TOKENS' : 'ALL TOKENS'}
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
            actionLabel={toast.person ? 'Message' : 'View'}
            onAction={() => {
              const t = toast;
              toast = null;
              view = 'token';
              if (t?.person) onMessage?.(t.message);
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
