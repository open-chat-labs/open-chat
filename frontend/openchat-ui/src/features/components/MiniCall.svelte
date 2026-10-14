<!-- Minimised call: floats over the app (SnapFloat — drag anywhere, 8 snap spots, clear of header/composer via safeTop/safeBottom).
     Video calls show the lead feed; tap it or "Back to call" → onOpen. Mount inside a positioned container (fills it, passes clicks through).
     The call timer ticks every second from `start`. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import AvatarStack from '../../lib/components/AvatarStack.svelte';
  import RoundIconButton from '../../lib/components/RoundIconButton.svelte';
  import SnapFloat from '../../lib/components/SnapFloat.svelte';

  type Spot = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';

  interface Props {
    title: string;
    media?: 'video' | 'voice';
    /** Call start, ms epoch; defaults to when the mini call mounted. */
    start?: number;
    /** Participants; the first is the lead feed. */
    people?: { name?: string; initial?: string; grad?: string }[];
    /** Faces for the stack; defaults to the people's gradients. */
    faces?: string[];
    /** Lead avatar background when the lead has none. */
    avatarGrad?: string;
    muted?: boolean;
    position?: Spot;
    safeTop?: number;
    safeBottom?: number;
    onSnap?: (position: Spot) => void;
    onOpen?: () => void;
    onToggleMute?: () => void;
    onLeave?: () => void;
  }

  let {
    title,
    media = 'video',
    start,
    people = [],
    faces,
    avatarGrad,
    muted = false,
    position = 'br',
    safeTop = 20,
    safeBottom = 20,
    onSnap,
    onOpen,
    onToggleMute,
    onLeave,
  }: Props = $props();

  const mountedAt = Date.now();
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  const timer = $derived.by(() => {
    const t = Math.max(0, Math.floor((now - (start ?? mountedAt)) / 1000));
    const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${h ? `${h}:${p(m)}` : m}:${p(s)}`;
  });
  const lead = $derived(people[0] ?? {});
</script>

<div class="layer">
  <SnapFloat width={280} {position} {safeTop} {safeBottom} label="Ongoing call" {onSnap}>
    <div class="card" data-screen-label="Mini call">
      {#if media === 'video'}
        <div
          class="lead"
          onclick={() => onOpen?.()}
          role="button"
          tabindex="0"
          aria-label="Back to call"
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen?.();
            }
          }}
        >
          <span class="lead-avatar" style:background={lead.grad || avatarGrad || 'linear-gradient(140deg,#B48CFF,#6A5CFF)'}>{lead.initial || title.slice(0, 1).toUpperCase()}</span>
          <span class="self"></span>
        </div>
      {/if}
      <div class="status">
        <span class="pulse"><span class="phone"></span></span>
        <span class="text"><span class="title">{title}</span><span class="meta">{media === 'video' ? 'Video' : 'Voice'} · {timer}</span></span>
      </div>
      <div class="controls">
        <span class="faces"><AvatarStack people={faces ?? people.map((x) => x.grad).filter((g): g is string => !!g)} size={26} max={4} /></span>
        <RoundIconButton icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} variant={muted ? 'off' : 'default'} pressed={muted} onPress={() => onToggleMute?.()} />
        <RoundIconButton icon="maximize" label="Back to call" onPress={() => onOpen?.()} />
        <RoundIconButton icon="phone-off" label="Leave call" variant="danger" onPress={() => onLeave?.()} />
      </div>
    </div>
  </SnapFloat>
</div>

<style>
  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .card {
    pointer-events: auto;
    box-sizing: border-box;
    padding: 12px;
    border-radius: 20px;
    background: var(--surface-2, #191921);
    box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.5),
      inset 0 0 0 1px color-mix(in oklch, var(--status-online, #2ee6a8) 40%, transparent);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lead {
    position: relative;
    margin: -4px -4px 0;
    aspect-ratio: 4/3;
    border-radius: 12px;
    overflow: hidden;
    background: linear-gradient(165deg, #4a3b45, #1d1a22);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lead-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    box-shadow: 0 0 0 3px var(--accent, #ff5672);
    display: flex;
    align-items: center;
    justify-content: center;
    font: 700 20px/1 var(--font-sans);
    color: #0e0e12;
  }

  .self {
    position: absolute;
    inset-inline-end: 8px;
    bottom: 8px;
    width: 64px;
    aspect-ratio: 4/3;
    border-radius: 6px;
    background: linear-gradient(165deg, #3d434c, #22262d);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.16);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pulse {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 22%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ocCallPulse 2.4s ease-out infinite;
  }

  .phone {
    width: 13px;
    height: 13px;
    background: var(--status-online, #2ee6a8);
    mask: var(--icon-phone) center/contain no-repeat;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title {
    font: 600 13px/1.1 var(--font-sans);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    font: 500 11.5px/1 var(--font-mono);
    color: var(--status-online, #2ee6a8);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .faces {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }
</style>
