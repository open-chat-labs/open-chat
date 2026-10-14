<!-- Live countdown text. `to` = end time (ms epoch or ISO). format: auto ("2d 4h" → "3h 12m" → "4:09") | clock ("10:57:11") | words ("3 hours").
     prefix/suffix wrap it ("Ends in", "left"); `ended` text when it hits zero, then onEnd fires once. Ticks every second under an hour, else every 30s. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { untrack } from 'svelte';

  interface Props {
    to: number | string;
    format?: 'auto' | 'clock' | 'words';
    /** Resource key (or literal text) shown before the time. */
    prefix?: string;
    /** Resource key (or literal text) shown after the time. */
    suffix?: string;
    /** Resource key (or literal text) shown once it reaches zero. */
    ended?: string;
    onEnd?: () => void;
  }

  let { to, format = 'auto', prefix, suffix, ended = 'ui.countdown.ended', onEnd }: Props = $props();
  const t = useT();

  let now = $state(Date.now());

  const end = $derived(typeof to === 'number' ? to : Date.parse(to));

  $effect(() => {
    const stop = end;
    const fast = format === 'clock';
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const at = Date.now();
      now = at;
      const left = stop - at;
      if (left <= 0) {
        untrack(() => onEnd?.());
        return;
      }
      timer = setTimeout(tick, left < 3600e3 || fast ? 1000 : 30000);
    };
    tick();
    return () => clearTimeout(timer);
  });

  const z = (n: number) => String(n).padStart(2, '0');

  const text = $derived.by(() => {
    const s = Math.max(0, Math.floor((end - now) / 1000));
    if (s === 0) return t(ended);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const body =
      format === 'clock'
        ? d
          ? t('ui.countdown.clockDays', { days: d, clock: `${h}:${z(m)}:${z(sec)}` })
          : (h ? `${h}:${z(m)}` : m) + `:${z(sec)}`
        : format === 'words'
          ? d ? t('ui.countdown.days', { count: d }) : h ? t('ui.countdown.hours', { count: h }) : m ? t('ui.countdown.minutes', { count: m }) : t('ui.countdown.seconds', { count: sec })
          : d ? t('ui.countdown.daysHours', { days: d, hours: h }) : h ? t('ui.countdown.hoursMinutes', { hours: h, minutes: m }) : `${m}:${z(sec)}`;
    return [prefix && t(prefix), body, suffix && t(suffix)].filter(Boolean).join(' ');
  });
</script>

<time datetime={new Date(end).toISOString()} aria-live="off" title={new Date(end).toLocaleString()}>{text}</time>

<style>
  time {
    font: inherit;
    color: inherit;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
