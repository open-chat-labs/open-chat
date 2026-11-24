import { describe, expect, test } from 'vitest';
import {
  activityAmount,
  activityDay,
  currencyRates,
  displayCurrencies,
  flowReturn,
  formatHolding,
  formatMoney,
  formatPrice,
  formatShare,
  formatUnitPrice,
  groupByDay,
  inActivityFilter,
  nextCurrency,
  pickedFlow,
  returnPlace,
  tokenMenuFlows,
  tokenPageActions,
  walletHoldings,
  type WalletPlace,
} from './wallet';
import type { WalletToken } from './types';

const tok = (symbol: string, held: number, price: number): WalletToken => ({ id: symbol.toLowerCase(), symbol, name: symbol, mark: symbol[0], grad: 'g', held, price, dp: 4 });

describe('the display currency', () => {
  test("the host's rates, else the tokens' own prices; USD always", () => {
    expect(currencyRates([tok('ICP', 1, 5)])).toEqual({ USD: 1, ICP: 5 });
    expect(currencyRates([tok('ICP', 1, 5)], { BTC: 80_000 })).toEqual({ USD: 1, BTC: 80_000 });
  });

  test('the currencies priced, in order, and the next one round to the first', () => {
    const currencies = displayCurrencies({ USD: 1, ICP: 5, BTC: 80_000 });
    expect(currencies).toEqual(['USD', 'BTC', 'ICP']);
    expect(nextCurrency('ICP', currencies)).toBe('USD');
    expect(nextCurrency('ETH', currencies)).toBe('USD');
  });

  test('money: dollars to the cent, the others to 4 places under 1, ICP after; unpriced falls back to USD', () => {
    const rates = { USD: 1, ICP: 5, BTC: 80_000 };
    expect(formatMoney(1234.5, 'USD', rates)).toBe('$1,234.50');
    expect(formatMoney(50, 'ICP', rates)).toBe('10.00 ICP');
    expect(formatMoney(400, 'BTC', rates)).toBe('₿0.0050');
    expect(formatMoney(5, 'ETH', rates)).toBe('$5.00');
  });

  test('prices: 2 places from $100, 4 under $1, up to 4 between; in another currency, as money', () => {
    expect(formatPrice(120)).toBe('$120.00');
    expect(formatPrice(0.25)).toBe('$0.2500');
    expect(formatPrice(5.481)).toBe('$5.481');
    expect(formatUnitPrice(5, 'ICP', { USD: 1, ICP: 5 })).toBe('1.00 ICP');
    expect(formatUnitPrice(5, 'USD', { USD: 1 })).toBe('$5.00');
  });

  test('holdings: whole numbers bare, 4 places under 1, else 2', () => {
    expect(formatHolding(10)).toBe('10');
    expect(formatHolding(0.5)).toBe('0.5000');
    expect(formatHolding(1.5)).toBe('1.50');
  });
});

describe("the wallet's holdings", () => {
  const tokens = [tok('ICP', 10, 5), tok('CHAT', 100, 0.2), tok('GHOST', 5, 0.1), tok('BTC', 0, 80_000)];

  test('automatic: those worth the minimum listed, the rest folded into small balances, all counted', () => {
    const h = walletHoldings(tokens, { autoConfig: true, minBalance: '1' });
    expect(h.held.map((t) => t.symbol)).toEqual(['ICP', 'CHAT']);
    expect(h.small.map((t) => t.symbol)).toEqual(['GHOST']);
    expect(h.smallTotal).toBeCloseTo(0.5);
    expect(h.total).toBeCloseTo(70.5);
    expect(h.floor).toBe(1);
  });

  test('manual: only the chosen tokens, no small balances', () => {
    const h = walletHoldings(tokens, { autoConfig: false, tokens: ['chat'] });
    expect(h.held.map((t) => t.symbol)).toEqual(['CHAT']);
    expect(h.small).toEqual([]);
    expect(h.total).toBeCloseTo(20);
  });

  test('hidden tokens are left out', () => {
    expect(walletHoldings(tokens, {}, ['icp']).held.map((t) => t.symbol)).toEqual(['CHAT', 'GHOST']);
  });

  test('a share as the token page reads it', () => {
    expect(formatShare(25, 100)).toBe('25.0%');
    expect(formatShare(1, 0)).toBe('0%');
  });
});

describe("a token page's buttons and menu", () => {
  test('held: Send leads; at zero Receive leads and the others wait', () => {
    expect(tokenPageActions(true).map((a) => [a.target, a.primary, a.disabled])).toEqual([
      ['send', true, false],
      ['receive', false, false],
      ['swap', false, false],
    ]);
    expect(tokenPageActions(false).map((a) => [a.target, a.primary, a.disabled])).toEqual([
      ['receive', true, false],
      ['send', false, true],
      ['swap', false, true],
    ]);
  });

  test("the menu: all three when held, Receive at zero, those offered", () => {
    expect(tokenMenuFlows(true, (f) => f !== 'swap')).toEqual(['send', 'receive']);
    expect(tokenMenuFlows(false, () => true)).toEqual(['receive']);
  });
});

describe('activity', () => {
  const now = new Date(2026, 10, 23, 12).getTime();

  test('days: today, yesterday, else the date', () => {
    expect(activityDay(now - 1000, 'en', now)).toBe('today');
    expect(activityDay(now - 86_400_000, 'en', now)).toBe('yesterday');
    expect(activityDay(new Date(2026, 10, 12, 9).getTime(), 'en', now)).toBe('Nov 12');
  });

  test('day buckets in the order they first appear', () => {
    const groups = groupByDay([{ day: 'today', n: 1 }, { day: 'x', n: 2 }, { day: 'today', n: 3 }]);
    expect(groups.map((g) => [g.day, g.items.map((i) => i.n)])).toEqual([
      ['today', [1, 3]],
      ['x', [2]],
    ]);
  });

  test('signs and the filter tabs', () => {
    expect(activityAmount('receive', 2, 2, 'ICP')).toBe('+2.00 ICP');
    expect(activityAmount('send', 2, 2, 'ICP')).toBe('−2.00 ICP');
    expect(activityAmount('own', 2, 2, 'ICP')).toBe('2.00 ICP');
    expect(inActivityFilter('own', 0)).toBe(true);
    expect(inActivityFilter('own', 1)).toBe(false);
    expect(inActivityFilter('receive', 2)).toBe(true);
  });
});

const at = (over: Partial<WalletPlace>): WalletPlace => ({ view: 'token', fromAll: false, backToAll: false, backToRecipients: false, sym: 'icp', ...over });

describe('where a flow goes back to', () => {
  test('from a token page: that page', () => {
    expect(returnPlace(at({}))).toBe('token');
  });

  test('from All activity, or with no token page to go back to: All activity', () => {
    expect(returnPlace(at({ view: 'all' }))).toBe('all');
    expect(returnPlace(at({ sym: '' }))).toBe('all');
  });

  test('from Recipients, or a flow opened from it (a Send to a saved recipient): Recipients', () => {
    expect(returnPlace(at({ view: 'recipients' }))).toBe('recipients');
    expect(returnPlace(at({ view: 'send', backToRecipients: true }))).toBe('recipients');
  });

  test('from a flow opened from All activity, with or without the picker: All activity', () => {
    expect(returnPlace(at({ view: 'send', fromAll: true }))).toBe('all');
    // Send from All activity whose token was picked (pickToken sets backToAll, not fromAll)
    expect(returnPlace(at({ view: 'send', backToAll: true }))).toBe('all');
    expect(returnPlace(at({ view: 'swap', fromAll: true }))).toBe('all');
  });

  test('from a flow opened on a token page: that page', () => {
    expect(returnPlace(at({ view: 'receive' }))).toBe('token');
  });
});

describe('where a newly opened flow goes back to (a host request or the token picker, one rule)', () => {
  test('opened on Recipients or All activity: there', () => {
    expect(flowReturn(at({ view: 'recipients' }), true)).toBe('recipients');
    expect(flowReturn(at({ view: 'recipients' }), false)).toBe('recipients');
    expect(flowReturn(at({ view: 'all' }), true)).toBe('all');
    expect(flowReturn(at({ view: 'all' }), false)).toBe('all');
  });

  test('a token with a page: that page, also on a token page with none shown yet (sym empty)', () => {
    expect(flowReturn(at({}), true)).toBe('token');
    expect(flowReturn(at({ sym: '' }), true)).toBe('token');
  });

  test('a token with a page replacing an open flow starts afresh: its page, wherever the flow came from', () => {
    expect(flowReturn(at({ view: 'send', backToRecipients: true }), true)).toBe('token');
    expect(flowReturn(at({ view: 'send', fromAll: true }), true)).toBe('token');
    expect(flowReturn(at({ view: 'swap', backToAll: true }), true)).toBe('token');
  });

  test('an extra token (no page): where the open flow goes back to, else the page shown, else All activity', () => {
    expect(flowReturn(at({ view: 'send', backToRecipients: true }), false)).toBe('recipients');
    expect(flowReturn(at({ view: 'send', fromAll: true }), false)).toBe('all');
    expect(flowReturn(at({ view: 'send', backToAll: true }), false)).toBe('all');
    expect(flowReturn(at({ view: 'receive' }), false)).toBe('token');
    expect(flowReturn(at({}), false)).toBe('token');
    // a token page goes back to itself, also with none picked yet (it shows the first token)
    expect(flowReturn(at({ sym: '' }), false)).toBe('token');
    // over a flow with no page behind it: All activity
    expect(flowReturn(at({ view: 'receive', sym: '' }), false)).toBe('all');
  });
});

describe('a token picked for a flow', () => {
  const pick = (over: Partial<WalletPlace>, inTokens: boolean, flow: 'send' | 'receive' = 'receive') =>
    pickedFlow(at(over), { id: inTokens ? 'ckbtc' : 'USDC', inTokens, flow });

  test('picked on All activity: back to All, the picked token shown (one of the wallet) or kept (an extra)', () => {
    expect(pick({ view: 'all', sym: '' }, true, 'send')).toMatchObject({ view: 'send', sym: 'ckbtc', extTok: null, backToAll: true, backToRecipients: false, fromAll: false });
    expect(pick({ view: 'all', sym: '' }, false)).toMatchObject({ view: 'receive', sym: '', extTok: 'USDC', backToAll: true });
  });

  test('picked on Recipients: back to Recipients, either token', () => {
    expect(pick({ view: 'recipients' }, true)).toMatchObject({ backToRecipients: true, backToAll: false });
    expect(pick({ view: 'recipients' }, false)).toMatchObject({ backToRecipients: true, backToAll: false });
  });

  test('picked inside a Send to a saved recipient: one of the wallet goes to its page, an extra back to Recipients', () => {
    const inSend = { view: 'send' as const, backToRecipients: true };
    expect(pick(inSend, true)).toMatchObject({ sym: 'ckbtc', backToRecipients: false, backToAll: false });
    expect(pick(inSend, false)).toMatchObject({ sym: 'icp', extTok: 'USDC', backToRecipients: true });
  });

  test('picked inside a flow from All activity: one of the wallet goes to its page, an extra back to All', () => {
    expect(pick({ view: 'swap', fromAll: true }, true)).toMatchObject({ backToAll: false, backToRecipients: false });
    expect(pick({ view: 'swap', fromAll: true }, false)).toMatchObject({ backToAll: true });
  });

  test('picked on a token page, with or without one shown yet', () => {
    expect(pick({}, true)).toMatchObject({ sym: 'ckbtc', backToAll: false, backToRecipients: false });
    expect(pick({ sym: '' }, true)).toMatchObject({ sym: 'ckbtc', backToAll: false });
    expect(pick({}, false)).toMatchObject({ sym: 'icp', backToAll: false });
    expect(pick({ sym: '' }, false)).toMatchObject({ sym: '', backToAll: false });
  });

  test('always starts afresh: no earlier address', () => {
    expect(pick({ view: 'send', backToRecipients: true }, true, 'send').sendAddr).toBe('');
  });
});
