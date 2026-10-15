<!-- Live call surface. Inline (in the conversation column, under the header) or full screen (`full`).
     Layout rule: with 1–2 other people your own video floats as a draggable window that snaps to a corner;
     with 3+ others everyone, you included, gets an equal tile. Sharing your screen puts it on stage with people (their
     camera feeds, yours included) in a strip.
     Full screen hides the top bar and controls after 3s without input (pointer, keys, focus); they stay while focused.
     The host owns every media state: mute (`muted` + onToggleMute), camera (`camera` + onToggleCamera) and screen sharing
     (`sharing` + onToggleShare). Camera / share flip at once and roll back if the host's promise rejects; their buttons are
     hidden without the callback. Feeds are MediaStreams (person.stream, self.stream, screenStream); who is talking comes
     from person.speaking. The timer only shows with `start`. -->
<script lang="ts" module>
  export interface CallPerson {
    id?: string;
    name: string;
    initial: string;
    grad: string;
    muted?: boolean;
    /** Highlighted as the active speaker (from the host's audio levels). */
    speaking?: boolean;
    /** Live video; the avatar shows without it. */
    stream?: MediaStream | null;
    /** Placeholder feed background when there is no stream; defaults from a palette. */
    bg?: string;
    /** Feed aspect ratio, width / height. */
    ratio?: number;
  }
</script>

<script lang="ts">
  import { Optimistic } from '../../lib/behaviours/optimistic.svelte';
  import { onMount, tick, untrack } from 'svelte';
  import RoundIconButton from '../../lib/components/RoundIconButton.svelte';
  import VideoTile from './VideoTile.svelte';
  import { useT } from '../../lib/i18n';

  interface Props {
    title: string;
    /** The other participants. */
    people: CallPerson[];
    /** You: avatar letter / background and your camera stream. */
    self?: { initial?: string; grad?: string; stream?: MediaStream | null };
    media?: 'video' | 'voice';
    full?: boolean;
    muted?: boolean;
    /** Your camera is on (defaults to on for video calls). */
    camera?: boolean;
    /** You are sharing your screen. */
    sharing?: boolean;
    /** Your shared screen, shown on stage while sharing. */
    screenStream?: MediaStream | null;
    /** Call start, ms epoch; the duration is hidden without it. */
    start?: number;
    /** Header avatar; defaults to the first participant's. */
    avatarGrad?: string;
    onToggleMute?: () => void;
    /** Turn your camera on / off. Hidden without it; rolls back if it rejects. */
    onToggleCamera?: (on: boolean) => Promise<unknown> | void;
    /** Start / stop sharing your screen. Hidden without it; rolls back if it rejects. */
    onToggleShare?: (on: boolean) => Promise<unknown> | void;
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
    camera,
    sharing: sharingProp = false,
    screenStream = null,
    self,
    start,
    avatarGrad,
    onToggleMute,
    onToggleCamera,
    onToggleShare,
    onToggleFull,
    panelOpen = false,
    onTogglePanel,
    onDetails,
    onMinimise,
    onLeave,
  }: Props = $props();
  const t = useT();

  const ME_GRAD = 'linear-gradient(140deg,#FF9F45,#FF5672)';
  const ME_BG = 'linear-gradient(165deg,#3d434c,#22262d)';
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
  let idle = $state(false);
  let corner = $state('br');
  let now = $state(Date.now());

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let drag: { x: number; y: number; moved: boolean } | null = null;

  // camera / share flip at once (lib/behaviours/optimistic.svelte.ts): the latest call wins, a rejected latest call
  // falls back to the host's last accepted value with an error, host changes are followed once nothing is in flight
  const camState = new Optimistic(() => camera ?? media === 'video');
  const shareState = new Optimistic(() => sharingProp);
  $effect.pre(() => {
    void camera;
    void media;
    untrack(() => camState.sync());
  });
  $effect.pre(() => {
    void sharingProp;
    untrack(() => shareState.sync());
  });
  const cam = $derived(camState.current);
  const sharing = $derived(shareState.current);
  let lastFlip = $state<'cam' | 'share'>('cam');
  const flipFailed = $derived(lastFlip === 'cam' ? camState.failed : shareState.failed);

  function flip(kind: 'cam' | 'share') {
    const state = kind === 'cam' ? camState : shareState;
    const call = kind === 'cam' ? onToggleCamera : onToggleShare;
    if (!call) return;
    lastFlip = kind;
    const next = !state.current;
    state.set(next, () => call(next));
  }

  const others = $derived(people.map((o, i) => ({ bg: BGS[i % BGS.length], ...o })));
  const pipMode = $derived(!sharing && others.length <= 2);

  type Tile = { key: string; name: string; initial: string; grad: string; bg: string; ratio: number; muted: boolean; speaking: boolean; big: boolean; stream: MediaStream | null };
  const selfTile = $derived<Tile>({
    key: 'self',
    name: t('ui.callPanel.you'),
    initial: self?.initial ?? t('ui.callPanel.you').slice(0, 1),
    grad: self?.grad ?? ME_GRAD,
    bg: cam ? ME_BG : '#16161c',
    ratio: 4 / 3,
    muted,
    speaking: false,
    big: false,
    stream: cam ? (self?.stream ?? null) : null,
  });
  const tileOf = (o: (typeof others)[number], i: number, big = false): Tile => ({
    key: o.id ?? `p${i}`,
    name: o.name,
    initial: o.initial,
    grad: o.grad,
    bg: o.bg,
    ratio: o.ratio || 4 / 3,
    muted: !!o.muted,
    speaking: !!o.speaking,
    big,
    stream: o.stream ?? null,
  });
  const tiles = $derived(sharing ? [] : pipMode ? others.map((o, i) => tileOf(o, i, others.length === 1)) : [...others.map((o, i) => tileOf(o, i)), selfTile]);
  const strip = $derived(sharing ? [...others.map((o, i) => tileOf(o, i)), selfTile] : []);

  // a MediaStream can't be set as an attribute; bind it as srcObject
  function feed(node: HTMLVideoElement, stream: MediaStream | null) {
    node.srcObject = stream;
    return {
      update(next: MediaStream | null) {
        if (node.srcObject !== next) node.srcObject = next;
      },
      destroy() {
        node.srcObject = null;
      },
    };
  }
  const cols = $derived(
    sharing || (pipMode && others.length !== 2)
      ? 'minmax(0,1fr)'
      : pipMode
        ? 'repeat(2,minmax(0,1fr))'
        : `repeat(${tiles.length <= 4 ? 2 : tiles.length <= 9 ? 3 : 4},minmax(0,1fr))`,
  );

  const panelShown = $derived(!!onTogglePanel && panelOpen);
  // the controls stay while keyboard focus is on them: hiding focused buttons would leave a keyboard user lost
  let focusInChrome = $state(false);
  const chromeHidden = $derived(full && idle && !focusInChrome);
  const inChrome = (el: EventTarget | null) => el instanceof Element && root.contains(el) && !!el.closest('.chrome');

  // any input brings the controls back: mouse, keys, focus moving and touch
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
    void full;
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
  type Control = { label: string; icon: string; variant: 'default' | 'off' | 'on' | 'danger'; pressed: boolean | undefined; press: () => void };
  const controls = $derived(
    [
      { label: muted ? 'ui.callPanel.unmute' : 'ui.callPanel.mute', icon: muted ? 'mic-off' : 'mic', variant: muted ? 'off' : 'default', pressed: muted, press: () => onToggleMute?.() },
      onToggleCamera && { label: cam ? 'ui.callPanel.cameraOff' : 'ui.callPanel.cameraOn', icon: cam ? 'video' : 'video-off', variant: cam ? 'default' : 'off', pressed: !cam, press: () => flip('cam') },
      onToggleShare && { label: sharing ? 'ui.callPanel.stopSharing' : 'ui.callPanel.shareScreen', icon: 'screen-share', variant: sharing ? 'on' : 'default', pressed: sharing, press: () => flip('share') },
      { label: 'ui.callPanel.leave', icon: 'phone-off', variant: 'danger', pressed: undefined, press: () => onLeave?.() },
    ].filter(Boolean) as Control[],
  );
</script>

<div
  class="call"
  class:full
  class:idle={chromeHidden}
  bind:this={root}
  onmousemove={wake}
  onpointerdown={wake}
  onkeydown={wake}
  onfocusin={(e) => {
    focusInChrome = inChrome(e.target);
    wake();
  }}
  onfocusout={(e) => (focusInChrome = inChrome(e.relatedTarget))}
  data-screen-label={full ? 'Call · full screen' : 'Call'} role="group">
  <div class="stage" class:sharing style:grid-template-columns={cols}>
    {#if sharing}
      <div class="shared">
        {#if screenStream}<video class="shared-video" use:feed={screenStream} autoplay playsinline muted></video>{/if}
        <span class="shared-label">{t('ui.callPanel.yourSharedScreen')}</span>
      </div>
    {/if}
    {#each tiles as tile (tile.key)}
      <div class="cell">
        <VideoTile nameLabel={tile.name} initial={tile.initial} grad={tile.grad} feed={tile.bg} stream={tile.stream} mirror={tile.key === 'self'} ratio={tile.ratio} muted={tile.muted} speaking={tile.speaking} big={tile.big} />
      </div>
    {/each}
  </div>

  {#if sharing}
    <div class="strip">
      {#each strip as tile (tile.key)}
        <div class="strip-tile" class:speaking={tile.speaking} style:background={tile.bg}>
          {#if tile.stream}
            <video class="strip-video" class:mirror={tile.key === 'self'} use:feed={tile.stream} autoplay playsinline muted></video>
          {:else}
            <div class="strip-center"><span class="strip-avatar" style:background={tile.grad}>{tile.initial}</span></div>
          {/if}
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
      title={t('ui.callPanel.dragToMove')}
      role="img"
      aria-label={t('ui.callPanel.yourVideo')}
    >
      {#if selfTile.stream}
        <video class="pip-video" use:feed={selfTile.stream} autoplay playsinline muted></video>
      {:else}
        <div class="strip-center"><span class="pip-avatar" style:background={selfTile.grad}>{selfTile.initial}</span></div>
      {/if}
      <span class="tag"><span class="tag-mic" class:muted style:mask="var(--icon-{muted ? 'mic-off' : 'mic'}) center/contain no-repeat"></span>{t('ui.callPanel.you')}</span>
    </div>
  {/if}

  <div class="top chrome">
    <span class="top-avatar" style:background={avatarGrad ?? others[0]?.grad ?? 'transparent'}></span>
    <span class="top-text">
      <span class="top-title">{title}</span>
      <span class="top-meta"
        ><span class="live-dot"></span>{start != null
          ? t('ui.callPanel.duration', { time: fmt(Math.max(0, Math.floor((now - start) / 1000))), count: others.length + 1 })
          : t('ui.callPanel.inCall', { count: others.length + 1 })}</span
      >
    </span>
    {#if sharing}
      <span class="sharing" onclick={() => flip('share')} role="button" tabindex="0"><span class="sharing-icon"></span>{t('ui.callPanel.youreSharing')}<span class="sharing-stop">{t('ui.callPanel.stop')}</span></span>
    {/if}
    {#if !full && (onTogglePanel || onDetails)}
      <span
        class="top-button"
        class:on={panelShown}
        onclick={() => (onTogglePanel ? onTogglePanel() : onDetails?.())}
        role="button"
        tabindex="0"
        aria-label={t(panelShown ? 'ui.callPanel.hideDetails' : 'ui.callPanel.details')}
        aria-pressed={panelShown}
        title={t(panelShown ? 'ui.callPanel.hideDetails' : 'ui.callPanel.details')}><span class="top-icon" style:mask="var(--icon-panel) center/contain no-repeat"></span></span
      >
    {/if}
    <span class="top-button" onclick={() => onMinimise?.()} role="button" tabindex="0" aria-label={t('ui.callPanel.minimise')} title={t('ui.callPanel.minimise')}
      ><span class="top-icon" style:mask="var(--icon-chat) center/contain no-repeat"></span></span
    >
    <span class="top-button" onclick={() => onToggleFull?.(!full)} role="button" tabindex="0" aria-label={t(full ? 'ui.callPanel.exitFullScreen' : 'ui.callPanel.fullScreen')} title={t(full ? 'ui.callPanel.exitFullScreen' : 'ui.callPanel.fullScreen')}
      ><span class="top-icon" style:mask="var(--icon-{full ? 'minimize' : 'maximize'}) center/contain no-repeat"></span></span
    >
  </div>

  <div class="bottom chrome">
    {#if flipFailed}<span class="flip-error" role="alert">{t('ui.callPanel.toggleFailed')}</span>{/if}
    <div class="pill" role="toolbar" aria-label={t('ui.callPanel.controls')}>
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
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .full .bottom {
    bottom: 20px;
  }

  .flip-error {
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(14, 14, 18, 0.8);
    font: 500 13px/1.3 var(--font-sans);
    color: var(--status-danger, #f5493d);
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

  .shared-video,
  .pip-video,
  .strip-video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: inherit;
  }

  .pip-video,
  .strip-video {
    object-fit: cover;
  }

  .pip-video,
  .strip-video.mirror {
    transform: scaleX(-1);
  }
</style>
