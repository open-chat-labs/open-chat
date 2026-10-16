<!-- Component Library: fixed side nav (group tabs; section links scroll, with scroll spy), floating theme bar
     (mode, direction, accent) + one group of
     sections at a time in a centred 1000px column. Port of the prototype's Component Library.dc.html. -->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { groups, sectionsFor, type GroupId } from './sections';
  import Foundations from './groups/Foundations.svelte';
  import General from './groups/General.svelte';
  import Features from './groups/Features.svelte';
  import Api from './groups/Api.svelte';
  import Search from './Search.svelte';
  import type { Target } from './search';
  import { sectionFromHash } from './hash';
  import { setI18n, lookup, interpolate, messages } from '../lib/i18n';

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
  // English · raw keys · pseudo-locale (accented, ~35% longer, bracketed): Keys and Pseudo make hard-coded copy stand
  // out — it stays plain English — and Pseudo shows where longer translations would overflow
  const LANGS = ['en', 'keys', 'pseudo'] as const;

  // a deep link (#<section id>) opens that section's group and lands on it, whatever was stored last
  const linked = sectionFromHash(location.hash);
  if (linked) save('section-' + linked.group, linked.id);
  let group = $state<GroupId>(linked?.group ?? pick(load('group'), ['foundations', 'general', 'features', 'api'], 'foundations'));
  let mode = $state(pick(load('mode'), MODES, 'dark'));
  let accent = $state(pick(load('accent'), ACCENTS, 'pink'));
  let dir = $state(pick(load('dir'), DIRS, 'ltr'));
  let lang = $state(pick(load('lang'), LANGS, 'en'));

  const ACCENTS_MAP: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ö', u: 'ü', c: 'ç', n: 'ñ', s: 'š', y: 'ý', A: 'Å', E: 'É', I: 'Î', O: 'Ø', U: 'Û', C: 'Ç', N: 'Ñ', S: 'Š', Y: 'Ý' };
  const pseudo = (text: string) => {
    // accent every letter and pad by ~35% (applied after formatting, so ICU syntax is untouched)
    const body = text.replace(/./g, (m) => ACCENTS_MAP[m] ?? m);
    return '[' + body + ' ' + '·'.repeat(Math.max(1, Math.round(text.length * 0.35))) + ']';
  };
  // the library's English plus the docs page's own demo copy (docs.*), so demo labels translate like real ones
  type Dict = Parameters<typeof lookup>[0];
  const docsCopy = import.meta.glob<Dict>('./i18n/*.json', { eager: true, import: 'default' });
  const merge = (a: Dict, b: Dict): Dict => {
    const out: Dict = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = typeof v === 'object' && typeof out[k] === 'object' ? merge(out[k] as Dict, v) : v;
    return out;
  };
  const en = Object.values(docsCopy).reduce(merge, messages.en as Dict);
  setI18n({
    get locale() {
      return 'en';
    },
    t(key, params) {
      const text = lookup(en, key);
      if (text === undefined) return interpolate(key, params); // not a key: literal text, shown as-is in every mode
      // keys mode: the key, then each param in order, so values and snippet markup still show where they belong
      if (lang === 'keys') return interpolate(key + Object.keys(params ?? {}).map((k) => ` {${k}}`).join(''), params);
      const out = interpolate(text, params);
      return lang === 'pseudo' ? pseudo(out) : out;
    },
  });
  let active = $state('');
  let linksEl: HTMLDivElement;
  const activeTitle = $derived(sectionsFor[group].find((s) => s.id === active)?.title ?? '');

  /** Distance from the viewport top a section lands at: clears the floating theme bar. */
  const OFFSET = 92;

  const sections = $derived(sectionsFor[group]);
  const info = $derived(groups.find((g) => g.id === group)!);

  $effect(() => save('group', group));
  $effect(() => save('mode', mode));
  $effect(() => save('accent', accent));
  $effect(() => save('dir', dir));
  $effect(() => save('lang', lang));

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

  // Search jumps: same group scrolls straight there; another group is switched to with the target stored as its
  // section, so the restore above lands on it. The section's heading flashes once it's in place.
  function jump(t: Target) {
    const same = t.group === group;
    if (location.hash && sectionFromHash(location.hash)?.id !== t.id) dropHash();
    if (same) {
      const el = document.getElementById(t.id);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - OFFSET, behavior: 'smooth' });
    } else {
      save('section-' + t.group, t.id);
      group = t.group;
    }
    setTimeout(() => {
      const head = document.getElementById(t.id)?.querySelector('h2');
      head?.animate([{ color: 'var(--accent)' }, { color: 'var(--accent)', offset: 0.6 }, { color: 'var(--ink)' }], { duration: 1400, easing: 'ease-out' });
    }, same ? 350 : 700);
  }

  // A user scroll gesture ends the restore early, so it never fights the reader.
  const stopRestore = () => {
    restoring = false;
  };

  // A hash that no longer matches where the reader is would send a reload (or a shared link) back to the old section.
  // replaceState doesn't fire hashchange or scroll.
  const dropHash = () => history.replaceState(history.state, '', location.pathname + location.search);

  // The hash changing in-page (a section link, an edited URL, back/forward): another group's section is switched to
  // like a search jump; in this group the browser has already scrolled to it, so only a running restore is stopped.
  function onHashChange() {
    const t = sectionFromHash(location.hash);
    if (!t) return;
    if (t.group === group) stopRestore();
    else jump(t);
  }

  function showGroup(g: GroupId) {
    if (g === group) return;
    const t = sectionFromHash(location.hash);
    if (t && t.group !== g) dropHash();
    group = g;
  }
</script>

<svelte:window onscroll={onScroll} onwheel={stopRestore} ontouchstart={stopRestore} onkeydown={stopRestore} onhashchange={onHashChange} />

<div class="root" data-mode={mode} data-accent={accent} {dir}>
  <nav aria-label="Library sections">
    <div class="brand">OPENCHAT</div>
    <div class="tabs" role="tablist" aria-label="Library group">
      {#each groups as g (g.id)}
        <span role="tab" tabindex="0" aria-selected={group === g.id} class="tab" class:on={group === g.id} onclick={() => showGroup(g.id)}>{g.label}</span>
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
      <Search onGo={jump} />
      <div class="controls">
        <label class="pick">
          <span class="sr">Mode</span>
          <select bind:value={mode}>
            {#each MODES as m}<option value={m}>{m === 'dark' ? 'Dark' : 'Light'}</option>{/each}
          </select>
        </label>
        <label class="pick">
          <span class="sr">Direction</span>
          <select bind:value={dir}>
            {#each DIRS as d}<option value={d}>{d.toUpperCase()}</option>{/each}
          </select>
        </label>
        <label class="pick accent">
          <span class="sr">Accent</span>
          <span class="dot" aria-hidden="true"></span>
          <select bind:value={accent}>
            {#each ACCENTS as a}<option value={a}>{a[0].toUpperCase() + a.slice(1)}</option>{/each}
          </select>
        </label>
        <label class="pick">
          <span class="sr">Language</span>
          <select bind:value={lang}>
            <option value="en">English</option>
            <option value="keys">Keys</option>
            <option value="pseudo">Pseudo</option>
          </select>
        </label>
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
      {:else if group === 'features'}
        <Features {mode} {accent} />
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
  /* a fallback link colour, so as weak as a bare `a` (:where): a component's own link colour always wins. Not inside
     the pages (Landing, Learn): they colour their own links */
  :where(.root) :global(a:where(:not([data-oc-page] a))) { color: var(--accent); }
  :where(.root) :global(a:where(:not([data-oc-page] a)):hover) { color: var(--accent-hover); }

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

  .bar { position: sticky; top: 12px; z-index: var(--z-backdrop); /* above demo content, below modals */ box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 460px) minmax(max-content, 1fr); /* search centred while there's room; the controls never overlap it */ align-items: center; gap: 16px; min-height: 64px; margin-bottom: 28px; padding-block: 8px; padding-inline: 18px 10px; border-radius: var(--radius-xl); background: color-mix(in srgb, var(--surface-1) 82%, transparent); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: inset 0 0 0 1px var(--line-1), var(--shadow-panel); }
  .crumb { min-width: 0; text-align: start; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 13px/1 var(--font-sans); color: var(--ink); }
  .crumb-sep { margin-inline: 8px; color: var(--ink-4); }
  .crumb-section { font-weight: 500; color: var(--ink-3); }
  .controls { min-width: 0; display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
  .pick { position: relative; display: flex; align-items: center; }
  .pick select { appearance: none; height: 34px; padding-inline: 10px 26px; border: 0; border-radius: var(--radius-sm); background: var(--overlay-1); box-shadow: inset 0 0 0 1px var(--line-1); color: var(--ink); font: 600 12.5px/1 var(--font-sans); cursor: pointer; }
  .pick select:hover { background: var(--overlay-2); }
  .pick select option { background: var(--surface-1); color: var(--ink); }
  .pick::after { content: ''; position: absolute; inset-inline-end: 8px; width: 12px; height: 12px; background: var(--ink-3); mask: var(--icon-chevron-down) center/contain no-repeat; pointer-events: none; }
  .accent select { padding-inline-start: 28px; }
  .dot { position: absolute; inset-inline-start: 11px; width: 12px; height: 12px; border-radius: 50%; background: var(--accent); pointer-events: none; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  .group { display: flex; flex-direction: column; gap: 56px; max-width: 1000px; margin: 0 auto; }
  .intro h1 { margin: 0 0 12px; font: 700 34px/1.05 var(--font-sans); letter-spacing: -0.02em; }
  .intro p { margin: 0; max-width: 680px; font: 400 15.5px/1.6 var(--font-sans); color: var(--ink-2); }
</style>
