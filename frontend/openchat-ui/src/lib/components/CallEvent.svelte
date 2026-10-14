<!-- Call as a centred timeline pill (not a bubble). Single: live (green tint, pulse, Join / Leave once joined) | ended | missed (red tint, Call back).
     Grouped: pass `calls` (2+ ended/missed calls in a row) for one collapsible summary pill. Live calls are never grouped — the app decides runs. -->
<script lang="ts">
  import AvatarStack from './AvatarStack.svelte';
  import { useT } from '../i18n';

  type Media = 'video' | 'voice';

  interface Call {
    state: 'ended' | 'missed';
    media: Media;
    startedBy?: string;
    duration?: string;
    time: string;
  }

  interface Props {
    state?: 'live' | 'ended' | 'missed';
    media?: Media;
    /** Display name; "You" reads as your own call. */
    startedBy?: string;
    /** Live calls: participant faces, as CSS backgrounds or image URLs. */
    faces?: string[];
    /** Live calls: time since start, e.g. "12:04". */
    elapsed?: string;
    duration?: string;
    time?: string;
    /** 2+ ended/missed calls to show as one grouped pill. */
    calls?: Call[];
    joined?: boolean;
    onLeave?: () => void;
    onJoin?: () => void;
    onCallBack?: () => void;
  }

  let {
    state: callState = 'live',
    media: mediaProp = 'video',
    startedBy = '',
    faces = [],
    elapsed = '',
    duration = '',
    time = '',
    calls = [],
    joined = false,
    onLeave,
    onJoin,
    onCallBack,
  }: Props = $props();
  const t = useT();

  let open = $state(false);

  const mask = (m: Media) => `var(--icon-${m === 'voice' ? 'phone' : 'video'}) center/contain no-repeat`;

  const grouped = $derived(calls.length > 1);
  const missedCount = $derived(calls.filter((c) => c.state === 'missed').length);
  const groupTitle = $derived(t('ui.callEvent.group', { count: calls.length, missed: missedCount }));

  // "You" (startedBy) is your own call: no "from …" on a missed one
  const missedTitle = (media: Media, who: string) => t('ui.callEvent.missed', { media, who, self: !who || who === 'You' ? 'yes' : 'no' });

  function rowTitle(c: Call) {
    const who = c.startedBy ?? '';
    if (c.state === 'missed') return missedTitle(c.media, who);
    return t(who === 'You' ? 'ui.callEvent.youStarted' : 'ui.callEvent.call', { media: c.media }) + (c.duration ? ` · ${c.duration}` : '');
  }

  // a single call can come in through `calls` too
  const one = $derived<Partial<Call>>(calls[0] ?? {});
  const st = $derived(one.state ?? callState);
  const media = $derived(one.media ?? mediaProp);
  const who = $derived(one.startedBy ?? startedBy);
  const live = $derived(st === 'live');
  const missed = $derived(st === 'missed');
  const inCall = $derived(live && joined);
  const title = $derived(
    live
      ? t('ui.callEvent.started', { media, who })
      : missed
        ? t('ui.callEvent.missed', { media, who, self: who === 'You' ? 'yes' : 'no' })
        : t('ui.callEvent.ended', { media }),
  );
  const sub = $derived(
    live ? t('ui.callEvent.live', { elapsed, inCall: inCall ? 'yes' : 'no' }) : missed ? (one.time ?? time) : `${one.duration ?? duration} · ${one.time ?? time}`,
  );
  const people = $derived(faces.map((x) => (/^(https?:|data:|\/|\.)/.test(x) ? `center/cover no-repeat url(${JSON.stringify(x)})` : x)));
</script>

<div class="row">
  {#if !grouped}
    <div class="pill" class:live class:missed class:actionable={live || missed} role="group" aria-label={title}>
      <span class="badge" class:pulse={live}><span class="badge-icon" style:mask={mask(media)}></span></span>
      <span class="text"><span class="title">{title}</span><span class="sub">{sub}</span></span>
      {#if live && people.length}<span class="faces"><AvatarStack {people} size={28} max={4} /></span>{/if}
      {#if live || missed}
        <span class="action" class:join={live && !inCall} class:leave={inCall} onclick={inCall ? onLeave : live ? onJoin : onCallBack} role="button" tabindex="0"
          ><span class="action-icon" style:mask={mask(live ? media : 'voice')}></span>{t(inCall ? 'ui.callEvent.leave' : live ? 'ui.callEvent.join' : 'ui.callEvent.callBack')}</span
        >
      {/if}
    </div>
  {:else}
    <div class="group">
      <div class="summary" onclick={() => (open = !open)} role="button" tabindex="0" aria-expanded={open} aria-label={groupTitle}>
        <span class="badge" class:missed={missedCount > 0}><span class="badge-icon" style:mask={mask(missedCount ? 'voice' : calls[calls.length - 1].media)}></span></span>
        <span class="text"><span class="title plain">{groupTitle}</span><span class="sub">{calls[0].time} – {calls[calls.length - 1].time}</span></span>
        <span class="chevron" class:open></span>
      </div>
      {#if open}
        <div class="rows">
          {#each calls as call}
            <div class="call-row" class:missed={call.state === 'missed'}>
              <span class="row-icon" style:mask={mask(call.media)}></span><span class="row-title">{rowTitle(call)}</span><span class="row-time">{call.time}</span>
            </div>
          {/each}
          {#if missedCount > 0}
            <div class="call-back-row"><span class="call-back" onclick={onCallBack} role="button" tabindex="0"><span class="call-back-icon"></span>{t('ui.callEvent.callBack')}</span></div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .row {
    display: flex;
    justify-content: center;
    min-width: 0;
    width: 100%;
  }

  .pill,
  .summary {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 62px;
    padding: 0 22px 0 12px;
  }

  .pill {
    min-width: min(320px, 100%);
    max-width: 100%;
    box-sizing: border-box;
    border-radius: 31px;
    background: var(--surface-2, #191921);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .pill.actionable {
    padding-right: 12px;
  }

  .pill.live {
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 10%, var(--surface-2, #191921));
    box-shadow: inset 0 0 0 1.5px color-mix(in oklch, var(--status-online, #2ee6a8) 45%, transparent);
  }

  .pill.missed {
    background: color-mix(in oklch, var(--status-danger, #ff4d4d) 8%, var(--surface-2, #191921));
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-danger, #ff4d4d) 30%, transparent);
  }

  .badge {
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge-icon {
    width: 17px;
    height: 17px;
    background: var(--ink-2, #c9c9d4);
  }

  .missed .badge,
  .badge.missed {
    background: var(--status-danger-soft, rgba(255, 77, 77, 0.12));
  }

  .missed .badge-icon,
  .badge.missed .badge-icon {
    background: var(--status-danger, #ff4d4d);
  }

  .badge.pulse {
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 22%, transparent);
    animation: ocCallPulse 2.4s ease-out infinite;
  }

  .badge.pulse .badge-icon {
    background: var(--status-online, #2ee6a8);
  }

  .text {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title {
    font: 600 14px/1.1 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pill.missed .title {
    color: var(--status-danger, #ff4d4d);
  }

  .sub {
    font: 500 12px/1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pill.live .sub {
    color: var(--status-online, #2ee6a8);
  }

  .faces {
    flex: none;
    display: flex;
    align-items: center;
  }

  .action {
    flex: none;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 38px;
    padding: 0 16px 0 13px;
    border-radius: 19px;
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
    font: 600 13px/1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    white-space: nowrap;
  }

  .action.join {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
  }

  .action.leave {
    background: var(--status-danger, #ff4d4d);
    color: #fff;
  }

  .action:hover {
    filter: brightness(1.08);
  }

  .action-icon {
    width: 15px;
    height: 15px;
    background: currentColor;
  }

  .group {
    min-width: min(320px, 100%);
    max-width: 100%;
    box-sizing: border-box;
    border-radius: 31px;
    background: var(--surface-2, #191921);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    overflow: hidden;
  }

  .summary {
    cursor: pointer;
  }

  .summary:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .summary .sub {
    overflow: visible;
  }

  .chevron {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-3, #a3a3b2);
    mask: var(--icon-chevron-down) center/contain no-repeat;
    transition: transform 0.2s;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .rows {
    display: flex;
    flex-direction: column;
    padding: 6px 0 14px;
    box-shadow: inset 0 1px 0 var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .call-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 24px 10px 23px;
  }

  .row-icon {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-2, #c9c9d4);
  }

  .row-title {
    flex: 1;
    min-width: 0;
    font: 500 13px/1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .call-row.missed .row-icon {
    background: var(--status-danger, #ff4d4d);
  }

  .call-row.missed .row-title {
    color: var(--status-danger, #ff4d4d);
  }

  .row-time {
    flex: none;
    font: 500 12px/1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }

  .call-back-row {
    display: flex;
    justify-content: center;
    padding: 6px 12px 0;
  }

  .call-back {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 15px 0 12px;
    border-radius: 17px;
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
    font: 600 12.5px/1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
  }

  .call-back:hover {
    filter: brightness(1.15);
  }

  .call-back-icon {
    width: 14px;
    height: 14px;
    background: currentColor;
    mask: var(--icon-phone) center/contain no-repeat;
  }
</style>
