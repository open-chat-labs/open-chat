<!-- Voice note bubble: play/pause button, seekable waveform, speed toggle (1x → 1.5x → 2x), elapsed / total and time.
     cornerBottomLeft (px or any CSS length) overrides the tail corner, e.g. to sit flush against a reply strip. -->
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
    elapsed: string;
    total: string;
    speed?: Speed;
    side?: 'received' | 'sent';
    lastInGroup?: boolean;
    time: string;
    cornerBottomLeft?: number | string | null;
    playing?: boolean;
    onPlay?: () => void;
    onPause?: () => void;
    onSpeedChange?: (speed: Speed) => void;
    onSeek?: (fraction: number) => void;
  }

  let { progress = 0, elapsed, total, speed = '1x', side = 'received', lastInGroup = true, time, cornerBottomLeft = null, playing = false, onPlay, onPause, onSpeedChange, onSeek }: Props = $props();
  const t = useT();

  // play state, seeking and speed changes stick locally until the parent sends new values
  let isPlaying = $derived(playing);
  let at = $derived(Math.max(0, Math.min(1, progress)));
  let speedIndex = $derived(Math.max(0, SPEEDS.indexOf(speed)));

  const sent = $derived(side === 'sent');
  const bottomLeft = $derived(
    cornerBottomLeft == null || cornerBottomLeft === ''
      ? sent ? 'var(--radius-xl)' : lastInGroup ? 'var(--radius-lg)' : 'var(--radius-xl)'
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

<div class="row">
  <div class="bubble" class:sent class:last={lastInGroup} style:border-end-start-radius={bottomLeft}>
    <div class="controls">
      <div class="play" class:playing={isPlaying} onclick={togglePlay} role="button" tabindex="0" aria-label={t(isPlaying ? 'ui.voiceMessage.pause' : 'ui.voiceMessage.play')}>
        <span class="play-icon"></span>
      </div>
      <div class="wave"><Waveform levels={LEVELS} progress={at} seekable={true} onSeek={seek} height={22} label={t('ui.voiceMessage.seek')} /></div>
      <div class="speed" onclick={cycleSpeed} role="button" tabindex="0">{SPEEDS[speedIndex]}</div>
    </div>
    <div class="meta">
      <span class="clock">{elapsed}<span class="slash"> / </span><span class="total">{total}</span></span>
      <span class="time">{time}</span>
    </div>
  </div>
</div>

<style>
  .row {
    width: 100%;
    display: flex;
    justify-content: flex-start;
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
    background: var(--bubble-recv-bg, #191921);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    border-start-start-radius: var(--radius-xs);
    border-start-end-radius: var(--radius-xl);
    border-end-end-radius: var(--radius-xl);
    padding: var(--space-10) var(--space-14) var(--space-10) var(--space-12);
  }

  .bubble.sent {
    border-start-start-radius: var(--radius-xl);
    border-start-end-radius: var(--radius-xs);
  }

  .bubble.sent.last {
    border-end-end-radius: var(--radius-lg);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-14);
  }

  .play {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .play:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.14));
  }

  .play-icon {
    width: 14px;
    height: 14px;
    margin-left: 2px;
    background: var(--ink, #e4e4ec);
    mask: var(--icon-play-filled) center/contain no-repeat;
  }

  .playing .play-icon {
    margin-left: 0;
    mask: var(--icon-pause-filled) center/contain no-repeat;
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-2, #b9b9c6);
    cursor: pointer;
    user-select: none;
  }

  .speed:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.12));
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
    color: var(--accent, #ff5672);
  }

  .slash {
    color: var(--ink-3, #8a8a99);
  }

  .total {
    color: var(--ink, #e4e4ec);
  }

  .time {
    flex: none;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--meta, #9393a2);
  }
</style>
