import { describe, expect, test } from 'vitest';
import { TocOpen } from './tocOpen.svelte';

describe("a doc's contents list", () => {
  test('opens the entries on the way to the section being read, and closes them when the reader moves on', () => {
    const toc = new TocOpen();
    toc.reading([2, 3]);
    expect([toc.isOpen(2), toc.isOpen(3), toc.isOpen(5)]).toEqual([true, true, false]);
    toc.reading([5]);
    expect([toc.isOpen(2), toc.isOpen(5)]).toEqual([false, true]);
  });

  test('keeps an entry the reader opened open until they close it', () => {
    const toc = new TocOpen();
    toc.toggle(2);
    toc.reading([5]);
    toc.reading([7]);
    expect(toc.isOpen(2)).toBe(true);
    toc.toggle(2);
    expect(toc.isOpen(2)).toBe(false);
  });

  test('keeps an entry opened by hand while it was being read open after the reader moves on', () => {
    const toc = new TocOpen();
    toc.reading([2]);
    toc.toggle(2);
    toc.toggle(2);
    toc.reading([5]);
    expect(toc.isOpen(2)).toBe(true);
  });

  test("keeps an entry closed while the reader is in it, and opens it by itself when they come back", () => {
    const toc = new TocOpen();
    toc.reading([2]);
    toc.toggle(2);
    toc.reading([2]);
    expect(toc.isOpen(2)).toBe(false);
    toc.reading([5]);
    toc.reading([2]);
    expect(toc.isOpen(2)).toBe(true);
  });

  test('opens an entry the reader closed earlier, elsewhere, once they come to its section', () => {
    const toc = new TocOpen();
    toc.reading([5]);
    toc.toggle(2);
    toc.toggle(2);
    expect(toc.isOpen(2)).toBe(false);
    toc.reading([2]);
    expect(toc.isOpen(2)).toBe(true);
  });
});
