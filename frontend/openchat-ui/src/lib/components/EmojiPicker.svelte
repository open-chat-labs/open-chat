<!-- Reaction emoji picker: search + grouped grid (no GIFs). The host owns the surface (popover / menu panel / focus card).
     `selected` marks reactions you've already added (picking one again removes it — host decides). `onBack` shows a back arrow.
     A host with emoji of its own (`source`: every emoji, its custom ones) gives them by section, with a category bar under
     the search to go to one, and searches them itself; a pick is `onPickItem`'s. Without, the picker's own small set.
     Keys: arrows move in the grid, Enter picks, Esc → onBack (or onClose). -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onDestroy, onMount } from 'svelte';
  import Spinner from './Spinner.svelte';
  import type { EmojiPickerSource, PickerEmojiItem } from '../types';

  // labels and emoji names are resource keys, translated at render (and search) time
  const EMOJI: { label: string; items: [string, string][] }[] = [
    { label: 'ui.emojiPicker.groups.frequentlyUsed', items: [['😂', 'ui.emojiPicker.emoji.joy'], ['❤️', 'ui.emojiPicker.emoji.heart'], ['👍', 'ui.emojiPicker.emoji.thumbsUp'], ['🔥', 'ui.emojiPicker.emoji.fire'], ['🙏', 'ui.emojiPicker.emoji.pray'], ['😍', 'ui.emojiPicker.emoji.heartEyes'], ['🎉', 'ui.emojiPicker.emoji.party'], ['😅', 'ui.emojiPicker.emoji.sweatSmile']] },
    { label: 'ui.emojiPicker.groups.smileys', items: [['😀', 'ui.emojiPicker.emoji.grin'], ['😃', 'ui.emojiPicker.emoji.smiley'], ['😄', 'ui.emojiPicker.emoji.smile'], ['😁', 'ui.emojiPicker.emoji.beaming'], ['😆', 'ui.emojiPicker.emoji.laughing'], ['🥹', 'ui.emojiPicker.emoji.holdingBackTears'], ['😊', 'ui.emojiPicker.emoji.blush'], ['😇', 'ui.emojiPicker.emoji.innocent'], ['🙂', 'ui.emojiPicker.emoji.slightSmile'], ['😉', 'ui.emojiPicker.emoji.wink'], ['😌', 'ui.emojiPicker.emoji.relieved'], ['😋', 'ui.emojiPicker.emoji.yum'], ['😎', 'ui.emojiPicker.emoji.cool'], ['🤩', 'ui.emojiPicker.emoji.starStruck'], ['🥳', 'ui.emojiPicker.emoji.partying'], ['😏', 'ui.emojiPicker.emoji.smirk'], ['😮', 'ui.emojiPicker.emoji.openMouth'], ['😢', 'ui.emojiPicker.emoji.cry'], ['😭', 'ui.emojiPicker.emoji.sob'], ['😤', 'ui.emojiPicker.emoji.triumph'], ['😡', 'ui.emojiPicker.emoji.rage'], ['🤯', 'ui.emojiPicker.emoji.mindBlown'], ['🫡', 'ui.emojiPicker.emoji.salute'], ['🤔', 'ui.emojiPicker.emoji.thinking']] },
    { label: 'ui.emojiPicker.groups.people', items: [['👋', 'ui.emojiPicker.emoji.wave'], ['👏', 'ui.emojiPicker.emoji.clap'], ['🙌', 'ui.emojiPicker.emoji.raisedHands'], ['🤝', 'ui.emojiPicker.emoji.handshake'], ['💪', 'ui.emojiPicker.emoji.muscle'], ['👀', 'ui.emojiPicker.emoji.eyes'], ['✌️', 'ui.emojiPicker.emoji.victory'], ['🤞', 'ui.emojiPicker.emoji.fingersCrossed']] },
    { label: 'ui.emojiPicker.groups.objects', items: [['🚀', 'ui.emojiPicker.emoji.rocket'], ['💎', 'ui.emojiPicker.emoji.gem'], ['🪙', 'ui.emojiPicker.emoji.coin'], ['📈', 'ui.emojiPicker.emoji.chartUp'], ['🏆', 'ui.emojiPicker.emoji.trophy'], ['🎁', 'ui.emojiPicker.emoji.gift'], ['💡', 'ui.emojiPicker.emoji.idea'], ['✅', 'ui.emojiPicker.emoji.check']] },
  ];
  const ALL = EMOJI.flatMap((g) => g.items);

  interface Props {
    /** Replaces the "frequently used" row when non-empty. */
    recent?: string[];
    selected?: string[];
    autoFocus?: boolean;
    onPick?: (emoji: string) => void;
    onBack?: () => void;
    onClose?: () => void;
    /** The host's emoji in place of the picker's own set (see the comment at the top). */
    source?: EmojiPickerSource;
    /** With `source`: one of its emoji picked. */
    onPickItem?: (item: PickerEmojiItem) => void;
    /** Emoji in a row (a wider surface takes more). */
    columns?: number;
  }

  let { recent = [], selected = [], autoFocus = true, onPick, onBack, onClose, source, onPickItem, columns = 8 }: Props = $props();
  const t = useT();

  let query = $state('');
  let search: HTMLInputElement;
  let grid: HTMLDivElement;

  // ---- a host's emoji (`source`): what's typed is the host's to search
  const searching = $derived(source !== undefined && query.trim() !== '');

  function typed() {
    source?.onQuery(query);
  }

  // one listener for the grid's thousands of cells
  function pickedItem(e: MouseEvent, list: PickerEmojiItem[]) {
    const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-i]');
    const item = cell ? list[Number(cell.dataset.i)] : undefined;
    if (item) onPickItem?.(item);
  }

  // the category bar: the section in view, and going to one (out of a search)
  let shown = $state<string>();
  let frame = 0;
  onDestroy(() => cancelAnimationFrame(frame));

  function followScroll() {
    if (!source || searching || jumping) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      let current = source?.sections[0]?.id;
      for (const section of grid.querySelectorAll<HTMLElement>('[data-section]')) {
        if (section.offsetTop - grid.offsetTop <= grid.scrollTop + 8) current = section.dataset.section ?? current;
      }
      shown = current;
    });
  }

  function goTo(id: string) {
    if (query !== '') {
      query = '';
      source?.onQuery('');
    }
    shown = id;
    jumping = true;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(jumpFrame);
    jumpFrame = requestAnimationFrame(() => settle(id, 30, 0));
  }

  // the sections not drawn yet (.lazy) have a made-up height until they're scrolled near (drawn a frame or two after
  // they are), so the one gone to moves as those before it are drawn: jump, and again each frame until it has stayed put
  // for a few (or the list can't scroll further); meanwhile the bar shows the one gone to
  let jumping = false;
  let jumpFrame = 0;
  onDestroy(() => cancelAnimationFrame(jumpFrame));

  function settle(id: string, tries: number, still: number) {
    const section = grid.querySelector<HTMLElement>(`[data-section="${CSS.escape(id)}"]`);
    const top = section ? Math.min(section.offsetTop - grid.offsetTop, grid.scrollHeight - grid.clientHeight) : grid.scrollTop;
    const there = Math.abs(grid.scrollTop - top) < 1;
    if ((there && still >= 3) || tries === 0) {
      jumping = false;
      return;
    }
    if (!there) grid.scrollTop = top;
    jumpFrame = requestAnimationFrame(() => settle(id, tries - 1, there ? still + 1 : 0));
  }

  onMount(() => {
    source?.onOpen();
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
    const d = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns } as Record<string, number>)[e.key];
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

<div class="picker" role="dialog" aria-label={t('ui.emojiPicker.title')} onkeydown={onKey} style:--emoji-columns={columns}>
  <div class="top">
    {#if onBack}
      <span class="back" onclick={onBack} role="button" tabindex="0" aria-label={t('ui.emojiPicker.backToActions')} data-tip={t('ui.common.back')}><span class="back-icon"></span></span>
    {/if}
    <div class="search">
      <span class="search-icon"></span>
      <input bind:this={search} bind:value={query} oninput={typed} placeholder={t('ui.emojiPicker.search')} aria-label={t('ui.emojiPicker.search')} />
    </div>
  </div>
  {#if source && source.sections.length > 1}
    <div class="bar" role="toolbar" aria-label={source.categoriesLabel}>
      {#each source.sections as section (section.id)}
        <button
          type="button"
          class="category"
          class:on={!searching && (shown ?? source.sections[0].id) === section.id}
          aria-label={section.label}
          title={section.label}
          onclick={() => goTo(section.id)}>{@render emoji(section.icon)}</button
        >
      {/each}
    </div>
  {/if}
  <div class="scroll" bind:this={grid} onscroll={followScroll}>
    {#if source}
      {#if searching}
        {#if source.matches?.length}
          {@render items(source.matches)}
        {:else if source.matches}
          <span class="none">{t('ui.emojiPicker.noMatch', { query: query.trim() })}</span>
        {/if}
      {:else}
        {#each source.sections as section (section.id)}
          <div class="group lazy" data-section={section.id}>
            <span class="label"
              >{section.label}{#if section.lockedNote}<span class="locked-note"><span class="lock-icon"></span>{section.lockedNote}</span>{/if}</span
            >
            {#if section.items.length}
              {@render items(section.items)}
            {:else if source.status.kind === 'failed'}
              <span class="none">{source.status.text}</span>
            {:else if source.status.kind === 'loading'}
              <div class="loading"><Spinner size={20} /></div>
            {/if}
          </div>
        {/each}
      {/if}
    {:else}
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
    {/if}
  </div>
</div>

{#snippet emoji(item: PickerEmojiItem)}
  {#if item.kind === 'char'}{item.char}{:else}<img class="image" src={item.url} alt="" draggable="false" />{/if}
{/snippet}

<!-- a host's emoji, with one listener for the grid's cells -->
{#snippet items(list: PickerEmojiItem[])}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="grid" role="group" onclick={(e) => pickedItem(e, list)}>
    {#each list as item, i}
      {@const on = item.kind === 'char' && selected.includes(item.char)}
      <span
        class="cell"
        class:on
        class:locked={item.kind === 'image' && item.locked}
        data-emoji=""
        data-i={i}
        role="button"
        tabindex="0"
        aria-label={item.name}
        title={item.name}>{@render emoji(item)}</span
      >
    {/each}
  </div>
{/snippet}

<style lang="scss">
  @use '../styles/mixins' as *;

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
    @include flex-center;
    cursor: pointer;
    color: var(--ink-2);

    &:hover {
      background: var(--overlay-2);
      color: var(--ink);
    }
  }

  .back:focus-visible,
  .cell:focus-visible {
    @include focus-ring;
  }

  .back-icon {
    @include icon(back, 16px, $flex: null);
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
    @include icon(search, 15px, var(--ink-4));
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
    grid-template-columns: repeat(var(--emoji-columns), minmax(0, 1fr));
    gap: 2px;
  }

  .cell {
    aspect-ratio: 1;
    @include flex-center;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    user-select: none;

    &.on {
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 50%, transparent);
    }

    &:hover {
      background: var(--overlay-2);
    }

    // a host's emoji that isn't the user's to use yet
    &.locked {
      opacity: 0.5;
    }
  }

  // a host's image emoji, the size a character's drawn
  .image {
    width: 26px;
    height: 26px;
    object-fit: contain;
    pointer-events: none;
  }

  // a host's section, drawn only once it's scrolled near (thousands of emoji)
  .lazy {
    content-visibility: auto;
    contain-intrinsic-size: auto 240px;
  }

  .loading {
    display: flex;
    justify-content: center;
    padding: var(--space-12) 0;
  }

  .locked-note {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    margin-inline-start: var(--space-8);
    letter-spacing: normal;
  }

  .lock-icon {
    @include icon(lock, 11px, var(--ink-4), $flex: null);
  }

  // a host's sections, one button each: greyed but the one in view
  .bar {
    flex: none;
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .category {
    flex: 1 0 auto;
    min-width: var(--control-sm);
    height: var(--control-sm);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    @include flex-center;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    filter: grayscale(1);
    opacity: 0.55;

    .image {
      width: 20px;
      height: 20px;
    }

    &:hover {
      background: var(--overlay-2);
      opacity: 0.85;
    }

    &.on {
      filter: none;
      opacity: 1;
      background: var(--overlay-2);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .none {
    padding: var(--space-24) 0;
    text-align: center;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
  }
</style>
