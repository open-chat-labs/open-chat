<!-- Reaction emoji picker: search + grouped grid (no GIFs). The host owns the surface (popover / menu panel / focus card).
     `selected` marks reactions you've already added (picking one again removes it — host decides). `onBack` shows a back arrow.
     Keys: arrows move in the grid, Enter picks, Esc → onBack (or onClose). -->
<script lang="ts">
  import { onMount } from 'svelte';

  const EMOJI: { label: string; items: [string, string][] }[] = [
    { label: 'FREQUENTLY USED', items: [['😂', 'joy'], ['❤️', 'heart'], ['👍', 'thumbs up'], ['🔥', 'fire'], ['🙏', 'pray'], ['😍', 'heart eyes'], ['🎉', 'party'], ['😅', 'sweat smile']] },
    { label: 'SMILEYS', items: [['😀', 'grin'], ['😃', 'smiley'], ['😄', 'smile'], ['😁', 'beaming'], ['😆', 'laughing'], ['🥹', 'holding back tears'], ['😊', 'blush'], ['😇', 'innocent'], ['🙂', 'slight smile'], ['😉', 'wink'], ['😌', 'relieved'], ['😋', 'yum'], ['😎', 'cool'], ['🤩', 'star struck'], ['🥳', 'partying'], ['😏', 'smirk'], ['😮', 'open mouth'], ['😢', 'cry'], ['😭', 'sob'], ['😤', 'triumph'], ['😡', 'rage'], ['🤯', 'mind blown'], ['🫡', 'salute'], ['🤔', 'thinking']] },
    { label: 'PEOPLE', items: [['👋', 'wave'], ['👏', 'clap'], ['🙌', 'raised hands'], ['🤝', 'handshake'], ['💪', 'muscle'], ['👀', 'eyes'], ['✌️', 'victory'], ['🤞', 'fingers crossed']] },
    { label: 'OBJECTS', items: [['🚀', 'rocket'], ['💎', 'gem'], ['🪙', 'coin'], ['📈', 'chart up'], ['🏆', 'trophy'], ['🎁', 'gift'], ['💡', 'idea'], ['✅', 'check']] },
  ];
  const ALL = EMOJI.flatMap((g) => g.items);
  const COLUMNS = 8;

  interface Props {
    /** Replaces the "frequently used" row when non-empty. */
    recent?: string[];
    selected?: string[];
    autoFocus?: boolean;
    onPick?: (emoji: string) => void;
    onBack?: () => void;
    onClose?: () => void;
  }

  let { recent = [], selected = [], autoFocus = true, onPick, onBack, onClose }: Props = $props();

  let query = $state('');
  let search: HTMLInputElement;
  let grid: HTMLDivElement;

  onMount(() => {
    if (autoFocus) requestAnimationFrame(() => search?.focus({ preventScroll: true }));
  });

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const head = recent.length ? [{ label: 'RECENT', items: recent.map((c) => [c, (ALL.find((x) => x[0] === c) ?? [c, c])[1]] as [string, string]) }] : [];
    return head
      .concat(EMOJI.filter((g) => !head.length || g.label !== 'FREQUENTLY USED'))
      .map((g) => ({ label: g.label, items: g.items.filter(([, name]) => !q || name.includes(q)) }))
      .filter((g) => g.items.length);
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      (onBack ?? onClose)?.();
      return;
    }
    const cells = [...grid.querySelectorAll<HTMLElement>('[data-emoji]')];
    if (e.target === search) {
      if (e.key === 'ArrowDown' && cells[0]) {
        e.preventDefault();
        cells[0].focus();
      } else if (e.key === 'Enter' && cells[0]) {
        e.preventDefault();
        cells[0].click();
      }
      return;
    }
    const i = cells.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const d = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS } as Record<string, number>)[e.key];
    if (d) {
      e.preventDefault();
      const n = i + d;
      if (n < 0) search.focus();
      else cells[n]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      cells[i].click();
    }
  }
</script>

<div class="picker" role="dialog" aria-label="Pick a reaction" onkeydown={onKey}>
  <div class="top">
    {#if onBack}
      <span class="back" onclick={onBack} role="button" tabindex="0" aria-label="Back to actions" data-tip="Back"><span class="back-icon"></span></span>
    {/if}
    <div class="search">
      <span class="search-icon"></span>
      <input bind:this={search} bind:value={query} placeholder="Search emoji" aria-label="Search emoji" />
    </div>
  </div>
  <div class="scroll" bind:this={grid}>
    {#each groups as group}
      <div class="group">
        <span class="label">{group.label}</span>
        <div class="grid" role="grid">
          {#each group.items as [char, name]}
            {@const on = selected.includes(char)}
            <span class="cell" class:on data-emoji="" onclick={() => onPick?.(char)} role="button" tabindex="0" aria-label={name} aria-pressed={on} title={name}>{char}</span>
          {/each}
        </div>
      </div>
    {/each}
    {#if !groups.length}<span class="none">No emoji match "{query}"</span>{/if}
  </div>
</div>

<style>
  .picker {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-10, 10px);
    padding: var(--space-10, 10px);
  }

  .top {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6, 6px);
  }

  .back {
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md, 10px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--ink-2, #c9c9d4);
  }

  .back:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    color: var(--ink, #ececf1);
  }

  .back:focus-visible,
  .cell:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .back-icon {
    width: 16px;
    height: 16px;
    background: currentColor;
    mask: var(--icon-back) center/contain no-repeat;
  }

  .search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-8, 8px);
    height: 38px;
    padding: 0 var(--space-12, 12px);
    border-radius: var(--radius-md, 10px);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .search-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--ink-4, #8a8a99);
    mask: var(--icon-search) center/contain no-repeat;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: var(--weight-regular) var(--text-sm, 13px) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-12, 12px);
    padding: 0 var(--space-2, 2px);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-6, 6px);
  }

  .label {
    padding: 0 var(--space-4, 4px);
    font: var(--weight-semibold) var(--text-xs, 11px) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide, 0.06em);
    color: var(--ink-4, #8a8a99);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 2px;
  }

  .cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm, 8px);
    background: transparent;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    user-select: none;
  }

  .cell.on {
    background: var(--accent-soft, rgba(255, 86, 114, 0.16));
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 50%, transparent);
  }

  .cell:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .none {
    padding: var(--space-24, 24px) 0;
    text-align: center;
    font: var(--weight-regular) var(--text-sm, 13px) / 1.4 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }
</style>
