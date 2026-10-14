// Props metadata (meta.json) helpers shared by the API group, section Props dialogs and search.
import meta from './meta.json';

export type Prop = { name: string; type: string; editor: string | null; options: string[] | null; required?: boolean; componentDefault?: string | null; doc?: string };
export type ComponentMeta = { name: string; source: string; description: string; group?: string; props: Prop[] };

export const components = meta as unknown as ComponentMeta[];
const byName = new Map(components.map((c) => [c.name, c]));

/** Components named in a section's meta line ("Button.dc.html · IconButton.dc.html"), in that order, that have props. */
export function componentsIn(metaLine: string): ComponentMeta[] {
  const names = metaLine.replace(/\.dc\.html/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const seen = new Set<string>();
  return names.flatMap((n) => {
    const c = byName.get(n);
    if (!c || !c.props.length || seen.has(n)) return [];
    seen.add(n);
    return [c];
  });
}
