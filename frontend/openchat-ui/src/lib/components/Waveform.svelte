<!-- Audio waveform. levels: array of 0–1 (or `count` bars from a stable seed). progress 0–1 colours the played part.
     seekable → handle + pointer/arrow-key seeking → onSeek(fraction). Bars fill the width, so it never cuts off. -->
<script lang="ts">
  interface Props {
    levels?: number[];
    /** Bars to generate when no levels are given. */
    count?: number;
    seed?: number;
    progress?: number;
    /** Defaults to whether onSeek is set. */
    seekable?: boolean;
    handle?: boolean;
    height?: number;
    playedColor?: string;
    restColor?: string;
    /** Ring around the handle; match the surface behind. */
    ring?: string;
    label?: string;
    onSeek?: (fraction: number) => void;
  }

  let {
    levels,
    count = 40,
    seed = 7,
    progress = 0,
    seekable,
    handle = true,
    height = 22,
    playedColor = 'var(--accent,#FF5672)',
    restColor = 'var(--bubble-wave-off,#4A4A56)',
    ring = 'var(--bubble-recv-bg,#191921)',
    label = 'Waveform',
    onSeek,
  }: Props = $props();

  let root: HTMLDivElement;
  let width = $state(0);

  const seek = $derived(seekable ?? !!onSeek);
  const prog = $derived(Math.max(0, Math.min(1, progress)));

  const source = $derived.by(() => {
    if (levels?.length) return levels;
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
      out.push(0.25 + (x - Math.floor(x)) * 0.75);
    }
    return out;
  });

  // resample source levels to however many 3px bars (2px gap) fit the measured width
  const bars = $derived.by(() => {
    const n = width ? Math.max(8, Math.floor((width + 2) / 5)) : source.length;
    if (n === source.length) return source;
    return Array.from({ length: n }, (_, i) => source[Math.min(source.length - 1, Math.floor((i * source.length) / n))]);
  });

  function seekAt(clientX: number) {
    if (!onSeek) return;
    const r = root.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  }

  function down(e: PointerEvent) {
    if (!seek) return;
    seekAt(e.clientX);
    const move = (ev: PointerEvent) => seekAt(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function key(e: KeyboardEvent) {
    if (!seek || !onSeek) return;
    const d = e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowLeft' ? -0.05 : 0;
    if (!d) return;
    e.preventDefault();
    onSeek(Math.max(0, Math.min(1, prog + d)));
  }
</script>

<div
  class="wave"
  class:seek
  bind:this={root}
  bind:clientWidth={width}
  style:height="{height}px"
  onpointerdown={down}
  onkeydown={key}
  role={seek ? 'slider' : 'img'}
  tabindex={seek ? 0 : undefined}
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(prog * 100)}
>
  {#each bars as level, i}
    <span class="bar" style:height="{Math.max(3, Math.round(level * height))}px" style:background={(i + 0.5) / bars.length <= prog ? playedColor : restColor}></span>
  {/each}
  {#if seek && handle}
    <span class="handle" style:left="{(prog * 100).toFixed(2)}%" style:background={playedColor} style:box-shadow="0 0 0 2px {ring}" aria-hidden="true"></span>
  {/if}
</div>

<style>
  .wave {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: default;
    touch-action: none;
    user-select: none;
  }

  .wave.seek {
    cursor: pointer;
  }

  .bar {
    flex: none;
    width: 3px;
    border-radius: 999px;
    transition: background 120ms;
  }

  .handle {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    border-radius: 50%;
    pointer-events: none;
  }
</style>
