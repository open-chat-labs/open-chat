<!-- Swap offer, read from the viewer's side: what leaves your wallet (−) on top, what arrives (+) below, joined by an arrow.
     state: open | pending (taken, not yet settled) | done | cancelled | expired. Your own offer (side 'sent') shows Cancel offer as a quiet segment; others' offers show accent Accept swap. -->
<script lang="ts">
  import { useT } from '../i18n';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Leg {
    /** Formatted amount, without sign or symbol. */
    amount: string;
    symbol: string;
    mark?: string;
    usd?: string;
    gradient?: string;
  }

  interface Props {
    side?: 'received' | 'sent';
    /** pending: taken and on its way, doneText says how; cancelled reads like expired. */
    state?: 'open' | 'pending' | 'done' | 'cancelled' | 'expired';
    /** What leaves the viewer's wallet. */
    give: Leg;
    /** What arrives. */
    get: Leg;
    /** Open offers: time left, e.g. "9d 21h". */
    expiresIn?: string;
    /** Resource key (or literal text). */
    doneText?: string;
    time: string;
    lastInGroup?: boolean;
    onAccept?: () => void;
    onCancel?: () => void;
  }

  let { side = 'received', state = 'open', give, get, expiresIn = '', doneText = 'ui.swapOffer.swapped', time, lastInGroup = true, onAccept, onCancel }: Props = $props();
  const t = useT();

  const sent = $derived(side === 'sent');
  const WHEN = { pending: 'ui.swapOffer.inProgress', done: 'ui.swapOffer.finished', cancelled: 'ui.swapOffer.cancelled', expired: 'ui.swapOffer.expired' };
  const when = $derived(state === 'open' ? (expiresIn ? t('ui.swapOffer.timeLeft', { time: expiresIn }) : '') : t(WHEN[state]));
  const legs = $derived([
    { leg: give, sign: '−', incoming: false },
    { leg: get, sign: '+', incoming: true },
  ]);
</script>

<div class="shell" class:sent class:last={lastInGroup} class:expired={state === 'expired' || state === 'cancelled'}>
  <div class="stack">
    <div class="head"><span class="label"><span class="swap-icon"></span><span class="grow">{t('ui.swapOffer.title')}</span><span class="when">{when}</span></span></div>
    <div class="legs">
      {#each legs as { leg, sign, incoming }}
        <div class="leg">
          <TokenAvatar symbol={leg.symbol} mark={leg.mark ?? leg.symbol[0]} gradient={leg.gradient} size={40} />
          <span class="figures"><span class="amount" class:incoming>{sign}{leg.amount} {leg.symbol}</span><span class="usd">{leg.usd ?? ''}</span></span>
        </div>
      {/each}
      <span class="arrow" aria-hidden="true"><span class="arrow-icon"></span></span>
    </div>
    {#if state === 'open'}
      <span class="action" onclick={sent ? onCancel : onAccept} role="button" tabindex="0">{t(sent ? 'ui.swapOffer.cancelOffer' : 'ui.swapOffer.acceptSwap')}</span>
    {:else if state === 'done'}
      <span class="done"><span class="check"></span>{t(doneText)}</span>
    {:else if state === 'pending'}
      <span class="done pending">{t(doneText)}</span>
    {/if}
  </div>
  <div class="time">{time}</div>
</div>

<style>
  .shell {
    --msg-bg: var(--bubble-recv-bg);
    --msg-ink: var(--bubble-recv-text);
    --msg-soft: var(--ink-4);
    --msg-seg: var(--overlay-1);
    width: 300px;
    max-width: 100%;
    padding: 4px;
    box-sizing: border-box;
    border-radius: var(--radius-xs) 22px 22px var(--radius-xs);
    background: var(--msg-bg);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .shell.last {
    border-bottom-left-radius: 22px;
  }

  .shell.sent {
    --msg-bg: var(--bubble-send-bg);
    --msg-ink: var(--bubble-text);
    --msg-soft: var(--bubble-text-soft);
    --msg-seg: rgba(0, 0, 0, 0.18);
    box-shadow: none;
  }

  .shell.expired {
    opacity: 0.65;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .head {
    padding: 10px 10px 0;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 500 12px/1 var(--font-sans);
    color: var(--msg-soft);
  }

  .swap-icon {
    width: 12px;
    height: 12px;
    background: currentColor;
    mask: var(--icon-swap) center/contain no-repeat;
  }

  .grow {
    flex: 1;
  }

  .when {
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .legs {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .leg {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 6px;
    background: var(--msg-seg);
  }

  .figures {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .amount {
    font: 700 18px/1 var(--font-sans);
    letter-spacing: -0.01em;
    color: var(--msg-ink);
  }

  .shell:not(.sent) .amount.incoming {
    color: var(--status-online);
  }

  .usd {
    font: 400 12.5px/1 var(--font-sans);
    color: var(--msg-soft);
  }

  .arrow {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 28px;
    height: 28px;
    margin: -14px 0 0 -14px;
    border-radius: 50%;
    background: var(--msg-bg);
    box-shadow: 0 0 0 3px var(--msg-bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .arrow-icon {
    width: 14px;
    height: 14px;
    background: var(--msg-ink);
    mask: var(--icon-arrow-down) center/contain no-repeat;
  }

  .action,
  .done {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    border-radius: 6px;
  }

  .action {
    background: var(--accent);
    font: 600 13.5px/1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
  }

  .sent .action {
    background: rgba(0, 0, 0, 0.18);
    color: var(--bubble-text);
  }

  .action:hover {
    filter: brightness(1.08);
  }

  .done {
    gap: 6px;
    background: var(--msg-seg);
    font: 600 12.5px/1 var(--font-sans);
    color: var(--status-online);
  }

  .done.pending {
    color: var(--msg-soft);
  }

  .check {
    width: 13px;
    height: 13px;
    background: currentColor;
    mask: var(--icon-check) center/contain no-repeat;
  }

  .time {
    display: flex;
    justify-content: flex-end;
    padding: 6px 10px 4px;
    font: 400 11px/1 var(--font-mono);
    color: var(--msg-soft);
  }
</style>
