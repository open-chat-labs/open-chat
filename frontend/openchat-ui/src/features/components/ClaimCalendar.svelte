<!-- The CHIT claim calendar: a month of daily claims, paged back to the month the account was made. Header: the month
     with previous / next, what it claimed, and a Local / UTC toggle (onUtcChange) for the claim times. Always six
     weeks (42 cells), so its height never changes between months: days of the months either side show dimmed, with
     nothing on them. A day is claimed (accent-tinted, its CHIT under it), insured (streak insurance spent), missed,
     today or still to come. Hovering or tapping a claimed or insured day pops up its date, the time it was claimed
     (local or UTC) and what it paid. While today's claim is open (claimable), today offers Claim (onClaim, which it
     waits on).
     layout="card" (the native CHIT screen's): the heading (label) and the month with previous / next above a card; a
     day is a square tile, tapping one picks it (today at first, a past month's last day) and a line under the grid
     says what happened on it, in place of the popover; under that, the month's CHIT, claims and insured days and the
     Local / UTC toggle. -->
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
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';

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
    /** "bar": the month bar over the grid, a popover per day. "card": the native CHIT screen's, a heading and the
     *  month over a card, a picked day described under the grid, the totals and the toggle at the foot. */
    layout?: 'bar' | 'card';
    /** Resource key (or literal text): the heading over the card (layout "card" only). */
    label?: string;
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
    layout = 'bar',
    label = '',
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
  // layout "card": the day picked (none yet: today, or a past month's last day)
  let picked = $state<string | null>(null);

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
    /** Layout "card": what the line under the grid says while it's picked. */
    info?: { text: string; tone: 'ink' | 'chit' | 'online' | 'muted' };
  };

  // layout "card": the line under the grid for a day ("Thu 22 Oct · …")
  const shortHead = (ts: number) =>
    t('ui.claimCalendar.dayHead', { weekday: dateFmt({ weekday: 'short' }, ts), day: new Date(ts).getUTCDate(), month: dateFmt({ month: 'short' }, ts) });
  const infoLine = (ts: number, ...parts: string[]) => [shortHead(ts), ...parts].join(' · ');

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
      if (isToday && claimable)
        cells.push({
          key,
          day: d,
          kind: 'claim',
          today: true,
          col,
          title: t('ui.claimCalendar.claimToday'),
          info: { text: infoLine(ts, t('ui.claimCalendar.readyToClaim')), tone: 'chit' },
        });
      // after today, or before the account was made: nothing to claim, nothing missed
      else if (ts > TODAY || ts < JOINED_DAY) cells.push({ key, day: d, kind: 'future', today: isToday, col, info: { text: infoLine(ts), tone: 'muted' } });
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
          info: { text: infoLine(ts, t('ui.claimCalendar.insuredInfo')), tone: 'online' },
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
          info: {
            text: infoLine(
              ts,
              ...(rec.minute == null ? [] : [utc ? t('ui.claimCalendar.timeUtc', { time: hhmm(rec.minute) }) : hhmm(rec.minute + localOffset(rec.at))]),
              t('ui.claimCalendar.claimedShort', { amount: fmt(rec.amount) }),
              t('ui.claimCalendar.streakDay', { day: rec.streakDay }),
            ),
            tone: 'ink',
          },
        });
      } else
        cells.push({
          key,
          day: d,
          kind: 'missed',
          today: isToday,
          col,
          title: t('ui.claimCalendar.notClaimed', { day: d, month: dateFmt({ month: 'short' }, ts) }),
          info: { text: infoLine(ts, t('ui.claimCalendar.notClaimedInfo')), tone: 'muted' },
        });
    }
    // layout "card": picked at first, today in today's month and the last day in a past one
    const lastDay = view === total ? dayKey(TODAY) : dayKey(Date.UTC(y, mo + 1, 0));
    return {
      cells,
      label: dateFmt({ month: 'long', year: 'numeric' }, first),
      chit,
      claimed,
      insured,
      canPrev: view > minTotal,
      canNext: view < total,
      maxOffset: total - minTotal,
      lastDay,
    };
  });

  const pickedKey = $derived(picked ?? calendar.lastDay);
  const pickedInfo = $derived(calendar.cells.find((c) => c.key === pickedKey)?.info);

  // layout "card": a tap on today's Claim claims it, any other day it picks
  function pick(cell: Cell) {
    picked = cell.key;
    if (cell.kind === 'claim') void claim();
  }

  // a tap shows a day's popover, or hides it again (a mouse shows it on hover, so its click leaves it be). The pointer
  // is told by its pointerdown: some browsers' click isn't a PointerEvent.
  let lastPointer = '';
  // From the keyboard (Enter / Space, a click with no detail) it toggles too.
  function tapped(e: MouseEvent, key: string) {
    if (e.detail !== 0 && lastPointer === 'mouse') return;
    openDay = openDay === key ? null : key;
  }

  function page(step: number) {
    monthOffset = Math.min(calendar.maxOffset, Math.max(0, monthOffset - step));
    openDay = null;
    picked = null;
  }
</script>

{#snippet dayInner(cell: Cell)}
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
{/snippet}

{#snippet tzToggle()}
  <div class="segments" role="radiogroup" aria-label={t('ui.claimCalendar.timeZone')}>
    {#each [['ui.claimCalendar.local', false], ['UTC', true]] as [label, isUtc]}
      <button type="button" class="tz-option" class:on={utc === isUtc} onclick={() => onUtcChange?.(isUtc as boolean)} role="radio" aria-checked={utc === isUtc}
        >{t(label as string)}</button
      >
    {/each}
  </div>
{/snippet}

{#if layout === 'card'}
  <div class="claim-calendar card-layout">
    <div class="card-head">
      <span class="card-label"><ListSectionLabel {label} /></span>
      <button
        type="button"
        class="card-step"
        aria-disabled={!calendar.canPrev}
        onclick={() => page(-1)}
        aria-label={t('ui.claimCalendar.prevMonth')}><span class="card-glyph back"></span></button
      >
      <span class="card-month">{calendar.label}</span>
      <button
        type="button"
        class="card-step"
        aria-disabled={!calendar.canNext}
        onclick={() => page(1)}
        aria-label={t('ui.claimCalendar.nextMonth')}><span class="card-glyph"></span></button
      >
    </div>
    <div class="card">
      <div class="card-grid">
        {#each [0, 1, 2, 3, 4, 5, 6] as d}<span class="card-weekday">{dateFmt({ weekday: 'narrow' }, Date.UTC(2023, 0, 1 + d))}</span>{/each}
        {#each calendar.cells as cell (cell.key)}
          {#if cell.kind === 'outside' || cell.kind === 'future'}
            <div class="tile {cell.kind}" aria-hidden={cell.kind === 'outside' ? 'true' : undefined}>
              <span class="tile-num">{cell.day}</span><span class="tile-sub"></span>
            </div>
          {:else}
            <button
              type="button"
              class="tile {cell.kind}"
              class:picked={cell.key === pickedKey}
              class:claiming={cell.kind === 'claim' && claiming}
              onclick={() => pick(cell)}
              aria-label={cell.title ?? cell.info?.text}
              aria-pressed={cell.key === pickedKey}
              aria-disabled={cell.kind === 'claim' && (claiming || !onClaim) ? true : undefined}
              ><span class="tile-num">{cell.day}</span><span class="tile-sub"
                >{cell.kind === 'claim'
                  ? t(claiming ? 'ui.claimCalendar.claiming' : 'ui.claimCalendar.claim')
                  : cell.kind === 'claimed'
                    ? fmt(cell.amount ?? 0)
                    : cell.kind === 'insured'
                      ? '✓'
                      : ''}</span
              ></button
            >
          {/if}
        {/each}
      </div>
      <div class="card-info {pickedInfo?.tone ?? 'muted'}" aria-live="polite">{pickedInfo?.text ?? ''}</div>
      <div class="card-foot">
        <span
          ><Translate key="ui.claimCalendar.chitAmount"
            >{#snippet amount()}<span class="foot-chit">{fmt(calendar.chit)}</span>{/snippet}</Translate
          ></span
        >
        <span>{t('ui.claimCalendar.claimedCount', { count: calendar.claimed })}</span>
        <span class="grow" class:online-ink={calendar.insured > 0}>{t('ui.claimCalendar.insuredCount', { count: calendar.insured })}</span>
        {@render tzToggle()}
      </div>
    </div>
  </div>
{:else}
<div class="claim-calendar">
  <div class="month-bar">
    <button
      type="button"
      class="month-step"
      aria-disabled={!calendar.canPrev}
      onclick={() => page(-1)}
      aria-label={t('ui.claimCalendar.prevMonth')}
      title={t('ui.claimCalendar.prevMonth')}><span class="month-glyph back"></span></button
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
    <button
      type="button"
      class="month-step"
      aria-disabled={!calendar.canNext}
      onclick={() => page(1)}
      aria-label={t('ui.claimCalendar.nextMonth')}
      title={t('ui.claimCalendar.nextMonth')}><span class="month-glyph next"></span></button
    >
    <span class="grow"></span>
    {@render tzToggle()}
  </div>

  <div class="grid">
    {#each [0, 1, 2, 3, 4, 5, 6] as d}<span class="weekday">{dateFmt({ weekday: 'narrow' }, Date.UTC(2023, 0, 1 + d))}</span>{/each}
    {#each calendar.cells as cell (cell.key)}
      {#if cell.kind === 'outside'}
        <div class="day outside" aria-hidden="true"><span class="day-num">{cell.day}</span><span class="day-amount"></span></div>
      {:else}
        {#if (cell.kind === 'claim' && onClaim) || cell.lines}
          <button
            type="button"
            class="day {cell.kind}"
            class:today={cell.today}
            class:claiming={cell.kind === 'claim' && claiming}
            onpointerdown={(e) => (lastPointer = e.pointerType)}
            onclick={cell.kind === 'claim' ? claim : (e) => tapped(e, cell.key)}
            onpointerenter={cell.lines ? (e) => e.pointerType === 'mouse' && (openDay = cell.key) : undefined}
            onpointerleave={cell.lines ? (e) => e.pointerType === 'mouse' && openDay === cell.key && (openDay = null) : undefined}
            onblur={cell.lines ? () => openDay === cell.key && (openDay = null) : undefined}
            aria-label={cell.title ?? cell.head}
            aria-expanded={cell.lines ? openDay === cell.key : undefined}
            aria-disabled={cell.kind === 'claim' && claiming ? true : undefined}
            title={cell.title}>{@render dayInner(cell)}</button
          >
        {:else}
          <div class="day {cell.kind}" class:today={cell.today} class:inert={cell.kind === 'claim'} title={cell.title}>{@render dayInner(cell)}</div>
        {/if}
      {/if}
    {/each}
  </div>
</div>
{/if}

<style lang="scss">
  @use '../../lib/styles/mixins' as *;

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
    margin: 0;
    padding: 0;
    border: none;
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

  /* at the end of the range: still focusable (a disabled button would drop the focus it has), its press does nothing
     (page clamps) */
  .month-step[aria-disabled='true'] {
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
    margin: 0;
    border: none;
    background: none;
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

  /* a day with something to do is a button (claim, or its popover): it draws as the rest do */
  .day {
    --day-ink: var(--ink-4);
    --day-amount: var(--status-chit);
    position: relative;
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    font: inherit;
    color: inherit;
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
  /* ---- layout "card" (the native CHIT screen's) */

  .card-layout {
    gap: 8px;
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-inline-start: 4px;
  }

  .card-label {
    flex: 1;
    min-width: 0;
  }

  .card-step {
    flex: none;
    width: 36px;
    height: 36px;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &[aria-disabled='true'] {
      opacity: 0.35;
      pointer-events: none;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .card-glyph {
    @include icon(chevron-right, 16px, var(--ink-2));

    &.back {
      transform: scaleX(-1);
    }
  }

  .card-month {
    min-width: 96px;
    text-align: center;
    font: var(--weight-semibold) text-size(13.5px) / 1 var(--font-sans);
    color: var(--ink);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 12px 12px;
    border-radius: 16px;
    background: var(--overlay-1);
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    margin-bottom: -6px;
  }

  .card-weekday {
    padding-bottom: 4px;
    text-align: center;
    font: var(--weight-semibold) text-size(10.5px) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .tile {
    --tile-ink: var(--ink-3);
    --tile-sub: var(--status-chit);
    box-sizing: border-box;
    width: 100%;
    aspect-ratio: 1;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: transparent;
    font: inherit;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;

    &:focus-visible {
      @include focus-ring;
    }

    &.picked {
      box-shadow: inset 0 0 0 1.5px var(--ink-2);
    }

    &.outside {
      --tile-ink: var(--ink-4);
      opacity: 0.35;
      cursor: default;
    }

    &.future {
      opacity: 0.4;
      cursor: default;
    }

    &.claimed {
      --tile-ink: var(--ink);
      background: var(--status-chit-soft);
    }

    &.insured {
      --tile-ink: var(--ink);
      --tile-sub: var(--status-online);
      background: color-mix(in srgb, var(--status-online) 12%, transparent);
    }

    &.claim {
      --tile-ink: var(--ink);
      box-shadow: inset 0 0 0 1.5px var(--status-chit);
    }

    &.claiming,
    &.claim[aria-disabled='true'] {
      cursor: default;
    }
  }

  .tile-num {
    font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-sans);
    color: var(--tile-ink);
  }

  .tile-sub {
    height: 9px;
    font: var(--weight-semibold) text-size(9px) / 1 var(--font-mono);
    color: var(--tile-sub);
  }

  .card-info {
    display: flex;
    align-items: center;
    min-height: 40px;
    padding: 8px 10px;
    box-sizing: border-box;
    border-radius: 12px;
    background: var(--tint-row);
    font: var(--weight-medium) text-size(12.5px) / 1.35 var(--font-sans);

    &.ink {
      color: var(--ink);
    }

    &.chit {
      color: var(--status-chit);
    }

    &.online {
      color: var(--status-online);
    }

    &.muted {
      color: var(--ink-3);
    }
  }

  .card-foot {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-inline-start: 4px;
    font: var(--weight-medium) text-size(12px) / 1 var(--font-sans);
    color: var(--ink-3);

    .segments {
      padding: 2px;
      border-radius: 9px;
      background: var(--tint-pill);
      box-shadow: none;
    }

    .tz-option {
      height: 28px;
      border-radius: 7px;
      font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-sans);

      &.on {
        background: var(--overlay-3);
      }
    }
  }

  .foot-chit {
    font-family: var(--font-mono);
    font-weight: var(--weight-semibold);
    color: var(--status-chit);
  }
</style>
