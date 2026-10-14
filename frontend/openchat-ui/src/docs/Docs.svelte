<!-- Component docs: one section per library component — live demo (defaults + samples), props table from meta.json. -->
<script lang="ts">
  import * as Lib from '../lib/index';
  import * as App from '../app/index';
  import meta from './meta.json';
  import { samples, overlays } from './samples';

  // `default` is the demo value (fed to the live demo); `componentDefault` is the source text of the component's own default
  type Prop = {
    name: string;
    type: string;
    default: unknown;
    editor: string | null;
    options: string[] | null;
    section: string | null;
    required?: boolean;
    componentDefault?: string | null;
    doc?: string;
  };
  type Meta = { group?: 'library' | 'app'; name: string; source: string; hash: string; description: string; preview: { width?: number | string; height?: number | string } | null; props: Prop[] };

  const comps: Record<string, any> = { ...(Lib as any), ...(App as any) };
  const all = (meta as Meta[]).slice().sort((a, b) => a.name.localeCompare(b.name));

  let mode = $state('dark');
  let accent = $state('pink');
  let query = $state('');
  let open = $state<Record<string, boolean>>({});
  let propsOf = $state<Meta | null>(null);

  let group = $state<'library' | 'app'>('library');
  const shown = $derived(all.filter((m) => (m.group ?? 'library') === group && (!query || m.name.toLowerCase().includes(query.toLowerCase()))));
  const isOverlay = (n: string) => overlays.includes(n) || /Dialog$/.test(n);

  const defaults = (m: Meta) => {
    const out: Record<string, unknown> = {};
    for (const p of m.props) if (p.default !== null && p.default !== undefined && p.editor !== null) out[p.name] = p.default;
    return out;
  };
  const px = (x: number | string | undefined, fallback: string) => (x == null ? fallback : typeof x === 'number' ? x + 'px' : x);
  const propsFor = (m: Meta) => {
    const base = { ...defaults(m), ...(samples[m.name] ?? {}) };
    if (isOverlay(m.name)) return { ...base, onClose: () => (open[m.name] = false), onSend: () => (open[m.name] = false) };
    return base;
  };
</script>

<div data-mode={mode} data-accent={accent} class="docs">
  <aside class="nav">
    <div class="brand">OpenChat UI</div>
    <div class="groups" role="tablist" aria-label="Component group">
      <button role="tab" aria-selected={group === 'library'} class:on={group === 'library'} onclick={() => (group = 'library')}>Library</button>
      <button role="tab" aria-selected={group === 'app'} class:on={group === 'app'} onclick={() => (group = 'app')}>App</button>
    </div>
    <input class="search" placeholder="Filter components" bind:value={query} aria-label="Filter components" />
    <nav aria-label="Components">
      {#each shown as m}
        <a href={'#' + m.name}>{m.name}</a>
      {/each}
    </nav>
  </aside>

  <main class="main">
    <header class="top">
      <h1>{group === 'app' ? 'App components' : 'Library'} <span>{shown.length}</span></h1>
      <label>Mode
        <select bind:value={mode}><option value="dark">Dark</option><option value="light">Light</option></select>
      </label>
      <label>Accent
        <select bind:value={accent}>
          <option value="pink">Pink</option><option value="orange">Orange</option><option value="blue">Blue</option><option value="green">Green</option>
        </select>
      </label>
    </header>

    {#each shown as m (m.name)}
      {@const C = comps[m.name]}
      <section id={m.name} class="section">
        <div class="head">
          <h2>{m.name}</h2>
          <code>{m.source} · {m.hash}</code>
          {#if m.props.length}
            <button class="props-btn" onclick={() => (propsOf = m)}>Props <span>{m.props.length}</span></button>
          {/if}
        </div>
        {#if m.description}<p class="desc">{m.description}</p>{/if}

        <div class="demo" style="min-height:{px(m.preview?.height, '80px')}">
          <div class="stage" style="width:min(100%, {px(m.preview?.width, '100%')})">
            <svelte:boundary>
              {#if isOverlay(m.name)}
                <button class="open" onclick={() => (open[m.name] = true)}>Open {m.name}</button>
                {#if open[m.name] && C}<C {...propsFor(m)} />{/if}
              {:else if C}
                <C {...propsFor(m)} />
              {/if}
              {#snippet failed(error)}
                <pre class="demo-error">{String((error as Error)?.message ?? error)}</pre>
              {/snippet}
            </svelte:boundary>
          </div>
        </div>

      </section>
    {/each}
  </main>

  {#if propsOf}
    {@const m = propsOf}
    <Lib.DialogShell title="{m.name} props" width={820} height="auto" flush onClose={() => (propsOf = null)}>
      <div class="props-scroll">
        <table>
          <thead><tr><th>Prop</th><th>Type</th><th>Default</th></tr></thead>
          <tbody>
            {#each m.props as p}
              <tr>
                <td>
                  <code>{p.name}</code>
                  {#if p.doc}<div class="prop-doc">{p.doc}</div>{/if}
                </td>
                <td><code>{p.options ? p.options.map((o) => JSON.stringify(o)).join(' | ') : p.type}</code></td>
                <td>
                  {#if p.required}<span class="required">required</span>{:else}<code>{p.componentDefault ?? '—'}</code>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Lib.DialogShell>
  {/if}
</div>

<style>
  .groups { display: flex; gap: 4px; padding: 2px; border-radius: 10px; background: var(--overlay-1, rgba(255,255,255,.05)); margin-bottom: 10px; }
  .groups button { flex: 1; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--ink-2, #B9B9C6); font: 600 12.5px/1 var(--font-sans); cursor: pointer; }
  .groups button.on { background: var(--surface-3, #24242e); color: var(--ink, #ECECF1); }
  .docs { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 100vh; background: var(--surface-0); color: var(--ink); font-family: var(--font-sans, 'Plus Jakarta Sans', system-ui, sans-serif); }
  .nav { position: sticky; top: 0; height: 100vh; overflow-y: auto; box-sizing: border-box; padding: 20px 14px; border-right: 1px solid var(--line-1); background: var(--surface-1); display: flex; flex-direction: column; gap: 12px; }
  /* thin scrollbars that sit on the surface instead of the OS gutter */
  .nav, .props-scroll { scrollbar-width: thin; scrollbar-color: var(--line-2, rgba(255,255,255,.1)) transparent; }
  .nav::-webkit-scrollbar, .props-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .nav::-webkit-scrollbar-track, .props-scroll::-webkit-scrollbar-track { background: transparent; }
  .nav::-webkit-scrollbar-thumb, .props-scroll::-webkit-scrollbar-thumb { border-radius: 3px; background: var(--line-2, rgba(255,255,255,.1)); }
  .nav::-webkit-scrollbar-thumb:hover, .props-scroll::-webkit-scrollbar-thumb:hover { background: var(--ink-4); }
  .brand { font: 700 15px/1 var(--font-sans); padding: 4px 8px; }
  .search { height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--field); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line-1); font: 500 13px/1 var(--font-sans); outline: none; }
  .nav > * { flex-shrink: 0; }
  nav { display: flex; flex-direction: column; gap: 2px; }
  nav a { padding: 7px 10px; border-radius: 8px; color: var(--ink-2); text-decoration: none; font: 500 13px/1.2 var(--font-sans); }
  nav a:hover { background: var(--overlay-1); color: var(--ink); }
  .main { box-sizing: border-box; width: 100%; max-width: 1080px; justify-self: center; min-width: 0; padding: 28px 40px 80px; display: flex; flex-direction: column; gap: 56px; }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }
  .top h1 { margin: 0 auto 0 0; font: 700 24px/1 var(--font-sans); letter-spacing: -0.02em; }
  .top h1 span { font: 500 13px/1 var(--font-mono); color: var(--ink-4); margin-left: 8px; }
  .top label { display: flex; align-items: center; gap: 8px; font: 500 12.5px/1 var(--font-sans); color: var(--ink-3); }
  .top select { height: 32px; border-radius: 8px; border: 0; padding: 0 8px; background: var(--field); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line-1); }
  .section { scroll-margin-top: 24px; display: flex; flex-direction: column; gap: 16px; }
  .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line-1); }
  .head h2 { margin: 0; font: 700 17px/1 var(--font-sans); letter-spacing: -0.015em; }
  .head code { font: 400 12px/1 var(--font-mono); color: var(--ink-4); }
  .props-btn { margin-left: auto; align-self: center; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--overlay-1); color: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line-1); font: 600 12px/1 var(--font-sans); cursor: pointer; }
  .props-btn:hover { background: var(--overlay-2); color: var(--ink); }
  .props-btn span { font: 500 11px/1 var(--font-mono); color: var(--ink-4); }
  .props-scroll { max-height: min(70vh, 640px); overflow: auto; padding: 4px 12px 12px; }
  .props-scroll th { position: sticky; top: 0; background: var(--surface-1); }
  .desc { margin: 0; max-width: 760px; font: 400 13.5px/1.6 var(--font-sans); color: var(--ink-3); white-space: pre-line; }
  .demo { box-sizing: border-box; padding: 24px; border-radius: 20px; background: var(--surface-1); box-shadow: inset 0 0 0 1px var(--line-1); display: flex; align-items: flex-start; justify-content: center; }
  .stage { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); }
  .demo-error { margin: 0; padding: 12px 14px; border-radius: 10px; background: color-mix(in srgb, var(--status-danger, #f5493d) 14%, transparent); color: var(--status-danger, #f5493d); font: 500 12px/1.5 var(--font-mono); white-space: pre-wrap; }
  .open { justify-self: start; height: 40px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--overlay-2); color: var(--ink); font: 600 13.5px/1 var(--font-sans); cursor: pointer; }
  table { width: 100%; border-collapse: collapse; font: 400 12.5px/1.5 var(--font-sans); }
  th { text-align: left; font: 600 11px/1 var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-4); padding: 8px 10px; border-bottom: 1px solid var(--line-1); }
  td { padding: 8px 10px; border-bottom: 1px solid var(--line-1); vertical-align: top; color: var(--ink-2); }
  td code { font: 400 12px/1.5 var(--font-mono); overflow-wrap: anywhere; }
  .props-scroll td:last-child code { overflow-wrap: normal; white-space: nowrap; }
  .prop-doc { margin-top: 2px; color: var(--ink-4); }
  .required { font: 600 11px/1 var(--font-mono); letter-spacing: 0.04em; color: var(--accent-bright); }
</style>
