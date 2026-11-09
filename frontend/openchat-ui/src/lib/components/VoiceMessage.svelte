<!-- Voice note bubble: play/pause button, seekable waveform, speed toggle (1x → 1.5x → 2x), elapsed / total and time.
     cornerBottomLeft (px or any CSS length) overrides the tail corner, e.g. to sit flush against a reply strip.
     By hand: `side` 'sent' is the sent bubble's colours only, as ChatBubble's (every bubble is left-aligned, so the
     shape is the same for both sides); `mirror` flips the corners for a right-aligned layout (mobile, native). -->
<script lang="ts">
  import { useT } from '../i18n';
  import Waveform from './Waveform.svelte';

  const H = [7, 14, 20, 11, 17, 9, 15, 21, 10, 16, 6, 13, 19, 8, 12, 18, 10, 15, 7, 20];
  const LEVELS = H.concat(H, H).slice(0, 48).map((h) => h / 22);
  const SPEEDS = ['1x', '1.5x', '2x'] as const;
  type Speed = (typeof SPEEDS)[number];

  interface Props {
    /** 0–1 */
    progress?: number;
    /** The recording's waveform, 0–1 per bar; placeholder bars without it. */
    levels?: number[];
    elapsed: string;
    total: string;
    speed?: Speed;
    side?: 'received' | 'sent';
    /** A right-aligned layout (mobile, native): the grouped corners on the inline-end side, as ChatBubble's. */
    mirror?: boolean;
    lastInGroup?: boolean;
    time: string;
    cornerBottomLeft?: number | string | null;
    playing?: boolean;
    onPlay?: () => void;
    onPause?: () => void;
    onSpeedChange?: (speed: Speed) => void;
    onSeek?: (fraction: number) => void;
  }

  let { progress = 0, levels, elapsed, total, speed = '1x', side = 'received', mirror = false, lastInGroup = true, time, cornerBottomLeft = null, playing = false, onPlay, onPause, onSpeedChange, onSeek }: Props = $props();
  const t = useT();

  // play state, seeking and speed changes stick locally until the parent sends new values
  let isPlaying = $derived(playing);
  let at = $derived(Math.max(0, Math.min(1, progress)));
  let speedIndex = $derived(Math.max(0, SPEEDS.indexOf(speed)));

  const sent = $derived(side === 'sent');
  // on the sent bubble's own shade the accent wouldn't show: the bubble's text colours instead
  const SENT_WAVE = {
    playedColor: 'var(--bubble-text)',
    restColor: 'color-mix(in oklch, var(--bubble-text) 32%, transparent)',
    ring: 'var(--bubble-send-bg)',
  };
  const bottomLeft = $derived(
    cornerBottomLeft == null || cornerBottomLeft === ''
      ? mirror ? 'var(--radius-xl)' : lastInGroup ? 'var(--radius-lg)' : 'var(--radius-xl)'
      : /[a-z%]/i.test(String(cornerBottomLeft)) ? String(cornerBottomLeft) : `${cornerBottomLeft}px`,
  );

  function togglePlay() {
    isPlaying = !isPlaying;
    if (isPlaying) onPlay?.();
    else onPause?.();
  }

  function cycleSpeed() {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    onSpeedChange?.(SPEEDS[speedIndex]);
  }

  function seek(f: number) {
    at = f;
    onSeek?.(f);
  }
</script>

<div class="row" class:mirror>
  <div class="bubble" class:sent class:mirror class:last={lastInGroup} style:border-end-start-radius={bottomLeft}>
    <div class="controls">
      <div class="play" class:playing={isPlaying} onclick={togglePlay} role="button" tabindex="0" aria-label={t(isPlaying ? 'ui.voiceMessage.pause' : 'ui.voiceMessage.play')}>
        <span class="play-icon"></span>
      </div>
      <div class="wave">
        <Waveform
          levels={levels?.length ? levels : LEVELS}
          progress={at}
          seekable={true}
          onSeek={seek}
          height={22}
          label={t('ui.voiceMessage.seek')}
          {...sent ? SENT_WAVE : {}}
        />
      </div>
      <div class="speed" onclick={cycleSpeed} role="button" tabindex="0">{SPEEDS[speedIndex]}</div>
    </div>
    <div class="meta">
      <span class="clock">{elapsed}<span class="slash"> / </span><span class="total">{total}</span></span>
      <span class="time">{time}</span>
    </div>
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .row {
    width: 100%;
    display: flex;
    justify-content: flex-start;

    /* a right-aligned layout: the bubble at the inline end */
    &.mirror {
      justify-content: flex-end;
    }
  }

  .bubble {
    text-align: start;
    width: 330px;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    background: var(--bubble-recv-bg);
    box-shadow: var(--bubble-ring), var(--bubble-shadow);
    border-start-start-radius: var(--radius-xs);
    border-start-end-radius: var(--radius-xl);
    border-end-end-radius: var(--radius-xl);
    padding: var(--space-10) var(--space-14) var(--space-10) var(--space-12);

    &.sent {
      background: var(--bubble-send-bg);
      box-shadow: var(--bubble-shadow);
    }

    &.mirror {
      border-start-start-radius: var(--radius-xl);
      border-start-end-radius: var(--radius-xs);

      &.last {
        border-end-end-radius: var(--radius-lg);
      }
    }
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-14);
  }

  .play {
    position: relative;
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);

    /* while it plays, a halo spreads from the button and fades, again and again (by hand) */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: 0 0 0 2px var(--voice-halo, var(--accent));
      opacity: 0;
      pointer-events: none;
    }

    &.playing::after {
      animation: voiceHalo 1.44s ease-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      &.playing::after {
        animation: none;
      }
    }

    .sent & {
      --voice-halo: var(--bubble-text);
      background: color-mix(in oklch, var(--bubble-text) 12%, transparent);
    }
    @include flex-center;
    cursor: pointer;

    &:hover {
      background: var(--btn-hover);
    }
  }

  .play-icon {
    width: 14px;
    height: 14px;
    margin-left: 2px;
    background: var(--ink);
    mask: var(--icon-play-filled) center/contain no-repeat;

    .sent & {
      background: var(--bubble-text);
    }

    .playing & {
      margin-left: 0;
      mask: var(--icon-pause-filled) center/contain no-repeat;
    }
  }

  .wave {
    flex: 1;
    min-width: 0;
  }

  .speed {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 22px;
    padding: 0;
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;

    .sent & {
      color: var(--bubble-text);
      background: color-mix(in oklch, var(--bubble-text) 8%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--bubble-text) 16%, transparent);
    }

    &:hover {
      background: var(--btn-hover);
    }
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-10);
    padding-inline-start: 44px;
  }

  .clock {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--accent);

    .sent & {
      color: var(--bubble-text);
    }
  }

  .slash {
    color: var(--ink-3);

    .sent & {
      color: var(--bubble-text-soft);
    }
  }

  .total {
    color: var(--ink);

    .sent & {
      color: var(--bubble-text);
    }
  }

  .time {
    flex: none;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--meta);

    .sent & {
      color: var(--bubble-text-soft);
    }
  }

  @keyframes voiceHalo {
    0% {
      opacity: 0.55;
      transform: scale(1);
    }
    /* gone well before it's spread all the way */
    65% {
      opacity: 0;
    }
    100% {
      opacity: 0;
      transform: scale(1.7);
    }
  }
</style>
