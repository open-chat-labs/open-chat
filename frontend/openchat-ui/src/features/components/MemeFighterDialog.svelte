<!-- Meme Fighter (composer + → Meme Fighter). ≥960px: templates beside a preview + numbered fields.
     Narrower: two steps, pick → write, Back in the header. "Add to message" (or Cmd/Ctrl+Enter) renders the meme to a PNG
     and calls onAttach({ blob, src, templateId }) — src is an object URL the host owns (and revokes); a rejected
     onAttach keeps the editor open with an error. The host adds it to the composer's photo tray. Esc goes back, then closes.
     Text is fitted with the same rule in the preview and the PNG: the largest size where whole words fit each box. -->
<script lang="ts" module>
  export interface MemeTemplate {
    id: string;
    name: string;
    /** Vibe keys it is listed under: fresh, happy, anxiety, lol, angry. */
    vibes: string[];
    /** Aspect ratio, width / height. */
    ar: number;
    /** Panel grid columns. */
    cols: number;
    /** Panel backgrounds (CSS colours or two-stop linear gradients), row by row. */
    cells: string[];
    /** Text boxes as [x, y, width, height] in % of the image. */
    boxes: [number, number, number, number][];
  }
</script>

<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import { useT } from '../../lib/i18n';

  const VIBES: [string, string, string][] = [
    ['fresh', '🌱', 'ui.memeFighterDialog.vibeFresh'],
    ['happy', '😁', 'ui.memeFighterDialog.vibeHappy'],
    ['anxiety', '😬', 'ui.memeFighterDialog.vibeAnxiety'],
    ['lol', '🤣', 'ui.memeFighterDialog.vibeLol'],
    ['angry', '😡', 'ui.memeFighterDialog.vibeAngry'],
  ];
  const RENDER_W = 900;
  const colsCss = (n: number) => (n === 1 ? 'minmax(0,1fr)' : `repeat(${n},minmax(0,1fr))`);

  // largest size where whole words fit the box width and all lines fit its height (same rule for preview and PNG)
  function fitBox(x: CanvasRenderingContext2D, t: MemeTemplate, b: MemeTemplate['boxes'][number], s: string, W: number) {
    const H = W / t.ar, bw = (b[2] / 100) * W * 0.94, bh = (b[3] / 100) * H * 0.92;
    const words = s.split(/\s+/).filter(Boolean);
    const wrap = (size: number) => {
      x.font = `${size}px Anton, Impact, sans-serif`;
      const out: string[] = [];
      let line = '';
      for (const w of words) {
        const tl = line ? `${line} ${w}` : w;
        if (x.measureText(tl).width > bw && line) {
          out.push(line);
          line = w;
        } else line = tl;
      }
      out.push(line);
      return out;
    };
    let size = Math.min(bh * 0.7, 110), lines = wrap(size);
    while (size > 10) {
      lines = wrap(size);
      const widest = Math.max(...lines.map((l) => x.measureText(l).width));
      if (lines.length * size * 1.05 <= bh && widest <= bw) break;
      size -= 1;
    }
    return { size, lines };
  }

  let measure: CanvasRenderingContext2D | null = null;
  const measureCtx = () => (measure ??= document.createElement('canvas').getContext('2d')!);

  // canvas render of a template + texts → PNG blob URL
  function renderMeme(t: MemeTemplate, texts: string[]) {
    const W = RENDER_W, H = Math.round(W / t.ar), c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d')!, rows = Math.ceil(t.cells.length / t.cols), cw = W / t.cols, ch = H / rows;
    x.fillStyle = '#111';
    x.fillRect(0, 0, W, H);
    t.cells.forEach((cell, i) => {
      const cx = (i % t.cols) * cw, cy = Math.floor(i / t.cols) * ch;
      const m = cell.match(/#[0-9a-f]{6}/gi);
      if (m && m.length > 1) {
        const g = x.createLinearGradient(cx, cy, cx + cw, cy + ch);
        g.addColorStop(0, m[0]);
        g.addColorStop(1, m[1]);
        x.fillStyle = g;
      } else x.fillStyle = cell;
      x.fillRect(cx + 1, cy + 1, cw - 2, ch - 2);
    });
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.fillStyle = '#fff';
    x.strokeStyle = '#000';
    t.boxes.forEach((b, i) => {
      const s = (texts[i] || '').trim().toUpperCase();
      if (!s) return;
      const f = fitBox(x, t, b, s, W);
      const bx = (b[0] / 100) * W, by = (b[1] / 100) * H, bw = (b[2] / 100) * W, bh = (b[3] / 100) * H;
      x.font = `${f.size}px Anton, Impact, sans-serif`;
      x.lineWidth = Math.max(3, f.size / 9);
      const lh = f.size * 1.05, top = by + bh / 2 - ((f.lines.length - 1) * lh) / 2;
      f.lines.forEach((l, k) => {
        x.strokeText(l, bx + bw / 2, top + k * lh);
        x.fillText(l, bx + bw / 2, top + k * lh);
      });
    });
    return new Promise<Blob>((res, rej) => c.toBlob((blob) => (blob ? res(blob) : rej(new Error('render failed'))), 'image/png'));
  }

  interface Props {
    templates: MemeTemplate[];
    z?: number;
    /** The rendered PNG, plus an object URL for previews (a blob URL, not a data URL: inline style strings split on ";").
     *  The host owns the URL; reject to keep the editor open with an error. */
    onAttach?: (meme: { blob: Blob; src: string; templateId: string; template: string }) => Promise<unknown> | void;
    onClose?: () => void;
  }

  let { templates, z = 80, onAttach, onClose }: Props = $props();
  const t = useT();

  let box: HTMLDivElement;
  let vw = $state(typeof window === 'undefined' ? 1200 : window.innerWidth);
  let view = $state<'browse' | 'edit'>('browse');
  let tplId = $state<string | null>(null);
  let texts = $state<Record<string, string[]>>({});
  let query = $state('');
  let vibe = $state<string | null>(null);
  let focused = $state<number | null>(null);
  // attach in flight: the shared dialog contract (lib/behaviours/dialog.svelte.ts)
  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());
  const busy = $derived(flow.busy);
  let fontsReady = $state(0);

  const wide = $derived(vw >= 960);
  const T = $derived(templates.find((t) => t.id === tplId) ?? templates[0]);
  const current = $derived(texts[T.id] ?? []);
  const list = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => (!q || t.name.toLowerCase().includes(q)) && (!vibe || t.vibes.includes(vibe)));
  });
  const picked = $derived(wide || view === 'edit');
  const narrowEdit = $derived(!wide && view === 'edit');
  const hasText = $derived(current.some((v) => v && v.trim()));

  const boxes = $derived.by(() => {
    void fontsReady;
    const RH = RENDER_W / T.ar, cq = (px: number) => `${((px / RENDER_W) * 100).toFixed(2)}cqw`;
    return T.boxes.map((b, i) => {
      const raw = (current[i] || '').trim();
      const f = fitBox(measureCtx(), T, b, (raw || `Text ${i + 1}`).toUpperCase(), RENDER_W);
      const bh = (b[3] / 100) * RH, used = f.lines.length * f.size * 1.05;
      return {
        b,
        fs: cq(f.size),
        padT: cq(Math.max(0, (bh - used) / 2 - f.size * 0.06)),
        padX: cq((b[2] / 100) * RENDER_W * 0.03),
        shown: raw ? f.lines.join('\n') : '',
      };
    });
  });

  // switching templates carries text into matching boxes
  async function open(t: MemeTemplate) {
    if (!texts[t.id]) texts = { ...texts, [t.id]: current.slice(0, t.boxes.length) };
    tplId = t.id;
    view = 'edit';
    await tick();
    box.querySelector<HTMLInputElement>('input[data-box="0"]')?.focus();
  }

  function setText(i: number, value: string) {
    const next = current.slice();
    next[i] = value;
    texts = { ...texts, [T.id]: next };
  }

  async function generate() {
    if (!hasText || !onAttach) return;
    let src = '';
    // one attach at a time; a failure (render or host) keeps the editor with an error
    const result = await flow.run(async () => {
      try {
        await document.fonts.load('48px Anton');
      } catch {
        // font unavailable: render with the fallback face
      }
      const blob = await renderMeme(T, current);
      src = URL.createObjectURL(blob);
      await onAttach({ blob, src, templateId: T.id, template: T.name });
    });
    if (!result.ok && src) URL.revokeObjectURL(src);
  }

  // nothing leaves the dialog while an attach is pending: its result (or error) has to be seen here
  function dismiss() {
    if (!busy) onClose?.();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (busy) return;
      if (narrowEdit) view = 'browse';
      else dismiss();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      generate();
    }
  }

  onMount(() => {
    document.fonts?.load('48px Anton').then(() => fontsReady++).catch(() => {});
    const t = setTimeout(() => box.querySelector('input')?.focus(), 60);
    return () => clearTimeout(t);
  });
</script>

<svelte:window bind:innerWidth={vw} />

{#snippet thumbs(narrow: boolean)}
  <div class="thumbs" class:narrow>
    {#each list as t}
      {@const sel = picked && t.id === T.id}
      <div class="thumb" onclick={() => open(t)} role="button" tabindex="0" aria-pressed={narrow ? undefined : sel} aria-label={t.name}>
        <div class="art" class:sel class:hoverable={!narrow} style:grid-template-columns={colsCss(t.cols)}>
          {#each t.cells as cell}<span style:background={cell}></span>{/each}
        </div>
        <span class="thumb-name" class:sel>{t.name}</span>
      </div>
    {/each}
  </div>
  {#if list.length === 0}<span class="none">{t('ui.memeFighterDialog.noTemplates')}</span>{/if}
{/snippet}

{#snippet filters(narrow: boolean)}
  <div class="search" class:narrow>
    <span class="search-icon"></span>
    <input bind:value={query} placeholder={t('ui.memeFighterDialog.searchTemplates')} aria-label={t('ui.memeFighterDialog.searchTemplates')} />
  </div>
  <div class="vibes" class:narrow>
    {#each VIBES as [key, emoji, label]}
      <button class="vibe" class:on={vibe === key} onclick={() => (vibe = vibe === key ? null : key)} aria-pressed={vibe === key}><span class="vibe-emoji">{emoji}</span>{t(label)}</button>
    {/each}
  </div>
{/snippet}

{#snippet editor(narrow: boolean)}
  <div class="preview" class:narrow style:max-width={T.ar < 1 ? `${Math.round((narrow ? 260 : 300) * T.ar)}px` : narrow ? '100%' : '460px'} style:aspect-ratio={String(T.ar)}>
    <div class="cells" style:grid-template-columns={colsCss(T.cols)}>
      {#each T.cells as cell}<span style:background={cell}></span>{/each}
    </div>
    {#each boxes as bx, i}
      <div
        class="box"
        class:focused={focused === i}
        style:left="{bx.b[0]}%"
        style:top="{bx.b[1]}%"
        style:width="{bx.b[2]}%"
        style:height="{bx.b[3]}%"
        style:padding="0 {bx.padX}"
      >
        <span class="meme-text" style:font-size={bx.fs}>{bx.shown}</span>
        <span class="box-n">{i + 1}</span>
      </div>
    {/each}
  </div>
  <div class="fields">
    {#each boxes as _, i}
      <label class="field">
        <span class="field-n">{i + 1}</span>
        <input
          value={current[i] || ''}
          oninput={(e) => setText(i, e.currentTarget.value)}
          onfocus={() => (focused = i)}
          onblur={() => (focused = null)}
          data-box={i}
          placeholder={t('ui.memeFighterDialog.boxPlaceholder', { n: i + 1 })}
          aria-label={t('ui.memeFighterDialog.boxLabel', { n: i + 1, total: T.boxes.length })}
        />
      </label>
    {/each}
  </div>
{/snippet}

<div class="layer" class:wide style:z-index={z}>
  <div class="scrim" onclick={dismiss} aria-hidden="true"></div>
  <div class="dialog" bind:this={box} data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label={t('ui.memeFighterDialog.title')} onkeydown={onKey}>
    <div class="head" class:back={narrowEdit}>
      {#if narrowEdit}<IconButton variant="ghost" icon="back" label="ui.memeFighterDialog.backToTemplates" onClick={() => !busy && (view = 'browse')} />{/if}
      <span class="title">{narrowEdit ? T.name : t('ui.memeFighterDialog.title')}</span>
      <IconButton variant="ghost" icon="close" label="ui.common.close" onClick={dismiss} />
    </div>
    {#if wide}
      <div class="split">
        <div class="side">
          {@render filters(false)}
          {@render thumbs(false)}
        </div>
        <div class="main">
          <div class="main-scroll">{@render editor(false)}</div>
          <div class="foot">
            <span class="foot-name">{T.name}</span>
            {#if flow.failed}<span class="attach-error" role="alert">{t('ui.memeFighterDialog.attachFailed')}</span>{/if}
            {#if hasText}<Button label="ui.memeFighterDialog.clearText" variant="ghost" onClick={() => (texts = { ...texts, [T.id]: [] })} />{/if}
            {#if onAttach}<Button label={busy ? 'ui.memeFighterDialog.adding' : 'ui.memeFighterDialog.addToMessage'} disabled={!hasText || busy} onClick={generate} />{/if}
          </div>
        </div>
      </div>
    {:else if view !== 'edit'}
      <div class="narrow-scroll">
        {@render filters(true)}
        {@render thumbs(true)}
      </div>
    {:else}
      <div class="narrow-scroll edit">{@render editor(true)}</div>
      <div class="foot narrow">
        {#if flow.failed}<span class="attach-error" role="alert">{t('ui.memeFighterDialog.attachFailed')}</span>{/if}
        {#if hasText}<Button label="ui.memeFighterDialog.clear" variant="ghost" onClick={() => (texts = { ...texts, [T.id]: [] })} />{/if}
        {#if onAttach}<div class="grow"><Button label={busy ? 'ui.memeFighterDialog.adding' : 'ui.memeFighterDialog.addToMessage'} disabled={!hasText || busy} onClick={generate} fullWidth={true} /></div>{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }

  .layer.wide {
    padding: 24px;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .dialog {
    position: relative;
    width: 100%;
    max-width: 440px;
    height: 760px;
    max-height: 100%;
    outline: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-xl, 22px);
    background: var(--surface-1, #0e0e12);
    color: var(--ink, #ececf1);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 24px 64px rgba(0, 0, 0, 0.45);
  }

  .wide .dialog {
    max-width: 920px;
    height: 660px;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 60px;
    box-sizing: border-box;
    padding: 0 12px 0 22px;
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .wide .head {
    height: 66px;
  }

  .head.back {
    padding-left: 10px;
  }

  .title {
    flex: 1;
    padding-left: 0;
    font: 700 17px/1 var(--font-sans);
  }

  .back .title {
    padding-left: 4px;
  }

  .split {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .side {
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    border-right: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .search {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 12px;
    border-radius: 11px;
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .search.narrow {
    height: 44px;
    padding: 0 14px;
    border-radius: 12px;
  }

  .search-icon {
    width: 15px;
    height: 15px;
    flex: none;
    background: var(--ink-3, #9a9aa8);
    -webkit-mask: var(--icon-search) center/contain no-repeat;
    mask: var(--icon-search) center/contain no-repeat;
  }

  .narrow .search-icon {
    width: 16px;
    height: 16px;
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: 500 13.5px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .search.narrow input {
    font-size: 14px;
  }

  .vibes {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .vibes.narrow {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 -16px;
    padding: 0 16px;
  }

  .vibe {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 10px 0 8px;
    border: 0;
    border-radius: 999px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px transparent;
    color: var(--ink-2, #c9c9d4);
    font: 600 12px/1 var(--font-sans);
    cursor: pointer;
  }

  .narrow .vibe {
    flex: none;
    gap: 6px;
    height: 36px;
    padding: 0 12px 0 10px;
    font-size: 13px;
  }

  .vibe.on {
    background: color-mix(in oklch, var(--accent, #ff5672) 16%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 55%, transparent);
    color: var(--accent-bright, #ff8298);
  }

  .vibe-emoji {
    font-size: 13px;
    line-height: 1;
  }

  .narrow .vibe-emoji {
    font-size: 15px;
  }

  .thumbs {
    flex: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .thumbs.narrow {
    gap: 12px;
  }

  .thumb {
    display: flex;
    flex-direction: column;
    gap: 6px;
    cursor: pointer;
  }

  .narrow .thumb {
    gap: 7px;
  }

  .art {
    display: grid;
    gap: 2px;
    aspect-ratio: 4/3;
    border-radius: 10px;
    overflow: hidden;
    background: #111;
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .narrow .art {
    border-radius: 12px;
  }

  .art.sel,
  .art.hoverable:hover {
    box-shadow: 0 0 0 2px var(--accent, #ff5672);
  }

  .thumb-name {
    font: 600 12px/1.2 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .narrow .thumb-name {
    font-size: 12.5px;
  }

  .thumb-name.sel {
    color: var(--ink, #ececf1);
  }

  .none {
    padding: 20px 0;
    text-align: center;
    font: 400 13px/1.4 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .main {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .main-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px;
  }

  .narrow-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 14px 16px 20px;
  }

  .narrow-scroll.edit {
    padding: 16px;
  }

  .preview {
    position: relative;
    flex: none;
    width: 100%;
    align-self: center;
    border-radius: 14px;
    overflow: hidden;
    container-type: inline-size;
  }

  .preview.narrow {
    border-radius: 12px;
  }

  .cells {
    position: absolute;
    inset: 0;
    display: grid;
    gap: 2px;
    background: #111;
  }

  .box {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    border-radius: 8px;
    outline: 1.5px dashed rgba(255, 255, 255, 0.7);
    outline-offset: -2px;
  }

  .narrow .box {
    border-radius: 7px;
  }

  .box.focused {
    outline: 2px solid var(--accent, #ff5672);
  }

  .meme-text {
    text-align: center;
    text-transform: uppercase;
    font-family: 'Anton', Impact, sans-serif;
    font-weight: 400;
    line-height: 1.05;
    color: #fff;
    -webkit-text-stroke: 1px #000;
    paint-order: stroke fill;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    word-break: normal;
    overflow-wrap: normal;
    white-space: pre-line;
  }

  .box-n {
    position: absolute;
    top: -1px;
    left: -1px;
    min-width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px 0 6px 0;
    background: var(--accent, #ff5672);
    font: 700 11px/1 var(--font-mono);
    color: var(--on-accent, #2e0512);
  }

  .narrow .box-n {
    min-width: 18px;
    height: 18px;
    border-radius: 5px 0 5px 0;
    font-size: 10px;
  }

  .fields {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 46px;
    padding: 0 6px 0 8px;
    border-radius: 12px;
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .narrow-scroll .field {
    height: 48px;
  }

  .field-n {
    flex: none;
    min-width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    background: var(--accent, #ff5672);
    font: 700 12px/1 var(--font-mono);
    color: var(--on-accent, #2e0512);
  }

  .field input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: 500 14px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .narrow-scroll .field input {
    font-size: 15px;
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .foot.narrow {
    gap: 8px;
    padding: 12px 16px;
  }

  .foot-name {
    flex: 1;
    min-width: 0;
    font: 600 13px/1.35 var(--font-sans);
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  .attach-error {
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }
</style>
