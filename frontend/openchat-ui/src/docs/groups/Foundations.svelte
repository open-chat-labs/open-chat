<!-- Foundations: colour, scales, typography, layout ladder. Every value shown is read live from the tokens
     (getComputedStyle on the themed root), so it follows mode and accent. -->
<script lang="ts">
  import { tick } from 'svelte';
  import Section from '../Section.svelte';
  import Frame from '../Frame.svelte';
  import { foundations, sec } from '../sections';
  import { Button, Translate } from '../../lib/index';
  import { messages } from '../../lib/i18n';
  import type { PageAccent } from '../../pages/types';

  interface Props {
    /** Changes whenever mode or accent changes; triggers a re-read of the computed token values. */
    theme: string;
    /** The docs' accent, for the native previews (each is its own theme root). */
    accent: PageAccent;
  }

  let { theme, accent }: Props = $props();

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

  // ── i18n ──
  const countKeys = (o: unknown): number => (typeof o === 'object' && o ? Object.values(o).reduce((n: number, v) => n + countKeys(v), 0) : 1);
  const keyCount = countKeys(messages.en);
  const componentCount = Object.keys((messages.en as { ui: object }).ui).length - 2; // minus the shared common + duration groups
  let replies = $state(1);
  let typing = $state(1);
  let noun = $state<'group' | 'channel' | 'community'>('group');
  const wiring = `<script lang="ts">
  import { addMessages, _ } from 'svelte-i18n';
  import { fromStore } from 'svelte/store';
  import { setI18n, messages } from '@openchat/ui/src/lib';

  addMessages('en', messages.en);   // the library's English, under ui.*
  const format = fromStore(_);      // reactive: components re-render on locale change
  setI18n({ t: (key, params) => format.current(key, { values: params }) });
${'<'}/script>`;
  const usage = `<!-- copy props take a key -->
<Button label="ui.common.save" />

<!-- your own markup: just the text -->
<Translate key="ui.chatBubble.replies" params={{ count }} />

<!-- markup inside a sentence: a snippet per placeholder -->
<Translate key="ui.leaveGroupDialog.question">
  {#snippet name()}<strong>{group}</strong>{/snippet}
</Translate>

<!-- in script -->
const t = useT();
t('ui.duration.hours', { count: 12 });`;

  // ── accessibility: WCAG contrast of text tokens on surfaces, read live ──
  type RGBA = [number, number, number, number];
  const parseColour = (v: string): RGBA | null => {
    v = v.trim();
    const hex = v.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      let h = hex[1];
      if (h.length <= 4) h = [...h].map((c) => c + c).join('');
      const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
      return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
    }
    const m = v.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return [p[0], p[1], p[2], p[3] ?? 1];
  };
  const luminance = ([r, g, b]: RGBA) => {
    const ch = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const contrast = (fg: RGBA, bg: RGBA) => {
    const a = fg[3];
    const mixed: RGBA = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
    const [hi, lo] = [luminance(mixed), luminance(bg)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const contrastPairs: { fg: string; bg: string; use: string }[] = [
    { fg: 'ink', bg: 'surface-1', use: 'Body text' },
    { fg: 'ink-2', bg: 'surface-1', use: 'Secondary text' },
    { fg: 'ink-3', bg: 'surface-1', use: 'Tertiary text, hints' },
    { fg: 'ink-4', bg: 'surface-1', use: 'Metadata, timestamps' },
    { fg: 'ink-4', bg: 'surface-0', use: 'Metadata on the page' },
    { fg: 'accent', bg: 'surface-1', use: 'Links, accent labels' },
    { fg: 'accent-bright', bg: 'surface-1', use: 'Accent text' },
    { fg: 'on-accent', bg: 'accent', use: 'Primary button label' },
    { fg: 'status-danger', bg: 'surface-1', use: 'Errors' },
    { fg: 'status-online', bg: 'surface-1', use: 'Success, online' },
    { fg: 'status-warning', bg: 'surface-1', use: 'Warnings' },
    { fg: 'bubble-text', bg: 'bubble-send-bg', use: 'Sent message' },
    { fg: 'bubble-text-soft', bg: 'bubble-send-bg', use: 'Sent timestamp, quote' },
    { fg: 'bubble-recv-text', bg: 'bubble-recv-bg', use: 'Received message' },
  ];
  let contrasts = $state<{ fg: string; bg: string; use: string; ratio: number }[]>([]);

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
    void theme;
    tick().then(() => {
      const root = host?.closest<HTMLElement>('[data-mode]');
      if (!root) return;
      const cs = getComputedStyle(root);
      const out: Record<string, string> = {};
      for (const t of all) if (t) out[t] = pretty(cs.getPropertyValue('--' + t));
      values = out;
      contrasts = contrastPairs.flatMap((p) => {
        const fg = parseColour(cs.getPropertyValue('--' + p.fg)), bg = parseColour(cs.getPropertyValue('--' + p.bg));
        return fg && bg ? [{ ...p, ratio: contrast(fg, bg) }] : [];
      });
    });
  });

  // ── native platform: two previews (light, dark) as their own theme roots, read live like the rest ──
  type NativeMode = 'light' | 'dark';
  const nativeModes: NativeMode[] = ['light', 'dark'];
  const nativeColours = ['surface-0', 'surface-1', 'surface-2', 'field', 'hero-base', 'tint-row', 'tint-pill'];
  const nativeLayout = ['safe-top', 'safe-right', 'safe-bottom', 'safe-left', 'scroll-end'];
  const nativeText = ['text-2xs', 'text-xs', 'text-sm', 'text-md', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];
  const callColours = ['call-bg', 'call-ink', 'call-ink-2', 'call-chip', 'call-control', 'call-control-on', 'call-control-on-ink', 'call-tile', 'call-tile-mix', 'call-pill', 'call-badge', 'call-label'];
  // The app's four font sizes (its font scale store's steps 1 to 4) at the platform's default scale. These factors
  // are the client's fontScaleFactor (openchat-client/src/state/ui/stores.ts), which the library can't import;
  // the app sets the real --text-scale with textScaleOf (app/src/logic/profile/appearance.ts), which also takes
  // the platform's font scale. A demo only: change them with fontScaleFactor.
  const textSizes: { label: string; scale: number }[] = [
    { label: 'Small', scale: 0.875 },
    { label: 'Default', scale: 1 },
    { label: 'Large', scale: 1.125 },
    { label: 'Larger', scale: 1.25 },
  ];
  let textScale = $state(1);

  const previews: Partial<Record<NativeMode, HTMLElement>> = {};
  const calls: Partial<Record<NativeMode, HTMLElement>> = {};
  let probe = $state<HTMLElement>();
  let nativeValues = $state<Partial<Record<NativeMode, Record<string, string>>>>({});
  let lengthValues = $state<Record<string, string>>({});
  let callValues = $state<Record<string, string>>({});

  const read = (el: HTMLElement | undefined, tokens: string[]): Record<string, string> => {
    if (!el) return {};
    const cs = getComputedStyle(el);
    return Object.fromEntries(tokens.map((t) => [t, pretty(cs.getPropertyValue('--' + t))]));
  };

  // a token that holds a calc() or env() reads back as written; a property set to it computes to px
  const readLengths = (el: HTMLElement | undefined, tokens: string[]): Record<string, string> => {
    if (!el) return {};
    return Object.fromEntries(
      tokens.map((t) => {
        el.style.paddingLeft = `var(--${t})`;
        return [t, getComputedStyle(el).paddingLeft];
      }),
    );
  };

  async function readNative(): Promise<void> {
    await tick();
    nativeValues = Object.fromEntries(nativeModes.map((m) => [m, read(previews[m], nativeColours)]));
    lengthValues = readLengths(probe, [...nativeLayout, ...nativeText]);
    callValues = read(calls.light, callColours);
  }

  $effect(() => {
    void theme;
    void accent;
    void textScale;
    void readNative();
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

  <Section {...sec(foundations, 'i18n')}>
    <Frame label="How it works" style="flex-direction: column; flex-wrap: nowrap">
      <div class="flow">
        <div class="step"><span class="step-k">Component</span><code>t('ui.chatBubble.replies', {'{'} count {'}'})</code><span class="step-d">asks for a resource key</span></div>
        <span class="arrow" aria-hidden="true"></span>
        <div class="step"><span class="step-k">Host translator</span><code>setI18n({'{'} t {'}'})</code><span class="step-d">the app decides how: svelte-i18n, locale, edit mode</span></div>
        <span class="arrow" aria-hidden="true"></span>
        <div class="step"><span class="step-k">Text</span><code>"3 replies"</code><span class="step-d">rendered as plain text</span></div>
      </div>
      <p class="note">
        Components never contain copy. Every label, title, placeholder and aria-label is a key under <code>ui.*</code>
        ({keyCount.toLocaleString()} keys across {componentCount} components in <code>src/lib/i18n/en.json</code>). Without a host translator
        the bundled English is used, and a string that isn't a key renders as itself. Switch Language in the bar to
        <b>Keys</b> or <b>Pseudo</b>: copy that stays plain English is hard-coded, and Pseudo shows where longer translations overflow.
      </p>
    </Frame>
    <div class="pair">
      <Frame label="Try it · plurals and variants" style="flex-direction: column; flex-wrap: nowrap">
        <div class="demo-row">
          <Button variant="secondary" label="−" onClick={() => (replies = Math.max(0, replies - 1))} />
          <Button variant="secondary" label="+" onClick={() => (replies += 1)} />
          <span class="out"><Translate key="ui.chatBubble.replies" params={{ count: replies }} /></span>
        </div>
        <div class="demo-row">
          <Button variant="secondary" label="−" onClick={() => (typing = Math.max(1, typing - 1))} />
          <Button variant="secondary" label="+" onClick={() => (typing += 1)} />
          <span class="out"><Translate key="ui.typingIndicator.typing" params={{ count: typing, name: 'Lucy' }} /></span>
        </div>
        <div class="demo-row">
          {#each ['group', 'channel', 'community'] as const as n}
            <Button variant={noun === n ? 'primary' : 'ghost'} label={'docs.foundations.nouns.' + n} onClick={() => (noun = n)} />
          {/each}
          <span class="out"><Translate key="ui.leaveGroupDialog.confirm" params={{ noun }} /></span>
        </div>
        <div class="demo-row">
          <span class="out">
            <Translate key="ui.leaveGroupDialog.question">{#snippet name()}<strong class="hl">The Awesome Group</strong>{/snippet}</Translate>
          </span>
          <span class="tag">snippet slot</span>
        </div>
      </Frame>
      <Frame label="Rules" style="flex-direction: column; flex-wrap: nowrap">
        <ul class="rules">
          <li><b>Keys are plain strings</b> under <code>ui.&lt;component&gt;.*</code>; shared words live in <code>ui.common.*</code>.</li>
          <li><b>Copy props take a key</b> (<code>label</code>, <code>title</code>, <code>placeholder</code> …). Data (names, messages, amounts) is never translated.</li>
          <li><b>Whole sentences</b> in ICU MessageFormat: <code>plural</code> for counts, <code>select</code> for variants. Never concatenate fragments.</li>
          <li><b>Markup inside a sentence</b> is a snippet named after its placeholder, so translators can move it.</li>
          <li><b>Values stay ids</b>: durations travel as <code>'12 hours'</code> and display through <code>durationText()</code>; menus report keys.</li>
          <li><b>Numbers and dates</b> format with the host locale (<code>getI18n().locale</code>).</li>
        </ul>
      </Frame>
    </div>
    <div class="pair">
      <Frame label="Using it" style="flex-direction: column; flex-wrap: nowrap"><pre class="code">{usage}</pre></Frame>
      <Frame label="Wiring it into the app (once, in the root)" style="flex-direction: column; flex-wrap: nowrap"><pre class="code">{wiring}</pre></Frame>
    </div>
  </Section>

  <Section {...sec(foundations, 'accessibility')}>
    <div class="grid3">
      <Frame label="Keyboard" style="flex-direction: column; flex-wrap: nowrap">
        <p class="note">Every custom control (a <code>role</code> on a span) activates with Enter and Space through <code>a11y.js</code>. Tabs and menus move with the arrow keys (<code>rove()</code>), Home and End jump to the ends.</p>
      </Frame>
      <Frame label="Focus" style="flex-direction: column; flex-wrap: nowrap">
        <p class="note">One visible ring for every interactive role (<code>:focus-visible</code>, accent, 2px). Dialogs move focus to their first field, keep Tab inside, and hand focus back to the opener on close.</p>
      </Frame>
      <Frame label="Dialogs" style="flex-direction: column; flex-wrap: nowrap">
        <p class="note">DialogShell and <code>use:modal</code> share one stack: Esc closes only the topmost dialog, through the dialog's own close path, and stops at inner pickers that handle Esc first.</p>
      </Frame>
      <Frame label="Names" style="flex-direction: column; flex-wrap: nowrap">
        <p class="note">Icon-only buttons carry an accessible name (IconButton derives one from common icons). Every <code>aria-label</code>, <code>title</code> and placeholder is a translated key.</p>
      </Frame>
      <Frame label="Motion" style="flex-direction: column; flex-wrap: nowrap">
        <p class="note">With <code>prefers-reduced-motion</code>, animations and transitions collapse to an instant (tokens.css); the achievement toast fades instead of flying.</p>
      </Frame>
      <Frame label="Direction" style="flex-direction: column; flex-wrap: nowrap">
        <p class="note">Layout uses logical properties, so <code>dir="rtl"</code> mirrors every component. Direction-bearing glyphs (back, send, reply, chevrons) flip via <code>[data-oc-flip]</code>; pointer maths reads <code>--oc-dir</code>.</p>
      </Frame>
    </div>

    <Frame label="Text contrast · WCAG 2.2, read live for this mode and accent" style="flex-direction: column; flex-wrap: nowrap">
      <div class="ladder" role="table" aria-label="Text contrast">
        <div class="lrow crow head" role="row">
          <span role="columnheader">SAMPLE</span><span role="columnheader">TEXT ON</span><span role="columnheader">USED FOR</span><span role="columnheader">RATIO</span><span role="columnheader">AA</span>
        </div>
        {#each contrasts as c (c.fg + c.bg)}
          {@const level = c.ratio >= 7 ? 'AAA' : c.ratio >= 4.5 ? 'AA' : c.ratio >= 3 ? 'Large only' : 'Fails'}
          <div class="lrow crow" role="row">
            <span role="cell"><span class="sample-chip" style:background="var(--{c.bg})" style:color="var(--{c.fg})">Aa</span></span>
            <span role="cell">--{c.fg} on --{c.bg}</span>
            <span role="cell" class="note">{c.use}</span>
            <span role="cell">{c.ratio.toFixed(2)}:1</span>
            <span role="cell"><span class="grade" class:pass={c.ratio >= 4.5} class:warn={c.ratio >= 3 && c.ratio < 4.5} class:fail={c.ratio < 3}>{level}</span></span>
          </div>
        {/each}
      </div>
    </Frame>

    <Frame label="Known gaps · found while building the library" style="flex-direction: column; flex-wrap: nowrap">
      <ul class="rules">
        <li><b>Low-contrast text tokens.</b> <code>--ink-4</code> (metadata, timestamps) is below 4.5:1 on every dark surface. In light mode, the pink accent as text (links, Retry, accent labels) and white on the pink primary button fall to about 2.4–3.1:1, and green success text to about 2.4–3:1. Check the table in each accent; these need a design decision on the tokens.</li>
        <li><b>Custom controls instead of native buttons.</b> Interactive elements are <code>role="button"</code> spans in 87 files (446 svelte-check a11y warnings). Keyboard works through <code>a11y.js</code>, but native <code>&lt;button&gt;</code>s would give that, disabled state and form semantics for free; worth migrating component by component.</li>
        <li><b>Few live regions.</b> Spinner, Skeleton, Countdown, UndoToast, AchievementToast and a handful of dialogs announce themselves; Banner, TypingIndicator, send failures and copy confirmations don't yet (<code>role="status"</code> / <code>aria-live="polite"</code>).</li>
        <li><b>Uppercase copy in the strings.</b> Some labels are written in capitals in <code>en.json</code> (DAY STREAK, FREQUENTLY USED) instead of uppercased by CSS, so screen readers may spell them and translators see shouting.</li>
        <li><b>Colour as the only signal</b> on a few indicators (online dot, unread dot): fine next to a count or text, but check each use has a text equivalent.</li>
      </ul>
    </Frame>
  </Section>

  <Section {...sec(foundations, 'native')}>
    <div class="native-grid">
      {#each nativeModes as m (m)}
        <div class="native-preview" data-platform="native" data-mode={m} data-accent={accent} style:--text-scale={textScale} bind:this={previews[m]}>
          <span class="np-label">data-platform="native" · data-mode="{m}"</span>
          {#if m === 'dark'}<span class="probe" aria-hidden="true" bind:this={probe}></span>{/if}
          <div class="hero">
            <div class="hero-top">
              <span class="hero-tile" aria-hidden="true"><span class="hero-bolt"></span></span>
              <span class="hero-balance"><b>12,450</b> CHIT</span>
              <span class="pill">7 day streak</span>
            </div>
            <div class="hero-row"><span>Daily claim</span><span class="pill">Claim 500</span></div>
          </div>
          <span class="field-sample">Search</span>
          <div class="call" data-always-dark bind:this={calls[m]}>
            <span class="call-text"><b>Voice call</b><span>12:45 · 3 people</span></span>
            <span class="call-btn" aria-hidden="true"></span>
            <span class="call-btn on" aria-hidden="true"></span>
          </div>
          <div class="swatches">
            {#each nativeColours as t}
              <div class="swatch-item">
                <span class="swatch" style:background="var(--{t})"></span>
                <span class="name">--{t}</span>
                <span class="val">{nativeValues[m]?.[t] ?? ''}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <div class="grid3">
      <Frame label="Safe areas · read on this device" style="flex-direction: column; flex-wrap: nowrap">
        <div class="rows">
          {#each nativeLayout as t}
            <div class="scale-row"><span class="name">--{t}</span><span class="val">{lengthValues[t] ?? ''}</span></div>
          {/each}
        </div>
        <p class="note">The device's insets through <code>env(safe-area-inset-*)</code>, 0 without any (as here, on a desktop browser). They replace the prototype's fixed status-bar and home-indicator paddings; the native entry needs <code>viewport-fit=cover</code>. <code>--scroll-end</code> is the end padding of a pushed screen's scrolling list.</p>
      </Frame>
      <Frame label="Text scale · the interface size setting" style="flex-direction: column; flex-wrap: nowrap">
        <div class="demo-row">
          {#each textSizes as s (s.label)}
            <Button variant={textScale === s.scale ? 'primary' : 'ghost'} label={s.label} onClick={() => (textScale = s.scale)} />
          {/each}
        </div>
        <div class="rows">
          <div class="scale-row"><span class="name">--text-scale</span><span class="val">{textScale}</span></div>
          {#each nativeText as t}
            <div class="scale-row"><span class="name">--{t}</span><span class="val">{lengthValues[t] ?? ''}</span></div>
          {/each}
        </div>
        <p class="note">Each <code>--text-*</code> size is its designed size times <code>--text-scale</code>, which is 1 on the web. The native app sets it on the native root: the font size setting times the platform's font scale (dynamic type, Android's font scale).</p>
      </Frame>
      <Frame label="Always dark · calls" style="flex-direction: column; flex-wrap: nowrap">
        <div class="swatches">
          {#each callColours as t}
            <div class="swatch-item">
              <span class="swatch" data-always-dark style:background="var(--{t})"></span>
              <span class="name">--{t}</span>
              <span class="val">{callValues[t] ?? ''}</span>
            </div>
          {/each}
        </div>
        <p class="note"><code>data-always-dark</code> on the call screen's and the minimised call's root gives them the dark tokens in both themes, with the accent of the nearest <code>data-accent</code> root (or their own), plus the call colours above. The in-chat live pill and the header call strip follow the theme.</p>
      </Frame>
    </div>
  </Section>
</div>

<style lang="scss">
  @use '../../lib/styles/mixins' as *;

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
  .flow { display: flex; align-items: stretch; gap: 12px; width: 100%; }
  .step { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: var(--radius-md); background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line-1); }
  .step-k { font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); }
  .step code { font: 500 12px/1.4 var(--font-mono); color: var(--ink); overflow-wrap: anywhere; }
  .step-d { font: 400 12px/1.4 var(--font-sans); color: var(--ink-3); }
  .arrow { flex: none; align-self: center; width: 16px; height: 16px; background: var(--ink-4); mask: var(--icon-arrow) center/contain no-repeat; }
  :global([dir='rtl']) .arrow { transform: scaleX(-1); }
  .note { margin: 0; font: 400 13px/1.55 var(--font-sans); color: var(--ink-2); }
  .note code, .rules code { font: 500 11.5px/1 var(--font-mono); color: var(--ink); }
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 16px; }
  .demo-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; }
  .out { margin-inline-start: 8px; font: 500 14px/1.4 var(--font-sans); color: var(--ink); }
  .hl { color: var(--accent-bright); }
  .tag { font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-4); }
  .rules { margin: 0; padding-inline-start: 18px; display: flex; flex-direction: column; gap: 9px; font: 400 13px/1.5 var(--font-sans); color: var(--ink-2); }
  .rules b { color: var(--ink); font-weight: 600; }
  .code { margin: 0; width: 100%; box-sizing: border-box; overflow-x: auto; padding: 14px; border-radius: var(--radius-md); background: var(--surface-0); box-shadow: inset 0 0 0 1px var(--line-1); font: 400 11.5px/1.6 var(--font-mono); color: var(--ink-2); direction: ltr; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; }
  .crow { grid-template-columns: 56px 1.6fr 1.4fr 0.7fr 0.8fr; align-items: center; }
  .sample-chip { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 28px; border-radius: 8px; box-shadow: inset 0 0 0 1px var(--line-1); font: 600 13px/1 var(--font-sans); }
  .grade { display: inline-block; padding: 4px 8px; border-radius: var(--radius-pill); font: 600 11px/1 var(--font-sans); }
  .grade.pass { background: color-mix(in srgb, var(--status-online) 16%, transparent); color: var(--status-online); }
  .grade.warn { background: color-mix(in srgb, var(--status-warning) 16%, transparent); color: var(--status-warning); }
  .grade.fail { background: var(--status-danger-soft); color: var(--status-danger); }
  .lrow { display: grid; grid-template-columns: 1.3fr 1.2fr 1.2fr 1fr 1.4fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line-1); font: 400 11.5px/1.4 var(--font-mono); color: var(--ink-2); }
  .lrow:last-child { border-bottom: 0; }
  .lrow.head { padding-top: 0; font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; color: var(--ink-4); }
  .lrow em { font-style: normal; color: var(--ink-4); }
  .note { font-family: var(--font-sans); color: var(--ink-3); }

  // native previews: each is a theme root, so everything inside reads that root's tokens
  .native-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr)); gap: 16px; margin-bottom: 16px; }
  .native-preview {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 22px 16px;
    border-radius: 20px;
    background: var(--surface-0);
    color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font-family: var(--font-sans);
  }
  .probe { position: absolute; visibility: hidden; pointer-events: none; }
  .np-label { font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); }
  .hero {
    display: flex;
    flex-direction: column;
    border-radius: 20px;
    overflow: hidden;
    background: linear-gradient(150deg, color-mix(in oklch, var(--accent) 26%, var(--hero-base)) 0%, var(--hero-base) 75%);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
  }
  .hero-top { display: flex; align-items: center; gap: 12px; padding: 18px; }
  .hero-tile { @include flex-center; flex: none; width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--tint-pill); }
  .hero-bolt { @include icon(zap, 22px, var(--status-chit)); }
  .hero-balance { flex: 1; min-width: 0; font-size: var(--text-sm); color: var(--ink-3); b { margin-inline-end: 4px; font-size: var(--text-2xl); font-weight: 800; color: var(--ink); } }
  .hero-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 18px; background: var(--tint-row); font-size: var(--text-base); font-weight: 600; }
  .pill { flex: none; display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border-radius: 14px; background: var(--tint-pill); font-size: var(--text-md); font-weight: 600; color: var(--ink-2); }
  .field-sample { display: flex; align-items: center; height: var(--control-xl); padding: 0 14px; border-radius: var(--radius-md); background: var(--field); font-size: var(--text-base); color: var(--ink-4); }
  .call { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 16px; border-radius: 22px; background: var(--call-bg); color: var(--call-ink); }
  .call-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; font-size: var(--text-sm); color: var(--call-ink-2); b { font-size: var(--text-base); color: var(--call-ink); } }
  .call-btn { @include flex-center; flex: none; width: 40px; height: 40px; border-radius: var(--radius-circle); background: var(--call-control); }
  .call-btn::before { content: ''; @include icon(mic, 18px, var(--call-ink)); }
  .call-btn.on { background: var(--call-control-on); }
  .call-btn.on::before { @include icon(volume, 18px, var(--call-control-on-ink)); }
</style>
