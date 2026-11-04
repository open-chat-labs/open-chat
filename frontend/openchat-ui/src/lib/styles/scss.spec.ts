// @vitest-environment node
// Every component styles in SCSS, so nesting and the library's mixins (_mixins.scss) work in all of them.
import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { hasPlainStyle } from './styleBlocks';

const src = new URL('../../', import.meta.url);

describe('hasPlainStyle', () => {
  test('accepts lang="scss", single quotes and no quotes', () => {
    expect(hasPlainStyle('<div></div>\n<style lang="scss">\n</style>')).toBe(false);
    expect(hasPlainStyle("<style lang='scss'>\n</style>")).toBe(false);
    expect(hasPlainStyle('<style lang=scss>\n</style>')).toBe(false);
  });

  test('reports a plain or other-language block, not a <style> inside a string or comment', () => {
    expect(hasPlainStyle('<style>\n</style>')).toBe(true);
    expect(hasPlainStyle('<style lang="less">\n</style>')).toBe(true);
    expect(hasPlainStyle('<style lang="scss-like">\n</style>')).toBe(true);
    expect(hasPlainStyle('<script>const sample = "<style>";</script>\n  <!-- <style> -->')).toBe(false);
  });
});

test('every style block in the library is SCSS', () => {
  const plain = readdirSync(src, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.svelte'))
    .filter((path) => hasPlainStyle(readFileSync(new URL(path, src), 'utf8')));
  expect(plain).toEqual([]);
});

test('the mixins output no CSS of their own', () => {
  expect(sass.compile(fileURLToPath(new URL('lib/styles/_mixins.scss', src))).css).toBe('');
});
