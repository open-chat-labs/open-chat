// @vitest-environment node
// A fallback on a token that tokens.css defines never renders, so it only drifts from the real value.
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

// vitest compiles CSS imports away, so tokens.css is read from disk
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

const sources = import.meta.glob<string>(['../**/*.{svelte,css,ts,js}', '../../features/**/*.{svelte,css,ts,js}', '../../pages/**/*.{svelte,css,ts,js}', '../../docs/**/*.{svelte,css,ts,js}', '!../**/*.spec.ts', '!../../**/*.spec.ts'], { query: '?raw', import: 'default', eager: true });

/** The tokens defined on :root (the dark default), which every theme starts from. */
export function rootTokens(css: string): Set<string> {
  const names = new Set<string>();
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selector.includes(':root')) for (const [, name] of body.matchAll(/(--[\w-]+)\s*:/g)) names.add(name);
  }
  return names;
}

/** Invariant: no var() gives a fallback for a token tokens.css defines on :root. */
describe('token fallbacks', () => {
  const defined = rootTokens(tokens);

  test('the token list is read', () => {
    expect(defined.has('--ink')).toBe(true);
  });

  test('no source repeats a defined token as a fallback', () => {
    const offenders = Object.entries(sources).flatMap(([path, text]) =>
      [...text.matchAll(/var\((--[\w-]+)\s*,/g)].filter(([, name]) => defined.has(name)).map(([, name]) => `${path}: ${name}`),
    );
    expect(offenders).toEqual([]);
  });
});
