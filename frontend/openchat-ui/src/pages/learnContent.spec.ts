import { describe, expect, test } from 'vitest';
import { LEARN_PAGES, docOutline, learnFromHash, learnHashHref, learnPagesOf, outlinePath, placeholderLearnContent, readingSection } from './learnContent';

describe('learnFromHash', () => {
  test.each(LEARN_PAGES)('#%s names that sub-page', (page) => expect(learnFromHash('#' + page)).toEqual({ page }));
  test('a blog post', () => expect(learnFromHash('#blog/android-beta')).toEqual({ page: 'blog', post: 'android-beta' }));
  test('a slug on another sub-page is ignored', () => expect(learnFromHash('#faq/x')).toEqual({ page: 'faq' }));
  test.each(['', '#', '#vision', '#blog/%E0%A4%A'])('%j is not a sub-page', (hash) => expect(learnFromHash(hash)).toBeNull());
});

describe('learnHashHref', () => {
  test('sub-page and post', () => {
    expect(learnHashHref('/learn', 'faq')).toBe('/learn#faq');
    expect(learnHashHref('/learn', 'blog', 'a b')).toBe('/learn#blog/a%20b');
    expect(learnHashHref('', 'roadmap', 'ignored')).toBe('#roadmap');
  });
  test('round-trips through learnFromHash', () => expect(learnFromHash(learnHashHref('', 'blog', 'a/b c'))).toEqual({ page: 'blog', post: 'a/b c' }));
});

describe('placeholder content', () => {
  test('ids are unique where they are used as anchors and URLs', () => {
    const slugs = placeholderLearnContent.posts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const doc of Object.values(placeholderLearnContent.docs)) {
      const ids = doc!.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('learnPagesOf', () => {
  const noDocs = { ...placeholderLearnContent, docs: {} };
  test('a doc page shows only with its doc, or when the host gives its content', () => {
    expect(learnPagesOf(noDocs)).toEqual(['roadmap', 'blog', 'faq']);
    expect(learnPagesOf(noDocs, ['architecture'])).toEqual(['roadmap', 'architecture', 'blog', 'faq']);
    expect(learnPagesOf(placeholderLearnContent)).toEqual(LEARN_PAGES);
  });
});

describe('a doc outline', () => {
  const sec = (id: string, depth?: number) => ({ id, title: id, paras: [], depth });
  const sections = [sec('1'), sec('2'), sec('2-1', 2), sec('2-2', 2), sec('3'), sec('3-1', 2), sec('3-1-1', 3), sec('3-2', 2)];
  const flat = (entries: ReturnType<typeof docOutline>): [string, number, string[]][] =>
    entries.flatMap((e) => [[sections[e.index].id, e.depth, e.children.map((c) => c.number)] as [string, number, string[]], ...flat(e.children)]);

  test('nests each section under the nearest shallower one, numbered within its parent', () => {
    const outline = docOutline(sections);
    expect(outline.map((e) => e.number)).toEqual(['01', '02', '03']);
    expect(flat(outline)).toEqual([
      ['1', 1, []],
      ['2', 1, ['2.1', '2.2']],
      ['2-1', 2, []],
      ['2-2', 2, []],
      ['3', 1, ['3.1', '3.2']],
      ['3-1', 2, ['3.1.1']],
      ['3-1-1', 3, []],
      ['3-2', 2, []],
    ]);
  });

  test('is flat without depths, as before', () => {
    expect(docOutline([sec('a'), sec('b')]).map((e) => [e.number, e.children.length])).toEqual([
      ['01', 0],
      ['02', 0],
    ]);
  });

  test('puts a section that skips a level one level down', () => {
    expect(docOutline([sec('a'), sec('b', 3)])[0].children.map((c) => [c.number, c.depth])).toEqual([['1.1', 2]]);
  });

  test("gives the entries on the way to a section, and none for one it doesn't have", () => {
    const outline = docOutline(sections);
    expect(outlinePath(outline, 6).map((e) => sections[e.index].id)).toEqual(['3', '3-1', '3-1-1']);
    expect(outlinePath(outline, 0).map((e) => e.index)).toEqual([0]);
    expect(outlinePath(outline, 99)).toEqual([]);
  });
});

describe('the section being read', () => {
  test('is the last whose top has reached the line, or the first before any has', () => {
    expect(readingSection([-500, -20, 90, 700], 120)).toBe(2);
    expect(readingSection([300, 900], 120)).toBe(0);
    expect(readingSection([-900, -400], 120)).toBe(1);
    // a heading right at the line (where a jump to it leaves it) is being read
    expect(readingSection([-300, 120], 120)).toBe(1);
  });
});

