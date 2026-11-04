// @vitest-environment node
// How tokens.css's themes combine: data-mode × data-accent, with and without data-platform="native", and the
// always-dark scope inside a light root. A small cascade over tokens.css (read from disk, as tokens.spec does)
// resolves the tokens an element ends up with: its parent's, then its own matching rules by specificity and order.
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

type Element = { root?: boolean; attrs: Record<string, string> };
type Rule = { selectors: string[]; declarations: [string, string][]; order: number };

// the rules that set tokens; selectors are :root, :where(:root), attribute compounds and descendant combinators
const rules: Rule[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body], order) => ({
    selectors: selector.split(';').at(-1)!.split(',').map((s) => s.trim()),
    declarations: [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)].map(([, name, value]): [string, string] => [name, value.trim()]),
    order,
  }))
  .filter((r) => r.declarations.length > 0);

function matchesCompound(compound: string, el: Element): boolean {
  const rest = compound.replace(/^:where\(:root\)|^:root/, (root) => (el.root ? '' : root));
  if (rest.startsWith(':')) return false;
  return [...rest.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(([, name, value]) => (value === undefined ? name in el.attrs : el.attrs[name] === value));
}

function specificity(selector: string): number {
  return (selector.replace(/:where\([^)]*\)/g, '').match(/\[|:root/g) ?? []).length;
}

function matches(selector: string, path: Element[]): boolean {
  const compounds = selector.split(/\s+/);
  if (!matchesCompound(compounds.at(-1)!, path.at(-1)!)) return false;
  let at = path.length - 2;
  for (const compound of compounds.slice(0, -1).reverse()) {
    while (at >= 0 && !matchesCompound(compound, path[at])) at--;
    if (at-- < 0) return false;
  }
  return true;
}

/** The tokens the last element of `path` (root first) ends up with. */
function resolve(path: Element[]): Map<string, string> {
  const tokens = new Map<string, string>();
  path.forEach((_, depth) => {
    const own = rules
      .flatMap((rule) => rule.selectors.filter((s) => matches(s, path.slice(0, depth + 1))).map((s) => ({ rule, weight: specificity(s) })))
      .sort((a, b) => a.weight - b.weight || a.rule.order - b.rule.order);
    for (const { rule } of own) for (const [name, value] of rule.declarations) tokens.set(name, value);
  });
  return tokens;
}

const root = (attrs: Record<string, string>): Element => ({ root: true, attrs });
const MODES = ['dark', 'light'] as const;
const ACCENTS = ['pink', 'orange', 'blue', 'green'] as const;
const NATIVE_ONLY = ['--safe-top', '--safe-right', '--safe-bottom', '--safe-left', '--scroll-end', '--text-scale', '--hero-base', '--tint-row', '--tint-pill'];
const TEXT = ['--text-2xs', '--text-xs', '--text-sm', '--text-md', '--text-base', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl'];
const NATIVE_LIGHT_SURFACES = { '--surface-0': '#FFFFFF', '--surface-1': '#FFFFFF', '--surface-2': '#F4F3EF', '--field': '#F4F3EF' };

function changed(a: Map<string, string>, b: Map<string, string>): string[] {
  return [...new Set([...a.keys(), ...b.keys()])].filter((name) => a.get(name) !== b.get(name)).sort();
}

describe('the cascade this spec runs', () => {
  test('reads the theme families', () => {
    expect(resolve([root({})]).get('--surface-0')).toBe('#07070a');
    expect(resolve([root({ 'data-mode': 'light', 'data-accent': 'blue' })]).get('--accent')).toBe('#3D8BFF');
  });
});

describe('data-platform="native"', () => {
  test.each(MODES.flatMap((mode) => ACCENTS.map((accent) => [mode, accent] as const)))('%s · %s: only the native tokens change', (mode, accent) => {
    const web = resolve([root({ 'data-mode': mode, 'data-accent': accent })]);
    const native = resolve([root({ 'data-mode': mode, 'data-accent': accent, 'data-platform': 'native' })]);
    // light's --surface-1 is white on the web already
    const surfaces = mode === 'light' ? Object.keys(NATIVE_LIGHT_SURFACES).filter((name) => name !== '--surface-1') : [];
    const expected = [...NATIVE_ONLY, ...TEXT, ...surfaces].sort();
    expect(changed(web, native)).toEqual(expected);
    for (const name of NATIVE_ONLY) expect(web.has(name)).toBe(false);
  });

  test('native light has white pages and a white hero base; dark keeps the dark ones', () => {
    const light = resolve([root({ 'data-mode': 'light', 'data-accent': 'pink', 'data-platform': 'native' })]);
    const dark = resolve([root({ 'data-mode': 'dark', 'data-accent': 'pink', 'data-platform': 'native' })]);
    for (const [name, value] of Object.entries(NATIVE_LIGHT_SURFACES)) expect(light.get(name)).toBe(value);
    expect(light.get('--hero-base')).toBe('#FFFFFF');
    expect(dark.get('--hero-base')).toBe('#14141a');
    expect(dark.get('--surface-0')).toBe('#07070a');
    expect(dark.get('--tint-row')).toBe('rgba(0,0,0,.22)');
    expect(dark.get('--tint-pill')).toBe('rgba(0,0,0,.28)');
  });

  test("each text size is the web's size times --text-scale, which is 1 unless the app sets it", () => {
    const web = resolve([root({})]);
    const native = resolve([root({ 'data-platform': 'native' })]);
    expect(native.get('--text-scale')).toBe('1');
    for (const name of TEXT) expect(native.get(name)).toBe(`calc(${web.get(name)} * var(--text-scale))`);
  });

  test('safe areas read the device insets, with none where there are none', () => {
    const native = resolve([root({ 'data-platform': 'native' })]);
    for (const side of ['top', 'right', 'bottom', 'left']) expect(native.get(`--safe-${side}`)).toBe(`env(safe-area-inset-${side},0px)`);
  });
});

describe('data-always-dark', () => {
  const call: Element = { attrs: { 'data-always-dark': '' } };

  test.each(ACCENTS)('inside a native light root (%s): dark tokens with the dark accent, and the call colours', (accent) => {
    const themed = { 'data-mode': 'light', 'data-accent': accent };
    const inside = resolve([root({ ...themed, 'data-platform': 'native' }), call]);
    const dark = resolve([root({ 'data-mode': 'dark', 'data-accent': accent, 'data-platform': 'native' })]);
    for (const name of dark.keys()) expect([name, inside.get(name)]).toEqual([name, dark.get(name)]);
    expect(inside.get('--call-bg')).toBe('#050507');
  });

  test('works the same under a web light root', () => {
    const inside = resolve([root({ 'data-mode': 'light', 'data-accent': 'green' }), call]);
    expect(inside.get('--surface-0')).toBe('#07070a');
    expect(inside.get('--accent')).toBe('#2EE6A8');
    expect(inside.get('--bubble-text')).toBe('#FFFFFF');
  });

  test('the call colours exist only inside the scope', () => {
    expect(resolve([root({ 'data-mode': 'light', 'data-accent': 'pink', 'data-platform': 'native' })]).has('--call-bg')).toBe(false);
  });
});
