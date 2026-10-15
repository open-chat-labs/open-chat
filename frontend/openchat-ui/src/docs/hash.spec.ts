import { describe, expect, test } from 'vitest';
import { sectionFromHash } from './hash';
import { sectionsFor } from './sections';

describe('sectionFromHash', () => {
  test('finds a section in any group', () => {
    for (const [group, list] of Object.entries(sectionsFor)) {
      const id = list[0].id;
      expect(sectionFromHash('#' + id)).toEqual({ group, id });
      expect(sectionFromHash(id)).toEqual({ group, id });
    }
  });

  test('decodes the hash', () => {
    const id = sectionsFor.features[0].id;
    expect(sectionFromHash('#' + encodeURIComponent(id))).toEqual({ group: 'features', id });
  });

  test.each(['', '#', '#no-such-section', '#%E0%A4%A'])('%s names no section', (hash) => {
    expect(sectionFromHash(hash)).toBeNull();
  });
});
