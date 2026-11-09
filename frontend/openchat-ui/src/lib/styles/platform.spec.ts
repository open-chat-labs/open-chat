// @vitest-environment node
// How tokens.css's themes combine: data-mode × data-accent, with and without data-platform="native", and the
// always-dark scope. A small cascade over tokens.css (read from disk, as tokens.spec does) resolves the tokens an
// element ends up with: its parent's, then its own matching rules by specificity and order, then its inline style,
// with var() substituted as the browser does for custom properties.
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

export type Element = { root?: boolean; attrs: Record<string, string>; style?: Record<string, string> };
type Rule = { selectors: string[]; declarations: [string, string][]; order: number };
type Parsed = { rules: Rule[]; unsupported: string[]; atRuleTokens: string[] };

// what the cascade below understands: :root or :where(:root), or attribute compounds, joined by descendant combinators
const COMPOUND = String.raw`(?:\[[\w-]+(?:="[^"]*")?\])+`;
const SUPPORTED = new RegExp(String.raw`^(?::where\(:root\)|:root|${COMPOUND}(?: ${COMPOUND})*)$`);
const TOKEN = /(--[\w-]+)\s*:\s*([^;]+)/g;

/** The top-level rules of a stylesheet that set tokens. At-rule blocks (@media, @keyframes …) are skipped, and
 *  any token one of them sets is reported, as are selectors outside what the cascade understands. */
function parse(css: string): Parsed {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const parsed: Parsed = { rules: [], unsupported: [], atRuleTokens: [] };
  for (let at = 0, order = 0; ; order++) {
    const open = text.indexOf('{', at);
    if (open < 0) return parsed;
    const prelude = text.slice(at, open).split(';').at(-1)!.trim();
    let close = open + 1;
    for (let depth = 1; depth > 0; close++) depth += text[close] === '{' ? 1 : text[close] === '}' ? -1 : 0;
    const body = text.slice(open + 1, close - 1);
    const declarations = [...body.matchAll(TOKEN)].map(([, name, value]): [string, string] => [name, value.trim()]);
    if (prelude.startsWith('@')) {
      parsed.atRuleTokens.push(...declarations.map(([name]) => `${prelude}: ${name}`));
    } else if (declarations.length > 0) {
      const selectors = prelude.split(',').map((s) => s.trim());
      parsed.unsupported.push(...selectors.filter((s) => !SUPPORTED.test(s)));
      parsed.rules.push({ selectors, declarations, order });
    }
    at = close;
  }
}

function matchesCompound(compound: string, el: Element): boolean {
  if (compound === ':root' || compound === ':where(:root)') return el.root === true;
  return [...compound.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(([, name, value]) => (value === undefined ? name in el.attrs : el.attrs[name] === value));
}

// for the selectors SUPPORTED allows: each attribute and :root count one, :where() nothing
const specificity = (selector: string): number => (selector.replace(/:where\([^)]*\)/g, '').match(/\[|:root/g) ?? []).length;

function matches(selector: string, path: Element[]): boolean {
  const compounds = selector.split(' ');
  if (!matchesCompound(compounds.at(-1)!, path.at(-1)!)) return false;
  let at = path.length - 2;
  for (const compound of compounds.slice(0, -1).reverse()) {
    while (at >= 0 && !matchesCompound(compound, path[at])) at--;
    if (at-- < 0) return false;
  }
  return true;
}

/** The tokens the last element of `path` (root first) ends up with, var() substituted. */
export function cascade(css: string): (path: Element[]) => Map<string, string> {
  const { rules } = parse(css);
  return (path) => {
    const tokens = new Map<string, string>();
    path.forEach((el, depth) => {
      const own = new Map<string, string>();
      rules
        .flatMap((rule) => rule.selectors.filter((s) => matches(s, path.slice(0, depth + 1))).map((s) => ({ rule, weight: specificity(s) })))
        .sort((a, b) => a.weight - b.weight || a.rule.order - b.rule.order)
        .forEach(({ rule }) => rule.declarations.forEach(([name, value]) => own.set(name, value)));
      Object.entries(el.style ?? {}).forEach(([name, value]) => own.set(name, value));
      own.forEach((value, name) => tokens.set(name, value));
      own.forEach((_, name) => {
        let value = tokens.get(name)!;
        for (let i = 0; i < 10 && value.includes('var('); i++) value = value.replace(/var\((--[\w-]+)\)/g, (_m, ref: string) => tokens.get(ref) ?? 'UNSET');
        tokens.set(name, value);
      });
    });
    return tokens;
  };
}

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const resolve = cascade(css);
const root = (attrs: Record<string, string>, style?: Record<string, string>): Element => ({ root: true, attrs, style });
const MODES = ['dark', 'light'] as const;
const ACCENTS = ['pink', 'orange', 'blue', 'green'] as const;
const HERO = ['--hero-base', '--tint-row', '--tint-pill'];
// the shell kit's (src/native): touch target, bar padding, tab bar height, veils, shadows
const SHELL = ['--touch-target', '--bar-end', '--tab-bar-h', '--veil-sheet', '--veil-lift', '--shadow-sheet', '--shadow-menu', '--shadow-lift', '--shadow-push', '--shadow-fab'];
// a conversation's attach panel (its actions' colours) and what sits over a photo or video
const ACTIONS = ['--action-media', '--action-file', '--action-poll', '--action-crypto', '--action-swap', '--action-meme'];
const COMPOSER = [...ACTIONS, '--on-media-chip', '--on-media-badge', '--on-media-ink'];
const TEXT = ['--text-2xs', '--text-xs', '--text-sm', '--text-md', '--text-base', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl'];
const NATIVE_LIGHT_SURFACES = { '--surface-0': '#FFFFFF', '--surface-1': '#FFFFFF', '--surface-2': '#F4F3EF', '--field': '#F4F3EF' };
const call: Element = { attrs: { 'data-always-dark': '' } };

function changed(a: Map<string, string>, b: Map<string, string>): string[] {
  return [...new Set([...a.keys(), ...b.keys()])].filter((name) => a.get(name) !== b.get(name)).sort();
}

describe('the cascade this spec runs', () => {
  test('understands every rule in tokens.css that sets tokens', () => {
    const { rules, unsupported, atRuleTokens } = parse(css);
    expect(rules.length).toBeGreaterThan(10);
    expect(unsupported).toEqual([]);
    expect(atRuleTokens).toEqual([]);
  });

  test('reports what it does not understand', () => {
    const parsed = parse('@media (min-width:1px){[a]{--x:1}} .c[a]{--y:2} :is([b]){--z:3}');
    expect(parsed.atRuleTokens).toEqual(['@media (min-width:1px): --x']);
    expect(parsed.unsupported).toEqual(['.c[a]', ':is([b])']);
  });

  test('reads the theme families, with var() substituted', () => {
    expect(resolve([root({})]).get('--surface-0')).toBe('#07070a');
    expect(resolve([root({})]).get('--accent')).toBe('#FF5672');
    expect(resolve([root({ 'data-mode': 'light', 'data-accent': 'blue' })]).get('--accent')).toBe('#3D8BFF');
    expect(resolve([root({ 'data-mode': 'dark', 'data-accent': 'blue' })]).get('--on-accent')).toBe('#06182F');
  });
});

describe('the web, without the attributes', () => {
  test('a dark element with no data-accent inside a light root keeps the light accent, as before', () => {
    const inside = resolve([root({ 'data-mode': 'light', 'data-accent': 'pink' }), { attrs: { 'data-mode': 'dark' } }]);
    expect(inside.get('--on-accent')).toBe('#FFFFFF');
    expect(inside.get('--surface-0')).toBe('#07070a');
  });

  test('text sizes are the designed sizes (a scale of 1), and safe areas the insets', () => {
    const web = resolve([root({ 'data-mode': 'dark', 'data-accent': 'pink' })]);
    expect(web.get('--text-sm')).toBe('calc(11.5px * 1)');
    expect(web.get('--text-3xl')).toBe('calc(34px * 1)');
    for (const side of ['top', 'right', 'bottom', 'left']) expect(web.get(`--safe-${side}`)).toBe(`env(safe-area-inset-${side},0px)`);
    for (const name of [...HERO, ...SHELL, ...COMPOSER]) expect(web.has(name)).toBe(false);
  });
});

describe('data-platform="native"', () => {
  test.each(MODES.flatMap((mode) => ACCENTS.map((accent) => [mode, accent] as const)))('%s · %s: only the native tokens change', (mode, accent) => {
    const web = resolve([root({ 'data-mode': mode, 'data-accent': accent })]);
    const native = resolve([root({ 'data-mode': mode, 'data-accent': accent, 'data-platform': 'native' })]);
    // light's --surface-1 is white on the web already; --bg and --card-2 read --surface-0 and --surface-2
    const surfaces = mode === 'light' ? ['--surface-0', '--surface-2', '--field', '--bg', '--card-2'] : [];
    expect(changed(web, native)).toEqual([...HERO, ...SHELL, ...COMPOSER, ...surfaces].sort());
  });

  test('touch targets are 44pt on iOS and 48dp on Android, and the tab bar follows', () => {
    const ios = resolve([root({ 'data-mode': 'dark', 'data-platform': 'native', 'data-os': 'ios' })]);
    const android = resolve([root({ 'data-mode': 'dark', 'data-platform': 'native', 'data-os': 'android' })]);
    expect(ios.get('--touch-target')).toBe('44px');
    expect(android.get('--touch-target')).toBe('48px');
    expect(ios.get('--bar-end')).toBe('max(env(safe-area-inset-bottom,0px),12px)');
    expect(ios.get('--tab-bar-h')).toBe('calc(10px + 44px + max(env(safe-area-inset-bottom,0px),12px))');
    expect(android.get('--tab-bar-h')).toBe('calc(10px + 48px + max(env(safe-area-inset-bottom,0px),12px))');
  });

  test("a pushed screen's shadow falls on its start side, mirrored in RTL", () => {
    const ltr = resolve([root({ 'data-mode': 'dark', 'data-platform': 'native', dir: 'ltr' })]);
    const rtl = resolve([root({ 'data-mode': 'dark', 'data-platform': 'native', dir: 'rtl' })]);
    expect(ltr.get('--shadow-push')).toBe('-12px 0 32px rgba(0,0,0,.35)');
    expect(rtl.get('--shadow-push')).toBe('12px 0 32px rgba(0,0,0,.35)');
  });

  test('the attach panel\'s action colours have a value per mode, deepened for white in light', () => {
    const light = resolve([root({ 'data-mode': 'light', 'data-accent': 'pink', 'data-platform': 'native' })]);
    const dark = resolve([root({ 'data-mode': 'dark', 'data-accent': 'pink', 'data-platform': 'native' })]);
    expect(ACTIONS.map((name) => dark.get(name))).toEqual(['#7FD1FF', '#7FB2FF', '#FFB45E', '#2EE6A8', '#B48CFF', '#FFD36B']);
    expect(ACTIONS.map((name) => light.get(name))).toEqual(['#0A84C6', '#2F6FE0', '#C46A0A', '#0A8A61', '#7C4DDB', '#A87B00']);
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

  test('the text sizes follow a --text-scale set on the native root, on <html> or below it', () => {
    const scaled = { '--text-scale': '1.25' };
    const onHtml = resolve([root({ 'data-platform': 'native' }, scaled)]);
    const below = resolve([root({ 'data-mode': 'dark' }), { attrs: { 'data-platform': 'native' }, style: scaled }]);
    const web = resolve([root({})]);
    TEXT.forEach((name) => {
      const designed = web.get(name)!.replace(' * 1)', '');
      expect(onHtml.get(name)).toBe(`${designed} * 1.25)`);
      expect(below.get(name)).toBe(`${designed} * 1.25)`);
    });
  });
});

describe('data-always-dark', () => {
  test.each(ACCENTS)('inside a native light root (%s): what a native dark root has, plus the call colours', (accent) => {
    const inside = resolve([root({ 'data-mode': 'light', 'data-accent': accent, 'data-platform': 'native' }), call]);
    const dark = resolve([root({ 'data-mode': 'dark', 'data-accent': accent, 'data-platform': 'native' })]);
    for (const name of dark.keys()) expect([name, inside.get(name)]).toEqual([name, dark.get(name)]);
    expect(inside.get('--call-bg')).toBe('#050507');
  });

  test('takes the accent of its nearest themed root', () => {
    const docs = root({ 'data-mode': 'dark', 'data-accent': 'green' });
    const preview: Element = { attrs: { 'data-platform': 'native', 'data-mode': 'light', 'data-accent': 'blue' } };
    const inside = resolve([docs, preview, call]);
    expect(inside.get('--accent')).toBe('#3D9BFF');
    expect(inside.get('--on-accent')).toBe('#06182F');
  });

  test('takes its own data-accent over its root', () => {
    const own: Element = { attrs: { 'data-always-dark': '', 'data-mode': 'dark', 'data-accent': 'pink' } };
    expect(resolve([root({ 'data-mode': 'light', 'data-accent': 'blue' }), own]).get('--on-accent')).toBe('#2E0512');
    const portal: Element = { attrs: { 'data-always-dark': '', 'data-accent': 'orange' } };
    expect(resolve([root({}), portal]).get('--accent')).toBe('#FF8A3D');
  });

  test('outside any themed element, takes <html>\'s accent', () => {
    const inside = resolve([root({ 'data-mode': 'light', 'data-accent': 'green' }), { attrs: {} }, call]);
    expect(inside.get('--surface-0')).toBe('#07070a');
    expect(inside.get('--accent')).toBe('#2EE6A8');
    expect(inside.get('--bubble-text')).toBe('#FFFFFF');
  });

  test('portalled to <body>, beside the native root, follows a --text-scale set on <html>', () => {
    const html = root({ 'data-mode': 'light', 'data-accent': 'blue' }, { '--text-scale': '1.25' });
    const body: Element = { attrs: {} };
    const inside = resolve([html, body, call]);
    expect(inside.get('--text-sm')).toBe('calc(11.5px * 1.25)');
    expect(inside.get('--accent')).toBe('#3D9BFF');
  });

  test('once the native tree takes --text-scale off <html> again, the web tree has the sizes as designed', () => {
    const web = resolve([root({ 'data-mode': 'dark', 'data-accent': 'pink' })]);
    expect(web.get('--text-scale')).toBe('1');
    expect(web.get('--text-sm')).toBe('calc(11.5px * 1)');
  });

  test('the call colours exist only inside the scope', () => {
    expect(resolve([root({ 'data-mode': 'light', 'data-accent': 'pink', 'data-platform': 'native' })]).has('--call-bg')).toBe(false);
  });
});

describe('toasts (design pass 7)', () => {
  // inverted: light in dark mode and dark in light mode; the action is the other mode's bright accent
  const INVERTED = {
    dark: { '--toast-bg': '#E6E5EB', '--toast-ink': '#1A1720', '--toast-ink-2': '#5A5764', '--toast-success': '#0E8B62' },
    light: { '--toast-bg': '#24212A', '--toast-ink': '#F2F1F5', '--toast-ink-2': '#B9B6C2', '--toast-success': '#2EE6A8' },
  };
  const ACTION = {
    dark: { pink: '#C8244A', orange: '#A85413', blue: '#1B5FCC', green: '#0A7A57' },
    light: { pink: '#FF8298', orange: '#FFA366', blue: '#7DBBFF', green: '#6BF0C4' },
  };
  const TOAST = ['--toast-bg', '--toast-ink', '--toast-ink-2', '--toast-hover', '--toast-shadow', '--toast-success', '--toast-success-soft', '--toast-action', '--toast-action-soft', '--toast-action-hover'];

  test.each(MODES.flatMap((mode) => ACCENTS.map((accent) => [mode, accent] as const)))('%s · %s: inverted, with the other mode\'s accent on the action', (mode, accent) => {
    for (const platform of [{}, { 'data-platform': 'native' }]) {
      const tokens = resolve([root({ 'data-mode': mode, 'data-accent': accent, ...platform })]);
      for (const [name, value] of Object.entries(INVERTED[mode])) expect([name, tokens.get(name)]).toEqual([name, value]);
      expect(tokens.get('--toast-action')).toBe(ACTION[mode][accent]);
      for (const name of TOAST) expect([name, tokens.get(name)?.includes('UNSET')]).toEqual([name, false]);
    }
  });

  test('the action\'s soft and hover fills are its colour at 10/18% in dark mode and 14/24% in light', () => {
    const dark = resolve([root({ 'data-mode': 'dark', 'data-accent': 'blue' })]);
    const light = resolve([root({ 'data-mode': 'light', 'data-accent': 'blue' })]);
    expect([dark.get('--toast-action-soft'), dark.get('--toast-action-hover')]).toEqual(['rgba(27,95,204,.10)', 'rgba(27,95,204,.18)']);
    expect([light.get('--toast-action-soft'), light.get('--toast-action-hover')]).toEqual(['rgba(125,187,255,.14)', 'rgba(125,187,255,.24)']);
  });

  test('an always-dark area inside a light root has the dark toast, in its root\'s accent', () => {
    const inside = resolve([root({ 'data-mode': 'light', 'data-accent': 'orange', 'data-platform': 'native' }), call]);
    expect(inside.get('--toast-bg')).toBe('#E6E5EB');
    expect(inside.get('--toast-action')).toBe('#A85413');
  });

  test('the default root (no attributes) has the dark · pink toast', () => {
    const plain = resolve([root({})]);
    expect(plain.get('--toast-bg')).toBe('#E6E5EB');
    expect(plain.get('--toast-action')).toBe('#C8244A');
  });
});
