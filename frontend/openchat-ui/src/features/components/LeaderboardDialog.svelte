<!-- CHIT high scores: one board per period (tabs), top rows with the podium in green, and your own row pinned below.
     Your row comes from `you` (per period or one value) or the board, exactly as the host ranks it; hidden without one.
     With a `game` (the host's), the joystick plays it in the boards' place, and the trophy that takes its place goes
     back to them; without one, the joystick only says it's coming. -->
<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { useT } from '../../lib/i18n';

  type Standing = { rank: number; score: number };

  interface Board {
    /** Tab label, e.g. "SEPTEMBER". Resource key (or literal text). */
    label: string;
    /** [handle, score], best first. */
    rows: [string, number][];
    you?: Standing;
  }

  interface Props {
    /** Boards in tab order, keyed by period. */
    boards: Record<string, Board>;
    /** Period shown first; defaults to the first board. */
    initialPeriod?: string;
    /** Your handle, shown as "YOU — HANDLE". */
    handle: string;
    /** Your standing: one for every board, or per period key. */
    you?: Standing | Record<string, Standing> | null;
    /** Opened from another dialog: a back arrow, back to it (none without). */
    onBack?: () => void;
    onClose?: () => void;
    /** A game the joystick plays, in the boards' place (the host's: it fills the space it's given). */
    game?: Snippet;
  }

  let { boards, initialPeriod, handle, you = null, onBack, onClose, game }: Props = $props();
  // the game showing in the boards' place; focus goes to it (its keys are the game's, and a focused button would wear
  // its ring the whole game), and back to the joystick after
  let playing = $state(false);
  let gameArea = $state<HTMLDivElement>();
  let joystick = $state<HTMLButtonElement>();
  async function toggleGame() {
    playing = !playing;
    await tick();
    (playing ? gameArea : joystick)?.focus();
  }
  const t = useT();

  const keys = $derived(Object.keys(boards));
  let chosen = $state<string | null>(null);
  const period = $derived(chosen ?? initialPeriod ?? keys[0]);
  const board = $derived(boards[period]);

  // the host's ranking is authoritative (ties are its call), so the row shows it as given
  const mine = $derived<Standing | null>(
    (you && 'rank' in you ? (you as Standing) : (you as Record<string, Standing> | null)?.[period]) ?? board.you ?? null,
  );
</script>

<div class="layer oc-dialog-layer" data-screen-label="Leaderboard" role="dialog" aria-modal="true" use:modal={() => onClose?.()}>
  <div class="oc-veil" onclick={() => onClose?.()} aria-hidden="true"></div>

  <div class="card">
    <div class="head">
      {#if onBack}<span class="icon-button back" onclick={() => onBack?.()} role="button" tabindex="0" aria-label={t('ui.leaderboardDialog.backToChit')} title={t('ui.leaderboardDialog.backToChit')}><span class="back-icon"></span></span
        >{:else}<span class="icon-button back spacer" aria-hidden="true"></span>{/if}
      <span class="title">{t('ui.leaderboardDialog.title')}</span>
      {#if game}<button
          type="button"
          class="icon-button"
          bind:this={joystick}
          onclick={toggleGame}
          aria-label={t(playing ? 'ui.leaderboardDialog.backToScores' : 'ui.leaderboardDialog.play')}
          title={t(playing ? 'ui.leaderboardDialog.backToScores' : 'ui.leaderboardDialog.play')}><span class={playing ? 'trophy' : 'joystick'}></span></button
        >{:else}<span class="icon-button" title={t('ui.leaderboardDialog.playSoon')}><span class="joystick"></span></span>{/if}
      <span class="icon-button" onclick={() => onClose?.()} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-icon"></span></span>
    </div>

    {#if playing && game}
      <div class="game" bind:this={gameArea} tabindex="-1">{@render game()}</div>
    {:else}
      <div class="periods">
        {#each keys as key}
          <span class="period" class:on={key === period} onclick={() => (chosen = key)} role="button" tabindex="0">{t(boards[key].label)}</span>
        {/each}
      </div>

      <div class="columns">
        <div class="column-row">
          <span class="rank-col">#</span>
          <span class="name-col">{t('ui.leaderboardDialog.username')}</span>
          <span class="score-col">CHIT</span>
        </div>
      </div>

      <div class="rows">
        {#each board.rows as [name, score], i}
          <!-- the podium lights up green, the chasing pack stays white -->
          <div class="row" class:podium={i < 3}>
            <span class="rank">{i + 1}</span>
            <span class="name">{name}</span>
            <span class="score">{score}</span>
          </div>
        {/each}
      </div>

      {#if mine}
        <div class="row you">
          <span class="rank">{mine.rank}</span>
          <span class="name">{t('ui.leaderboardDialog.you', { handle })}</span>
          <span class="score">{mine.score}</span>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .layer {
    z-index: 73;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 620px;
    height: 600px;
    max-height: 100%;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-modal);
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-24) var(--space-32) var(--space-14);
  }

  .icon-button {
    flex: none;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  /* the arrow's place kept with no arrow, so the title stays where it is */
  .icon-button.spacer {
    cursor: default;
  }

  .icon-button.back {
    width: 32px;
    height: 32px;
    margin-inline-start: -10px;
  }

  .icon-button:hover {
    background: var(--overlay-2);
  }

  .back-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2);
    mask: var(--icon-back) center/contain no-repeat;
  }

  .joystick {
    width: 17px;
    height: 17px;
    background: var(--status-chit);
    mask: var(--icon-joystick) center/contain no-repeat;
  }

  .trophy {
    width: 17px;
    height: 17px;
    background: var(--status-chit);
    mask: var(--icon-trophy) center/contain no-repeat;
  }

  /* the host's game, in the boards' place */
  .game {
    outline: none;
    flex: 1;
    min-height: 0;
    margin: var(--space-8) var(--space-32) var(--space-32);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .title {
    flex: 1;
    min-width: 0;
    text-align: center;
    font: 700 22px/1 'JetBrains Mono', monospace;
    letter-spacing: 0.14em;
    color: var(--status-chit);
  }

  .periods {
    flex: none;
    display: flex;
    justify-content: center;
    gap: var(--space-26);
    padding: var(--space-6) var(--space-32) var(--space-18);
  }

  .period {
    font: 500 12.5px/1 'JetBrains Mono', monospace;
    letter-spacing: 0.1em;
    color: var(--ink-3);
    padding-block-end: 5px;
    border-block-end: 2px solid transparent;
    cursor: pointer;
    user-select: none;
  }

  .period.on {
    color: var(--ink);
    border-block-end-color: var(--status-chit);
  }

  .period:hover {
    color: var(--ink);
  }

  .columns {
    flex: none;
    padding: 0 var(--space-32) var(--space-12);
  }

  .column-row {
    display: flex;
    align-items: baseline;
    gap: 14px;
    padding-block-end: var(--space-10);
    border-block-end: 2px solid var(--accent);
    font: 500 11px/1 'JetBrains Mono', monospace;
    letter-spacing: 0.1em;
    color: var(--status-online);
  }

  .rank-col {
    flex: none;
    width: 34px;
  }

  .name-col {
    flex: 1;
  }

  .score-col {
    flex: none;
  }

  .rows {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    padding: 0 var(--space-32);
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 14px;
    min-height: 30px;
    padding: 4px 0;
    font: 700 15px/1 'JetBrains Mono', monospace;
    color: var(--ink);
  }

  .row.podium {
    color: var(--status-online);
  }

  .rank {
    flex: none;
    width: 34px;
  }

  .name {
    flex: 1;
    min-width: 0;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .score {
    flex: none;
  }

  .row.you {
    flex: none;
    min-height: 0;
    padding: var(--space-16) var(--space-32) var(--space-24);
    margin-block-start: var(--space-10);
    border-block-start: 1px solid var(--line-1);
    color: var(--accent);
  }
</style>
