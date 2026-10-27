<!-- Wallet side panel: display currency, ⋯ menu (settings, recipients), balance card with allocation bar, optional
     "All activity" home row, and the token list (sortable by value or name, either direction) with per-token menus.
     `tokens` is the catalogue, held or not: the tokens you own are listed (those under the minimum value folded into one
     "small balances" row), then a folded "Supported tokens" row; with nothing owned, the card is empty and the first few
     supported tokens are listed under "View all". Both emit onAction('browse').
     Menus: right-click opens at the cursor, the kebab anchors under itself, a touch long-press anchors to the row.
     Veil, hidden tokens and settings can be owned by the host (the props) or kept locally (no handler passed). -->
<script lang="ts" module>
  /** The parts of the wallet settings this panel reads. */
  export interface WalletPanelSettings {
    currency?: string;
    /** false = only `tokens` are listed; otherwise holdings worth at least `minBalance` USD, the rest folded into
     *  "small balances" (the minimum never hides a supported token). */
    autoConfig?: boolean;
    minBalance?: string;
    /** The manual list: token ids (`id`, else the symbol). */
    tokens?: string[];
  }
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { MenuItem, WalletToken, WalletTokenAction } from '../../lib/types';
  import BalanceCard from './BalanceCard.svelte';
  import ContextMenu from '../../lib/components/ContextMenu.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import ShareBar from '../../lib/components/ShareBar.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';
  import { getI18n, useT } from '../../lib/i18n';
  import { parseAmount } from '../../lib/amount';
  const i18n = getI18n(); // number formatting follows the host locale

  const mask = (name: string) => `var(--icon-${name}) center/contain no-repeat`;
  const OTHER = 'transparent';
  const UNDO_MS = 6000;
  const DOTS = '••••';
  // display currencies; BTC / ETH / ICP are offered when the host's tokens price them (USD per unit)
  const CURRENCIES = ['USD', 'BTC', 'ETH', 'ICP'];
  const PREFIX: Record<string, string> = { USD: '$', BTC: '₿', ETH: 'Ξ', ICP: '' };

  const num = (v: number, dp: number) => v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  // under a dollar keeps four places; single and double digits keep up to four,
  // trimmed — so ICP reads $5.481 rather than $5.48
  const price = (v: number) => {
    if (v >= 100) return `$${num(v, 2)}`;
    if (v < 1) return `$${num(v, 4)}`;
    return `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };

  type Rect = { left: number; right: number; top: number; bottom: number };

  interface Props {
    tokens: WalletToken[];
    loading?: boolean;
    /** Wallet settings when a host owns them (currency, which tokens are listed). */
    settings?: WalletPanelSettings;
    onSettingsChange?: (settings: WalletPanelSettings) => void;
    /** Hidden tokens (their ids: `id`, else the symbol) when a host owns the list. */
    hidden?: string[];
    onHiddenChange?: (hidden: string[]) => void;
    /** Host-owned removal (and its undo window). */
    onRemoveToken?: (id: string) => void;
    /** The removed token's symbol, for the undo banner. */
    undoSymbol?: string;
    onUndoRemove?: () => void;
    onDismissUndo?: () => void;
    /** Veiled balances when a host owns the veil. */
    balanceHidden?: boolean;
    onBalanceHiddenChange?: (hidden: boolean) => void;
    /** Reload balances (one token by its id, or all when none). The spinner runs until it settles; Refresh is hidden without it. */
    onRefresh?: (id?: string) => Promise<unknown> | void;
    /** "settings", "recipients", "send", "receive", "swap", or "send:<id>" etc. for a token's own menu. */
    onAction?: (kind: string) => void;
    /** A token row picked, by its id (`id`, else the symbol). */
    onToken?: (id: string) => void;
    /** The selected token's id. */
    selectedToken?: string;
    /** USD per unit of each display currency (BTC, ETH, ICP) when the host prices them; otherwise the tokens' own
     *  prices (a token with that symbol) are used. */
    rates?: Partial<Record<string, number>>;
    /** How many tokens the wallet can receive (the deduped catalogue); defaults to `tokens`' length. */
    supportedCount?: number;
    /** The flows the host offers (`onAction('send' | 'receive' | 'swap')`); the balance card's buttons for the others
     *  are left out. All three without it. */
    flows?: ('send' | 'receive' | 'swap')[];
    /** Workspace mode: shows an "All activity" row above the tokens. */
    onHome?: () => void;
    homeSelected?: boolean;
    homeCount?: number;
  }

  let {
    tokens,
    loading = false,
    settings = {},
    onSettingsChange,
    onRefresh,
    hidden: hiddenProp,
    onHiddenChange,
    onRemoveToken,
    undoSymbol: undoProp,
    onUndoRemove,
    onDismissUndo,
    balanceHidden,
    onBalanceHiddenChange,
    onAction,
    onToken,
    selectedToken,
    onHome,
    homeSelected = false,
    homeCount,
    rates: hostRates,
    supportedCount,
    flows = ['send', 'receive', 'swap'],
  }: Props = $props();
  const t = useT();

  let root: HTMLDivElement;
  let localCurrency = $state<string | null>(null);
  let localHidden = $state<string[]>([]);
  let localVeil = $state(false);
  let sort = $state<'value' | 'name'>('value');
  // direction is its own control: it sticks when the sort key changes
  let dir = $state<'asc' | 'desc'>('desc');
  let spinning = $state(false);
  let smallOpen = $state(false);
  let undo = $state<{ symbol: string; hidden: string[] } | null>(null);
  // a token's identity in callbacks, the hidden list and the selection: several ledgers can share a symbol
  const idOf = (tk: WalletToken) => tk.id ?? tk.symbol;
  let menu = $state<{ items: MenuItem[]; key: string | null; point: { x: number; y: number } | null; anchor: Rect | null; align: 'start' | 'end' } | null>(null);

  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let pressStart: { x: number; y: number } | null = null;
  let pressFired = false;
  let touch = false;

  onMount(() => {
    const away = (e: PointerEvent) => {
      if (menu && !root.contains(e.target as Node)) menu = null;
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  });
  onDestroy(() => {
    clearTimeout(undoTimer);
    clearTimeout(pressTimer);
  });

  // display currency lives in wallet settings when a host owns them
  const currency = $derived(localCurrency ?? settings.currency ?? 'USD');
  // a host can own the hidden list (so other surfaces can hide tokens too); otherwise keep it local
  const hidden = $derived(hiddenProp ?? localHidden);
  const veiled = $derived(balanceHidden ?? localVeil);
  const manual = $derived(settings.autoConfig === false);
  const undoSymbol = $derived(undoProp || (undo ? undo.symbol : ''));
  const dirTitle = $derived(
    t(sort === 'name' ? (dir === 'asc' ? 'ui.walletPanel.aToZ' : 'ui.walletPanel.zToA') : dir === 'asc' ? 'ui.walletPanel.smallestFirst' : 'ui.walletPanel.largestFirst'),
  );

  // USD per unit of each display currency, from the tokens' own prices
  const rates = $derived.by(() => {
    const out: Record<string, number> = { USD: 1 };
    for (const c of CURRENCIES.slice(1)) {
      const p = hostRates ? hostRates[c] : tokens.find((tk) => tk.symbol === c)?.price;
      if (p && p > 0) out[c] = p;
    }
    return out;
  });
  const currencies = $derived(CURRENCIES.filter((c) => rates[c]));

  async function refresh(id?: string) {
    if (!onRefresh || spinning) return;
    spinning = true;
    try {
      await onRefresh(id);
    } catch {
      // the balances simply stay as they were; the host reports its own errors
    } finally {
      spinning = false;
    }
  }

  function money(v: number) {
    const rate = rates[currency];
    // a currency the tokens can't price falls back to USD
    if (!rate) return `$${num(v, 2)}`;
    const c = v / rate;
    if (currency === 'USD') return `$${num(c, 2)}`;
    return PREFIX[currency] + num(c, c < 1 ? 4 : 2) + (currency === 'ICP' ? ' ICP' : '');
  }

  // wallet settings decide which tokens exist here at all: either a minimum
  // dollar value (automatic) or an explicit list (manual)
  const floor = $derived(manual ? 0 : parseAmount(settings.minBalance || ''));
  // the tokens you own, not hidden from the list
  const owned = $derived(
    tokens
      .filter((t) => t.held > 0)
      .filter((t) => !hidden.includes(idOf(t)))
      .map((t) => ({ ...t, value: t.price * t.held })),
  );
  const held = $derived.by(() => {
    const allow = manual && settings.tokens ? settings.tokens : null;
    return owned.filter((t) => (allow ? allow.includes(idOf(t)) : t.value >= floor));
  });
  // owned, but under the minimum value: folded into one row instead of disappearing
  const small = $derived(manual ? [] : owned.filter((t) => t.value < floor));
  const smallTotal = $derived(small.reduce((sum, t) => sum + t.value, 0));
  // what's listed counts towards the total, small balances included
  const total = $derived([...held, ...small].reduce((sum, t) => sum + t.value, 0));
  // nothing owned yet: the supported tokens lead, Receive is the primary action
  const empty = $derived(!loading && tokens.every((t) => !(t.held > 0)));
  const supported = $derived(tokens.slice(0, 5));
  const supportedTotal = $derived(supportedCount ?? tokens.length);
  const listed = $derived(
    held.slice().sort((x, y) => (dir === 'asc' ? 1 : -1) * (sort === 'name' ? x.symbol.localeCompare(y.symbol) : x.value - y.value)),
  );

  // four largest holdings get their own segment, everything else pools into one;
  // segments run largest first so the bar reads as a ranking, with the pool last.
  // The pooled remainder reads as an outline so it cannot be mistaken for a token.
  const allocation = $derived.by(() => {
    const byValue = held.slice().sort((x, y) => y.value - x.value);
    const rest = byValue.slice(4);
    type Bucket = { symbol: string; grad: string; value: number; count?: number };
    const lead: Bucket[] = byValue.slice(0, 4);
    const buckets: Bucket[] =
      rest.length === 0
        ? lead
        : lead.concat(rest.length === 1 ? [rest[0]] : [{ symbol: t('ui.walletPanel.other'), grad: OTHER, value: rest.reduce((sum, x) => sum + x.value, 0), count: rest.length }]);
    if (buckets.length < 2) return [];
    return buckets.map((b) => ({
      gradient: b.grad,
      share: b.value / total,
      ring: b.grad === OTHER ? 'inset 0 0 0 1px var(--line-3)' : 'none',
      tipLabel: b.count ? t('ui.walletPanel.smallerHoldings', { count: b.count }) : b.symbol,
      tipValue: veiled ? DOTS : `${money(b.value)} · ${Math.round((b.value / total) * 100)}%`,
    }));
  });

  function setHidden(next: string[]) {
    if (onHiddenChange) onHiddenChange(next);
    else localHidden = next;
  }

  // a host that owns wallet settings also owns the undo window, so the banner
  // can outlive a dialog that closes on removal
  function removeToken(tk: WalletToken) {
    if (onRemoveToken) {
      onRemoveToken(idOf(tk));
      return;
    }
    const snapshot = { symbol: tk.symbol, hidden };
    setHidden([...hidden, idOf(tk)]);
    clearTimeout(undoTimer);
    undo = snapshot;
    undoTimer = setTimeout(() => (undo = null), UNDO_MS);
  }

  function undoRemove() {
    if (onUndoRemove) {
      onUndoRemove();
      return;
    }
    const snapshot = undo;
    clearTimeout(undoTimer);
    undo = null;
    // restore the same way the hide went: through the host when it owns `hidden`
    if (snapshot) setHidden(snapshot.hidden);
  }

  function dismissUndo() {
    if (onDismissUndo) {
      onDismissUndo();
      return;
    }
    clearTimeout(undoTimer);
    undo = null;
  }

  const rectOf = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  };

  // right-click → at the cursor; kebab/currency button → under the trigger; long-press → anchored to the row at the finger
  function openMenu(items: MenuItem[], e: Event | null, key: string | null = null, anchorOverride: Rect | null = null) {
    const atCursor = e?.type === 'contextmenu' && !touch;
    const target = e?.currentTarget as Element | null | undefined;
    menu = {
      items,
      key,
      point: atCursor ? { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY } : null,
      anchor: atCursor ? null : (anchorOverride ?? (target ? rectOf(target) : null)),
      align: anchorOverride ? 'start' : 'end',
    };
  }

  // the token's menu: labels carry its symbol, callbacks its id. A token's `actions` (from the host) decide which
  // items it offers; without them, all of them (Hide in a manual wallet only)
  function tokenItems(tk: WalletToken): MenuItem[] {
    const { symbol } = tk;
    const id = idOf(tk);
    const offers = (a: WalletTokenAction) =>
      (a === 'send' || a === 'receive' || a === 'swap' ? flows.includes(a) : true) && (tk.actions ? tk.actions.includes(a) : a !== 'hide' || manual);
    const items: MenuItem[] = [
      // built when the menu opens, so labels are translated here (they carry the symbol)
      ...(offers('send') ? [{ label: t('ui.walletPanel.send', { symbol }), mask: mask('wallet-send'), onSelect: () => onAction?.(`send:${id}`) }] : []),
      ...(offers('receive') ? [{ label: t('ui.walletPanel.receive', { symbol }), mask: mask('receive'), onSelect: () => onAction?.(`receive:${id}`) }] : []),
      ...(offers('swap') ? [{ label: t('ui.walletPanel.swap', { symbol }), mask: mask('swap'), onSelect: () => onAction?.(`swap:${id}`) }] : []),
      ...(onRefresh && offers('refresh') ? [{ label: t('ui.walletPanel.refresh'), mask: mask('refresh'), onSelect: () => refresh(id) }] : []),
      ...(tk.ledger
        ? [
            { label: '', variant: 'separator' as const },
            { label: t('ui.walletPanel.copyLedgerId'), mask: mask('copy'), onSelect: () => onAction?.(`ledger:${id}`) },
          ]
        : []),
    ];
    if (offers('hide')) items.push({ label: t('ui.walletPanel.hide'), mask: mask('eye-off'), onSelect: () => removeToken(tk) });
    return items;
  }

  function openCurrency(e: Event) {
    openMenu(
      currencies.map((c) => ({
        label: c,
        checkMask: c === currency ? mask('check') : undefined,
        onSelect: () => {
          if (onSettingsChange) onSettingsChange({ ...settings, currency: c });
          else localCurrency = c;
        },
      })),
      e,
    );
  }

  function openPanelMenu(e?: Event) {
    openMenu(
      [
        { label: t('ui.common.settings'), mask: mask('gear'), onSelect: () => onAction?.('settings') },
        { label: t('ui.walletPanel.manageRecipients'), mask: mask('users'), onSelect: () => onAction?.('recipients') },
      ],
      e ?? null,
    );
  }

  function rowContextMenu(e: MouseEvent, tk: WalletToken) {
    e.stopPropagation();
    e.preventDefault();
    if (touch) {
      const row = (e.currentTarget as Element).getBoundingClientRect();
      if (!menu) {
        clearTimeout(pressTimer);
        pressFired = true;
        openMenu(tokenItems(tk), e, idOf(tk), { left: e.clientX, right: e.clientX, top: row.top, bottom: row.bottom });
      }
      return;
    }
    openMenu(tokenItems(tk), e, idOf(tk));
  }

  function rowPointerDown(e: PointerEvent, tk: WalletToken) {
    touch = e.pointerType === 'touch';
    if (!touch) return;
    const x = e.clientX, y = e.clientY, row = (e.currentTarget as Element).getBoundingClientRect();
    pressStart = { x, y };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      pressFired = true;
      openMenu(tokenItems(tk), null, idOf(tk), { left: x, right: x, top: row.top, bottom: row.bottom });
    }, 500);
  }

  function rowPointerMove(e: PointerEvent) {
    if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) {
      clearTimeout(pressTimer);
      pressStart = null;
    }
  }

  function rowPointerUp() {
    clearTimeout(pressTimer);
    pressStart = null;
  }

  function rowKey(e: KeyboardEvent, tk: WalletToken) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter') onToken?.(idOf(tk));
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      openMenu(tokenItems(tk), e, idOf(tk));
    }
  }

  function press(tk: WalletToken) {
    if (pressFired) {
      pressFired = false;
      return;
    }
    onToken?.(idOf(tk));
  }
</script>

<div class="panel" bind:this={root} data-screen-label="Wallet">
  <div class="top">
    <span class="title">{t('ui.walletPanel.title')}</span>
    <span class="currency" onclick={openCurrency} role="button" tabindex="0" aria-label={t('ui.walletPanel.displayCurrency')} title={t('ui.walletPanel.displayCurrency')}>
      <span class="currency-code">{currency}</span>
      <span class="chevron"></span>
    </span>
    <div class="more"><IconButton icon="more" onClick={openPanelMenu} /></div>
  </div>

  <div class="balance">
    <BalanceCard
      label={t('ui.walletPanel.totalBalance')}
      amount={money(total)}
      {veiled}
      {spinning}
      {allocation}
      {empty}
      onToggleVeil={() => (onBalanceHiddenChange ? onBalanceHiddenChange(!veiled) : (localVeil = !veiled))}
      onRefresh={onRefresh ? () => refresh() : undefined}
      onSend={flows.includes('send') ? () => onAction?.('send') : undefined}
      onReceive={flows.includes('receive') ? () => onAction?.('receive') : undefined}
      onSwap={flows.includes('swap') ? () => onAction?.('swap') : undefined}
    />
  </div>

  <div class="tokens">
    {#if onHome && !empty}
      <div class="home" class:on={homeSelected} onclick={onHome} role="button" tabindex="0" aria-current={homeSelected}>
        <span class="home-badge"><span class="home-icon"></span></span>
        <span class="home-label">{t('ui.walletPanel.allActivity')}</span>
        <span class="home-count">{homeCount ?? ''}</span>
      </div>
    {/if}
    {#if empty}
      <div class="list-head">
        <span class="heading">{t('ui.walletPanel.supportedTokens')}</span>
        <span class="view-all" onclick={() => onAction?.('browse')} role="button" tabindex="0">{t('ui.walletPanel.viewAll', { count: supportedTotal })}</span>
      </div>
    {:else}
    <div class="list-head">
      <span class="heading">{t('ui.walletPanel.tokens', { count: listed.length })}</span>
      <span
        class="sort"
        onclick={() => (sort = sort === 'name' ? 'value' : 'name')}
        role="button"
        tabindex="0"
        aria-label={t(sort === 'name' ? 'ui.walletPanel.sortedByName' : 'ui.walletPanel.sortedByValue')}
        title={t(sort === 'name' ? 'ui.walletPanel.sortedByName' : 'ui.walletPanel.sortedByValue')}
      >
        <span class="sort-label">{t(sort === 'name' ? 'ui.walletPanel.name' : 'ui.walletPanel.value')}</span>
        <span class="chevron"></span>
      </span>
      <span class="direction" onclick={() => (dir = dir === 'asc' ? 'desc' : 'asc')} role="button" tabindex="0" aria-label={dirTitle} title={dirTitle}>
        <span class="direction-icon" style:mask={mask(dir === 'asc' ? 'arrow-up' : 'arrow-down')}></span>
      </span>
    </div>
    {/if}

    <div class="scroll">
      {#if loading}<Skeleton variant="token" count={5} />{/if}
      {#each loading ? [] : listed as tk (idOf(tk))}
        {@const share = (tk.value / total) * 100}
        <div
          class="token"
          class:selected={selectedToken === idOf(tk)}
          onclick={() => press(tk)}
          role="button"
          oncontextmenu={(e) => rowContextMenu(e, tk)}
          onpointerdown={(e) => rowPointerDown(e, tk)}
          onpointerup={rowPointerUp}
          onpointercancel={rowPointerUp}
          onpointermove={rowPointerMove}
          onkeydown={(e) => rowKey(e, tk)}
          tabindex="0"
        >
          <TokenAvatar size={40} symbol={tk.symbol} mark={tk.mark} gradient={tk.grad} logo={tk.logo} />
          <div class="token-body">
            <div class="token-line"><span class="symbol">{tk.symbol}</span><span class="value">{veiled ? DOTS : money(tk.value)}</span></div>
            <div class="token-line"
              ><span class="price">{price(tk.price)}</span><span class="holdings">{veiled ? DOTS : num(tk.held, tk.held < 1 ? 4 : tk.held % 1 === 0 ? 0 : 2)}</span></div
            >
            <ShareBar {share} {veiled} gradient={tk.grad} />
          </div>
          <span
            class="kebab"
            onclick={(e) => {
              e.stopPropagation();
              if (menu?.key === idOf(tk)) menu = null;
              else openMenu(tokenItems(tk), e, idOf(tk));
            }}
            role="button"
            tabindex="0"
            aria-label={t('ui.walletPanel.tokenOptions')}
            onpointerdown={(e) => e.stopPropagation()}
            title={t('ui.walletPanel.tokenOptions')}
            aria-haspopup="menu"
          >
            <span class="kebab-icon"></span>
          </span>
        </div>
      {/each}
      {#if empty}
        {#each supported as tk (idOf(tk))}
          <div class="token supported" onclick={() => onToken?.(idOf(tk))} role="button" tabindex="0">
            <TokenAvatar size={40} symbol={tk.symbol} mark={tk.mark} gradient={tk.grad} logo={tk.logo} />
            <div class="token-body">
              <span class="symbol">{tk.symbol}</span>
              <span class="name">{tk.name}</span>
            </div>
            <span class="supported-price">{price(tk.price)}</span>
          </div>
        {/each}
      {/if}
      {#if !loading && small.length > 0}
        <div class="folded" onclick={() => (smallOpen = !smallOpen)} role="button" tabindex="0" aria-expanded={smallOpen}>
          <span class="folded-badge"><span class="folded-icon small-icon"></span></span>
          <span class="folded-text">
            <span class="folded-title">{t('ui.walletPanel.smallBalances', { count: small.length })}</span>
            <span class="folded-sub">{t('ui.walletPanel.smallBalancesSub', { floor: money(floor), total: veiled ? DOTS : money(smallTotal) })}</span>
          </span>
          <span class="folded-chevron" class:open={smallOpen}></span>
        </div>
        {#if smallOpen}
          {#each small as tk (idOf(tk))}
            <div class="token" onclick={() => onToken?.(idOf(tk))} role="button" tabindex="0">
              <TokenAvatar size={40} symbol={tk.symbol} mark={tk.mark} gradient={tk.grad} logo={tk.logo} />
              <div class="token-body">
                <div class="token-line"><span class="symbol">{tk.symbol}</span><span class="small-holdings">{veiled ? DOTS : num(tk.held, tk.held < 1 ? 4 : 2)}</span></div>
                <div class="token-line"><span class="name">{tk.name}</span><span class="small-value">{veiled ? DOTS : money(tk.value)}</span></div>
              </div>
            </div>
          {/each}
        {/if}
      {/if}
      {#if !loading && !empty}
        <div class="folded" onclick={() => onAction?.('browse')} role="button" tabindex="0">
          <span class="folded-badge"><span class="folded-icon search-icon"></span></span>
          <span class="folded-text">
            <span class="folded-title">{t('ui.walletPanel.supportedTokensRow')}</span>
            <span class="folded-sub">{t('ui.walletPanel.canReceive', { count: supportedTotal })}</span>
          </span>
          <span class="folded-chevron forward"></span>
        </div>
      {/if}
    </div>
  </div>

  <div class="undo">
    <UndoToast icon="hide" shown={!!undoSymbol} message={undoSymbol ? t('ui.walletPanel.hidden', { symbol: undoSymbol }) : ''} onAction={undoRemove} onClose={dismissUndo} />
  </div>

  <ContextMenu open={!!menu} items={menu?.items ?? []} point={menu?.point} anchor={menu?.anchor} align={menu?.align} onClose={() => (menu = null)} />
</div>

<style>
  .panel {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    padding: var(--space-10);
    overflow: hidden;
    background: var(--surface-1);
  }

  .top {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: var(--control-md);
    padding: var(--space-10) 0 var(--space-10) var(--space-10);
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink);
  }

  .currency {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: var(--control-md);
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    box-shadow: inset 0 0 0 1px var(--line-2);
    cursor: pointer;
    user-select: none;
  }

  .currency:hover {
    background: var(--overlay-1);
  }

  .currency-code {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-2);
  }

  .chevron {
    width: 11px;
    height: 11px;
    background: var(--ink-4);
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .more {
    flex: none;
    display: flex;
  }

  .balance {
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .tokens {
    flex: 1;
    min-width: 0;
    min-height: 0;
    margin-block-start: var(--space-10);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .home {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    margin: 0 var(--space-2) var(--space-10);
    padding: var(--space-10);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .home.on {
    background: var(--overlay-2);
  }

  .home:hover {
    background: var(--overlay-1);
  }

  .home-badge {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-soft);
  }

  .home-icon {
    width: 16px;
    height: 16px;
    background: var(--accent-bright);
    mask: var(--icon-list) center/contain no-repeat;
  }

  .home-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .home-count {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .list-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-12) 0 var(--space-10);
  }

  .heading {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
  }

  .sort {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    cursor: pointer;
    user-select: none;
  }

  .sort:hover {
    filter: brightness(1.4);
  }

  .sort-label {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .direction {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .direction:hover,
  .kebab:hover {
    background: var(--overlay-2);
  }

  .direction-icon {
    width: 13px;
    height: 13px;
    background: var(--ink-4);
  }

  .scroll {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .token {
    outline-offset: -2px;
    display: flex;
    align-items: center;
    gap: var(--space-14);
    min-width: 0;
    padding: var(--space-14) var(--space-10);
    border-radius: var(--radius-md);
    cursor: pointer;
    background: transparent;
  }

  .token.selected {
    background: var(--overlay-2);
  }

  .view-all {
    flex: none;
    height: 28px;
    margin: -6px -6px -6px 0;
    padding: 0 6px;
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent-bright);
    cursor: pointer;
    user-select: none;
  }

  .view-all:hover {
    background: var(--overlay-1);
  }

  .name {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .supported-price {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-3);
  }

  .small-holdings {
    flex: none;
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-mono);
    color: var(--ink-2);
  }

  .small-value {
    flex: none;
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .folded {
    outline-offset: -2px;
    display: flex;
    align-items: center;
    gap: var(--space-14);
    margin-block-start: var(--space-6);
    padding: var(--space-12) var(--space-10);
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    cursor: pointer;
  }

  .folded:hover {
    background: var(--overlay-2);
  }

  .folded-badge {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--overlay-2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .folded-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-3);
  }

  .small-icon {
    mask: var(--icon-kebab) center/contain no-repeat;
    transform: rotate(90deg);
  }

  .search-icon {
    mask: var(--icon-search) center/contain no-repeat;
  }

  .folded-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .folded-title {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .folded-sub {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-4);
  }

  .folded-chevron {
    flex: none;
    width: 12px;
    height: 12px;
    background: var(--ink-4);
    mask: var(--icon-chevron-down) center/contain no-repeat;
    transition: transform 0.2s;
  }

  .folded-chevron.open {
    transform: rotate(180deg);
  }

  .folded-chevron.forward {
    transform: rotate(-90deg);
  }

  :global([dir='rtl']) .folded-chevron.forward {
    transform: rotate(90deg);
  }

  .token:hover {
    background: var(--overlay-1);
  }

  .token-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .token-line {
    display: flex;
    align-items: baseline;
    gap: var(--space-8);
  }

  .token-line + .token-line {
    align-items: center;
  }

  .symbol {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .value {
    flex: none;
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-mono);
    color: var(--ink);
  }

  .price,
  .holdings {
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .price {
    flex: 1;
    min-width: 0;
  }

  .holdings {
    flex: none;
  }

  .kebab {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
  }

  .kebab-icon {
    width: 14px;
    height: 14px;
    background: var(--ink-3);
    mask: var(--icon-kebab) center/contain no-repeat;
  }

  .undo {
    position: absolute;
    z-index: 50;
    inset-block-end: var(--space-12);
    inset-inline: var(--space-10);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
</style>
