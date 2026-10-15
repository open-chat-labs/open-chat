// Section deep links: `#<section id>` names a section in any group (ids are unique across groups).
import { sectionsFor, type GroupId } from './sections';
import type { Target } from './search';

/** The section a location hash names ('#message-composer'), with its group; null for no hash or an unknown id. */
export function sectionFromHash(hash: string): Target | null {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  if (!id) return null;
  for (const [group, list] of Object.entries(sectionsFor) as [GroupId, (typeof sectionsFor)[GroupId]][]) {
    if (list.some((s) => s.id === id)) return { group, id };
  }
  return null;
}
