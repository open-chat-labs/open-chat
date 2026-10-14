<!-- Foundations: colour, scales, typography, layout ladder. Every value shown is read live from the tokens
     (getComputedStyle on the themed root), so it follows mode and accent. -->
<script lang="ts">
  import { tick } from 'svelte';
  import Section from '../Section.svelte';
  import Frame from '../Frame.svelte';
  import { foundations, sec } from '../sections';

  interface Props {
    /** Changes whenever mode or accent changes; triggers a re-read of the computed token values. */
    theme: string;
  }

  let { theme }: Props = $props();

  const colours: { title: string; tokens: string[] }[] = [
    { title: 'Surfaces', tokens: ['bg', 'surface-0', 'surface-1', 'surface-2', 'field', 'scrim', 'on-cover-bg'] },
    { title: 'Ink', tokens: ['ink', 'ink-2', 'ink-3', 'ink-4', 'meta', 'on-cover-ink'] },
    { title: 'Lines & overlays', tokens: ['line-1', 'line-2', 'line-3', 'overlay-1', 'overlay-2', 'btn-hover'] },
    { title: 'Accent', tokens: ['accent', 'accent-hover', 'accent-bright', 'accent-mid', 'accent-dim', 'accent-soft', 'on-accent'] },
    { title: 'Status', tokens: ['status-online', 'status-warning', 'status-danger', 'status-danger-soft', 'status-verified', 'status-chit', 'status-chit-soft'] },
    { title: 'Bubbles', tokens: ['bubble-send-bg', 'bubble-reply', 'bubble-text', 'bubble-text-soft', 'bubble-tick', 'bubble-recv-bg', 'bubble-recv-text', 'bubble-wave-off'] },
    { title: 'Categories', tokens: ['category-a', 'category-a-soft', 'category-b', 'category-b-soft', 'category-c', 'category-c-soft'] },
    { title: 'Covers', tokens: ['cover-plum', 'cover-teal', 'cover-violet', 'cover-amber', 'cover-slate'] },
    { title: 'Buttons', tokens: ['btn-danger-bg', 'btn-danger-bg-hover', 'btn-danger-line', 'skeleton-base'] },
  ];

  type Kind = 'bar' | 'radius' | 'shadow' | 'text' | 'plain';
  const scales: { title: string; kind: Kind; tokens: string[] }[] = [
    { title: 'Spacing', kind: 'bar', tokens: ['space-2', 'space-4', 'space-6', 'space-8', 'space-10', 'space-12', 'space-14', 'space-16', 'space-18', 'space-22', 'space-24', 'space-26', 'space-32'] },
    { title: 'Radius', kind: 'radius', tokens: ['radius-xs', 'radius-sm', 'radius-md', 'radius-lg', 'radius-xl', 'radius-2xl', 'radius-pill', 'radius-circle'] },
    { title: 'Sizing', kind: 'bar', tokens: ['icon-sm', 'icon-md', 'icon-lg', 'icon-xl', 'avatar-xs', 'avatar-sm', 'avatar-md', 'avatar-lg', 'control-sm', 'control-md', 'control-lg', 'control-xl', 'control-row', 'rail-collapsed'] },
    { title: 'Type', kind: 'text', tokens: ['text-2xs', 'text-xs', 'text-sm', 'text-md', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'] },
    { title: 'Weight · leading · tracking', kind: 'plain', tokens: ['weight-regular', 'weight-medium', 'weight-semibold', 'weight-bold', 'leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'tracking-tight', 'tracking-normal', 'tracking-wide', 'tracking-caps'] },
    { title: 'Motion', kind: 'plain', tokens: ['duration-fast', 'duration-base', 'duration-slow', 'ease-out', 'ease-standard'] },
    { title: 'Elevation', kind: 'shadow', tokens: ['shadow-raised', 'shadow-panel', 'shadow-modal'] },
    { title: 'Borders', kind: 'plain', tokens: ['border-hairline', 'border-thin', 'border-ring'] },
    { title: 'Z-index', kind: 'plain', tokens: ['z-base', 'z-sticky', 'z-backdrop', 'z-modal'] },
  ];

  const ramp: { spec: string; font: string; sample: string; mono?: boolean; caps?: boolean }[] = [
    { spec: '700 · 34/1.05', font: '700 var(--text-3xl)/1.05', sample: 'Page title' },
    { spec: '700 · 19/1.2', font: '700 var(--text-2xl)/1.2', sample: 'Dialog title' },
    { spec: '700 · 17/1', font: '700 var(--text-xl)/1', sample: 'Section title' },
    { spec: '600 · 15.5/1.35', font: '600 var(--text-lg)/1.35', sample: 'Chat name · panel heading' },
    { spec: '400 · 13.5/1.5', font: '400 var(--text-base)/1.5', sample: 'Body — the message text and most of the interface reads at this size.' },
    { spec: '500 · 12.5/1.35', font: '500 var(--text-md)/1.35', sample: 'Secondary — previews, descriptions, row subtitles' },
    { spec: '500 · 11.5/1.35', font: '500 var(--text-sm)/1.35', sample: 'Caption — timestamps, helper text' },
    { spec: '700 · 10/1 · .12em', font: '700 var(--text-xs)/1', sample: 'Section label', caps: true },
    { spec: 'mono 400 · 12/1.4', font: '400 12px/1.4', sample: 'lib/Button.dc.html · 8b5cf575', mono: true },
    { spec: 'mono 500 · 10 · .09em', font: '500 10px/1', sample: 'Try it · inline label', mono: true, caps: true },
  ];

  // Responsive ladder: at each breakpoint, which width tokens the three columns take.
  const ladder: { bp: string | null; list: string; info: string | null; note: string }[] = [
    { bp: null, list: 'panel-list-xs', info: null, note: 'Info panel slides over the chat' },
    { bp: 'bp-sm', list: 'panel-list-sm', info: 'panel-info-md', note: 'Three columns from here' },
    { bp: 'bp-md', list: 'panel-list-sm', info: 'panel-info-lg', note: '' },
    { bp: 'bp-lg', list: 'panel-list-lg', info: 'panel-info-lg', note: '' },
    { bp: 'bp-xl', list: 'panel-list-xl', info: 'panel-info-xl', note: '' },
    { bp: 'bp-2xl', list: 'panel-list-xl', info: 'panel-info-xl', note: 'Chat is an island, min --island-min' },
    { bp: 'bp-3xl', list: 'panel-list-3xl', info: 'panel-info-3xl', note: '' },
  ];

  let host: HTMLDivElement;
  let values = $state<Record<string, string>>({});

  const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
  function pretty(raw: string): string {
    const v = raw.trim();
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v.toUpperCase();
    const m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
    if (m) {
      const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return '#' + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]) + (a < 1 ? hex2(a * 255) : '');
    }
    if (/gradient\(/.test(v)) return 'gradient';
    return v;
  }

  const all = [...colours.flatMap((g) => g.tokens), ...scales.flatMap((g) => g.tokens), ...ladder.flatMap((r) => [r.bp, r.list, r.info]), 'panel-chat-min', 'island-min'];

  $effect(() => {
    theme;
    tick().then(() => {
      const root = host?.closest<HTMLElement>('[data-mode]');
      if (!root) return;
      const cs = getComputedStyle(root);
      const out: Record<string, string> = {};
      for (const t of all) if (t) out[t] = pretty(cs.getPropertyValue('--' + t));
      values = out;
    });
  });
</script>

<div class="foundations" bind:this={host}>
  <Section {...sec(foundations, 'colour')}>
    <div class="grid3">
      {#each colours as g}
        <Frame label={g.title}>
          <div class="swatches">
            {#each g.tokens as t}
              <div class="swatch-item">
                <span class="swatch" style:background="var(--{t})"></span>
                <span class="name">--{t}</span>
                <span class="val">{values[t] ?? ''}</span>
              </div>
            {/each}
          </div>
        </Frame>
      {/each}
    </div>
  </Section>

  <Section {...sec(foundations, 'scales')}>
    <div class="grid3">
      {#each scales as g}
        <Frame label={g.title}>
          <div class="rows">
            {#each g.tokens as t}
              <div class="scale-row">
                <span class="name">--{t}</span>
                <span class="val">{values[t] ?? ''}</span>
                {#if g.kind === 'bar'}
                  <span class="bar" style:width="var(--{t})"></span>
                {:else if g.kind === 'radius'}
                  <span class="radius" style:border-radius="var(--{t})"></span>
                {:else if g.kind === 'shadow'}
                  <span class="tile" style:box-shadow="var(--{t})"></span>
                {:else if g.kind === 'text'}
                  <span class="text-sample" style:font-size="var(--{t})">Ag</span>
                {/if}
              </div>
            {/each}
          </div>
        </Frame>
      {/each}
    </div>
  </Section>

  <Section {...sec(foundations, 'typography')}>
    <Frame>
      <div class="ramp">
        {#each ramp as r}
          <div class="ramp-row">
            <span class="spec">{r.spec}</span>
            <span class="sample" class:mono={r.mono} class:caps={r.caps} style:font="{r.font} {r.mono ? 'var(--font-mono)' : 'var(--font-sans)'}">{r.sample}</span>
          </div>
        {/each}
      </div>
    </Frame>
  </Section>

  <Section {...sec(foundations, 'layout')}>
    <Frame>
      <div class="ladder" role="table" aria-label="Responsive layout ladder">
        <div class="lrow head" role="row">
          <span role="columnheader">VIEWPORT</span><span role="columnheader">CHAT LIST</span><span role="columnheader">INFO PANEL</span><span role="columnheader">CHAT</span><span role="columnheader">NOTES</span>
        </div>
        {#each ladder as r, i}
          {@const next = ladder[i + 1]?.bp}
          <div class="lrow" role="row">
            <span role="cell">
              {#if r.bp}≥ {values[r.bp] ?? ''} <em>--{r.bp}</em>{:else}&lt; {values[ladder[1].bp!] ?? ''}{/if}
              {#if next && r.bp}<em> · to {values[next] ?? ''}</em>{/if}
            </span>
            <span role="cell">{values[r.list] ?? ''} <em>--{r.list}</em></span>
            <span role="cell">{#if r.info}{values[r.info] ?? ''} <em>--{r.info}</em>{:else}overlay{/if}</span>
            <span role="cell">fluid · min {values['panel-chat-min'] ?? ''}</span>
            <span role="cell" class="note">{r.note}</span>
          </div>
        {/each}
      </div>
    </Frame>
  </Section>
</div>

<style>
  .foundations { display: flex; flex-direction: column; gap: 56px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  /* token names and values are code: keep them LTR inside an RTL page */
  .name, .val, .spec, .lrow > span { direction: ltr; unicode-bidi: isolate; }
  .name { justify-self: start; font: 500 11px/1.3 var(--font-mono); color: var(--ink-2); overflow-wrap: anywhere; }
  .val { justify-self: end; font: 400 10.5px/1.3 var(--font-mono); color: var(--ink-4); }

  .swatches { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 12px; width: 100%; }
  .swatch-item { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
  .swatch { width: 38px; height: 38px; border-radius: 13px; box-shadow: inset 0 0 0 1px var(--line-2); margin-bottom: 2px; }

  .rows { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .scale-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 8px; }
  .scale-row > :nth-child(3) { grid-column: 1 / -1; }
  .bar { display: block; height: 10px; max-width: 100%; border-radius: 3px; background: var(--accent); }
  .radius { display: block; width: 34px; height: 34px; background: var(--accent-soft); box-shadow: inset 0 0 0 1.5px var(--accent); }
  .tile { display: block; width: 100%; height: 44px; margin: 4px 0 10px; border-radius: var(--radius-md); background: var(--surface-2); }
  .text-sample { font-family: var(--font-sans); font-weight: 600; line-height: 1.1; color: var(--ink); }

  .ramp { display: flex; flex-direction: column; width: 100%; }
  .ramp-row { display: grid; grid-template-columns: 150px minmax(0, 1fr); align-items: baseline; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--line-1); }
  .ramp-row:last-child { border-bottom: 0; }
  .spec { font: 400 11.5px/1.4 var(--font-mono); color: var(--ink-4); }
  .sample { color: var(--ink); }
  .sample.caps { text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--ink-3); }
  .sample.mono { color: var(--ink-3); }
  .sample.mono.caps { letter-spacing: 0.09em; }

  .ladder { display: flex; flex-direction: column; width: 100%; }
  .lrow { display: grid; grid-template-columns: 1.3fr 1.2fr 1.2fr 1fr 1.4fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line-1); font: 400 11.5px/1.4 var(--font-mono); color: var(--ink-2); }
  .lrow:last-child { border-bottom: 0; }
  .lrow.head { padding-top: 0; font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; color: var(--ink-4); }
  .lrow em { font-style: normal; color: var(--ink-4); }
  .note { font-family: var(--font-sans); color: var(--ink-3); }
</style>
