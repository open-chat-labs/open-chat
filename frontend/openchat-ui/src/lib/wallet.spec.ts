import { describe, expect, test } from 'vitest';
import { flowReturn, pickedFlow, returnPlace, type WalletPlace } from './wallet';

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
