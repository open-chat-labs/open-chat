<!-- Component Library: fixed side nav (group tabs; section links scroll, with scroll spy), floating theme bar
     (mode, direction, accent) + one group of
     sections at a time in a centred 1000px column. Port of the prototype's Component Library.dc.html. -->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { groups, sectionsFor, type GroupId } from './sections';
  import Foundations from './groups/Foundations.svelte';
  import General from './groups/General.svelte';
  import App from './groups/App.svelte';
  import Api from './groups/Api.svelte';

  const KEY = 'openchat-library-';
  const load = (k: string) => {
    try { return localStorage.getItem(KEY + k); } catch { return null; }
  };
  const save = (k: string, v: string) => {
    try { localStorage.setItem(KEY + k, v); } catch { /* storage unavailable */ }
  };
  const pick = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

  const MODES = ['dark', 'light'] as const;
  const ACCENTS = ['pink', 'orange', 'blue', 'green'] as const;
  const DIRS = ['ltr', 'rtl'] as const;

  let group = $state<GroupId>(pick(load('group'), ['foundations', 'general', 'app', 'api'], 'foundations'));
  let mode = $state(pick(load('mode'), MODES, 'dark'));
  let accent = $state(pick(load('accent'), ACCENTS, 'pink'));
  let dir = $state(pick(load('dir'), DIRS, 'ltr'));
  let active = $state('');
  let linksEl: HTMLDivElement;
  const activeTitle = $derived(sectionsFor[group].find((s) => s.id === active)?.title ?? '');

  /** Distance from the viewport top a section lands at: clears the floating theme bar. */
  const OFFSET = 80;

  const sections = $derived(sectionsFor[group]);
  const info = $derived(groups.find((g) => g.id === group)!);

  $effect(() => save('group', group));
  $effect(() => save('mode', mode));
  $effect(() => save('accent', accent));
  $effect(() => save('dir', dir));

  // Scroll spy: the active link is the last section whose top is within 140px of the viewport top.
  // While a restore is in flight the stored section isn't overwritten by intermediate scroll positions.
  let restoring = false;
  let frame = 0;
  function spy() {
    frame = 0;
    let id = '';
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el && el.getBoundingClientRect().top <= 140) id = s.id;
    }
    active = id;
    if (!restoring && id) save('section-' + group, id);
  }
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(spy);
  };

  // Keep the active link visible inside the scrolling link list (without moving the page).
  $effect(() => {
    const id = active;
    const link = id && linksEl?.querySelector<HTMLElement>(`a[href="#${CSS.escape(id)}"]`);
    if (!link) return;
    const top = link.offsetTop - linksEl.offsetTop, bottom = top + link.offsetHeight;
    if (top < linksEl.scrollTop) linksEl.scrollTop = top - 8;
    else if (bottom > linksEl.scrollTop + linksEl.clientHeight) linksEl.scrollTop = bottom - linksEl.clientHeight + 8;
  });

  // On load and on every group switch: jump to the stored section (OFFSET below the top), retrying for ~1s because
  // demos settle late; with nothing stored, go to the top.
  $effect(() => {
    const g = group;
    let timer: ReturnType<typeof setInterval> | undefined;
    untrack(() => {
      restoring = true;
      const target = load('section-' + g);
      tick().then(() => {
        if (!target || !document.getElementById(target)) {
          window.scrollTo(0, 0);
          restoring = false;
          spy();
          return;
        }
        const started = performance.now();
        const jump = () => {
          const el = document.getElementById(target);
          if (restoring && el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - OFFSET);
          if (!restoring || performance.now() - started > 1000) {
            clearInterval(timer);
            restoring = false;
            spy();
          }
        };
        jump();
        timer = setInterval(jump, 100);
      });
    });
    return () => {
      clearInterval(timer);
      restoring = false;
    };
  });

  // A user scroll gesture ends the restore early, so it never fights the reader.
  const stopRestore = () => {
    restoring = false;
  };
</script>

<svelte:window onscroll={onScroll} onwheel={stopRestore} ontouchstart={stopRestore} onkeydown={stopRestore} />

<div class="root" data-mode={mode} data-accent={accent} {dir}>
  <nav aria-label="Library sections">
    <div class="brand">OPENCHAT</div>
    <div class="tabs" role="tablist" aria-label="Library group">
      {#each groups as g (g.id)}
        <span role="tab" tabindex="0" aria-selected={group === g.id} class="tab" class:on={group === g.id} onclick={() => (group = g.id)}>{g.label}</span>
      {/each}
    </div>
    <div class="divider" role="separator"></div>
    <div class="links" bind:this={linksEl}>
      {#each sections as s (s.id)}
        <a href={'#' + s.id} class:on={active === s.id} aria-current={active === s.id ? 'true' : undefined}>{s.title}</a>
      {/each}
    </div>
  </nav>

  <main>
    <div class="bar" role="toolbar" aria-label="Theme">
      <span class="crumb">{info.label}{#if activeTitle}<span class="crumb-sep">/</span><span class="crumb-section">{activeTitle}</span>{/if}</span>
      <div class="controls">
        <div class="seg" role="radiogroup" aria-label="Mode">
          {#each MODES as m}
            <span role="radio" tabindex="0" aria-checked={mode === m} class:on={mode === m} onclick={() => (mode = m)}>{m === 'dark' ? 'Dark' : 'Light'}</span>
          {/each}
        </div>
        <div class="seg" role="radiogroup" aria-label="Direction">
          {#each DIRS as d}
            <span role="radio" tabindex="0" aria-checked={dir === d} class:on={dir === d} onclick={() => (dir = d)}>{d.toUpperCase()}</span>
          {/each}
        </div>
        <div class="swatches" role="radiogroup" aria-label="Accent">
          {#each ACCENTS as a}
            <!-- each swatch carries its own theme attributes so it paints that accent's --accent -->
            <span role="radio" tabindex="0" aria-checked={accent === a} aria-label={a} class="swatch" class:on={accent === a} data-mode={mode} data-accent={a} onclick={() => (accent = a)}></span>
          {/each}
        </div>
      </div>
    </div>
    <div class="group">
      <header class="intro">
        <h1>{info.title}</h1>
        <p>{info.intro}</p>
      </header>
      {#if group === 'foundations'}
        <Foundations theme={mode + accent} />
      {:else if group === 'general'}
        <General />
      {:else if group === 'app'}
        <App />
      {:else}
        <Api />
      {/if}
    </div>
  </main>
</div>

<style>
  :global(html), :global(body) { margin: 0; padding: 0; }
  :global(body) { -webkit-font-smoothing: antialiased; }
  :global(*) { scrollbar-width: thin; scrollbar-color: rgba(128, 128, 140, 0.35) transparent; }
  :global(::-webkit-scrollbar) { width: 8px; height: 8px; }
  :global(::-webkit-scrollbar-track) { background: transparent; }
  :global(::-webkit-scrollbar-thumb) { border-radius: 99px; background: rgba(128, 128, 140, 0.35); }

  .root { box-sizing: border-box; min-height: 100vh; padding: 16px 32px 88px; padding-inline-start: 284px; background: var(--bg); color: var(--ink); font-family: var(--font-sans); }
  .root :global(a) { color: var(--accent); }
  .root :global(a:hover) { color: var(--accent-hover); }

  nav { position: fixed; inset-inline-start: 0; top: 0; bottom: 0; z-index: var(--z-sticky); box-sizing: border-box; width: 252px; padding: 26px 16px 0; overflow: hidden; display: flex; flex-direction: column; gap: var(--space-4); background: var(--surface-0); box-shadow: inset -1px 0 0 var(--line-1); }
  .root[dir='rtl'] nav { box-shadow: inset 1px 0 0 var(--line-1); }
  nav > :not(.links) { flex-shrink: 0; }
  .brand { padding: 0 10px 12px; font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; color: var(--ink-4); }

  .tabs { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
  .tab { padding: 7px 10px; border-radius: var(--radius-sm); font: 600 13px/1.2 var(--font-sans); color: var(--ink-2); cursor: pointer; user-select: none; }
  .tab:hover { background: var(--overlay-1); }
  .tab.on { background: var(--accent-soft); color: var(--accent); }

  .divider { height: 1px; margin: 4px 6px 6px; background: var(--line-1); }
  /* only the section links scroll; brand and group tabs stay put */
  .links { flex: 1 1 auto; min-height: 0; overflow-y: auto; margin: 0 -8px; padding: 0 8px 26px; display: flex; flex-direction: column; gap: 1px; }
  .root nav a { padding: 6px 10px; border-radius: var(--radius-sm); font: 500 12.5px/1.2 var(--font-sans); color: var(--ink-2); text-decoration: none; }
  .root nav a:hover { background: var(--overlay-1); color: var(--ink); }
  .root nav a.on { background: var(--overlay-1); color: var(--accent); }

  .bar { position: sticky; top: 12px; z-index: var(--z-backdrop); /* above demo content, below modals */ box-sizing: border-box; display: flex; align-items: center; gap: 16px; min-height: 52px; margin-bottom: 28px; padding-block: 8px; padding-inline: 18px 10px; border-radius: var(--radius-xl); background: color-mix(in srgb, var(--surface-1) 82%, transparent); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: inset 0 0 0 1px var(--line-1), var(--shadow-panel); }
  .crumb { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 13px/1 var(--font-sans); color: var(--ink); }
  .crumb-sep { margin-inline: 8px; color: var(--ink-4); }
  .crumb-section { font-weight: 500; color: var(--ink-3); }
  .controls { flex: none; display: flex; align-items: center; gap: 10px; }
  .seg { display: flex; gap: 2px; padding: 2px; border-radius: var(--radius-sm); background: var(--overlay-1); }
  .seg span { flex: 1; min-width: 52px; padding: 7px 12px; border-radius: 7px; text-align: center; font: 600 11.5px/1 var(--font-sans); color: var(--ink-3); cursor: pointer; user-select: none; }
  .seg span.on { background: var(--surface-2); color: var(--ink); box-shadow: var(--shadow-raised); }
  .swatches { display: flex; gap: 10px; padding: 0 6px; }
  .swatch { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); cursor: pointer; box-shadow: inset 0 0 0 1px var(--line-2); }
  .swatch.on { box-shadow: 0 0 0 2px var(--surface-1), 0 0 0 4px var(--accent); }

  .group { display: flex; flex-direction: column; gap: 56px; max-width: 1000px; margin: 0 auto; }
  .intro h1 { margin: 0 0 12px; font: 700 34px/1.05 var(--font-sans); letter-spacing: -0.02em; }
  .intro p { margin: 0; max-width: 680px; font: 400 15.5px/1.6 var(--font-sans); color: var(--ink-2); }
</style>
