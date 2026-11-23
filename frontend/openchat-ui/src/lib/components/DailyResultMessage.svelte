<!-- A daily puzzle's result shared into a chat (by hand, 2026-11-23; not in the design export): its title ("The Daily #12")
     and game over the puzzle's grid (the host's `preview`), its time, hints and day streak beside it, and whether those
     were checked (`verification`: none while it's being checked, "Verified" with a tick, or "Unverified", the stats
     faded). `note` stands in for the grid where the host can't draw it ("needs a newer app"); `playLabel` with `onPlay`
     offers today's puzzle. Optional caption under the card, as TransferMessage's. Its words are the host's (resource
     keys or literal text). -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useT } from '../i18n';
  import ReplyQuote from './ReplyQuote.svelte';

  interface Stat {
    /** The value shown ("1:23", "2"); "–" while it isn't known. */
    value: string;
    /** Resource key (or literal text): what it is ("Time"). */
    label: string;
    /** Tabular figures (a time). */
    mono?: boolean;
  }

  interface Props {
    side?: 'received' | 'sent';
    /** Resource key (or literal text): "The Daily #12". */
    title: string;
    /** Resource key (or literal text): the game, and its tier ("Bridges · Tricky"). */
    subtitle?: string;
    /** The puzzle's grid, drawn by the host in a square beside the stats. */
    preview?: Snippet;
    stats: Stat[];
    /** Whether the stats were checked: none shown while pending. */
    verification?: 'pending' | 'verified' | 'unverified';
    /** Resource key (or literal text) for "Verified" / "Unverified". */
    verifiedLabel?: string;
    unverifiedLabel?: string;
    /** Resource key (or literal text) under the card in place of Play ("This puzzle type needs a newer app"). */
    note?: string;
    /** Resource key (or literal text): Play, shown with onPlay. */
    playLabel?: string;
    onPlay?: () => void;
    caption?: string;
    time: string;
    lastInGroup?: boolean;
    /** Your own at the inline end (native): the corners mirrored, as ChatBubble's `mirror`. */
    mirror?: boolean;
    /** Reply quote (ReplyQuote, as ChatBubble's): who wrote the quoted message ("You" for your own), at the top of the message. */
    quoteName?: string;
    quoteText?: string;
    /** The quote tapped: the host goes to the quoted message. Without it the quote is only shown. */
    onQuote?: () => void;
  }

  let {
    side = 'received',
    title,
    subtitle = '',
    preview,
    stats,
    verification = 'pending',
    verifiedLabel = 'ui.dailyResultMessage.verified',
    unverifiedLabel = 'ui.dailyResultMessage.unverified',
    note = '',
    playLabel = '',
    onPlay,
    caption = '',
    time,
    lastInGroup = true,
    mirror = false,
    quoteName = '',
    quoteText = '',
    onQuote,
  }: Props = $props();
  const t = useT();

  const sent = $derived(side === 'sent');
</script>

<div class="shell" class:sent class:last={lastInGroup} class:mirror data-bubble-sent={sent ? '' : undefined}>
  {#if quoteName}<ReplyQuote name={quoteName} text={quoteText} sent={side === 'sent'} tile {mirror} onOpen={onQuote} />{/if}
  <div class="card">
    <div class="head">
      <span class="title">{t(title)}</span>
      {#if subtitle}<span class="subtitle">{t(subtitle)}</span>{/if}
    </div>
    <div class="body">
      {#if preview}<div class="preview">{@render preview()}</div>{/if}
      <div class="stats" class:unverified={verification === 'unverified'}>
        {#each stats as stat}
          <span class="stat"><span class="value" class:mono={stat.mono}>{stat.value}</span><span class="label">{t(stat.label)}</span></span>
        {/each}
        {#if verification !== 'pending'}
          <span class="check" class:verified={verification === 'verified'}
            ><span class="check-icon" aria-hidden="true"></span>{t(verification === 'verified' ? verifiedLabel : unverifiedLabel)}</span
          >
        {/if}
      </div>
    </div>
    {#if note}
      <p class="note">{t(note)}</p>
    {:else if playLabel && onPlay}
      <button type="button" class="play" onclick={onPlay}>{t(playLabel)}<span class="chevron"></span></button>
    {/if}
  </div>
  {#if caption}
    <p class="caption">{caption}<span class="time spacer" aria-hidden="true">{time}</span><span class="time stamp">{time}</span></p>
  {:else}
    <div class="time footer">{time}</div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .shell {
    --msg-ink: var(--bubble-recv-text);
    --msg-soft: var(--ink-4);
    --msg-line: var(--line-1);
    width: 320px;
    max-width: 100%;
    @include message-shell(var(--bubble-recv-bg));

    &.sent {
      --msg-ink: var(--bubble-text);
      --msg-soft: var(--bubble-text-soft);
      --msg-line: rgba(255, 255, 255, 0.14);
      background: var(--bubble-send-bg);
      box-shadow: var(--bubble-shadow);
    }
  }

  .card {
    display: flex;
    flex-direction: column;
    border-radius: 2px 18px 6px 6px;
    background: var(--overlay-1);
    overflow: hidden;

    // mirrored with the shell
    .mirror & {
      border-start-start-radius: 18px;
      border-start-end-radius: 2px;
    }

    .sent & {
      background: rgba(0, 0, 0, 0.18);
    }
  }

  /* under a reply quote (the card's first tile then), its top corners are a tile's */
  .shell:has(> :global(.reply-quote)) > .card {
    border-start-start-radius: 6px;
    border-start-end-radius: 6px;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 14px 0;
  }

  .title {
    font: 700 17px/1.2 var(--font-sans);
    color: var(--msg-ink);
  }

  .subtitle {
    font: 600 11px/1.2 var(--font-sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--msg-soft);
  }

  .body {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 14px 14px;
  }

  .preview {
    flex: 0 0 132px;
    width: 132px;
    height: 132px;
    color: var(--msg-ink);
  }

  .stats {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;

    &.unverified .stat {
      opacity: 0.5;
    }
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .value {
    font: 700 18px/1 var(--font-sans);
    color: var(--msg-ink);

    &.mono {
      font-variant-numeric: tabular-nums;
    }
  }

  .label {
    font: 600 10.5px/1.2 var(--font-sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--msg-soft);
  }

  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: 600 11.5px/1.2 var(--font-sans);
    color: var(--msg-soft);

    &.verified {
      color: var(--status-online);

      .sent & {
        color: var(--bubble-text);
      }
    }
  }

  .check-icon {
    @include icon(info, 13px, $flex: null);

    .verified & {
      @include icon(circle-check, 13px, $flex: null);
    }
  }

  .note {
    margin: 0;
    padding: 10px 14px;
    border-top: 1px solid var(--msg-line);
    font: 400 12.5px/1.4 var(--font-sans);
    color: var(--msg-soft);
  }

  .play {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 14px;
    border: none;
    border-top: 1px solid var(--msg-line);
    background: none;
    font: 600 12.5px/1 var(--font-sans);
    color: var(--msg-soft);
    cursor: pointer;

    &:hover,
    &:focus-visible {
      color: var(--msg-ink);
    }
  }

  .chevron {
    @include icon(chevron-right, 12px, $flex: null);
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
