// meta.json is written by hand on every change, so this keeps it honest: each component's documented props are
// exactly the names in its Props type (the API tab, Props dialogs and search read meta.json, not the source).
import { describe, expect, test } from 'vitest';
import meta from './meta.json';

const sources = import.meta.glob<string>(['../lib/components/*.svelte', '../features/components/*.svelte', '../pages/*.svelte'], { query: '?raw', import: 'default', eager: true });
const byName = new Map(Object.entries(sources).map(([path, text]) => [path.split('/').pop()!.replace('.svelte', ''), text]));
// helpers that take no props worth documenting
const UNDOCUMENTED = ['Translate'];

/** Top-level member names of an object type body (from just after its "{"), skipping comments and nested types. */
function members(body: string): string[] {
  const names: string[] = [];
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (body.startsWith('/*', i)) {
      i = body.indexOf('*/', i + 2) + 1;
    } else if (body.startsWith('//', i)) {
      i = body.indexOf('\n', i);
    } else if ('{([<'.includes(c)) {
      depth++;
    } else if ('})]'.includes(c) || (c === '>' && body[i - 1] !== '=')) {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && (i === 0 || /[\s;{]/.test(body[i - 1]))) {
      const m = /^([A-Za-z_$][\w$]*)\??\s*:/.exec(body.slice(i));
      if (m) {
        names.push(m[1]);
        i += m[0].length - 1;
      }
    }
  }
  return names;
}

/** Member names of a named type: an interface, or a type alias of object literals / named types joined by & or |. */
export function typeMembers(source: string, type: string): string[] | null {
  const iface = new RegExp(`interface ${type}\\b[^{]*\\{`).exec(source);
  if (iface) return members(source.slice(iface.index + iface[0].length));
  const alias = new RegExp(`type ${type}\\s*=`).exec(source);
  if (!alias) return null;
  const names = new Set<string>();
  let i = alias.index + alias[0].length;
  for (;;) {
    while (/[\s|&]/.test(source[i])) i++;
    if (source[i] === '{') {
      members(source.slice(i + 1)).forEach((n) => names.add(n));
      let depth = 0;
      do {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') depth--;
        i++;
      } while (depth > 0);
    } else {
      const m = /^[A-Za-z_$][\w$]*/.exec(source.slice(i));
      if (!m) break;
      (typeMembers(source, m[0]) ?? []).forEach((n) => names.add(n));
      i += m[0].length;
    }
    if (!/^\s*[|&]/.test(source.slice(i))) break;
  }
  return [...names];
}

describe('meta.json', () => {
  const entries = meta as { name: string; props?: { name: string }[] }[];

  test('has an entry for every component', () => {
    const missing = [...byName.keys()].filter((name) => !UNDOCUMENTED.includes(name) && !entries.some((c) => c.name === name));
    expect(missing).toEqual([]);
  });

  test.each(entries.filter((c) => byName.has(c.name)).map((c) => [c.name, c] as const))('%s documents exactly its Props', (name, c) => {
    const names = typeMembers(byName.get(name)!, 'Props');
    expect(names, `no Props type found in ${name}`).not.toBeNull();
    expect((c.props ?? []).map((p) => p.name).sort()).toEqual([...names!].sort());
  });
});
