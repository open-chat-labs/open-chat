import { describe, expect, test } from 'vitest';
import { cssUrl } from './cssUrl';

describe('cssUrl', () => {
  test('leaves the URL as it is, percent-encoding included', () => {
    expect(cssUrl('https://cdn.example/covers/a%20b.png?x=1&y=(2)')).toBe('url("https://cdn.example/covers/a%20b.png?x=1&y=(2)")');
  });

  test('escapes quotes, backslashes and newlines so the value stays one string', () => {
    expect(cssUrl('a"b\\c\nd\r\ne')).toBe('url("a\\"b\\\\c\\a d\\a e")');
  });
});
