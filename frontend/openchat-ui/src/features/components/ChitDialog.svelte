<!-- Daily CHIT: streak ring (fills toward the next milestone), collected balance, milestone bar, claim button,
     the daily puzzle card, streak insurance and "ways to earn". Claiming goes to the host (onClaim): the button waits
     on its promise, shows the claim only once it resolves and an error if it rejects; the host then passes the new
     streak / balance. Without onClaim there is no claim button. onAction: settings | leaderboard | insurance | earn | calendar |
     puzzle… (see DailyPuzzleCard). -->
<script lang="ts" module>
  import type { PuzzleAction } from './DailyPuzzleCard.svelte';

  export type ChitAction = 'settings' | 'leaderboard' | 'insurance' | 'earn' | 'calendar' | PuzzleAction;
</script>

<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import DailyPuzzleCard from './DailyPuzzleCard.svelte';
  import Confetti from '../../lib/components/Confetti.svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { getI18n, useT } from '../../lib/i18n';

  // milestone days that pay a bonus on top of the daily claim, with the position each one takes on the bar —
  // hand-spaced so the early run stays readable and the long haul to 365 still reads as long
  const DEFAULT_TIERS = [3, 7, 14, 30, 100, 365];
  const DEFAULT_POS: Record<number, number> = { 3: 8, 7: 16, 14: 32, 30: 48, 100: 67, 365: 100 };
  // numbers in the host's locale (i18n is set up below; fmt only runs after init)
  const fmt = (n: number) => n.toLocaleString(i18n.locale ?? 'en');

  interface Props {
    streak: number;
    balance: number;
    /** All-time CHIT earned. */
    earned: number;
    /** Today's claim. */
    daily: number;
    /** Whether today's claim is open (defaults to false). */
    claimable?: boolean;
    /** Milestone days that pay a bonus (backend schedule); defaults to 3, 7, 14, 30, 100, 365. */
    milestones?: number[];
    /** Achievements for the "Ways to earn" row; the count is hidden without it. */
    achievements?: { total: number; left: number };
    /** Time until the next claim (and the next puzzle). */
    countdown?: string;
    /** Insured days bought / already used. */
    insured?: number;
    used?: number;
    /** This month's leaderboard place and score, for the trophy button's label. */
    boardRank?: number;
    boardScore?: number;
    puzzleState?: 'new' | 'progress' | 'solved' | 'unavailable' | 'hidden' | 'off';
    puzzleSub?: string;
    puzzleRemind?: boolean;
    /** DailyPuzzleCard's title and "⋯" menu (see there). */
    puzzleTitle?: string;
    puzzleMenu?: PuzzleAction[];
    /** The solved puzzle card's "Next puzzle in": defaults to `countdown`. */
    puzzleCountdown?: string;
    /** Shows a back arrow (opened from another dialog). */
    onBack?: () => void;
    /** Resource key (or literal text). */
    backLabel?: string;
    /** Claim today's CHIT. Reject to show an error; resolve once the host has applied it, or with false when there was
     *  nothing to claim (claimed already, elsewhere): no claim plays then, and the dialog follows `claimable`. */
    onClaim?: (r: { amount: number }) => Promise<unknown> | void;
    onAction?: (kind: ChitAction) => void;
    onClose?: () => void;
  }

  let {
    streak,
    balance,
    earned,
    daily,
    claimable = false,
    milestones,
    achievements,
    countdown = '',
    insured = 0,
    used = 0,
    boardRank,
    boardScore,
    puzzleState = 'new',
    puzzleSub,
    puzzleRemind = false,
    puzzleTitle,
    puzzleMenu,
    puzzleCountdown,
    onBack,
    backLabel = 'ui.common.back',
    onClaim,
    onAction,
    onClose,
  }: Props = $props();
  const t = useT();
  const i18n = getI18n();

  let claimedHere = $state<boolean | null>(null);
  // busy / leaving / the exit: the shared dialog contract (lib/behaviours/dialog.svelte.ts). A claim in flight
  // can't be dismissed or navigated away from: its result must be seen.
  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());

  const days = $derived(streak);
  const TIERS = $derived(milestones?.length ? [...milestones].sort((a, b) => a - b) : DEFAULT_TIERS);
  // the default schedule keeps its hand-tuned spacing; a custom one is spaced evenly
  // the default tiers keep their hand-spaced positions, whoever passes them
  const defaultTiers = $derived(TIERS.length === DEFAULT_TIERS.length && TIERS.every((d, i) => d === DEFAULT_TIERS[i]));
  const TIER_POS = $derived<Record<number, number>>(
    defaultTiers ? DEFAULT_POS : Object.fromEntries(TIERS.map((d, i) => [d, ((i + 1) / TIERS.length) * 100])),
  );
  const claimed = $derived(claimedHere ?? !claimable);
  // a claim made here shows as made until the next one opens (claimable again, for the next day)
  let wasClaimable = untrack(() => claimable);
  $effect(() => {
    const open = claimable;
    untrack(() => {
      if (open && !wasClaimable) claimedHere = null;
      wasClaimable = open;
    });
  });
  const insuredLeft = $derived(Math.max(insured - used, 0));

  const boardHint = $derived.by(() => {
    if (boardRank == null) return t('ui.chitDialog.leaderboard');
    // ordinal category (one / two / few / other) so each language can pick its own suffix
    const ord = new Intl.PluralRules(i18n.locale ?? 'en', { type: 'ordinal' }).select(boardRank);
    return t('ui.chitDialog.boardRank', { rank: boardRank, ord, hasScore: boardScore != null ? 'yes' : 'no', score: boardScore != null ? fmt(boardScore) : '' });
  });

  // progress runs tier to tier so the ring means "distance to the next rate"
  const nextTier = $derived(TIERS.find((t) => t > days) ?? TIERS[TIERS.length - 1]);
  const within = $derived.by(() => {
    const prev = TIERS.filter((t) => t <= days).pop() ?? 0;
    const span = Math.max(nextTier - prev, 1);
    return Math.min(Math.max(days - prev, 0), span) / span;
  });

  // the streak sits between its two bracketing milestones, in their spacing
  const barPct = $derived.by(() => {
    if (days <= 0) return 0;
    const top = TIERS[TIERS.length - 1];
    if (days >= top) return 100;
    const hi = TIERS.find((t) => t > days)!;
    const lo = TIERS.filter((t) => t <= days).pop() ?? 0;
    const loPos = lo ? TIER_POS[lo] : 0;
    return loPos + (TIER_POS[hi] - loPos) * ((days - lo) / (hi - lo));
  });

  const ring = $derived(
    `conic-gradient(var(--accent) 0turn, var(--status-chit) ${(0.15 + within * 0.7).toFixed(3)}turn, ` +
      `var(--overlay-2) ${(0.16 + within * 0.7).toFixed(3)}turn, var(--overlay-2) 1turn)`,
  );

  async function claim() {
    if (!onClaim || claimedHere) return;
    const result = await flow.run(() => onClaim({ amount: daily }));
    if (result.ok && result.value !== false) {
      claimedHere = true;
      claimBurst++;
    }
  }
  // a claim made here bursts confetti from the claim area, as the ring pops
  let claimBurst = $state(0);

  const close = () => flow.dismiss(onClose);
  // other dialogs open from here: not while a claim is pending or the dialog is leaving
  const act = (kind: ChitAction) => !flow.locked && onAction?.(kind);
  const back = () => !flow.locked && onBack?.();
</script>

{#snippet calendarLink(label: string)}
  <button type="button" class="calendar-link" onclick={() => act('calendar')}><span class="calendar-glyph" aria-hidden="true"></span>{t(label)}</button>
{/snippet}

<div class="layer oc-dialog-layer" class:closing={flow.closing} data-screen-label="CHIT" role="dialog" aria-modal="true" use:modal={flow.escape(onClose)}>
  <div class="oc-veil" onclick={close} aria-hidden="true"></div>

  <div class="card">
    <div class="head">
      {#if onBack}
        <span class="icon-button back" onclick={back} role="button" tabindex="0" aria-label={t(backLabel)} title={t(backLabel)}><span class="glyph back-glyph"></span></span>
      {/if}
      <div class="heading">
        <span class="title">{t('ui.chitDialog.title')}</span>
        <span class="subtitle">{t(claimed ? 'ui.chitDialog.claimedToday' : 'ui.chitDialog.claimToday')}</span>
      </div>
      <span class="icon-button" onclick={() => act('settings')} role="button" tabindex="0" aria-label={t('ui.chitDialog.settings')} title={t('ui.chitDialog.settings')}
        ><span class="glyph" style:mask="var(--icon-gear) center/contain no-repeat"></span></span
      >
      <span class="icon-button" onclick={() => act('leaderboard')} role="button" tabindex="0" aria-label={boardHint} title={boardHint}
        ><span class="glyph" style:mask="var(--icon-trophy) center/contain no-repeat"></span></span
      >
      <span class="icon-button" onclick={close} role="button" tabindex="0"><span class="glyph close-glyph"></span></span>
    </div>

    <div class="body">
      <div class="summary">
        <div class="ring" class:pop={!!claimedHere} style:background={ring}>
          <div class="ring-hole">
            <span class="streak">{days}</span>
            <span class="caps">{t('ui.chitDialog.dayStreak')}</span>
          </div>
        </div>
        <div class="totals">
          <span class="caps wide">{t('ui.chitDialog.collected')}</span>
          <span class="balance">{t('ui.chitDialog.amount', { amount: fmt(balance) })}</span>
          <span class="muted">{t('ui.chitDialog.earnedAllTime', { amount: fmt(earned) })}</span>
        </div>
      </div>

      <div class="milestones">
        <div class="milestone-head">
          <span class="milestone-title"
            >{days >= TIERS[TIERS.length - 1] ? t('ui.chitDialog.allMilestones', { daily: fmt(daily) }) : t('ui.chitDialog.toNextMilestone', { count: nextTier - days, tier: nextTier })}</span
          >
          <span class="rate">{t('ui.chitDialog.perDay', { amount: fmt(daily) })}</span>
        </div>
        <div class="bar-wrap">
          <div class="bar"><div class="fill" style:width="{barPct.toFixed(1)}%"></div></div>
          <!-- the bar's own end reads as the last milestone, so it needs no notch -->
          {#each TIERS.slice(0, -1) as tier}
            <span class="notch" style:inset-inline-start="{TIER_POS[tier]}%"></span>
          {/each}
          <div class="labels">
            {#each TIERS as tier}
              <span class="tier" class:reached={tier <= days} style:inset-inline-start="{TIER_POS[tier]}%">{tier}</span>
            {/each}
          </div>
        </div>
      </div>

      <div class="claim-area">
        {#if !claimed}
          {#if onClaim}
            <div class="claim" onclick={claim} role="button" tabindex="0" aria-disabled={flow.locked}>
              <span class="flame"></span>
              <span class="claim-label">{t(flow.busy ? 'ui.chitDialog.claiming' : 'ui.chitDialog.claim', { amount: fmt(daily) })}</span>
            </div>
          {/if}
          <span class="note" class:error={flow.failed} role={flow.failed ? 'alert' : undefined}>{t(flow.failed ? 'ui.chitDialog.claimFailed' : 'ui.chitDialog.claimNote')}</span>
          {@render calendarLink('ui.chitDialog.viewCalendar')}
        {:else}
          <div class="claimed">
            <span class="check"></span>
            <span class="claimed-label">{t('ui.chitDialog.comeBackIn', { countdown })}</span>
          </div>
          <span class="note strong">{t('ui.chitDialog.comeBackTomorrow')}</span>
          {@render calendarLink('ui.chitDialog.claimedViewCalendar')}
        {/if}
        <div class="burst" aria-hidden="true"><Confetti fire={claimBurst} /></div>
      </div>

      <div class="extras">
        <DailyPuzzleCard state={puzzleState} sub={puzzleSub} countdown={puzzleCountdown ?? countdown} remind={puzzleRemind} title={puzzleTitle} menu={puzzleMenu} onAction={(k) => act(k)} />
        <div class="row cover" class:insured={insuredLeft > 0} onclick={() => act('insurance')} role="button" tabindex="0">
          <span class="tile cover-tile"><span class="tile-glyph shield"></span></span>
          <div class="row-text">
            <span class="row-title">{insuredLeft > 0 ? t('ui.chitDialog.insuredFor', { count: insuredLeft }) : t('ui.chitDialog.noInsurance')}</span>
            <span class="row-hint"
              >{insuredLeft > 0 ? t('ui.chitDialog.insuredHint') : t('ui.chitDialog.uninsuredHint', { count: days })}</span
            >
          </div>
          {#if insuredLeft > 0}
            <span class="pips">
              {#each { length: Math.min(insuredLeft, 7) } as _}
                <span class="pip"></span>
              {/each}
            </span>
          {/if}
          <span class="chevron cover-chevron"></span>
        </div>
        <div class="row link" onclick={() => act('earn')} role="button" tabindex="0">
          <span class="tile"><span class="tile-glyph spark"></span></span>
          <div class="row-text">
            <span class="row-title">{t('ui.chitDialog.waysToEarn')}</span>
            {#if achievements}<span class="row-hint">{t('ui.chitDialog.achievementsLeft', { total: achievements.total, left: achievements.left })}</span>{/if}
          </div>
          <span class="chevron"></span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .layer {
    z-index: 72;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 560px;
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

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-24) var(--space-32);
    border-block-end: 1px solid var(--line-1);
  }

  .icon-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--overlay-2);
  }

  .icon-button.back {
    width: 32px;
    height: 32px;
    margin-inline-start: -10px;
  }

  .glyph {
    width: 17px;
    height: 17px;
    background: var(--ink-3);
  }

  .back-glyph {
    width: 16px;
    height: 16px;
    background: var(--ink-2);
    mask: var(--icon-back) center/contain no-repeat;
  }

  .close-glyph {
    width: 15px;
    height: 15px;
    mask: var(--icon-close) center/contain no-repeat;
  }

  .heading {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-22);
    padding: var(--space-26) var(--space-32) var(--space-32);
  }

  .summary {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-22);
    min-width: 0;
  }

  .ring {
    flex: none;
    position: relative;
    width: 136px;
    height: 136px;
    border-radius: var(--radius-pill);
  }

  .ring.pop {
    animation: oc-chit-pop 420ms var(--ease-out);
  }

  .ring-hole {
    position: absolute;
    inset: 14px;
    border-radius: var(--radius-pill);
    background: var(--surface-1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
  }

  .streak,
  .balance {
    font: var(--weight-bold) var(--text-3xl) / 1 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink);
  }

  .balance {
    line-height: 1.1;
  }

  .caps {
    font: var(--weight-semibold) var(--text-2xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
  }

  .caps.wide {
    font-size: var(--text-xs);
  }

  .totals {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .muted {
    font: var(--weight-regular) var(--text-sm) / 1.35 var(--font-sans);
    color: var(--ink-4);
  }

  .milestones {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-14);
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .milestone-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
    min-width: 0;
    margin: 0 10px;
  }

  .milestone-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .rate {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-3);
  }

  .bar-wrap {
    position: relative;
    margin: 0 10px;
  }

  .bar {
    position: relative;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    overflow: hidden;
  }

  .fill {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    background: linear-gradient(90deg, var(--accent), var(--status-chit));
    transition: width var(--duration-slow) var(--ease-out);
  }

  .notch {
    position: absolute;
    top: -1px;
    width: 2px;
    height: 10px;
    border-radius: 1px;
    background: var(--surface-1);
    transform: translateX(-50%);
  }

  .labels {
    position: relative;
    height: 18px;
    margin-block-start: var(--space-8);
  }

  .tier {
    position: absolute;
    transform: translateX(-50%);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4);
    white-space: nowrap;
  }

  .tier.reached {
    color: var(--status-chit);
  }

  .claim-area {
    position: relative;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  /* the confetti's box: the claim area's, out of its flow */
  .burst {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .claim,
  .claimed {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: 46px;
    border-radius: var(--radius-md);
    user-select: none;
  }

  .claim {
    background: linear-gradient(100deg, var(--accent), var(--status-chit));
    cursor: pointer;
  }

  .claim:hover {
    filter: brightness(1.06);
  }

  .flame {
    width: 17px;
    height: 17px;
    background: var(--on-accent);
    mask: var(--icon-flame) center/contain no-repeat;
  }

  .claim-label {
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: var(--on-accent);
  }

  .claimed {
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .check {
    width: 15px;
    height: 15px;
    background: var(--status-online);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .claimed-label {
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-2);
  }

  .note {
    padding-block-start: var(--space-4);
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-4);
    text-align: center;
    text-wrap: pretty;
  }

  /* a real button (Enter / Space, the shared focus ring), sized to its content */
  .calendar-link {
    position: relative;
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 10px;
    margin: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .calendar-link:hover {
    color: var(--ink);
    background: var(--overlay-1);
  }

  /* on touch, a 44px hit area round the 32px link */
  @media (pointer: coarse) {
    .calendar-link::before {
      content: '';
      position: absolute;
      inset: -6px 0;
    }
  }

  .calendar-glyph {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--status-chit);
    mask: var(--icon-calendar) center/contain no-repeat;
  }

  .note.error {
    color: var(--status-danger);
  }

  .note.strong {
    font-weight: var(--weight-semibold);
    color: var(--ink);
  }

  .extras {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    margin-block-start: var(--space-4);
    padding-block-start: var(--space-18);
    border-block-start: 1px solid var(--line-1);
  }

  .row {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    cursor: pointer;
  }

  .cover {
    --cover-ink: var(--status-warning);
    background: color-mix(in srgb, var(--status-warning) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-warning) 50%, transparent);
    transition:
      background var(--duration-fast) var(--ease-out),
      filter var(--duration-fast) var(--ease-out);
  }

  .cover.insured {
    --cover-ink: var(--status-online);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .cover:hover {
    filter: brightness(1.14);
  }

  .link {
    transition: background var(--duration-fast) var(--ease-out);
  }

  .link:hover {
    background: var(--overlay-1);
  }

  .tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: var(--overlay-2);
  }

  .cover-tile {
    background: color-mix(in srgb, var(--status-warning) 18%, transparent);
  }

  .insured .cover-tile {
    background: color-mix(in srgb, var(--status-online) 14%, transparent);
  }

  .tile-glyph {
    width: 18px;
    height: 18px;
    background: var(--ink-3);
  }

  .shield {
    background: var(--cover-ink);
    mask: var(--icon-shield) center/contain no-repeat;
  }

  .spark {
    mask: var(--icon-spark) center/contain no-repeat;
  }

  .row-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .row-title {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .row-hint {
    font: var(--weight-regular) var(--text-sm) / 1.35 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .pips {
    flex: none;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .pip {
    width: 13px;
    height: 13px;
    background: var(--status-online);
    mask: var(--icon-shield) center/contain no-repeat;
  }

  .chevron {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink-3);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .cover-chevron {
    background: var(--cover-ink);
  }
</style>
