<!-- API: one section per component with props — PROP · TYPE · CONTROL · DEFAULT, from meta.json
     (regenerated from each component's Props interface and $props() defaults). -->
<script lang="ts">
  import Section from '../Section.svelte';
  import Frame from '../Frame.svelte';
  import { api, apiComponents } from '../sections';

  type Prop = { name: string; type: string; editor: string | null; options: string[] | null; required?: boolean; componentDefault?: string | null; doc?: string };

  const propsOf = (c: { props: unknown[] }) => c.props as Prop[];
  const control = (p: Prop) => (p.options?.length ? p.options.join(' | ') : p.editor ?? '—');
  // the component's own default as written in its source; `required` when it has none and must be passed
  const fallback = (p: Prop) => (p.required ? null : p.componentDefault ?? 'undefined');
</script>

<div class="api">
  {#each apiComponents as c, i (c.name)}
    <Section {...api[i]}>
      <Frame>
        <div class="table" role="table" aria-label="{c.name} props">
          <div class="row head" role="row">
            <span role="columnheader">PROP</span><span role="columnheader">TYPE</span><span role="columnheader">CONTROL</span><span role="columnheader">DEFAULT</span>
          </div>
          {#each propsOf(c) as p (p.name)}
            {@const d = fallback(p)}
            <div class="row" role="row">
              <span role="cell" class="prop">{p.name}{#if p.doc}<span class="doc">{p.doc}</span>{/if}</span>
              <span role="cell">{p.type}</span>
              <span role="cell">{control(p)}</span>
              <span role="cell">{#if d === null}<span class="req">required</span>{:else}{d}{/if}</span>
            </div>
          {/each}
        </div>
      </Frame>
    </Section>
  {/each}
</div>

<style>
  .api { display: flex; flex-direction: column; gap: 56px; }
  .table { display: flex; flex-direction: column; width: 100%; }
  .row { display: grid; grid-template-columns: 1.1fr 1.6fr 1.1fr 0.8fr; gap: 14px; padding: 8px 0; border-bottom: 1px solid var(--line-1); font: 400 11.5px/1.4 var(--font-mono); color: var(--ink-2); }
  .row:last-child { border-bottom: 0; }
  .row > span { min-width: 0; overflow-wrap: anywhere; unicode-bidi: plaintext; }
  .row.head { padding-top: 0; font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; color: var(--ink-4); }
  .prop { color: var(--ink); }
  .doc { display: block; margin-top: 2px; font-family: var(--font-sans); color: var(--ink-4); }
  .req { color: var(--accent-bright); }
</style>
