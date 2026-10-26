<!-- Crypto transfer: the sign says the direction (+ received, green; − sent; none between two others), USD inline,
     then who it went to if given, "View transaction" opens details. side follows the bubble; direction defaults by it
     (sent = you sent it). Optional caption sits under the card. -->
<script lang="ts">
  import { useT } from '../i18n';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Props {
    side?: 'received' | 'sent';
    /** Formatted amount, without sign or symbol. */
    amount: string;
    symbol: string;
    mark?: string;
    gradient?: string;
    usd: string;
    /** Which way it went for the reader: in (+, green), out (−), or other, between two other people (no sign). Defaults by side. */
    direction?: 'in' | 'out' | 'other';
    /** Who it went to, shown after the USD value ("to Bob"). */
    recipient?: string;
    caption?: string;
    time: string;
    lastInGroup?: boolean;
    onOpen?: () => void;
  }

  let {
    side = 'received',
    amount,
    symbol,
    mark = symbol[0],
    gradient = 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    usd,
    direction,
    recipient = '',
    caption = '',
    time,
    lastInGroup = true,
    onOpen,
  }: Props = $props();
  const t = useT();

  const sent = $derived(side === 'sent');
  const way = $derived(direction ?? (sent ? 'out' : 'in'));
  const sign = $derived(way === 'in' ? '+' : way === 'out' ? '−' : '');
</script>

<div class="shell" class:sent class:last={lastInGroup}>
  <div class="card">
    <div class="head">
      <TokenAvatar {symbol} {mark} {gradient} badge={way === 'in' ? 'receive' : 'send'} size={40} />
      <span class="figures"
        ><span class="amount" class:in={way === 'in'}>{sign}{amount} {symbol}</span><span class="usd"
          >{usd}{#if recipient}{usd ? ' · ' : ''}{t('ui.transferMessage.to', { name: recipient })}{/if}</span
        ></span
      >
    </div>
    <span class="open" onclick={onOpen} role="button" tabindex="0">{t('ui.transferMessage.viewTransaction')}<span class="chevron"></span></span>
  </div>
  {#if caption}
    <p class="caption">{caption}<span class="time spacer" aria-hidden="true">{time}</span><span class="time stamp">{time}</span></p>
  {:else}
    <div class="time footer">{time}</div>
  {/if}
</div>

<style>
  .shell {
    --msg-ink: var(--bubble-recv-text);
    --msg-soft: var(--ink-4);
    --msg-line: var(--line-1);
    width: 280px;
    max-width: 100%;
    padding: 4px;
    box-sizing: border-box;
    border-radius: var(--radius-xs) 22px 22px var(--radius-xs);
    background: var(--bubble-recv-bg);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .shell.last {
    border-bottom-left-radius: 22px;
  }

  .shell.sent {
    --msg-ink: var(--bubble-text);
    --msg-soft: var(--bubble-text-soft);
    --msg-line: rgba(255, 255, 255, 0.14);
    background: var(--bubble-send-bg);
    box-shadow: none;
  }

  .card {
    display: flex;
    flex-direction: column;
    border-radius: 2px 18px 6px 6px;
    background: var(--overlay-1);
    overflow: hidden;
  }

  .sent .card {
    background: rgba(0, 0, 0, 0.18);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 14px 12px;
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
    font: 700 19px/1 var(--font-sans);
    letter-spacing: -0.01em;
    color: var(--msg-ink);
  }

  .amount.in {
    color: var(--status-online);
  }

  .sent .amount {
    color: var(--bubble-text);
  }

  .usd {
    font: 400 12.5px/1 var(--font-sans);
    color: var(--msg-soft);
  }

  .open {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 14px;
    border-top: 1px solid var(--msg-line);
    font: 600 12.5px/1 var(--font-sans);
    color: var(--msg-soft);
    cursor: pointer;
  }

  .open:hover {
    color: var(--msg-ink);
  }

  .chevron {
    width: 12px;
    height: 12px;
    background: currentColor;
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .caption {
    position: relative;
    margin: 0;
    padding: 10px 10px 8px;
    font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
    color: var(--msg-ink);
    text-wrap: pretty;
  }

  .time {
    font: 400 11px/1 var(--font-mono);
    color: var(--msg-soft);
  }

  /* invisible copy reserves room on the last line so the stamp never overlaps text */
  .spacer {
    display: inline-flex;
    visibility: hidden;
    align-items: center;
    gap: 4px;
    margin-left: 9px;
  }

  .stamp {
    position: absolute;
    right: 10px;
    bottom: 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    padding: 6px 10px 4px;
  }
</style>
