import { describe, expect, test } from 'vitest';
import { returnPlace, type WalletPlace } from './wallet';

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
