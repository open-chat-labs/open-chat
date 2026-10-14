import { describe, expect, test } from 'vitest';
import { cleanAmount, parseAmount } from './amount';

describe('cleanAmount', () => {
  test.each([
    ['1,5', '1,5'],
    ['1.5.', '1.5'],
    ['1,5,', '1,5'],
    ['1.5,', '1.5'],
    ['12abc3', '123'],
    // both marks with 3-digit groups: the earlier ones are grouping
    ['1,234.56', '1234.56'],
    ['1.234,56', '1234,56'],
    ['12,345,678.9', '12345678.9'],
  ])('%s → %s', (input, out) => expect(cleanAmount(input)).toBe(out));
});

describe('parseAmount', () => {
  test.each([
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['0,0001', 0.0001],
    [',5', 0.5],
    ['1.', 1],
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['1.234.567,8', 1234567.8],
    // not 3-digit groups, so the first mark typed is the decimal one
    ['1,23.4', 1.234],
    ['1.2,3', 1.23],
  ])('%s → %d', (input, n) => expect(parseAmount(input)).toBe(n));

  test.each(['', '.', ',', 'abc'])('%j is 0', (input) => expect(parseAmount(input)).toBe(0));
});
