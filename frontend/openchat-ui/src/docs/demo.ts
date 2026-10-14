// Demo props for a component: the demo values recorded in meta.json (props with an editor) overlaid with
// samples.ts, the same values the original export's preview used. Feature sections render whole screens with these.
import meta from './meta.json';
import { samples } from './samples';

type Prop = { name: string; default: unknown; editor: string | null };
type Meta = { name: string; props: Prop[]; preview: { width?: number | string; height?: number | string } | null };

const byName = new Map((meta as Meta[]).map((m) => [m.name, m]));

export function demoProps(name: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of byName.get(name)?.props ?? []) if (p.default != null && p.editor !== null) out[p.name] = p.default;
  return { ...out, ...(samples[name] ?? {}) };
}

/** The size the prototype previewed the component at, as CSS lengths. */
export function previewSize(name: string): { width: string; height: string } {
  const px = (x: number | string | undefined, fallback: string) => (x == null ? fallback : typeof x === 'number' ? x + 'px' : x);
  const p = byName.get(name)?.preview;
  return { width: px(p?.width, '100%'), height: px(p?.height, 'auto') };
}
