// Shared wallet helpers.
import { parseAmount } from './amount';
import type { WalletActivity, WalletPanelSettings, WalletToken } from './types';

/** The transaction id in what a send's host call resolved with ({ id }), or null. WalletSend's receipt and
 *  WalletMain's pending row both read it here, so they agree on which results carry one. */
export function txIdOf(result: unknown): string | null {
  return result && typeof result === 'object' && 'id' in result && typeof result.id === 'string' ? result.id : null;
}

/** Where WalletMain is: its view, and how an open flow was reached. */
export interface WalletPlace {
  view: 'all' | 'token' | 'send' | 'receive' | 'swap' | 'recipients';
  /** The flow was opened from All activity without a token. */
  fromAll: boolean;
  /** The flow goes back to All activity when it ends. */
  backToAll: boolean;
  /** The flow goes back to Recipients when it ends. */
  backToRecipients: boolean;
  /** The token whose page is shown, or '' for none. */
  sym: string;
}

/**
 * Where a flow opened from here goes back to when it ends: Recipients (or a flow opened from it), All activity (or a
 * flow opened from it, however its token was picked, or with no token page to go back to), else the token page.
 */
export function returnPlace(p: WalletPlace): 'recipients' | 'all' | 'token' {
  const flow = p.view === 'send' || p.view === 'receive' || p.view === 'swap';
  if (p.view === 'recipients' || (flow && p.backToRecipients)) return 'recipients';
  if (p.view === 'all' || (flow && (p.fromAll || p.backToAll)) || !p.sym) return 'all';
  return 'token';
}

/**
 * Where a flow opened from here goes back to (the token picker's pick, and a host request for an extra token; a request
 * naming a token from the wallet goes back to that token's page): where the user was when it opened.
 * From Recipients, Recipients; from All activity, All activity. A token with a page of its own (one in the wallet's
 * tokens) goes back to that page, also when it replaces an open flow (a request starts afresh). An extra token (no page)
 * goes back where the user was: the open flow's way back, else the page shown, else All activity.
 */
export function flowReturn(p: WalletPlace, tokenHasPage: boolean): 'recipients' | 'all' | 'token' {
  if (p.view === 'recipients') return 'recipients';
  if (p.view === 'all') return 'all';
  // a token page goes back to itself (with none picked yet, it shows the first token)
  if (tokenHasPage || p.view === 'token') return 'token';
  return returnPlace(p);
}

/** WalletMain's state after a token is picked for a flow in the token picker. */
export interface PickedFlow extends WalletPlace {
  view: 'send' | 'receive';
  /** A receivable token outside the wallet's tokens, received by its symbol; null for one of the wallet's. */
  extTok: string | null;
  /** The Send's address: always cleared, a picked flow starts afresh. */
  sendAddr: '';
}

/**
 * A token picked in the token picker for Send or Receive: the flow opens on it and goes back to where it was opened
 * (flowReturn). One of the wallet's tokens (`inTokens`) becomes the shown token; an extra token is only received, so
 * the page shown stays for Receive to go back to.
 */
export function pickedFlow(p: WalletPlace, picked: { id: string; inTokens: boolean; flow: 'send' | 'receive' }): PickedFlow {
  const back = flowReturn(p, picked.inTokens);
  return {
    view: picked.flow,
    sym: picked.inTokens ? picked.id : p.sym,
    extTok: picked.inTokens ? null : picked.id,
    fromAll: false,
    backToAll: back === 'all',
    backToRecipients: back === 'recipients',
    sendAddr: '',
  };
}

// ---- The wallet's figures: the tokens listed, their total, and the display currency. WalletPanel and WalletMain
// work them out here, and so does the native wallet (the app's src/native), so every wallet shows the same figures.

/** The display currencies, in the order a tap on the native total cycles them; BTC, ETH and ICP only when priced. */
export const WALLET_CURRENCIES = ['USD', 'BTC', 'ETH', 'ICP'];
const CURRENCY_PREFIX: Record<string, string> = { USD: '$', BTC: '₿', ETH: 'Ξ', ICP: '' };

/** The masked figure while balances are hidden. */
export const VEILED = '••••';

const num = (v: number, dp: number, locale: string | undefined) =>
  v.toLocaleString(locale ?? 'en', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** USD per unit of each display currency: the host's rates (BTC, ETH, ICP), else the tokens' own prices (a token
 *  with that symbol). USD is always 1; a currency with no price is left out. */
export function currencyRates(
  tokens: Pick<WalletToken, 'symbol' | 'price'>[],
  hostRates?: Partial<Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = { USD: 1 };
  for (const c of WALLET_CURRENCIES.slice(1)) {
    const p = hostRates ? hostRates[c] : tokens.find((tk) => tk.symbol === c)?.price;
    if (p && p > 0) out[c] = p;
  }
  return out;
}

/** The display currencies the rates price, in order. */
export function displayCurrencies(rates: Record<string, number>): string[] {
  return WALLET_CURRENCIES.filter((c) => rates[c]);
}

/** The currency after `current` (a tap on the native total), round to the first. */
export function nextCurrency(current: string, currencies: string[]): string {
  const at = currencies.indexOf(current);
  return currencies[(at + 1) % currencies.length] ?? 'USD';
}

/** A USD value in the display currency: dollars to the cent, the others to 4 places under 1 (else 2), ICP after the
 *  figure. A currency the rates can't price falls back to USD. */
export function formatMoney(usd: number, currency: string, rates: Record<string, number>, locale?: string): string {
  const rate = rates[currency];
  if (!rate) return `$${num(usd, 2, locale)}`;
  const c = usd / rate;
  if (currency === 'USD') return `$${num(c, 2, locale)}`;
  return (CURRENCY_PREFIX[currency] ?? '') + num(c, c < 1 ? 4 : 2, locale) + (currency === 'ICP' ? ' ICP' : '');
}

/** A token's USD price: 2 places from $100, 4 under a dollar, else up to 4 (ICP reads $5.481 rather than $5.48). */
export function formatPrice(usd: number, locale?: string): string {
  if (usd >= 100) return `$${num(usd, 2, locale)}`;
  if (usd < 1) return `$${num(usd, 4, locale)}`;
  return `$${usd.toLocaleString(locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

/** A token's price in the display currency: formatPrice's places in USD, formatMoney's in the others. */
export function formatUnitPrice(usd: number, currency: string, rates: Record<string, number>, locale?: string): string {
  return currency === 'USD' || !rates[currency] ? formatPrice(usd, locale) : formatMoney(usd, currency, rates, locale);
}

/** A holding as the token lists show it: a whole number bare, 4 places under 1, else 2. */
export function formatHolding(held: number, locale?: string): string {
  return num(held, held < 1 ? 4 : held % 1 === 0 ? 0 : 2, locale);
}

/** A small balance's holding (the folded list): 4 places under 1, else 2. */
export function formatSmallHolding(held: number, locale?: string): string {
  return num(held, held < 1 ? 4 : 2, locale);
}

/** An amount of a token to its own places (a token page's balance). */
export function formatTokenAmount(amount: number, dp: number, locale?: string): string {
  return num(amount, dp, locale);
}

/** A token with what it's worth, in USD. */
export type ValuedToken = WalletToken & { value: number };

/** What the wallet lists: the tokens owned and not hidden; those listed (worth at least the minimum in an automatic
 *  wallet, the chosen ones in a manual one); the small balances folded under them; the total of what's listed. */
export interface WalletHoldings {
  owned: ValuedToken[];
  held: ValuedToken[];
  small: ValuedToken[];
  smallTotal: number;
  total: number;
  /** The minimum value, in USD (0 in a manual wallet). */
  floor: number;
}

/** A token's identity: its `id`, else its symbol (several ledgers can share a symbol). */
export const walletTokenId = (tk: { id?: string; symbol: string }): string => tk.id ?? tk.symbol;

/** The wallet's holdings for its settings and the tokens hidden from its list (their ids). */
export function walletHoldings(tokens: WalletToken[], settings: WalletPanelSettings, hidden: string[] = []): WalletHoldings {
  const manual = settings.autoConfig === false;
  const floor = manual ? 0 : parseAmount(settings.minBalance || '');
  const owned = tokens
    .filter((t) => t.held > 0)
    .filter((t) => !hidden.includes(walletTokenId(t)))
    .map((t) => ({ ...t, value: t.price * t.held }));
  const allow = manual && settings.tokens ? settings.tokens : null;
  const held = owned.filter((t) => (allow ? allow.includes(walletTokenId(t)) : t.value >= floor));
  // owned, but under the minimum value: folded into one row instead of disappearing
  const small = manual ? [] : owned.filter((t) => t.value < floor);
  const smallTotal = small.reduce((sum, t) => sum + t.value, 0);
  // what's listed counts towards the total, small balances included
  const total = [...held, ...small].reduce((sum, t) => sum + t.value, 0);
  return { owned, held, small, smallTotal, total, floor };
}

/** A holding's share of the total, in percent (0 with nothing). */
export function shareOf(value: number, total: number): number {
  return total ? (value / total) * 100 : 0;
}

/** A holding's share as the token page reads it: "62.3%". */
export function formatShare(value: number, total: number): string {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '0%';
}

// ---- A token page's buttons and menu

export type TokenFlow = 'send' | 'receive' | 'swap';

/** The token page's Send / Receive / Swap: in that order with Send primary when it's held; at zero, Receive leads
 *  (primary) and Send and Swap wait for funds (disabled). */
export function tokenPageActions(held: boolean): { target: TokenFlow; primary: boolean; disabled: boolean }[] {
  const all: TokenFlow[] = ['send', 'receive', 'swap'];
  if (held) return all.map((target, i) => ({ target, primary: i === 0, disabled: false }));
  return [
    { target: 'receive', primary: true, disabled: false },
    { target: 'send', primary: false, disabled: true },
    { target: 'swap', primary: false, disabled: true },
  ];
}

/** The flows a token page's menu offers: all three when it's held, Receive alone at zero; those `offers` allows. */
export function tokenMenuFlows(held: boolean, offers: (flow: TokenFlow) => boolean): TokenFlow[] {
  const flows: TokenFlow[] = held ? ['send', 'receive', 'swap'] : ['receive'];
  return flows.filter((f) => offers(f));
}

// ---- Activity: day buckets, signs and the filter tabs

const DAY_MS = 86400000;
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** An activity row's day: 'today', 'yesterday', or its date ("12 Nov") in the locale. */
export function activityDay(ts: number, locale?: string, now: number = Date.now()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
  return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : new Date(ts).toLocaleDateString(locale ?? 'en', { day: 'numeric', month: 'short' });
}

/** An activity row's time ("10:42") in the locale. */
export function activityTime(ts: number, locale?: string): string {
  return new Date(ts).toLocaleTimeString(locale ?? 'en', { hour: '2-digit', minute: '2-digit' });
}

/** Rows in day buckets, in the order the days first appear (the rows newest first). */
export function groupByDay<T extends { day: string }>(list: T[]): { day: string; items: T[] }[] {
  const days: string[] = [];
  for (const e of list) if (!days.includes(e.day)) days.push(e.day);
  return days.map((day) => ({ day, items: list.filter((e) => e.day === day) }));
}

/** A kind of activity's filter tab: 1 sent, 2 received, 3 swapped; 0 between your own wallets (All only). */
export const ACTIVITY_KIND_INDEX: Record<WalletActivity['kind'], 0 | 1 | 2 | 3> = { own: 0, send: 1, receive: 2, swap: 3 };

/** Whether a row shows under a filter tab (0 All, 1 Sent, 2 Received, 3 Swaps). */
export function inActivityFilter(kind: WalletActivity['kind'], filter: number): boolean {
  return !filter || ACTIVITY_KIND_INDEX[kind] === filter;
}

/** An activity row's amount, signed: + received, − sent or swapped, none between your own wallets. */
export function activityAmount(kind: WalletActivity['kind'], amount: number, dp: number, symbol: string, locale?: string): string {
  return `${kind === 'receive' ? '+' : kind === 'own' ? '' : '−'}${num(amount, dp, locale)} ${symbol}`;
}
