<!-- Wallet side panel: display currency, ⋯ menu (settings, recipients), balance card with allocation bar, optional
     "All activity" home row, and the token list (sortable by value or name, either direction) with per-token menus.
     Menus: right-click opens at the cursor, the kebab anchors under itself, a touch long-press anchors to the row.
     Veil, hidden tokens and settings can be owned by the host (the props) or kept locally (no handler passed). -->
<script lang="ts" module>
  /** The parts of the wallet settings this panel reads. */
  export interface WalletPanelSettings {
    currency?: string;
    /** false = only `tokens` are listed; otherwise holdings worth at least `minBalance` USD. */
    autoConfig?: boolean;
    minBalance?: string;
    tokens?: string[];
  }
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { MenuItem, WalletToken } from '../../lib/types';
  import BalanceCard from './BalanceCard.svelte';
  import ContextMenu from '../../lib/components/ContextMenu.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import ShareBar from '../../lib/components/ShareBar.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';
  import { getI18n, useT } from '../../lib/i18n';
  const i18n = getI18n(); // number formatting follows the host locale

  const mask = (name: string) => `var(--icon-${name}) center/contain no-repeat`;
  const OTHER = 'transparent';
  const UNDO_MS = 6000;
  const DOTS = '••••';
  const CURRENCIES = ['USD', 'BTC', 'ETH', 'ICP'];
  const RATES: Record<string, number> = { USD: 1, BTC: 103819.98, ETH: 2622.86, ICP: 5.481 };
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
    /** Hidden token symbols when a host owns the list. */
    hidden?: string[];
    onHiddenChange?: (hidden: string[]) => void;
    /** Host-owned removal (and its undo window). */
    onRemoveToken?: (symbol: string) => void;
    undoSymbol?: string;
    onUndoRemove?: () => void;
    onDismissUndo?: () => void;
    /** Veiled balances when a host owns the veil. */
    balanceHidden?: boolean;
    onBalanceHiddenChange?: (hidden: boolean) => void;
    /** "settings", "recipients", "send", "receive", "swap", or "send:ICP" etc. for a token's own menu. */
    onAction?: (kind: string) => void;
    onToken?: (symbol: string) => void;
    selectedToken?: string;
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
  let undo = $state<{ symbol: string; hidden: string[] } | null>(null);
  let menu = $state<{ items: MenuItem[]; key: string | null; point: { x: number; y: number } | null; anchor: Rect | null; align: 'start' | 'end' } | null>(null);

  let spinTimer: ReturnType<typeof setTimeout> | undefined;
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
    clearTimeout(spinTimer);
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

  function money(v: number) {
    const c = v / RATES[currency];
    if (currency === 'USD') return `$${num(c, 2)}`;
    return PREFIX[currency] + num(c, c < 1 ? 4 : 2) + (currency === 'ICP' ? ' ICP' : '');
  }

  // wallet settings decide which tokens exist here at all: either a minimum
  // dollar value (automatic) or an explicit list (manual)
  const held = $derived.by(() => {
    const floor = manual ? 0 : parseFloat(settings.minBalance || '0') || 0;
    const allow = manual && settings.tokens ? settings.tokens : null;
    return tokens
      .filter((t) => t.held > 0)
      .filter((t) => !hidden.includes(t.symbol))
      .filter((t) => (allow ? allow.includes(t.symbol) : t.price * t.held >= floor))
      .map((t) => ({ ...t, value: t.price * t.held }));
  });
  const total = $derived(held.reduce((sum, t) => sum + t.value, 0));
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
      ring: b.grad === OTHER ? 'inset 0 0 0 1px var(--line-3,rgba(255,255,255,.24))' : 'none',
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
  function removeToken(symbol: string) {
    if (onRemoveToken) {
      onRemoveToken(symbol);
      return;
    }
    const snapshot = { symbol, hidden };
    setHidden([...hidden, symbol]);
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
    if (snapshot) localHidden = snapshot.hidden;
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

  function tokenItems(symbol: string): MenuItem[] {
    const items: MenuItem[] = [
      // built when the menu opens, so labels are translated here (they carry the symbol)
      { label: t('ui.walletPanel.send', { symbol }), mask: mask('wallet-send'), onSelect: () => onAction?.(`send:${symbol}`) },
      { label: t('ui.walletPanel.receive', { symbol }), mask: mask('receive'), onSelect: () => onAction?.(`receive:${symbol}`) },
      { label: t('ui.walletPanel.swap', { symbol }), mask: mask('swap'), onSelect: () => onAction?.(`swap:${symbol}`) },
      { label: t('ui.walletPanel.refresh'), mask: mask('refresh') },
    ];
    if (manual) items.push({ label: t('ui.walletPanel.hide'), mask: mask('eye-off'), onSelect: () => removeToken(symbol) });
    return items;
  }

  function openCurrency(e: Event) {
    openMenu(
      CURRENCIES.map((c) => ({
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

  function rowContextMenu(e: MouseEvent, symbol: string) {
    e.stopPropagation();
    e.preventDefault();
    if (touch) {
      const row = (e.currentTarget as Element).getBoundingClientRect();
      if (!menu) {
        clearTimeout(pressTimer);
        pressFired = true;
        openMenu(tokenItems(symbol), e, symbol, { left: e.clientX, right: e.clientX, top: row.top, bottom: row.bottom });
      }
      return;
    }
    openMenu(tokenItems(symbol), e, symbol);
  }

  function rowPointerDown(e: PointerEvent, symbol: string) {
    touch = e.pointerType === 'touch';
    if (!touch) return;
    const x = e.clientX, y = e.clientY, row = (e.currentTarget as Element).getBoundingClientRect();
    pressStart = { x, y };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      pressFired = true;
      openMenu(tokenItems(symbol), null, symbol, { left: x, right: x, top: row.top, bottom: row.bottom });
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

  function rowKey(e: KeyboardEvent, symbol: string) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter') onToken?.(symbol);
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      openMenu(tokenItems(symbol), e, symbol);
    }
  }

  function press(symbol: string) {
    if (pressFired) {
      pressFired = false;
      return;
    }
    onToken?.(symbol);
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
      onToggleVeil={() => (onBalanceHiddenChange ? onBalanceHiddenChange(!veiled) : (localVeil = !veiled))}
      onRefresh={() => {
        spinning = true;
        spinTimer = setTimeout(() => (spinning = false), 720);
      }}
      onSend={() => onAction?.('send')}
      onReceive={() => onAction?.('receive')}
      onSwap={() => onAction?.('swap')}
    />
  </div>

  <div class="tokens">
    {#if onHome}
      <div class="home" class:on={homeSelected} onclick={onHome} role="button" tabindex="0" aria-current={homeSelected}>
        <span class="home-badge"><span class="home-icon"></span></span>
        <span class="home-label">{t('ui.walletPanel.allActivity')}</span>
        <span class="home-count">{homeCount ?? ''}</span>
      </div>
    {/if}
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

    <div class="scroll">
      {#if loading}<Skeleton variant="token" count={5} />{/if}
      {#each loading ? [] : listed as tk (tk.symbol)}
        {@const share = (tk.value / total) * 100}
        <div
          class="token"
          class:selected={selectedToken === tk.symbol}
          onclick={() => press(tk.symbol)}
          role="button"
          oncontextmenu={(e) => rowContextMenu(e, tk.symbol)}
          onpointerdown={(e) => rowPointerDown(e, tk.symbol)}
          onpointerup={rowPointerUp}
          onpointercancel={rowPointerUp}
          onpointermove={rowPointerMove}
          onkeydown={(e) => rowKey(e, tk.symbol)}
          tabindex="0"
        >
          <TokenAvatar size={40} symbol={tk.symbol} mark={tk.mark} gradient={tk.grad} />
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
              if (menu?.key === tk.symbol) menu = null;
              else openMenu(tokenItems(tk.symbol), e, tk.symbol);
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
    background: var(--surface-1, #0e0e12);
  }

  .top {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: var(--control-md, 34px);
    padding: var(--space-10) 0 var(--space-10) var(--space-10);
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
  }

  .currency {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: var(--control-md, 34px);
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    cursor: pointer;
    user-select: none;
  }

  .currency:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .currency-code {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-2, #c9c9d4);
  }

  .chevron {
    width: 11px;
    height: 11px;
    background: var(--ink-4, #7c7c8c);
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
    margin: 0 var(--space-2, 2px) var(--space-10);
    padding: var(--space-10);
    border-radius: var(--radius-md, 12px);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .home.on {
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .home:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .home-badge {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
  }

  .home-icon {
    width: 16px;
    height: 16px;
    background: var(--accent-bright, #ff8298);
    mask: var(--icon-list) center/contain no-repeat;
  }

  .home-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .home-count {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
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
    color: var(--ink-4, #7c7c8c);
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
    color: var(--ink-4, #7c7c8c);
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
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .direction-icon {
    width: 13px;
    height: 13px;
    background: var(--ink-4, #7c7c8c);
  }

  .scroll {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-8, 8px);
  }

  .token {
    outline-offset: -2px;
    display: flex;
    align-items: center;
    gap: var(--space-14, 14px);
    min-width: 0;
    padding: var(--space-14, 14px) var(--space-10);
    border-radius: var(--radius-md);
    cursor: pointer;
    background: transparent;
  }

  .token.selected {
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .token:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
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
    color: var(--ink, #ececf1);
  }

  .value {
    flex: none;
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-mono);
    color: var(--ink, #ececf1);
  }

  .price,
  .holdings {
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
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
    background: var(--ink-3, #9a9aa8);
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
