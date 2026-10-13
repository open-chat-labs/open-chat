<!-- Live countdown text. `to` = end time (ms epoch or ISO). format: auto ("2d 4h" → "3h 12m" → "4:09") | clock ("10:57:11") | words ("3 hours").
     prefix/suffix wrap it ("Ends in", "left"); `ended` text when it hits zero, then onEnd fires once. Ticks every second under an hour, else every 30s. -->
<script lang="ts">
  import { untrack } from 'svelte';

  interface Props {
    to: number | string;
    format?: 'auto' | 'clock' | 'words';
    prefix?: string;
    suffix?: string;
    ended?: string;
    onEnd?: () => void;
  }

  let { to, format = 'auto', prefix, suffix, ended = 'Ended', onEnd }: Props = $props();

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
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

  const text = $derived.by(() => {
    const s = Math.max(0, Math.floor((end - now) / 1000));
    if (s === 0) return ended;
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const body =
      format === 'clock'
        ? (d ? `${d}d ` : '') + (h || d ? `${h}:${z(m)}` : m) + `:${z(sec)}`
        : format === 'words'
          ? d ? plural(d, 'day') : h ? plural(h, 'hour') : m ? plural(m, 'minute') : `${sec} seconds`
          : d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}:${z(sec)}`;
    return [prefix, body, suffix].filter(Boolean).join(' ');
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
