import { compile } from 'svelte/compiler';
import { expect, test } from 'vitest';
import source from './Docs.svelte?raw';

// drops :where(…) groups, which add nothing to a selector's specificity
const outsideWhere = (selector: string) => {
  let out = '';
  for (let i = 0; i < selector.length; ) {
    if (!selector.startsWith(':where(', i)) {
      out += selector[i++];
      continue;
    }
    let depth = 0;
    i += ':where'.length;
    do {
      if (selector[i] === '(') depth++;
      else if (selector[i] === ')') depth--;
      i++;
    } while (depth > 0);
  }
  return out.trim();
};

test("the docs' link colour is as weak as a bare `a`, so components' own link colours win", () => {
  const css = compile(source, { css: 'external', filename: 'Docs.svelte' }).css!.code.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}]*data-oc-page[^{}]*)\{/g)].map((m) => m[1].trim());
  expect(selectors).toHaveLength(2);
  expect(selectors.map(outsideWhere)).toEqual(['a', 'a:hover']);
});
