<!-- Group statistics: message total vs the previous 30 days, a 12-week activity strip, what gets sent (type mix),
     who is talking (top members + the rest) and engagement counters. -->
<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';

  const MIX_COLORS = ['#5B8CFF', '#B06BFF', '#FFB03D', '#2EE6A8', '#6E6E7C'];

  interface Props {
    /** Messages by type over the last 30 days; the total is their sum. Labels: resource keys (or literal text). */
    mix: { label: string; count: number; color?: string }[];
    /** Messages per week, oldest first; the last reads as this week. */
    weeks: number[];
    /** Top senders; avatarUrl replaces the initials. */
    people: { userId?: string; name: string; count: number; gradient?: string; avatarUrl?: string }[];
    /** Labels: resource keys (or literal text). */
    engagement: { count: string; label: string }[];
    /** Total for the previous 30 days; 0 hides the comparison. */
    totalPrev: number;
    /** Members beyond `people` who sent the rest. */
    otherPeople: number;
    onlineMinutes: number;
    onlineMinutesPrev: number;
  }

  let { mix, weeks, people, engagement, totalPrev, otherPeople, onlineMinutes, onlineMinutesPrev }: Props = $props();
  const t = useT();
  const i18n = getI18n();

  const fmt = (n: number) => Number(n).toLocaleString(i18n.locale ?? 'en');
  const initials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');

  const total = $derived(mix.reduce((s, x) => s + x.count, 0));
  // shares divide by at least 1, so an empty period reads 0 rather than NaN
  const whole = $derived(total || 1);
  // no previous period: nothing to compare against
  const pct = $derived(totalPrev > 0 ? Math.round(((total - totalPrev) / totalPrev) * 1000) / 10 : null);
  const peak = $derived(Math.max(...weeks) || 1);
  const topCount = $derived(people.reduce((m, p) => Math.max(m, p.count), 1));
  const others = $derived(Math.max(total - people.reduce((s, p) => s + p.count, 0), 0));
  const onlineUp = $derived(onlineMinutes >= onlineMinutesPrev);
</script>

<div class="stats">
  <div class="block">
    <div class="total-line">
      <span class="total">{fmt(total)}</span>
      <span class="total-unit">{t('ui.groupStats.messagesUnit', { count: total })}</span>
    </div>
    {#if pct != null}
      <div class="delta-line">
        <span class="delta" class:down={pct < 0}>
          <span class="delta-icon"></span>
          <span class="delta-label">{pct >= 0 ? '+' : ''}{pct}%</span>
        </span>
        <span class="delta-note">{t('ui.groupStats.vsPrevious')}</span>
      </div>
    {/if}
  </div>

  <div class="block weeks-block">
    <div class="weeks">
      {#each weeks as w, i}
        <div class="week" class:current={i === weeks.length - 1} style:height="{Math.max(Math.round((w / peak) * 100), 8)}%" title={t('ui.groupStats.weekMessages', { count: w })}></div>
      {/each}
    </div>
    <div class="weeks-axis">
      <span class="axis">{t('ui.groupStats.weeksAgo', { count: weeks.length })}</span>
      <span class="axis now">{t('ui.groupStats.thisWeek')}</span>
    </div>
  </div>

  <div class="rule"></div>

  <div class="section">
    <span class="section-title">{t('ui.groupStats.whatGetsSent')}</span>
    <div class="mix-bar">
      {#each mix as m, i}
        <div class="mix-part" style:width="{((m.count / whole) * 100).toFixed(2)}%" style:background={m.color || MIX_COLORS[i % MIX_COLORS.length]}></div>
      {/each}
    </div>
    <div class="mix-list">
      {#each mix as m, i}
        <div class="mix-row">
          <span class="mix-dot" style:background={m.color || MIX_COLORS[i % MIX_COLORS.length]}></span>
          <span class="mix-label">{t(m.label)}</span>
          <span class="mix-count">{fmt(m.count)}</span>
          <span class="mix-pct">{Math.round((m.count / whole) * 100)}%</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="rule"></div>

  <div class="section">
    <span class="section-title">{t('ui.groupStats.whoIsTalking')}</span>
    <div class="people">
      {#each people as p}
        <div class="person">
          <span class="initials" style:background={p.avatarUrl ? `url(${JSON.stringify(p.avatarUrl)}) center/cover no-repeat` : p.gradient || 'linear-gradient(145deg,#C9B4FF,#8A6BE0)'}
            >{p.avatarUrl ? '' : initials(p.name)}</span
          >
          <div class="person-body">
            <div class="person-line">
              <span class="person-name">{p.name}</span>
              <span class="person-count">{fmt(p.count)}</span>
            </div>
            <div class="person-track">
              <div class="person-fill" style:width="{((p.count / topCount) * 100).toFixed(1)}%"></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
    <span class="rest">{t('ui.groupStats.rest', { count: others, people: otherPeople })}</span>
  </div>

  <div class="rule"></div>

  <div class="section">
    <span class="section-title">{t('ui.groupStats.engagement')}</span>
    <span class="online"
      ><Translate key="ui.groupStats.onlineMinutes" params={{ direction: onlineUp ? 'up' : 'down' }}
        >{#snippet now()}<span class="online-now" class:down={!onlineUp}>{fmt(onlineMinutes)}</span>{/snippet}{#snippet prev()}<span
            class="online-prev">{fmt(onlineMinutesPrev)}</span
          >{/snippet}</Translate
      ></span
    >
    <div class="engagement">
      {#each engagement as e}
        <div class="counter">
          <span class="counter-value">{e.count}</span>
          <span class="counter-label">{t(e.label)}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .stats {
    width: 100%;
    box-sizing: border-box;
    padding-inline: var(--space-10);
    display: flex;
    flex-direction: column;
    gap: var(--space-26);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }

  .weeks-block {
    gap: var(--space-10);
  }

  .total-line {
    display: flex;
    align-items: flex-end;
    gap: var(--space-10);
    min-width: 0;
  }

  .total {
    font: var(--weight-bold) 40px/1 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
  }

  .total-unit {
    padding-bottom: 5px;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .delta-line {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .delta {
    --delta-ink: var(--status-online, #2ee6a8);
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px var(--space-8);
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--delta-ink) 14%, transparent);
  }

  .delta.down {
    --delta-ink: var(--status-danger, #f5493d);
  }

  .delta-icon {
    width: 11px;
    height: 11px;
    background: var(--delta-ink);
    mask: var(--icon-chevron-up) center/contain no-repeat;
  }

  .down .delta-icon {
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .delta-label {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--delta-ink);
  }

  .delta-note {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .weeks {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 92px;
    min-width: 0;
  }

  /* the most recent week reads as the live one; the rest recede */
  .week {
    flex: 1;
    min-width: 0;
    border-radius: 3px;
    background: var(--overlay-2, rgba(255, 255, 255, 0.12));
  }

  .week.current {
    background: var(--accent, #ff5672);
  }

  .weeks-axis {
    display: flex;
    justify-content: space-between;
    min-width: 0;
  }

  .axis {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .axis.now {
    color: var(--ink-3, #9a9aa8);
  }

  .rule {
    height: 1px;
    background: var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    min-width: 0;
  }

  .section-title {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3, #9a9aa8);
  }

  .mix-bar {
    display: flex;
    gap: 2px;
    height: 10px;
    min-width: 0;
  }

  .mix-part {
    min-width: 3px;
    border-radius: 2px;
  }

  .mix-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    min-width: 0;
  }

  .mix-row {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
  }

  .mix-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
  }

  .mix-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mix-count {
    flex: none;
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .mix-pct {
    flex: none;
    width: 44px;
    text-align: end;
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .people {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    min-width: 0;
  }

  .person {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
  }

  .initials {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-circle, 50%);
    font: var(--weight-bold) var(--text-sm) / 1 var(--font-sans);
    color: rgba(0, 0, 0, 0.6);
  }

  .person-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .person-line {
    display: flex;
    align-items: baseline;
    gap: var(--space-8);
    min-width: 0;
  }

  .person-name {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .person-count {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .person-track {
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
  }

  .person-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
  }

  .rest,
  .online {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .online {
    line-height: 1.45;
  }

  .online-now,
  .online-prev {
    font-weight: var(--weight-semibold);
  }

  .online-now {
    color: var(--status-online, #2ee6a8);
  }

  .online-now.down {
    color: var(--status-danger, #f5493d);
  }

  .online-prev {
    color: var(--ink-2, #c9c9d4);
  }

  .engagement {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-16) var(--space-18);
    min-width: 0;
    padding-top: var(--space-8);
  }

  .counter {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .counter-value {
    font: var(--weight-bold) var(--text-xl) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .counter-label {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
