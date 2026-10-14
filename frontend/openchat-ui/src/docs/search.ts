// Search index for the Component Library: every section of every group, plus every component with the
// sections that demo it (matched by name in the section's meta line) and its API entry.
import meta from './meta.json';
import { groups, sectionsFor, type GroupId } from './sections';

export type Target = { group: GroupId; id: string };
export type Hit = {
  kind: 'component' | 'section';
  title: string;
  /** Second line: description, or the section's meta. */
  sub: string;
  /** Primary jump target (a demo if there is one, else the API entry). */
  target: Target;
  /** Extra targets shown as chips: demo sections and the API entry. */
  links: (Target & { label: string })[];
  /** Lower-cased text searched beyond the title: description, meta, prop names. */
  haystack: string;
};

type Meta = { name: string; description: string; group?: string; props: { name: string }[] };

const label = (g: GroupId) => groups.find((x) => x.id === g)!.label;
const words = (s: string) => new Set(s.replace(/\.dc\.html/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean));

const demoGroups: GroupId[] = ['foundations', 'general', 'app'];

const sectionHits: Hit[] = demoGroups.flatMap((g) =>
  sectionsFor[g].map((s) => ({
    kind: 'section' as const,
    title: s.title,
    sub: s.meta,
    target: { group: g, id: s.id },
    links: [],
    haystack: (s.id + ' ' + s.meta).toLowerCase(),
  })),
);

const componentHits: Hit[] = (meta as Meta[]).map((c) => {
  const demos = demoGroups.flatMap((g) => sectionsFor[g].filter((s) => words(s.meta).has(c.name)).map((s) => ({ group: g, id: s.id, label: `${label(g)} › ${s.title}` })));
  const api = c.props.length ? [{ group: 'api' as const, id: 'api-' + c.name.toLowerCase(), label: 'API' }] : [];
  const links = [...demos, ...api];
  return {
    kind: 'component' as const,
    title: c.name,
    sub: c.description.split('\n')[0] || (c.group === 'app' ? 'App component' : 'Library component'),
    target: links[0] ?? { group: 'api', id: '' },
    links,
    haystack: (c.description + ' ' + c.props.map((p) => p.name).join(' ')).toLowerCase(),
  };
}).filter((h) => h.links.length);

const index = [...componentHits, ...sectionHits];

/** Name matches first (exact, prefix, word start, CamelCase initials, substring), then text matches. */
function score(h: Hit, q: string): number {
  const t = h.title.toLowerCase();
  const bonus = h.kind === 'component' ? 0.5 : 0;
  if (t === q) return 100 + bonus;
  if (t.startsWith(q)) return 80 + bonus;
  // word starts: "picker" → ChatPicker, "chat pi" → ChatPicker
  const parts = h.title.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (parts.some((p) => p.startsWith(q))) return 70 + bonus;
  const initials = parts.map((p) => p[0]).join('');
  if (q.length >= 2 && initials.startsWith(q)) return 65 + bonus;
  if (t.includes(q)) return 60 + bonus;
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length > 1 && terms.every((w) => t.includes(w) || h.haystack.includes(w))) return 40 + bonus;
  if (h.haystack.includes(q)) return 30 + bonus;
  return 0;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function search(query: string, limit = 12): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const ranked = index
    .map((h) => ({ h, s: score(h, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.h.title.localeCompare(b.h.title))
    .map((x) => x.h);
  // a section named after a component ("Chat picker") adds nothing next to the component (ChatPicker)
  const names = new Set(ranked.filter((h) => h.kind === 'component').map((h) => norm(h.title)));
  return ranked.filter((h) => h.kind === 'component' || !names.has(norm(h.title))).slice(0, limit);
}
