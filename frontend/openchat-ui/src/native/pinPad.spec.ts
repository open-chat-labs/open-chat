import { describe, expect, test } from 'vitest';
import { PIN_KEYS, pinDots, pinKeyOf, pinPress } from './pinPad';

describe('pinPress', () => {
  test('adds a digit until the PIN is complete', () => {
    expect(pinPress('', '4', 6)).toBe('4');
    expect(pinPress('12345', '6', 6)).toBe('123456');
    expect(pinPress('123456', '7', 6)).toBe('123456');
  });

  test('delete takes the last digit off, and does nothing with none', () => {
    expect(pinPress('123', 'delete', 6)).toBe('12');
    expect(pinPress('', 'delete', 6)).toBe('');
  });
});

describe('pinKeyOf', () => {
  test('digits and the deleting keys; nothing else', () => {
    expect(pinKeyOf('7')).toBe('7');
    expect(pinKeyOf('Backspace')).toBe('delete');
    expect(pinKeyOf('Delete')).toBe('delete');
    expect(pinKeyOf('a')).toBeUndefined();
    expect(pinKeyOf('Enter')).toBeUndefined();
  });
});

describe('pinDots', () => {
  test('one per digit, filled as far as typed', () => {
    expect(pinDots('12', 4)).toEqual([true, true, false, false]);
    expect(pinDots('', 3)).toEqual([false, false, false]);
  });
});

test('the pad is a phone keypad: 1–9, then 0 between a gap and delete', () => {
  expect(PIN_KEYS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'delete']);
});
