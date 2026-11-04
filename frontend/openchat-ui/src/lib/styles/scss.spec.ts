// @vitest-environment node
// Every component styles in SCSS, so the library's mixins (_mixins.scss) and nesting work in all of them.
import { expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

const src = new URL('../../', import.meta.url);

test('every style block in the library is <style lang="scss">', () => {
  const plain = readdirSync(src, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.svelte'))
    .filter((path) => /<style(?![^>]*lang="scss")[^>]*>/.test(readFileSync(new URL(path, src), 'utf8')));
  expect(plain).toEqual([]);
});

test('the mixins output no CSS of their own (every component would repeat it)', () => {
  const mixins = readFileSync(new URL('lib/styles/_mixins.scss', src), 'utf8');
  const topLevel = mixins
    .replace(/\/\/[^\n]*/g, '')
    .replace(/@mixin[^{]*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g, '')
    .trim();
  expect(topLevel).toBe('');
});
