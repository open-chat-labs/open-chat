<!-- Library search (combobox): components by name / description / prop, and sections by title / meta, across all
     groups. "/" or ⌘K / Ctrl+K focuses it; ↑ ↓ pick, Enter jumps, Esc clears. Chips jump to a specific demo or the API. -->
<script lang="ts">
  import { search, type Target } from './search';
  import { groups } from './sections';

  interface Props {
    onGo: (target: Target) => void;
  }

  let { onGo }: Props = $props();

  let query = $state('');
  let open = $state(false);
  let index = $state(0);
  let input: HTMLInputElement;

  const hits = $derived(search(query));
  const groupLabel = (g: string) => groups.find((x) => x.id === g)?.label ?? g;
  const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);

  $effect(() => {
    void query;
    index = 0;
  });

  function go(target: Target) {
    onGo(target);
    open = false;
    query = '';
    input.blur();
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!hits.length) return;
      e.preventDefault();
      open = true;
      index = (index + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
      document.getElementById('search-opt-' + index)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      const h = hits[index];
      if (h) {
        e.preventDefault();
        go(h.target);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) query = '';
      else input.blur();
    }
  }

  // "/" anywhere outside a field, or ⌘K / Ctrl+K from anywhere, focuses the search
  function globalKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  }

  /** Splits a title around the first match so it can be highlighted. */
  function mark(title: string) {
    const q = query.trim();
    const i = q ? title.toLowerCase().indexOf(q.toLowerCase()) : -1;
    return i < 0 ? { pre: title, hit: '', post: '' } : { pre: title.slice(0, i), hit: title.slice(i, i + q.length), post: title.slice(i + q.length) };
  }
</script>

<svelte:window onkeydown={globalKey} />

<div class="search" class:open={open && query.trim()}>
  <span class="glyph" aria-hidden="true"></span>
  <input
    bind:this={input}
    bind:value={query}
    type="text"
    placeholder="Search components, props, sections"
    autocomplete="off"
    spellcheck="false"
    role="combobox"
    aria-expanded={open && hits.length > 0}
    aria-controls="search-results"
    aria-activedescendant={open && hits.length ? 'search-opt-' + index : undefined}
    aria-label="Search the library"
    onfocus={() => (open = true)}
    onblur={() => setTimeout(() => (open = false), 120)}
    oninput={() => (open = true)}
    onkeydown={key}
  />
  {#if !query}<kbd aria-hidden="true">{isMac ? '⌘K' : 'Ctrl K'}</kbd>{/if}

  {#if open && query.trim()}
    <div class="results" id="search-results" role="listbox" aria-label="Results">
      {#each hits as h, i (h.kind + h.title + h.target.id)}
        {@const m = mark(h.title)}
        <div
          id={'search-opt-' + i}
          class="option"
          class:active={i === index}
          role="option"
          aria-selected={i === index}
          tabindex="-1"
          onmousedown={(e) => e.preventDefault()}
          onmouseenter={() => (index = i)}
          onclick={() => go(h.target)}
        >
          <div class="line">
            <span class="title">{m.pre}<mark>{m.hit}</mark>{m.post}</span>
            <span class="kind">{h.kind === 'component' ? 'Component' : groupLabel(h.target.group)}</span>
          </div>
          {#if h.sub}<div class="sub">{h.sub}</div>{/if}
          {#if h.links.length > 1}
            <div class="chips">
              {#each h.links as l (l.group + l.id)}
                <span class="chip" role="link" tabindex="-1" onclick={(e) => { e.stopPropagation(); go(l); }}>{l.label}</span>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <div class="empty">No matches for “{query.trim()}”</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .search { position: relative; min-width: 0; display: flex; align-items: center; gap: 10px; height: 44px; padding-inline: 14px 10px; border-radius: var(--radius-md); background: var(--field); box-shadow: inset 0 0 0 1px var(--line-1); }
  .search:focus-within { box-shadow: inset 0 0 0 1px var(--accent-dim); }
  .glyph { flex: none; width: 16px; height: 16px; background: var(--ink-4); mask: var(--icon-search) center/contain no-repeat; }
  input { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; background: none; outline: none; color: var(--ink); font: 500 14px/1 var(--font-sans); }
  input::placeholder { color: var(--ink-4); }
  input:focus-visible { outline: none; }
  kbd { flex: none; padding: 3px 6px; border-radius: 6px; background: var(--overlay-1); box-shadow: inset 0 0 0 1px var(--line-1); font: 500 10.5px/1 var(--font-mono); color: var(--ink-4); }

  .results { position: absolute; top: calc(100% + 10px); left: 50%; translate: -50% 0; width: min(560px, 80vw); max-height: min(520px, 70vh); overflow-y: auto; box-sizing: border-box; padding: 6px; border-radius: var(--radius-lg); background: var(--surface-1); box-shadow: inset 0 0 0 1px var(--line-2), var(--shadow-modal); }
  .option { padding: 9px 10px; border-radius: var(--radius-sm); cursor: pointer; }
  .option.active { background: var(--overlay-1); }
  .line { display: flex; align-items: baseline; gap: 10px; }
  .title { flex: 1; min-width: 0; font: 600 13.5px/1.3 var(--font-sans); color: var(--ink); }
  mark { background: none; color: var(--accent); }
  .kind { flex: none; font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-4); }
  .sub { margin-top: 3px; font: 400 12px/1.4 var(--font-sans); color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
  .chip { padding: 4px 8px; border-radius: var(--radius-pill); background: var(--overlay-1); box-shadow: inset 0 0 0 1px var(--line-1); font: 500 11px/1 var(--font-sans); color: var(--ink-2); }
  .chip:hover { background: var(--accent-soft); color: var(--accent); }
  .empty { padding: 14px 10px; font: 400 12.5px/1.4 var(--font-sans); color: var(--ink-3); }
</style>
