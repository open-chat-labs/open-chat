<!-- Daily puzzle entry (opt-in). state: new | progress | solved | hidden (one-line "hidden" + Undo) | off (renders nothing).
     "⋯" menu: Remind me daily / How to play / Hide. Everything reports through onAction(key):
     puzzle | puzzleRemindOn | puzzleRemindOff | puzzleHow | puzzleHide | puzzleUnhide. -->
<script lang="ts" module>
  export type PuzzleAction = 'puzzle' | 'puzzleRemindOn' | 'puzzleRemindOff' | 'puzzleHow' | 'puzzleHide' | 'puzzleUnhide';
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';

  interface Props {
    state?: 'new' | 'progress' | 'solved' | 'hidden' | 'off';
    /** Resource key (or literal text). Progress: status line ("3 of 7 bridges"). Solved: the title ("Solved in 4:12"). */
    sub?: string;
    /** Solved: time until the next puzzle. */
    countdown?: string;
    /** Daily reminder is on: bell badge on the tile, checked menu item. */
    remind?: boolean;
    /** Resource key (or literal text). New / progress: the title; defaults to "Today's puzzle · Bridges". */
    title?: string;
    /** The "⋯" menu's items, by their action; defaults to all three. With none, there's no menu. */
    menu?: PuzzleAction[];
    onAction?: (key: PuzzleAction) => void;
  }

  let { state: status = 'new', sub, countdown = '', remind = false, title, menu, onAction }: Props = $props();
  const t = useT();

  let menuOpen = $state(false);

  const card = $derived(
    status === 'progress'
      ? { title: t(title ?? 'ui.dailyPuzzleCard.title'), sub: t(sub ?? 'ui.dailyPuzzleCard.inProgress'), btn: t('ui.common.continue'), icon: 'joystick' }
      : status === 'solved'
        ? { title: t(sub ?? 'ui.dailyPuzzleCard.solved'), sub: t('ui.dailyPuzzleCard.nextIn', { countdown }), btn: t('ui.dailyPuzzleCard.view'), icon: 'circle-check' }
        : { title: t(title ?? 'ui.dailyPuzzleCard.title'), sub: t('ui.dailyPuzzleCard.teaser'), btn: t('ui.dailyPuzzleCard.tryIt'), icon: 'joystick' },
  );

  const items = $derived([
    { label: 'ui.dailyPuzzleCard.remind', icon: 'bell', on: remind, key: (remind ? 'puzzleRemindOff' : 'puzzleRemindOn') as PuzzleAction },
    { label: 'ui.dailyPuzzleCard.howToPlay', icon: 'info', on: false, key: 'puzzleHow' as PuzzleAction },
    { label: 'ui.dailyPuzzleCard.hide', icon: 'eye-off', on: false, key: 'puzzleHide' as PuzzleAction },
  ].filter((item) => menu === undefined || menu.includes(item.key === 'puzzleRemindOff' ? 'puzzleRemindOn' : item.key)));
</script>

<div class="wrap">
  {#if status !== 'off' && status !== 'hidden'}
    <div class="card {status}">
      <span class="tile"
        ><span class="tile-icon" style:mask="var(--icon-{card.icon}) center/contain no-repeat"></span>{#if remind}<span class="bell" title={t('ui.dailyPuzzleCard.reminderOn')} aria-label={t('ui.dailyPuzzleCard.reminderOn')}
            ><span class="bell-icon"></span></span
          >{/if}</span
      >
      <div class="text">
        <span class="title">{card.title}</span>
        <span class="sub">{card.sub}</span>
      </div>
      <span class="go" onclick={() => onAction?.('puzzle')} role="button" tabindex="0">{card.btn}</span>
      {#if items.length > 0}<span class="more" class:open={menuOpen} onclick={() => (menuOpen = !menuOpen)} role="button" tabindex="0" title={t('ui.dailyPuzzleCard.options')} aria-label={t('ui.dailyPuzzleCard.options')} aria-expanded={menuOpen}
        ><span class="more-icon"></span></span
      >{/if}
      {#if menuOpen && items.length > 0}
        <div class="menu" role="menu">
          {#each items as item}<span
              class="item"
              onclick={() => {
                menuOpen = false;
                onAction?.(item.key);
              }}
              role="menuitem"
              tabindex="0"
              ><span class="item-icon" style:mask="var(--icon-{item.icon}) center/contain no-repeat"></span><span class="item-label">{t(item.label)}</span>{#if item.on}<span class="check"></span>{/if}</span
            >{/each}
        </div>
      {/if}
    </div>
  {/if}
  {#if status === 'hidden'}
    <div class="hidden-note" role="status">
      <span class="hidden-icon"></span><span class="hidden-text">{t('ui.dailyPuzzleCard.hiddenNote')}</span><span
        class="undo"
        onclick={() => onAction?.('puzzleUnhide')}
        role="button"
        tabindex="0">{t('ui.common.undo')}</span
      >
    </div>
  {/if}
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
  }

  .card {
    --tile-bg: var(--overlay-2);
    --tile-ink: var(--ink-3);
    --go-bg: var(--overlay-2);
    --go-ink: var(--ink);
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-12) var(--space-12) var(--space-12) var(--space-14);
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .card.progress {
    --tile-bg: var(--accent-soft);
    --tile-ink: var(--accent-bright);
    --go-bg: var(--accent);
    --go-ink: var(--on-accent);
  }

  .card.solved {
    --tile-bg: color-mix(in oklch, var(--status-online) 16%, transparent);
    --tile-ink: var(--status-online);
  }

  .tile {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: var(--tile-bg);
  }

  .tile-icon {
    width: 18px;
    height: 18px;
    background: var(--tile-ink);
  }

  .bell {
    position: absolute;
    inset-inline-end: -5px;
    bottom: -5px;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--surface-1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bell-icon {
    width: 10px;
    height: 10px;
    background: var(--on-accent);
    mask: var(--icon-bell) center/contain no-repeat;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .title {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .sub {
    font: var(--weight-regular) var(--text-sm) / 1.35 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .go {
    flex: none;
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 var(--space-14);
    border-radius: var(--radius-md);
    background: var(--go-bg);
    color: var(--go-ink);
    font: var(--weight-bold) var(--text-sm) / 1 var(--font-sans);
    cursor: pointer;
  }

  .go:hover {
    filter: brightness(1.1);
  }

  .more {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: transparent;
  }

  .more:hover,
  .more.open {
    background: var(--overlay-2);
  }

  .more-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
    mask: var(--icon-more) center/contain no-repeat;
  }

  .menu {
    position: absolute;
    z-index: 3;
    inset-inline-end: 8px;
    bottom: calc(100% - 6px);
    width: 230px;
    padding: 6px;
    border-radius: var(--radius-md);
    background: var(--surface-3, #24242e);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 12px 30px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink);
    cursor: pointer;
  }

  .item:hover {
    background: var(--overlay-2);
  }

  .item-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--ink-3);
  }

  .item-label {
    flex: 1;
  }

  .check {
    width: 14px;
    height: 14px;
    background: var(--accent);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .hidden-note {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--line-1);
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .hidden-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: currentColor;
    mask: var(--icon-eye-off) center/contain no-repeat;
  }

  .hidden-text {
    flex: 1;
  }

  .undo {
    font-weight: var(--weight-bold);
    color: var(--accent-bright);
    cursor: pointer;
    padding: 8px 4px;
  }
</style>
