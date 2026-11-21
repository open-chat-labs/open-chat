<!-- Minimised call: floats over the app (SnapFloat — drag anywhere, 8 snap spots, clear of header/composer via safeTop/safeBottom).
     Video calls show the lead's feed (their avatar while it's off) and the user's own camera in the corner; tap it or
     "Back to call" → onOpen. Mount inside a positioned container (fills it, passes clicks through).
     The call timer ticks every second from `start` and is hidden without it (a mount time would be a made-up duration).
     The host owns the media: mute (`muted` + onToggleMute), camera (`camera` + onToggleCamera, hidden without it, as for
     a voice call). While `joining` it says so in place of the media controls. A broadcast viewer gets Ask to speak in
     place of mute (`speak`, as CallPanel), and the host their requests to speak (SpeakRequests). -->
<script lang="ts">
  import { onMount } from 'svelte';
  import AvatarStack from '../../lib/components/AvatarStack.svelte';
  import RoundIconButton from '../../lib/components/RoundIconButton.svelte';
  import SnapFloat from '../../lib/components/SnapFloat.svelte';
  import { stream as playStream } from '../../lib/behaviours/stream';
  import { useT } from '../../lib/i18n';
  import type { CallSpeakRequest } from './CallPanel.svelte';
  import SpeakRequests from './SpeakRequests.svelte';

  type Spot = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';

  interface Props {
    title: string;
    media?: 'video' | 'voice';
    /** Call start, ms epoch; the timer is hidden without it. */
    start?: number;
    /** Participants; the first is the lead feed. */
    people?: { name?: string; initial?: string; grad?: string; avatarUrl?: string; stream?: MediaStream | null }[];
    /** Faces for the stack; defaults to the people's pictures and gradients. */
    faces?: string[];
    /** Lead avatar background when the lead has none. */
    avatarGrad?: string;
    /** The user's own camera, in the lead's corner (video calls). */
    selfStream?: MediaStream | null;
    muted?: boolean;
    camera?: boolean;
    /** Still joining: no media controls yet. */
    joining?: boolean;
    /** A broadcast's viewer: 'ask' shows Ask to speak in place of mute, 'asked' shows it pressed. */
    speak?: 'ask' | 'asked';
    /** The host's queue of requests to speak. */
    requests?: CallSpeakRequest[];
    position?: Spot;
    safeTop?: number;
    safeBottom?: number;
    onSnap?: (position: Spot) => void;
    onOpen?: () => void;
    onToggleMute?: () => void;
    onToggleCamera?: (on: boolean) => void;
    onAskToSpeak?: () => void;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    onLeave?: () => void;
  }

  let {
    title,
    media = 'video',
    start,
    people = [],
    faces,
    avatarGrad,
    selfStream = null,
    muted = false,
    camera = false,
    joining = false,
    speak,
    requests = [],
    position = 'br',
    safeTop = 20,
    safeBottom = 20,
    onSnap,
    onOpen,
    onToggleMute,
    onToggleCamera,
    onAskToSpeak,
    onApprove,
    onReject,
    onLeave,
  }: Props = $props();
  const t = useT();

  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  const timer = $derived.by(() => {
    if (start == null) return '';
    const secs = Math.max(0, Math.floor((now - start) / 1000));
    const h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, s = secs % 60;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${h ? `${h}:${p(m)}` : m}:${p(s)}`;
  });
  const lead = $derived(people[0] ?? {});
  const stack = $derived(faces ?? people.map((x) => ({ grad: x.grad, src: x.avatarUrl })));
  // the lead's picture that failed to load: a new one is tried
  let failed = $state<string>();
</script>

<div class="layer">
  <SnapFloat width={280} {position} {safeTop} {safeBottom} label={t('ui.miniCall.ongoing')} {onSnap}>
    <div class="card" data-screen-label="Mini call">
      {#if media === 'video'}
        <div
          class="lead"
          onclick={() => onOpen?.()}
          role="button"
          tabindex="0"
          aria-label={t('ui.miniCall.backToCall')}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen?.();
            }
          }}
        >
          {#if lead.stream}
            <video class="feed" use:playStream={lead.stream} autoplay playsinline muted></video>
          {:else}
            <span class="lead-avatar" style:background={lead.grad || avatarGrad || 'linear-gradient(140deg,#B48CFF,#6A5CFF)'}
              >{#if lead.avatarUrl && lead.avatarUrl !== failed}<img class="face" src={lead.avatarUrl} alt="" onerror={() => (failed = lead.avatarUrl)} />{:else}{lead.initial || title.slice(0, 1).toUpperCase()}{/if}</span
            >
          {/if}
          {#if selfStream}
            <video class="self" use:playStream={selfStream} autoplay playsinline muted></video>
          {/if}
        </div>
      {/if}
      <div class="status">
        <span class="pulse"><span class="phone"></span></span>
        <span class="text"
          ><span class="title">{title}</span><span class="meta"
            >{joining ? t('ui.miniCall.joining') : timer ? t('ui.miniCall.meta', { media, timer }) : t('ui.miniCall.mediaOnly', { media })}</span
          ></span
        >
      </div>
      <div class="controls">
        <span class="faces"><AvatarStack people={stack} size={26} max={4} /></span>
        {#if !joining}
          {#if speak !== undefined}
            <RoundIconButton
              icon="mic"
              label={speak === 'asked' ? 'ui.callPanel.askedToSpeak' : 'ui.callPanel.askToSpeak'}
              variant={speak === 'asked' ? 'on' : 'default'}
              pressed={speak === 'asked'}
              onPress={() => {
                if (speak === 'ask') onAskToSpeak?.();
              }}
            />
          {:else}
            <RoundIconButton icon={muted ? 'mic-off' : 'mic'} label={t(muted ? 'ui.miniCall.unmute' : 'ui.miniCall.mute')} variant={muted ? 'off' : 'default'} pressed={muted} onPress={() => onToggleMute?.()} />
            {#if onToggleCamera}
              <RoundIconButton
                icon={camera ? 'video' : 'video-off'}
                label={camera ? 'ui.callPanel.cameraOff' : 'ui.callPanel.cameraOn'}
                variant={camera ? 'default' : 'off'}
                pressed={!camera}
                onPress={() => onToggleCamera?.(!camera)}
              />
            {/if}
          {/if}
        {/if}
        <RoundIconButton icon="maximize" label={t('ui.miniCall.backToCall')} onPress={() => onOpen?.()} />
        <RoundIconButton icon="phone-off" label={t('ui.miniCall.leave')} variant="danger" onPress={() => onLeave?.()} />
      </div>
      {#if requests.length > 0}
        <SpeakRequests {requests} {onApprove} {onReject} />
      {/if}
    </div>
  </SnapFloat>
</div>

<style lang="scss">
  @use '../../lib/styles/mixins' as *;

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
    background: var(--surface-2);
    color: var(--ink);
    box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.5),
      inset 0 0 0 1px color-mix(in oklch, var(--status-online) 40%, transparent);
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
    box-shadow: 0 0 0 3px var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font: 700 20px/1 var(--font-sans);
    color: #0e0e12;
    overflow: hidden;
  }

  .feed {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .face {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .self {
    position: absolute;
    object-fit: cover;
    // the user's own camera, mirrored as in the call view
    transform: scaleX(-1);
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
    background: color-mix(in oklch, var(--status-online) 22%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ocCallPulse 2.4s ease-out infinite;
  }

  .phone {
    width: 13px;
    height: 13px;
    background: var(--status-online);
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
    @include glyph-room;
  }

  .meta {
    font: 500 11.5px/1 var(--font-mono);
    color: var(--status-online);
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
