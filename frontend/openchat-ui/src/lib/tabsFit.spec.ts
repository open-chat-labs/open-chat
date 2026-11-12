import { describe, expect, test } from 'vitest';
import { tabsFit, tabsNeed } from './tabsFit';

const bar = { padding: 8, gap: 4 };

describe('tabsNeed', () => {
  test("is the tabs' parts and the gaps between them, and the bar's padding", () => {
    // 8 padding + 2 tab gaps; tab 1: 60 + 4 + 20; tab 2: 40; tab 3: 50 + 4 + 5 + 4 + 5
    const tabs = [
      { widths: [60, 20], gap: 4 },
      { widths: [40], gap: 4 },
      { widths: [50, 5, 5], gap: 4 },
    ];
    expect(tabsNeed(bar, tabs)).toBe(8 + 8 + 84 + 40 + 68);
  });

  test('is just the padding with no tabs', () => {
    expect(tabsNeed(bar, [])).toBe(8);
  });
});

// review of #10477: one-line labels mustn't spill out of a narrow bar
describe('tabsFit', () => {
  const tabs = [
    { widths: [70, 22], gap: 4 },
    { widths: [40, 18], gap: 4 },
  ];
  const need = tabsNeed(bar, tabs);

  test('fits a bar as wide as the tabs need, or wider', () => {
    expect(tabsFit({ ...bar, width: need }, tabs)).toBe(true);
    expect(tabsFit({ ...bar, width: need + 50 }, tabs)).toBe(true);
  });

  test("doesn't fit a narrower bar", () => {
    expect(tabsFit({ ...bar, width: need - 1 }, tabs)).toBe(false);
  });
});
