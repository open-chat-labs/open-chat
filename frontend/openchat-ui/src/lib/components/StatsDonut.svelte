<!-- Group / profile message stats: minutes online (this vs previous month), a donut of messages by type
     with the total in the middle, a tile per type, and extra counters (poll votes, replies …). -->
<script lang="ts">
  import { getI18n, useT } from '../i18n';
  import Translate from './Translate.svelte';
  const TYPE_ICONS: Record<string, string> = {
    text: 'chat',
    image: 'image',
    video: 'video',
    audio: 'mic',
    file: 'file',
    poll: 'poll',
    crypto: 'token',
    gif: 'gif',
  };

  const PALETTE = ['#5B8CFF', '#B06BFF', '#FFB03D', '#2EE6A8', '#FF5672', '#1FB6FF', '#FF8A3D', '#8C6BFF'];

  interface Props {
    onlineMinutes: number;
    onlineMinutesPrev: number;
    /** type picks the icon (text, image, video, audio, file, poll, crypto, gif; falls back to the label); label is a resource key (or
        literal text); colour defaults from a palette. */
    slices: { label: string; count: number; color?: string; type?: string }[];
    /** label: resource key (or literal text). */
    extras?: { label: string; count: string }[];
  }

  let { onlineMinutes, onlineMinutesPrev, slices, extras = [] }: Props = $props();
  const t = useT();
  const i18n = getI18n();

  const fmt = (n: number) => n.toLocaleString(i18n.locale ?? 'en');

  const colored = $derived(slices.map((s, i) => ({ ...s, color: s.color || PALETTE[i % PALETTE.length] })));
  const total = $derived(slices.reduce((sum, s) => sum + s.count, 0));

  // one conic-gradient ring: each slice gets a hard stop at its cumulative angle
  const ring = $derived.by(() => {
    const whole = total || 1;
    let at = 0;
    const stops = colored.map((s) => {
      const from = (at / whole) * 360;
      at += s.count;
      return `${s.color} ${from.toFixed(2)}deg ${((at / whole) * 360).toFixed(2)}deg`;
    });
    return `conic-gradient(from -90deg,${stops.join(',')})`;
  });
</script>

<div class="stats">
  <div class="online">
    <span class="online-now"><Translate key="ui.statsDonut.onlineThisMonth" params={{ count: onlineMinutes }}>{#snippet figure()}<span class="figure">{fmt(onlineMinutes)}</span>{/snippet}</Translate></span>
    <span class="online-prev">{t('ui.statsDonut.onlinePreviousMonth', { count: onlineMinutesPrev, figure: fmt(onlineMinutesPrev) })}</span>
  </div>
  <div class="donut-row">
    <div class="donut" style:background={ring}>
      <div class="hole">
        <span class="total">{fmt(total)}</span>
        <span class="caption">{t('ui.statsDonut.messages')}</span>
      </div>
    </div>
  </div>
  <div class="grid">
    {#each colored as slice}
      <div class="tile">
        <span class="count" style:color={slice.color}>{fmt(slice.count)}</span>
        <span class="label-row">
          <span class="type-icon" style:mask="var(--icon-{TYPE_ICONS[(slice.type ?? slice.label).toLowerCase()] ?? 'chat'}) center/contain no-repeat"></span>
          <span class="label">{t(slice.label)}</span>
        </span>
      </div>
    {/each}
  </div>
  {#if extras.length}
    <div class="grid">
      {#each extras as extra}
        <div class="tile">
          <span class="count">{extra.count}</span>
          <span class="label">{t(extra.label)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .stats {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-22);
  }

  .online {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding-top: var(--space-18);
    text-align: center;
  }

  .online-now {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
    text-wrap: pretty;
  }

  .figure {
    color: var(--accent-bright);
  }

  .online-prev {
    font: var(--weight-regular) var(--text-md) / 1.4 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .donut-row {
    display: flex;
    justify-content: center;
    padding: var(--space-18) 0;
  }

  .donut {
    flex: none;
    position: relative;
    width: 220px;
    height: 220px;
    border-radius: var(--radius-circle);
  }

  .hole {
    position: absolute;
    inset: 30px;
    border-radius: var(--radius-circle);
    background: var(--surface-1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
  }

  .total {
    font: var(--weight-bold) var(--text-2xl) / 1 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink);
  }

  .caption {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-6);
  }

  .tile {
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-12) var(--space-14);
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .count {
    font: var(--weight-bold) var(--text-lg) / 1 var(--font-sans);
    color: var(--ink);
  }

  .label-row {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }

  .type-icon {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--ink-4);
  }

  .label {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-xs) / 1.3 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--ink-4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
