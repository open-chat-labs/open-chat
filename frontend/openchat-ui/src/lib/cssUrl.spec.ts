import { mount, unmount } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { cssUrl } from './cssUrl';
import MemberRow from './components/MemberRow.svelte';

describe('cssUrl', () => {
  test('leaves the URL as it is, percent-encoding included', () => {
    expect(cssUrl('https://cdn.example/covers/a%20b.png?x=1&y=(2)')).toBe('url("https://cdn.example/covers/a%20b.png?x=1&y=(2)")');
  });

  test('escapes quotes, backslashes and newlines so the value stays one string', () => {
    expect(cssUrl('a"b\\c\nd\r\ne')).toBe('url("a\\"b\\\\c\\a d\\a e")');
  });

  test('no component builds a url(…) by hand', () => {
    const sources = import.meta.glob('../**/*.svelte', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    const handBuilt = Object.entries(sources)
      .filter(([, src]) => /url\(\$\{|url\(\{/.test(src))
      .map(([file]) => file);
    expect(handBuilt).toEqual([]);
  });

  test('an image URL with spaces or parentheses still makes a valid background (MemberRow)', () => {
    const set = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(MemberRow, { target, props: { title: 'Ana', image: 'https://cdn.example/a b(1).png' } });
    expect(set).toHaveBeenCalledWith('background', 'url("https://cdn.example/a b(1).png") center/cover no-repeat', '');
    unmount(app);
    target.remove();
    set.mockRestore();
  });
});
