<!-- Live call surface. Inline (in the conversation column, under the header) or full screen (`full`).
     Layout rule: with 1–2 other people your own video floats as a draggable window that snaps to a corner;
     with 3+ others everyone, you included, gets an equal tile. Sharing your screen puts it on stage with people in a strip.
     Full screen hides the top bar and controls after 3s without pointer movement.
     Host owns mute (`muted` + onToggleMute) so the call bar / mini window stay in sync; camera and sharing live here. -->
<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import RoundIconButton from '../../lib/components/RoundIconButton.svelte';
  import VideoTile from './VideoTile.svelte';

  interface Person {
    name: string;
    initial: string;
    grad: string;
    muted?: boolean;
    /** Feed background; defaults from a palette. */
    bg?: string;
    /** Feed aspect ratio, width / height. */
    ratio?: number;
  }

  interface Props {
    title: string;
    /** The other participants. */
    people: Person[];
    media?: 'video' | 'voice';
    full?: boolean;
    muted?: boolean;
    /** Call start, ms epoch. */
    start?: number;
    /** Header avatar; defaults to the first participant's. */
    avatarGrad?: string;
    onToggleMute?: () => void;
    onToggleFull?: (full: boolean) => void;
    panelOpen?: boolean;
    /** Shows the details toggle (with panelOpen state). */
    onTogglePanel?: () => void;
    /** Shows the details button when there is no onTogglePanel. */
    onDetails?: () => void;
    onMinimise?: () => void;
    onLeave?: () => void;
  }

  let {
    title,
    people,
    media = 'video',
    full = false,
    muted = false,
    start,
    avatarGrad,
    onToggleMute,
    onToggleFull,
    panelOpen = false,
    onTogglePanel,
    onDetails,
    onMinimise,
    onLeave,
  }: Props = $props();

  const ME = { name: 'You', initial: 'I', grad: 'linear-gradient(140deg,#FF9F45,#FF5672)', bg: 'linear-gradient(165deg,#3d434c,#22262d)' };
  const BGS = [
    'linear-gradient(165deg,#4a3b45,#1d1a22)',
    'linear-gradient(165deg,#2f3a44,#1a2026)',
    'linear-gradient(165deg,#43392f,#221d18)',
    'linear-gradient(165deg,#3b3446,#1e1a24)',
    'linear-gradient(165deg,#2e4038,#18221e)',
  ];
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
    return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(x).padStart(2, '0')}`;
  };

  let root: HTMLDivElement;
  let pip = $state<HTMLDivElement>();
  let camOverride = $state<boolean | null>(null);
  let sharing = $state(false);
  let idle = $state(false);
  let corner = $state('br');
  let now = $state(Date.now());

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let drag: { x: number; y: number; moved: boolean } | null = null;

  const cam = $derived(camOverride ?? media === 'video');
  const others = $derived(people.map((o, i) => ({ bg: BGS[i % BGS.length], ...o })));
  // the active speaker rotates every 2.6s until real audio levels are wired in
  const speaking = $derived(others.length ? Math.floor(now / 2600) % others.length : -1);
  const pipMode = $derived(!sharing && others.length <= 2);

  type Tile = { name: string; initial: string; grad: string; bg: string; ratio: number; muted: boolean; speaking: boolean; big: boolean };
  const selfTile = $derived<Tile>({ ...ME, bg: cam ? ME.bg : '#16161c', ratio: 4 / 3, muted, speaking: false, big: false });
  const tileOf = (o: (typeof others)[number], i: number, big = false): Tile => ({
    name: o.name,
    initial: o.initial,
    grad: o.grad,
    bg: o.bg,
    ratio: o.ratio || 4 / 3,
    muted: !!o.muted,
    speaking: i === speaking,
    big,
  });
  const tiles = $derived(sharing ? [] : pipMode ? others.map((o, i) => tileOf(o, i, others.length === 1)) : [...others.map((o, i) => tileOf(o, i)), selfTile]);
  const strip = $derived(sharing ? [...others.map((o, i) => tileOf(o, i)), selfTile] : []);
  const cols = $derived(
    sharing || (pipMode && others.length !== 2)
      ? 'minmax(0,1fr)'
      : pipMode
        ? 'repeat(2,minmax(0,1fr))'
        : `repeat(${tiles.length <= 4 ? 2 : tiles.length <= 9 ? 3 : 4},minmax(0,1fr))`,
  );

  const panelShown = $derived(!!onTogglePanel && panelOpen);
  const chromeHidden = $derived(full && idle);

  function wake() {
    clearTimeout(idleTimer);
    idle = false;
    if (full) idleTimer = setTimeout(() => (idle = true), 3000);
  }

  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(idleTimer);
    };
  });

  $effect(() => {
    full;
    untrack(wake);
  });

  function pipDown(e: PointerEvent) {
    if (!pip) return;
    drag = { x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pip.style.transition = 'none';
  }

  function pipMove(e: PointerEvent) {
    if (!drag || !pip) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    pip.style.transform = `translate(${dx}px,${dy}px)`;
  }

  async function pipUp() {
    const d = drag, el = pip;
    drag = null;
    if (!d || !el) return;
    const r = root.getBoundingClientRect(), b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2 - r.left, cy = b.top + b.height / 2 - r.top;
    const v = cy < r.height / 3 ? 't' : cy > (r.height * 2) / 3 ? 'b' : 'm';
    const h = cx < r.width / 3 ? 'l' : cx > (r.width * 2) / 3 ? 'r' : 'c';
    // the centre is the stage: push to the nearer horizontal edge instead
    // FLIP: positions jump between auto/px (not animatable), so glide from the drop point with a transform
    el.style.transform = '';
    el.style.transition = 'none';
    corner = v === 'm' && h === 'c' ? 'm' + (cx < r.width / 2 ? 'l' : 'r') : v + h;
    await tick();
    const n = el.getBoundingClientRect();
    el.style.transform = `translate(${b.left - n.left}px,${b.top - n.top}px)`;
    void el.offsetWidth;
    el.style.transition = 'transform 720ms cubic-bezier(.16,1,.3,1)';
    el.style.transform = '';
  }

  const pipInset = $derived(full ? '20px' : '12px');
  const controls = $derived([
    { label: muted ? 'Unmute' : 'Mute', icon: muted ? 'mic-off' : 'mic', variant: muted ? 'off' : 'default', pressed: muted, press: () => onToggleMute?.() },
    { label: cam ? 'Turn camera off' : 'Turn camera on', icon: cam ? 'video' : 'video-off', variant: cam ? 'default' : 'off', pressed: !cam, press: () => (camOverride = !cam) },
    { label: sharing ? 'Stop sharing' : 'Share screen', icon: 'screen-share', variant: sharing ? 'on' : 'default', pressed: sharing, press: () => (sharing = !sharing) },
    { label: 'Leave call', icon: 'phone-off', variant: 'danger', pressed: undefined, press: () => onLeave?.() },
  ] as const);
</script>

<div class="call" class:full class:idle={chromeHidden} bind:this={root} onmousemove={wake} data-screen-label={full ? 'Call · full screen' : 'Call'} role="group">
  <div class="stage" class:sharing style:grid-template-columns={cols}>
    {#if sharing}
      <div class="shared"><span class="shared-label">Your shared screen</span></div>
    {/if}
    {#each tiles as tile}
      <div class="cell"><VideoTile nameLabel={tile.name} initial={tile.initial} grad={tile.grad} feed={tile.bg} ratio={tile.ratio} muted={tile.muted} speaking={tile.speaking} big={tile.big} /></div>
    {/each}
  </div>

  {#if sharing}
    <div class="strip">
      {#each strip as tile}
        <div class="strip-tile" class:speaking={tile.speaking} style:background={tile.bg}>
          <div class="strip-center"><span class="strip-avatar" style:background={tile.grad}>{tile.initial}</span></div>
          <span class="tag"><span class="tag-mic" class:muted={tile.muted} style:mask="var(--icon-{tile.muted ? 'mic-off' : 'mic'}) center/contain no-repeat"></span>{tile.name}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if pipMode}
    <div
      class="pip"
      bind:this={pip}
      style:top={corner[0] === 't' ? (full ? '70px' : '62px') : corner[0] === 'm' ? '50%' : 'auto'}
      style:bottom={corner[0] === 'b' ? (full ? '108px' : '86px') : 'auto'}
      style:left={corner[1] === 'l' ? pipInset : corner[1] === 'c' ? '50%' : 'auto'}
      style:right={corner[1] === 'r' ? pipInset : 'auto'}
      style:translate="{corner[1] === 'c' ? '-50%' : '0'} {corner[0] === 'm' ? '-50%' : '0'}"
      style:background={selfTile.bg}
      onpointerdown={pipDown}
      onpointermove={pipMove}
      onpointerup={pipUp}
      title="Drag to move"
      role="img"
      aria-label="Your video"
    >
      <div class="strip-center"><span class="pip-avatar" style:background={selfTile.grad}>{selfTile.initial}</span></div>
      <span class="tag"><span class="tag-mic" class:muted style:mask="var(--icon-{muted ? 'mic-off' : 'mic'}) center/contain no-repeat"></span>You</span>
    </div>
  {/if}

  <div class="top chrome">
    <span class="top-avatar" style:background={avatarGrad ?? others[0]?.grad ?? 'transparent'}></span>
    <span class="top-text">
      <span class="top-title">{title}</span>
      <span class="top-meta"><span class="live-dot"></span>{fmt(Math.max(0, Math.floor((now - (start ?? now)) / 1000)))} · {others.length + 1} in call</span>
    </span>
    {#if sharing}
      <span class="sharing" onclick={() => (sharing = !sharing)} role="button" tabindex="0"><span class="sharing-icon"></span>You're sharing<span class="sharing-stop">Stop</span></span>
    {/if}
    {#if !full && (onTogglePanel || onDetails)}
      <span
        class="top-button"
        class:on={panelShown}
        onclick={() => (onTogglePanel ? onTogglePanel() : onDetails?.())}
        role="button"
        tabindex="0"
        aria-label={panelShown ? 'Hide details' : 'Details'}
        aria-pressed={panelShown}
        title={panelShown ? 'Hide details' : 'Details'}><span class="top-icon" style:mask="var(--icon-panel) center/contain no-repeat"></span></span
      >
    {/if}
    <span class="top-button" onclick={() => onMinimise?.()} role="button" tabindex="0" aria-label="Minimise to see messages" title="Minimise to see messages"
      ><span class="top-icon" style:mask="var(--icon-chat) center/contain no-repeat"></span></span
    >
    <span class="top-button" onclick={() => onToggleFull?.(!full)} role="button" tabindex="0" aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}
      ><span class="top-icon" style:mask="var(--icon-{full ? 'minimize' : 'maximize'}) center/contain no-repeat"></span></span
    >
  </div>

  <div class="bottom chrome">
    <div class="pill" role="toolbar" aria-label="Call controls">
      {#each controls as b}<RoundIconButton icon={b.icon} label={b.label} variant={b.variant} pressed={b.pressed} size={full ? 'lg' : 'md'} onPress={b.press} />{/each}
    </div>
  </div>
</div>

<style>
  .call {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
    border-radius: 14px;
    background: #0b0b0f;
    cursor: default;
    color: #fff;
  }

  .call.full {
    border-radius: 0;
  }

  .call.idle {
    cursor: none;
  }

  .stage {
    position: absolute;
    inset: 62px 12px 86px 12px;
    display: grid;
    grid-auto-rows: minmax(0, 1fr);
    gap: 8px;
  }

  .stage.sharing {
    inset: 62px 168px 86px 12px;
  }

  .full .stage {
    inset: 70px 20px 108px 20px;
  }

  .full .stage.sharing {
    inset: 70px 200px 108px 20px;
  }

  .shared {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    background: repeating-linear-gradient(135deg, #191921 0 14px, #15151b 14px 28px);
    box-shadow: inset 0 0 0 2px var(--accent, #ff5672);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shared-label {
    font: 500 13px/1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .cell {
    position: relative;
    min-width: 0;
    min-height: 0;
  }

  .strip {
    position: absolute;
    top: 62px;
    inset-inline-end: 12px;
    bottom: 86px;
    width: 144px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
  }

  .full .strip {
    top: 70px;
    bottom: 108px;
    width: 168px;
  }

  .strip-tile {
    position: relative;
    flex: none;
    aspect-ratio: 4/3;
    border-radius: 10px;
    overflow: hidden;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.06),
      0 8px 20px rgba(0, 0, 0, 0.4);
  }

  .strip-tile.speaking {
    box-shadow:
      inset 0 0 0 2px var(--accent, #ff5672),
      0 8px 20px rgba(0, 0, 0, 0.4);
  }

  .strip-center {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .strip-avatar,
  .pip-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 700 14px/1 var(--font-sans);
    color: #0e0e12;
  }

  .pip-avatar {
    width: 40px;
    height: 40px;
    font-size: 15px;
  }

  .tag {
    position: absolute;
    inset-inline-start: 6px;
    bottom: 6px;
    height: 20px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.55);
    font: 600 11px/1 var(--font-sans);
  }

  .tag-mic {
    width: 10px;
    height: 10px;
    background: #fff;
  }

  .tag-mic.muted {
    background: var(--status-danger, #f5493d);
  }

  .pip {
    position: absolute;
    z-index: 2;
    width: 281px;
    aspect-ratio: 4/3;
    border-radius: 12px;
    overflow: hidden;
    box-shadow:
      0 10px 28px rgba(0, 0, 0, 0.45),
      inset 0 0 0 1px rgba(255, 255, 255, 0.16);
    cursor: grab;
    touch-action: none;
    transition: none;
  }

  .full .pip {
    width: 375px;
  }

  .chrome {
    position: absolute;
    z-index: 3;
    opacity: 1;
    transition: opacity 300ms;
    pointer-events: auto;
  }

  .idle .chrome {
    opacity: 0;
    pointer-events: none;
  }

  .top {
    inset: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.6), transparent);
  }

  .full .top {
    padding: 14px 16px;
  }

  .top-avatar {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
  }

  .top-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .top-title {
    font: 700 15px/1 var(--font-sans);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .top-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 600 12px/1 var(--font-mono);
    color: rgba(255, 255, 255, 0.8);
  }

  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--status-online, #2ee6a8);
  }

  .sharing {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 6px 0 12px;
    border-radius: 15px;
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    font: 700 12.5px/1 var(--font-sans);
    cursor: pointer;
  }

  .sharing-icon {
    width: 13px;
    height: 13px;
    background: currentColor;
    mask: var(--icon-screen-share) center/contain no-repeat;
  }

  .sharing-stop {
    height: 22px;
    padding: 0 9px;
    display: flex;
    align-items: center;
    border-radius: 11px;
    background: rgba(46, 5, 18, 0.18);
  }

  .top-button {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .top-button.on {
    background: rgba(255, 255, 255, 0.22);
  }

  .top-button:hover {
    background: rgba(0, 0, 0, 0.6);
  }

  .top-icon {
    width: 15px;
    height: 15px;
    background: #fff;
  }

  .bottom {
    inset-inline: 0;
    bottom: 12px;
    display: flex;
    justify-content: center;
  }

  .full .bottom {
    bottom: 20px;
  }

  .pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 999px;
    background: rgba(14, 14, 18, 0.8);
    backdrop-filter: blur(12px);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }
</style>
