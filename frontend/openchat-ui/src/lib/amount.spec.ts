import { describe, expect, test } from 'vitest';
import { amountText, cleanAmount, floorTo, fromUnits, parseAmount, toUnits, usdText } from './amount';

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
  test('never more than x: 18-decimal tokens and large 8-decimal balances', () => {
    expect(floorTo(0.044038500211371456, 18)).toBe(0.044038500211371456);
    expect(floorTo(19605831.33811045, 8)).toBe(19605831.33811045);
    // a fixed-seed walk over random balances: always ≤ x, and x itself when it has no more than dp decimals
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 20_000; i++) {
      const eth = rand() * 3;
      expect(floorTo(eth, 18)).toBeLessThanOrEqual(eth);
      const big = Math.floor(rand() * 1e9 * 1e8) / 1e8;
      expect(floorTo(big, 8)).toBeLessThanOrEqual(big);
      if ((String(big).split('.')[1] ?? '').length <= 8) expect(floorTo(big, 8)).toBe(big);
    }
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
    [0.044038500211371456, 18, '0.044038500211371456'],
    [1.239, 2, '1.23'],
  ])('%s at %s dp → %s', (x, dp, out) => expect(amountText(x, dp)).toBe(out));
});

describe('usdText', () => {
  test('rounds down to cents', () => {
    expect(usdText(3.337)).toBe('3.33');
    expect(usdText(2.5)).toBe('2.50');
  });
});

describe('toUnits / fromUnits', () => {
  test.each([
    [0.000251, 6, 251n],
    [1e-8, 8, 1n],
    [1.5e21, 2, 150000000000000000000000n],
    [0.044038500211371456, 18, 44038500211371456n],
    [2.25e-8, 8, 2n],
    [0, 8, 0n],
    [-1, 8, 0n],
  ])('%s at %s dp → %s units', (x, dp, units) => expect(toUnits(x, dp)).toBe(units));
  test('never more than the units, also past 17 significant digits', () => {
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 20_000; i++) {
      const units = BigInt(Math.floor(rand() * 1e9)) * 1_000_000_000n + BigInt(Math.floor(rand() * 1e9));
      expect(toUnits(fromUnits(units, 18), 18) <= units).toBe(true);
    }
  });
  test('round trip', () => {
    expect(fromUnits(44038500211371456n, 18)).toBe(0.044038500211371456);
    expect(fromUnits(1960583133811045n, 8)).toBe(19605831.33811045);
  });
});
