<!-- Prize message. Built only on what a prize carries: token, winners, time left, claimed count and gates.
     The amount is revealed on claim ("You won 6.2 ICP"). 3D spinning coin with the token mark (paused with reduced motion); confetti bursts from
     the claim area when the prize turns won while it shows (not on the click: the claim may fail).
     state: open | claimed | ended. gates: [{ label, met }]. Any unmet gate → "Requirements not met".
     Without onClaim it marks itself claimed; onClaim gets the click (a claim needs a trusted one). canClaim false offers no Claim
     (the sender, a DM, all claimed). claiming: a claim is on its way, "Claiming…" with a spinner in place of Claim.
     sending: still on its way (its own, before it lands), the card as it will be with "Sending prize…" where Claim would go.
     By hand: `side` (the sent bubble's colours, as PollMessage), `sending` and `claiming`. -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { useT } from '../i18n';
  import Confetti from './Confetti.svelte';
  import RequirementChip from './RequirementChip.svelte';
  import Spinner from './Spinner.svelte';
  import TokenCoin from './TokenCoin.svelte';

  interface Props {
    token: { symbol: string; mark?: string; gradient?: string; edge?: string; edge2?: string };
    winners: number;
    claimed?: number;
    /** Time left, e.g. "4m 12s". */
    endsIn: string;
    endingSoon?: boolean;
    gates?: { label: string; met: boolean }[];
    state?: 'open' | 'claimed' | 'ended';
    /** Shown once won, e.g. "6.2 ICP"; "You won" alone without it. */
    wonAmount?: string;
    /** Whether Claim is offered when the prize is open and its requirements met. */
    canClaim?: boolean;
    /** Still being sent: no Claim, "Sending prize…" in its place. */
    sending?: boolean;
    /** A claim is on its way: no Claim, "Claiming…" with a spinner in its place. */
    claiming?: boolean;
    note?: string;
    side?: 'received' | 'sent';
    time: string;
    lastInGroup?: boolean;
    /** Your own at the inline end (native): the corners mirrored, as ChatBubble's `mirror`. */
    mirror?: boolean;
    onClaim?: (e: MouseEvent) => void;
  }

  let {
    token,
    winners,
    claimed = 0,
    endsIn,
    endingSoon = false,
    gates = [],
    state: status = 'open',
    wonAmount = '',
    canClaim = true,
    sending = false,
    claiming = false,
    note = '',
    side = 'received',
    time,
    lastInGroup = true,
    mirror = false,
    onClaim,
  }: Props = $props();
  const t = useT();

  let claimedHere = $state(false);
  let burst = $state(0);

  const ended = $derived(status === 'ended');
  const won = $derived(status === 'claimed' || claimedHere);
  const blocked = $derived(gates.some((g) => !g.met));
  const taken = $derived(claimed + (claimedHere && status !== 'claimed' ? 1 : 0));

  // confetti once the prize turns won while it shows; one that's already won when it mounts stays still
  let wasWon = untrack(() => won);
  $effect.pre(() => {
    if (won && !wasWon) untrack(() => burst++);
    wasWon = won;
  });

  function claim(e: MouseEvent) {
    if (claiming) return;
    if (onClaim) onClaim(e);
    else claimedHere = true;
  }
</script>

<div class="shell" class:sent={side === 'sent'} class:last={lastInGroup} class:mirror class:ended>
  <div class="stack">
    <div class="hero">
      <span class="coin">
        <TokenCoin
          symbol={token.symbol}
          mark={token.mark ?? token.symbol[0]}
          gradient={token.gradient ?? 'linear-gradient(140deg,#2EE6A8,#1FB6FF)'}
          edge={token.edge ?? '#555'}
          edge2={token.edge2 ?? '#444'}
          size={80}
        ></TokenCoin>
      </span>
      <span class="kicker">{t('ui.prizeMessage.kicker')}</span>
      <span class="headline">{t('ui.prizeMessage.headline', { symbol: token.symbol })}</span>
      <span class="facts">{t('ui.prizeMessage.winners', { count: winners })}<span class="sep"></span><span class="ends" class:soon={endingSoon && !ended}><span class="clock"></span>{ended ? t('ui.prizeMessage.ended') : t('ui.prizeMessage.endsIn', { time: endsIn })}</span></span>
    </div>
    <div class="panel">
      <div class="tally"><span>{taken >= winners ? t('ui.prizeMessage.allClaimed') : t('ui.prizeMessage.left', { left: winners - taken, total: winners })}</span><span class="mono">{taken}/{winners}</span></div>
      <div class="track"><span class="fill" style:width="{Math.min(100, (taken / winners) * 100)}%"></span></div>
    </div>
    {#if gates.length > 0 && !ended}
      <div class="panel">
        <span class="gates-title">{t('ui.prizeMessage.toClaim')}</span>
        <div class="gates" role="list">{#each gates as gate}<RequirementChip label={gate.label} state={gate.met ? 'met' : 'unmet'} />{/each}</div>
      </div>
    {/if}
    <div class="confetti-anchor" aria-hidden="true"><div class="confetti-box"><Confetti fire={burst} /></div></div>
    {#if sending}
      <span class="outcome" role="status"><Spinner size={16} tone="ink" label="ui.prizeMessage.sending" />{t('ui.prizeMessage.sending')}</span>
    {:else if won}
      <span class="outcome won"><span class="outcome-icon check"></span>{wonAmount ? t('ui.prizeMessage.youWon', { amount: wonAmount }) : t('ui.prizeMessage.youWonIt')}</span>
    {:else if claiming}
      <span class="outcome" role="status"><Spinner size={16} tone="ink" label="ui.prizeMessage.claiming" />{t('ui.prizeMessage.claiming')}</span>
    {:else if ended}
      <span class="outcome"><span class="outcome-icon clock"></span>{t('ui.prizeMessage.hasEnded')}</span>
    {:else if blocked}
      <span class="outcome" aria-disabled="true"><span class="outcome-icon lock"></span>{t('ui.prizeMessage.requirementsNotMet')}</span>
    {:else if canClaim}
      <span class="claim" onclick={claim} role="button" tabindex="0"><span class="gift"></span>{t('ui.prizeMessage.claim')}</span>
    {/if}
  </div>
  {#if note}
    <p class="note">{note}<span class="time spacer" aria-hidden="true">{time}</span><span class="time corner">{time}</span></p>
  {:else}
    <div class="time foot">{time}</div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .shell {
    --msg-bg: var(--bubble-recv-bg);
    --msg-ink: var(--ink);
    --msg-text: var(--bubble-recv-text);
    --msg-soft: var(--ink-3);
    --msg-faint: var(--ink-4);
    --msg-kicker: var(--accent-bright);
    --msg-seg: var(--overlay-1);
    --msg-track: var(--overlay-2);
    --msg-fill: var(--accent);
    --msg-glow: color-mix(in oklch, var(--accent) 28%, transparent);
    width: 320px;
    @include message-shell;

    &.sent {
      --msg-bg: var(--bubble-send-bg);
      --msg-ink: var(--bubble-text);
      --msg-text: var(--bubble-text);
      --msg-soft: var(--bubble-text-soft);
      --msg-faint: var(--bubble-text-soft);
      --msg-kicker: var(--bubble-text);
      --msg-seg: rgba(0, 0, 0, 0.18);
      --msg-track: rgba(0, 0, 0, 0.25);
      --msg-fill: #fff;
      --msg-glow: rgba(255, 255, 255, 0.16);
      box-shadow: none;
    }

    &.ended {
      opacity: 0.7;
    }
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 22px 16px 18px;
    border-radius: 2px 18px 6px 6px;

    // mirrored with the shell
    .mirror & {
      border-start-start-radius: 18px;
      border-start-end-radius: 2px;
    }
    background:
      radial-gradient(120% 120% at 50% 0%, var(--msg-glow), transparent 65%),
      var(--msg-seg);
  }

  .coin {
    width: 96px;
    height: 96px;
    @include flex-center;
  }

  .kicker {
    margin-top: 6px;
    font: 600 11.5px/1 var(--font-sans);
    color: var(--msg-kicker);
  }

  .headline {
    font: 700 26px/1 var(--font-sans);
    letter-spacing: -0.02em;
    color: var(--msg-ink);
  }

  .facts {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 500 12.5px/1 var(--font-sans);
    color: var(--msg-soft);
  }

  .sep {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.6;
  }

  .ends {
    display: flex;
    align-items: center;
    gap: 4px;

    &.soon {
      color: var(--status-warning);
    }
  }

  .clock,
  .outcome-icon,
  .gift {
    background: currentColor;
  }

  .ends .clock {
    width: 12px;
    height: 12px;
  }

  .clock {
    mask: var(--icon-clock) center/contain no-repeat;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 6px;
    background: var(--msg-seg);
  }

  .tally {
    display: flex;
    justify-content: space-between;
    font: 500 12px/1 var(--font-sans);
    color: var(--msg-soft);
  }

  .mono {
    font-family: var(--font-mono);
  }

  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--msg-track);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--msg-fill);
    transition: width 0.5s;
  }

  .gates-title {
    font: 600 10.5px/1 var(--font-mono);
    letter-spacing: 0.06em;
    color: var(--msg-faint);
  }

  .gates {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .confetti-anchor {
    position: relative;
    height: 0;
  }

  .confetti-box {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 52px;
    pointer-events: none;
  }

  .claim,
  .outcome {
    @include flex-center;
    gap: 8px;
    height: 52px;
    border-radius: 6px;
  }

  .claim {
    background: var(--accent);
    font: 700 14px/1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
    user-select: none;

    &:hover {
      filter: brightness(1.07);
    }

    &:active {
      transform: scale(0.98);
    }
  }

  .gift {
    width: 16px;
    height: 16px;
    mask: var(--icon-gift) center/contain no-repeat;
  }

  .outcome {
    background: var(--msg-track);
    font: 600 13px/1 var(--font-sans);
    color: var(--msg-soft);

    &.won {
      background: color-mix(in oklch, var(--status-online) 13%, transparent);
      font-size: 13.5px;
      color: var(--status-online);
    }
  }

  .outcome-icon {
    width: 14px;
    height: 14px;
  }

  .check {
    mask: var(--icon-check) center/contain no-repeat;
  }

  .lock {
    mask: var(--icon-lock) center/contain no-repeat;
  }

  .time {
    font: 400 11px/1 var(--font-mono);
    color: var(--msg-faint);
  }

  .foot {
    display: flex;
    justify-content: flex-end;
    padding: 6px 10px 4px;
  }

  .note {
    position: relative;
    margin: 0;
    padding: 10px 10px 8px;
    font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
    color: var(--msg-text);
  }

  /* invisible copy reserves room on the last line so the stamp never overlaps text */
  .spacer {
    visibility: hidden;
    margin-left: 9px;
  }

  .corner {
    position: absolute;
    right: 10px;
    bottom: 8px;
  }
</style>
