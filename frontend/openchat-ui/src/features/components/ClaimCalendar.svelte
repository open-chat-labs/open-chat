<!-- The CHIT claim calendar: a month of daily claims, paged back to the month the account was made. Header: the month
     with previous / next, what it claimed, and a Local / UTC toggle (onUtcChange) for the claim times. Always six
     weeks (42 cells), so its height never changes between months: days of the months either side show dimmed, with
     nothing on them. A day is claimed (accent-tinted, its CHIT under it), insured (streak insurance spent), missed,
     today or still to come. Hovering or tapping a claimed or insured day pops up its date, the time it was claimed
     (local or UTC) and what it paid. While today's claim is open (claimable), today offers Claim (onClaim, which it
     waits on). -->
<script lang="ts" module>
  /** One day of the CHIT claim history (UTC calendar days). */
  export interface ClaimDay {
    /** YYYY-MM-DD (UTC). */
    day: string;
    /** Streak day this claim counted as. */
    streakDay: number;
    /** CHIT claimed (absent for insured days). */
    amount?: number;
    /** Minute of the UTC day the claim was made. */
    minute?: number;
    /** When the claim was made, ms epoch: its local time is that day's (daylight saving), not today's. */
    at?: number;
    /** Covered by streak insurance instead of a claim. */
    insured?: boolean;
  }
</script>

<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';

  interface Props {
    /** Claim history (any order). */
    claimHistory?: ClaimDay[];
    /** "Today", ms epoch; defaults to now. */
    today?: number;
    /** When the account was created, ms epoch: the calendar doesn't page back before it, nor count days before it as
     *  missed. Defaults to `today`. */
    joined?: number;
    /** Whether today's claim is open: today offers Claim. */
    claimable?: boolean;
    /** Claim times in UTC instead of local time. */
    utc?: boolean;
    /** Local time offset for the claim times; defaults to this browser's on each claim's day (by its `at`). */
    utcOffsetMinutes?: number;
    /** Claim today's CHIT: today says it's claiming until this settles. Without it, today offers no Claim. */
    onClaim?: () => Promise<unknown> | void;
    onUtcChange?: (utc: boolean) => void;
  }

  let {
    claimHistory = [],
    today: todayProp,
    joined: joinedProp,
    claimable = false,
    utc = false,
    utcOffsetMinutes,
    onClaim,
    onUtcChange,
  }: Props = $props();

  const t = useT();
  const i18n = getI18n();

  const DAY = 86_400_000;
  const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const dayStart = (ms: number) => Math.floor(ms / DAY) * DAY;
  const dateFmt = (opts: Intl.DateTimeFormatOptions, ms: number) => new Intl.DateTimeFormat(i18n.locale ?? 'en', { timeZone: 'UTC', ...opts }).format(ms);
  const fmt = (n: number) => n.toLocaleString(i18n.locale ?? 'en');
  const hhmm = (m: number) => {
    m = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  // the local offset for a claim's time: the host's, or this browser's on the day it was made
  const localOffset = (at?: number) => utcOffsetMinutes ?? -new Date(at ?? Date.now()).getTimezoneOffset();

  // months back from today's
  let monthOffset = $state(0);
  // the day whose popover shows: hovered, or tapped (a touch has no hover)
  let openDay = $state<string | null>(null);

  let claiming = $state(false);
  async function claim() {
    if (!onClaim || claiming) return;
    claiming = true;
    try {
      await onClaim();
    } catch {
      // the host says why
    } finally {
      claiming = false;
    }
  }

  const TODAY = $derived(dayStart(todayProp ?? Date.now()));
  const JOINED_DAY = $derived(joinedProp === undefined ? 0 : dayStart(joinedProp));
  const hist = $derived(Object.fromEntries(claimHistory.map((c) => [c.day, c])) as Record<string, ClaimDay>);

  type Cell = {
    key: string;
    day: number;
    kind: 'outside' | 'claim' | 'future' | 'insured' | 'claimed' | 'missed';
    today: boolean;
    amount?: number;
    col: number;
    head?: string;
    lines?: { text: string; tone: 'ink' | 'chit' | 'online' | 'muted' }[];
    title?: string;
  };

  const calendar = $derived.by(() => {
    const now = new Date(TODAY);
    const total = now.getUTCFullYear() * 12 + now.getUTCMonth();
    const joinedAt = new Date(joinedProp ?? TODAY);
    const minTotal = Math.min(total, joinedAt.getUTCFullYear() * 12 + joinedAt.getUTCMonth());
    const view = Math.max(minTotal, total - monthOffset);
    const y = Math.floor(view / 12), mo = view % 12;
    const first = Date.UTC(y, mo, 1);
    // six whole weeks from the Sunday on or before the 1st
    const start = first - new Date(first).getUTCDay() * DAY;
    const cells: Cell[] = [];
    let chit = 0, claimed = 0, insured = 0;
    for (let i = 0; i < 42; i++) {
      const ts = start + i * DAY, date = new Date(ts), d = date.getUTCDate(), col = i % 7, key = dayKey(ts);
      const isToday = ts === TODAY;
      if (date.getUTCMonth() !== mo) {
        cells.push({ key, day: d, kind: 'outside', today: false, col });
        continue;
      }
      const rec = hist[key];
      const head = t('ui.claimCalendar.dayHead', { weekday: dateFmt({ weekday: 'short' }, ts), day: d, month: dateFmt({ month: 'long' }, ts) });
      if (isToday && claimable) cells.push({ key, day: d, kind: 'claim', today: true, col, title: t('ui.claimCalendar.claimToday') });
      // after today, or before the account was made: nothing to claim, nothing missed
      else if (ts > TODAY || ts < JOINED_DAY) cells.push({ key, day: d, kind: 'future', today: isToday, col });
      else if (rec?.insured) {
        insured++;
        cells.push({
          key,
          day: d,
          kind: 'insured',
          today: isToday,
          col,
          head,
          lines: [
            { text: t('ui.claimCalendar.insured'), tone: 'online' },
            { text: t('ui.claimCalendar.streakKept', { day: rec.streakDay }), tone: 'muted' },
          ],
        });
      } else if (rec && rec.amount != null) {
        chit += rec.amount;
        claimed++;
        const time =
          rec.minute == null
            ? null
            : utc
              ? t('ui.claimCalendar.timeUtc', { time: hhmm(rec.minute) })
              : t('ui.claimCalendar.timeLocal', { time: hhmm(rec.minute + localOffset(rec.at)) });
        cells.push({
          key,
          day: d,
          kind: 'claimed',
          today: isToday,
          amount: rec.amount,
          col,
          head,
          lines: [
            ...(time ? [{ text: t('ui.claimCalendar.claimedAt', { time }), tone: 'ink' as const }] : []),
            { text: t('ui.claimCalendar.claimedAmount', { amount: rec.amount, day: rec.streakDay }), tone: 'chit' },
          ],
        });
      } else
        cells.push({ key, day: d, kind: 'missed', today: isToday, col, title: t('ui.claimCalendar.notClaimed', { day: d, month: dateFmt({ month: 'short' }, ts) }) });
    }
    return { cells, label: dateFmt({ month: 'long', year: 'numeric' }, first), chit, claimed, insured, canPrev: view > minTotal, canNext: view < total, maxOffset: total - minTotal };
  });

  // a tap shows a day's popover, or hides it again (a mouse shows it on hover, so its click leaves it be). The pointer
  // is told by its pointerdown: some browsers' click isn't a PointerEvent
  let lastPointer = '';
  function tapped(key: string) {
    if (lastPointer === 'mouse') return;
    openDay = openDay === key ? null : key;
  }

  function page(step: number) {
    monthOffset = Math.min(calendar.maxOffset, Math.max(0, monthOffset - step));
    openDay = null;
  }
</script>

<div class="claim-calendar">
  <div class="month-bar">
    <span
      class="month-step"
      class:disabled={!calendar.canPrev}
      onclick={() => page(-1)}
      aria-label={t('ui.claimCalendar.prevMonth')}
      role="button"
      tabindex="0"
      title={t('ui.claimCalendar.prevMonth')}><span class="month-glyph back"></span></span
    >
    <div class="month-text">
      <span class="month-label">{calendar.label}</span>
      <span class="month-sum"
        ><Translate key="ui.claimCalendar.summary" params={{ claimed: calendar.claimed }}
          >{#snippet chit()}<span class="chit-ink">{t('ui.claimCalendar.chitAmount', { amount: fmt(calendar.chit) })}</span>{/snippet}{#snippet insured()}<span
              class:online-ink={calendar.insured > 0}>{t('ui.claimCalendar.insuredCount', { count: calendar.insured })}</span
            >{/snippet}</Translate
        ></span
      >
    </div>
    <span
      class="month-step"
      class:disabled={!calendar.canNext}
      onclick={() => page(1)}
      aria-label={t('ui.claimCalendar.nextMonth')}
      role="button"
      tabindex="0"
      title={t('ui.claimCalendar.nextMonth')}><span class="month-glyph next"></span></span
    >
    <span class="grow"></span>
    <div class="segments" role="radiogroup" aria-label={t('ui.claimCalendar.timeZone')}>
      {#each [['ui.claimCalendar.local', false], ['UTC', true]] as [label, isUtc]}
        <span class="tz-option" class:on={utc === isUtc} onclick={() => onUtcChange?.(isUtc as boolean)} role="radio" aria-checked={utc === isUtc} tabindex="0"
          >{t(label as string)}</span
        >
      {/each}
    </div>
  </div>

  <div class="grid">
    {#each [0, 1, 2, 3, 4, 5, 6] as d}<span class="weekday">{dateFmt({ weekday: 'narrow' }, Date.UTC(2023, 0, 1 + d))}</span>{/each}
    {#each calendar.cells as cell (cell.key)}
      {#if cell.kind === 'outside'}
        <div class="day outside" aria-hidden="true"><span class="day-num">{cell.day}</span><span class="day-amount"></span></div>
      {:else}
        <div
          class="day {cell.kind}"
          class:today={cell.today}
          class:inert={cell.kind === 'claim' && !onClaim}
          class:claiming={cell.kind === 'claim' && claiming}
          onpointerdown={(e) => (lastPointer = e.pointerType)}
          onclick={cell.kind === 'claim' ? claim : cell.lines ? () => tapped(cell.key) : undefined}
          onpointerenter={cell.lines ? (e) => e.pointerType === 'mouse' && (openDay = cell.key) : undefined}
          onpointerleave={cell.lines ? (e) => e.pointerType === 'mouse' && openDay === cell.key && (openDay = null) : undefined}
          aria-label={cell.title ?? cell.head ?? ''}
          role="button"
          tabindex="0"
          title={cell.title ?? ''}
        >
          <span class="day-num">{cell.day}</span>
          <span class="day-amount"
            >{#if cell.kind === 'insured'}<span class="day-shield"></span>{/if}{cell.kind === 'claim'
              ? t(claiming ? 'ui.claimCalendar.claiming' : 'ui.claimCalendar.claim')
              : cell.kind === 'claimed'
                ? fmt(cell.amount ?? 0)
                : ''}</span
          >
          {#if cell.lines && openDay === cell.key}
            <div class="pop" class:start={cell.col === 0} class:end={cell.col === 6} role="tooltip">
              <span class="pop-head">{cell.head}</span>
              {#each cell.lines as line}<span class="pop-line {line.tone}">{line.text}</span>{/each}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .claim-calendar {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
  }

  .month-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .month-step {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--overlay-1);
    cursor: pointer;
  }

  .month-step:hover {
    background: var(--overlay-2);
  }

  .month-step.disabled {
    opacity: 0.35;
    pointer-events: none;
  }

  .month-glyph {
    width: 14px;
    height: 14px;
    background: var(--ink-2);
  }

  .month-glyph.back {
    mask: var(--icon-back) center/contain no-repeat;
  }

  .month-glyph.next {
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .month-text {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    padding-inline: 4px;
  }

  .month-label {
    font: var(--weight-bold) 15px/1 var(--font-sans);
    color: var(--ink);
  }

  .month-sum {
    font: var(--weight-medium) 11px/1 var(--font-mono);
    color: var(--ink-3);
    white-space: nowrap;
  }

  .chit-ink {
    color: var(--status-chit);
  }

  .online-ink {
    color: var(--status-online);
  }

  .grow {
    flex: 1;
  }

  .segments {
    flex: none;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-sm);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .tz-option {
    display: flex;
    align-items: center;
    height: 24px;
    padding: 0 10px;
    border-radius: 6px;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
    user-select: none;
  }

  .tz-option.on {
    background: var(--overlay-2);
    color: var(--ink);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }

  .weekday {
    padding: 4px 0;
    text-align: center;
    font: var(--weight-medium) 11.5px/1 var(--font-sans);
    color: var(--ink-4);
  }

  .day {
    --day-ink: var(--ink-4);
    --day-amount: var(--status-chit);
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 58px;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: default;
    user-select: none;
  }

  /* the months either side: there, dimmed, with nothing on them */
  .day.outside {
    --day-ink: var(--ink-3);
    opacity: 0.4;
    pointer-events: none;
  }

  .day.claim {
    --day-ink: var(--ink);
    box-shadow: inset 0 0 0 1.5px var(--status-chit);
    cursor: pointer;
  }

  /* nothing to claim with without onClaim, nor while claiming */
  .day.claim.inert,
  .day.claim.claiming {
    cursor: default;
  }

  .day.future {
    --day-ink: var(--ink-3);
    opacity: 0.5;
  }

  .day.missed {
    --day-ink: var(--ink-3);
  }

  .day.insured {
    --day-ink: var(--ink);
    --day-amount: var(--status-online);
    background: color-mix(in srgb, var(--status-online) 12%, transparent);
    cursor: pointer;
  }

  .day.claimed {
    --day-ink: var(--ink);
    background: var(--accent-soft);
    cursor: pointer;
  }

  .day.today:not(.claim) {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .day-num {
    font: var(--weight-semibold) 13.5px/1 var(--font-sans);
    color: var(--day-ink);
  }

  .day-amount {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 11px;
    font: var(--weight-semibold) 11px/1 var(--font-mono);
    color: var(--day-amount);
  }

  .day-shield {
    width: 11px;
    height: 11px;
    background: var(--day-amount);
    mask: var(--icon-shield) center/contain no-repeat;
  }

  .pop {
    position: absolute;
    z-index: 5;
    bottom: calc(100% + 6px);
    inset-inline-start: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: 240px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 12px 32px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    text-align: start;
  }

  .pop.start {
    inset-inline-start: 0;
    transform: none;
  }

  .pop.end {
    inset-inline-start: auto;
    inset-inline-end: 0;
    transform: none;
  }

  .pop-head {
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .pop-line {
    font: var(--weight-medium) 11.5px/1.2 var(--font-sans);
    white-space: nowrap;
  }

  .pop-line.ink {
    color: var(--ink);
  }

  .pop-line.chit {
    color: var(--status-chit);
  }

  .pop-line.online {
    color: var(--status-online);
  }

  .pop-line.muted {
    color: var(--ink-3);
  }
</style>
