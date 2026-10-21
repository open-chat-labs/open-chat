// @vitest-environment node
// A fallback on a token that tokens.css defines never renders, so it only drifts from the real value.
import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

// vitest compiles CSS imports away (a raw import comes back empty), so the stylesheets are read from disk
const src = new URL('../../', import.meta.url);
const tokens = readFileSync(new URL('lib/styles/tokens.css', src), 'utf8');
const stylesheets = Object.fromEntries(
  readdirSync(src, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.css'))
    .map((path) => [path, readFileSync(new URL(path, src), 'utf8')]),
);

const sources = {
  ...import.meta.glob<string>(['../**/*.{svelte,ts,js}', '../../features/**/*.{svelte,ts,js}', '../../pages/**/*.{svelte,ts,js}', '../../docs/**/*.{svelte,ts,js,json}', '!../**/*.spec.ts', '!../../**/*.spec.ts'], { query: '?raw', import: 'default', eager: true }),
  ...stylesheets,
};

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

  test('the token list and the stylesheets are read', () => {
    expect(defined.has('--ink')).toBe(true);
    expect(stylesheets['lib/styles/global.css']).toContain('.oc-veil');
  });

  test('no source repeats a defined token as a fallback', () => {
    const offenders = Object.entries(sources).flatMap(([path, text]) =>
      [...text.matchAll(/var\((--[\w-]+)\s*,/g)].filter(([, name]) => defined.has(name)).map(([, name]) => `${path}: ${name}`),
    );
    expect(offenders).toEqual([]);
  });
});
