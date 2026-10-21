<!-- Reaction emoji picker: search + grouped grid (no GIFs). The host owns the surface (popover / menu panel / focus card).
     `selected` marks reactions you've already added (picking one again removes it — host decides). `onBack` shows a back arrow.
     Keys: arrows move in the grid, Enter picks, Esc → onBack (or onClose). -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onMount } from 'svelte';

  // labels and emoji names are resource keys, translated at render (and search) time
  const EMOJI: { label: string; items: [string, string][] }[] = [
    { label: 'ui.emojiPicker.groups.frequentlyUsed', items: [['😂', 'ui.emojiPicker.emoji.joy'], ['❤️', 'ui.emojiPicker.emoji.heart'], ['👍', 'ui.emojiPicker.emoji.thumbsUp'], ['🔥', 'ui.emojiPicker.emoji.fire'], ['🙏', 'ui.emojiPicker.emoji.pray'], ['😍', 'ui.emojiPicker.emoji.heartEyes'], ['🎉', 'ui.emojiPicker.emoji.party'], ['😅', 'ui.emojiPicker.emoji.sweatSmile']] },
    { label: 'ui.emojiPicker.groups.smileys', items: [['😀', 'ui.emojiPicker.emoji.grin'], ['😃', 'ui.emojiPicker.emoji.smiley'], ['😄', 'ui.emojiPicker.emoji.smile'], ['😁', 'ui.emojiPicker.emoji.beaming'], ['😆', 'ui.emojiPicker.emoji.laughing'], ['🥹', 'ui.emojiPicker.emoji.holdingBackTears'], ['😊', 'ui.emojiPicker.emoji.blush'], ['😇', 'ui.emojiPicker.emoji.innocent'], ['🙂', 'ui.emojiPicker.emoji.slightSmile'], ['😉', 'ui.emojiPicker.emoji.wink'], ['😌', 'ui.emojiPicker.emoji.relieved'], ['😋', 'ui.emojiPicker.emoji.yum'], ['😎', 'ui.emojiPicker.emoji.cool'], ['🤩', 'ui.emojiPicker.emoji.starStruck'], ['🥳', 'ui.emojiPicker.emoji.partying'], ['😏', 'ui.emojiPicker.emoji.smirk'], ['😮', 'ui.emojiPicker.emoji.openMouth'], ['😢', 'ui.emojiPicker.emoji.cry'], ['😭', 'ui.emojiPicker.emoji.sob'], ['😤', 'ui.emojiPicker.emoji.triumph'], ['😡', 'ui.emojiPicker.emoji.rage'], ['🤯', 'ui.emojiPicker.emoji.mindBlown'], ['🫡', 'ui.emojiPicker.emoji.salute'], ['🤔', 'ui.emojiPicker.emoji.thinking']] },
    { label: 'ui.emojiPicker.groups.people', items: [['👋', 'ui.emojiPicker.emoji.wave'], ['👏', 'ui.emojiPicker.emoji.clap'], ['🙌', 'ui.emojiPicker.emoji.raisedHands'], ['🤝', 'ui.emojiPicker.emoji.handshake'], ['💪', 'ui.emojiPicker.emoji.muscle'], ['👀', 'ui.emojiPicker.emoji.eyes'], ['✌️', 'ui.emojiPicker.emoji.victory'], ['🤞', 'ui.emojiPicker.emoji.fingersCrossed']] },
    { label: 'ui.emojiPicker.groups.objects', items: [['🚀', 'ui.emojiPicker.emoji.rocket'], ['💎', 'ui.emojiPicker.emoji.gem'], ['🪙', 'ui.emojiPicker.emoji.coin'], ['📈', 'ui.emojiPicker.emoji.chartUp'], ['🏆', 'ui.emojiPicker.emoji.trophy'], ['🎁', 'ui.emojiPicker.emoji.gift'], ['💡', 'ui.emojiPicker.emoji.idea'], ['✅', 'ui.emojiPicker.emoji.check']] },
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
  const t = useT();

  let query = $state('');
  let search: HTMLInputElement;
  let grid: HTMLDivElement;

  onMount(() => {
    if (autoFocus) requestAnimationFrame(() => search?.focus({ preventScroll: true }));
  });

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const head = recent.length ? [{ label: 'ui.emojiPicker.groups.recent', items: recent.map((c) => [c, (ALL.find((x) => x[0] === c) ?? [c, c])[1]] as [string, string]) }] : [];
    return head
      .concat(EMOJI.filter((g) => !head.length || g.label !== 'ui.emojiPicker.groups.frequentlyUsed'))
      .map((g) => ({ label: g.label, items: g.items.filter(([, name]) => !q || t(name).toLowerCase().includes(q)) }))
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

<div class="picker" role="dialog" aria-label={t('ui.emojiPicker.title')} onkeydown={onKey}>
  <div class="top">
    {#if onBack}
      <span class="back" onclick={onBack} role="button" tabindex="0" aria-label={t('ui.emojiPicker.backToActions')} data-tip={t('ui.common.back')}><span class="back-icon"></span></span>
    {/if}
    <div class="search">
      <span class="search-icon"></span>
      <input bind:this={search} bind:value={query} placeholder={t('ui.emojiPicker.search')} aria-label={t('ui.emojiPicker.search')} />
    </div>
  </div>
  <div class="scroll" bind:this={grid}>
    {#each groups as group}
      <div class="group">
        <span class="label">{t(group.label)}</span>
        <div class="grid" role="grid">
          {#each group.items as [char, name]}
            {@const on = selected.includes(char)}
            <span class="cell" class:on data-emoji="" onclick={() => onPick?.(char)} role="button" tabindex="0" aria-label={t(name)} aria-pressed={on} title={t(name)}>{char}</span>
          {/each}
        </div>
      </div>
    {/each}
    {#if !groups.length}<span class="none">{t('ui.emojiPicker.noMatch', { query })}</span>{/if}
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
    gap: var(--space-10);
    padding: var(--space-10);
  }

  .top {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .back {
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--ink-2);
  }

  .back:hover {
    background: var(--overlay-2);
    color: var(--ink);
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
    gap: var(--space-8);
    height: 38px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-md);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .search-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--ink-4);
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
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: 0 var(--space-2);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .label {
    padding: 0 var(--space-4);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
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
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    user-select: none;
  }

  .cell.on {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 50%, transparent);
  }

  .cell:hover {
    background: var(--overlay-2);
  }

  .none {
    padding: var(--space-24) 0;
    text-align: center;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
  }
</style>
