import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { ICON_ATTRS, ICONS } from './icons.js';
import manifest from '../../export-manifest.json';

test('icons.css defines a mask for every icon, and the export manifest counts them', () => {
  const names = Object.keys(ICONS);
  // read from disk: vitest hands CSS imports over empty
  const iconsCss = readFileSync(join(__dirname, 'styles/icons.css'), 'utf8');
  const masks = [...iconsCss.matchAll(/--icon-([a-z0-9-]+):/g)].map((m) => m[1]);
  expect(masks.sort()).toEqual([...names].sort());
  expect(manifest.icons.count).toBe(names.length);
  // ICON_ATTRS only overrides the SVG attributes of a few of them; they aren't extra icons
  expect(Object.keys(ICON_ATTRS).filter((name) => !(name in ICONS))).toEqual([]);
});
