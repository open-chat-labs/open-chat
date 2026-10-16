import { describe, expect, test } from 'vitest';
import { LEARN_PAGES, learnFromHash, learnHashHref, placeholderLearnContent } from './learnContent';

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
