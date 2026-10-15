import { describe, expect, test } from 'vitest';
import { amountText, cleanAmount, floorTo, parseAmount, usdText } from './amount';

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

describe('floorTo', () => {
  test('float noise does not cost a unit', () => {
    expect(floorTo(0.000251, 6)).toBe(0.000251);
    // every 6-dp balance below 0.1 comes back whole
    for (let u = 1; u < 100_000; u++) expect(floorTo(u / 1e6, 6)).toBe(u / 1e6);
  });
  test('rounds down, never up', () => {
    expect(floorTo(1.00089901999, 8)).toBe(1.00089901);
    expect(floorTo(0.75 * 0.00000003, 8)).toBe(0.00000002);
  });
});

describe('amountText', () => {
  test.each([
    [0.00000001, 8, '0.00000001'],
    [1.5, 8, '1.5'],
    [100, 0, '100'],
    [100, 2, '100'],
  ])('%s at %s dp → %s', (x, dp, out) => expect(amountText(x, dp)).toBe(out));
});

describe('usdText', () => {
  test('rounds down to cents', () => {
    expect(usdText(3.337)).toBe('3.33');
    expect(usdText(2.5)).toBe('2.50');
  });
});
