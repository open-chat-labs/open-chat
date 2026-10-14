<!-- Text message bubble: optional reply quote, forwarded tag, code block, text with an inline time/status stamp,
     failed + Retry line, thread link and reaction chips. Emoji-only messages of one or two emoji render large.
     Reaction chips are limited to maxReactionRows; the rest fold into a "+N" chip that expands them. -->
<script lang="ts">
  import { untrack } from 'svelte';

  // count grapheme clusters so flags, skin tones and ZWJ families read as one emoji
  const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const EMOJI_RE = /\p{Extended_Pictographic}/u;

  function emojiOnlyCount(text: string) {
    const t = text.trim();
    if (!t || !EMOJI_RE.test(t)) return 0;
    const units = SEG ? [...SEG.segment(t)].map((s) => s.segment) : [...t];
    const glyphs = units.filter((u) => u.trim() !== '');
    // every visible cluster must be pictographic — no mixed text
    return glyphs.length && glyphs.every((g) => EMOJI_RE.test(g)) ? glyphs.length : 0;
  }

  const STATUS: Record<string, string> = { sending: 'clock', sent: 'check', delivered: 'check-double', failed: 'failed' };

  interface Reaction {
    emoji: string;
    count: number;
    mine?: boolean;
  }

  interface Props {
    text: string;
    time: string;
    side?: 'sent' | 'received';
    lastInGroup?: boolean;
    status?: 'sending' | 'sent' | 'delivered' | 'failed';
    /** Shown under a failed message; defaults by side. */
    failedText?: string;
    retryAction?: () => void;
    /** Shown above the text, as in pasted snippets. */
    code?: string;
    forwarded?: boolean;
    edited?: boolean;
    deleted?: boolean;
    deletedText?: string;
    /** Reply quote: who wrote the quoted message ("You" for your own). */
    quoteName?: string;
    quoteText?: string;
    reactions?: Reaction[];
    maxReactionRows?: number;
    onToggleReaction?: (emoji: string) => void;
    onShowAllReactions?: () => void;
    threadCount?: number;
    threadLastAt?: string;
    onOpenThread?: () => void;
  }

  let {
    text,
    time,
    side = 'sent',
    lastInGroup = true,
    status = 'delivered',
    failedText = '',
    retryAction,
    code = '',
    forwarded = false,
    edited = false,
    deleted = false,
    deletedText = 'This message was deleted',
    quoteName = '',
    quoteText = '',
    reactions = [],
    maxReactionRows = 1,
    onToggleReaction,
    onShowAllReactions,
    threadCount = 0,
    threadLastAt = '',
    onOpenThread,
  }: Props = $props();

  const sent = $derived(side === 'sent');
  const emojiCount = $derived(emojiOnlyCount(text));
  const scale = $derived(
    emojiCount === 1 ? { size: '42px', leading: '1.15' } : emojiCount === 2 ? { size: '32px', leading: '1.2' } : { size: 'var(--text-base)', leading: '1.5' },
  );

  // fit === null renders every chip so their rows can be measured
  let fit = $state<number | null>(null);
  let expanded = $state(false);
  let chips = $state<HTMLDivElement>();
  let bubble = $state<HTMLDivElement>();

  const shown = $derived(fit === null || expanded ? reactions : reactions.slice(0, fit));
  const hidden = $derived(reactions.length - shown.length);

  // no arithmetic: let the browser wrap, read how many rows it actually used,
  // and drop one chip per pass until it fits. Monotonic, so it always terminates.
  $effect(() => {
    shown;
    const el = chips;
    if (!el || untrack(() => expanded)) return;
    const kids = [...el.children];
    if (!kids.length) return;
    const rows = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top))).size;
    if (rows <= Math.max(1, maxReactionRows)) return;
    const count = untrack(() => (fit === null ? reactions.length : fit));
    if (count > 1) fit = count - 1;
  });

  // the bubble's width is set by the message text, so it is a stable trigger:
  // observing the chip row instead would feed the chip count back into its own constraint
  $effect(() => {
    const el = bubble;
    if (!el) return;
    let last = el.getBoundingClientRect().width;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (!w || Math.abs(w - last) < 1) return;
      last = w;
      if (!untrack(() => expanded)) fit = null; // show all, then converge down again
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

{#snippet stamp()}{edited ? 'edited · ' : ''}{time}{#if sent}<span class="tick" style:mask="var(--icon-{STATUS[status] ?? 'check-double'}) center/contain no-repeat"></span>{/if}{/snippet}

<div class="wrap">
  {#if deleted}
    <div class="deleted" class:sent>
      <span class="trash"></span>
      <span class="deleted-text">{deletedText}</span>
      <span class="deleted-time">{time}</span>
    </div>
  {:else}
    <div class="column" class:sent>
      <div class="bubble" class:last={lastInGroup} bind:this={bubble} data-oc-bubble>
        {#if quoteName}
          <div class="quote">
            <span class="quote-bar"></span>
            <div class="quote-body">
              <div class="quote-name">{quoteName}</div>
              <div class="quote-text">{quoteText}</div>
            </div>
          </div>
        {/if}
        {#if forwarded}
          <div class="forwarded"><span class="forward-icon"></span><span class="forward-label">Forwarded</span></div>
        {/if}
        {#if code}
          <pre class="code">{code}</pre>
        {/if}
        <p class="text" style:font-size={scale.size} style:line-height={scale.leading}>{text}<span class="stamp spacer" aria-hidden="true">{@render stamp()}</span><span class="stamp corner">{@render stamp()}</span></p>
      </div>
      {#if status === 'failed'}
        <div class="failed">
          <span class="failed-text">{failedText || (sent ? 'Not delivered' : "Couldn't load")}</span>
          <span class="retry" onclick={retryAction} role="button" tabindex="0">Retry</span>
        </div>
      {/if}
      {#if threadCount > 0}
        <div class="thread" onclick={onOpenThread} role="button" tabindex="0">
          <span class="thread-icon" data-oc-flip></span>
          <span class="thread-count">{threadCount === 1 ? '1 reply' : `${threadCount} replies`}</span>
          <span class="thread-meta">{threadLastAt ? `Last reply ${threadLastAt}` : ''}</span>
        </div>
      {/if}
      {#if reactions.length > 0}
        <div class="reactions" class:after-thread={threadCount > 0} bind:this={chips}>
          {#each shown as r}
            <span
              class="chip"
              class:mine={r.mine}
              data-oc-chip
              onclick={() => onToggleReaction?.(r.emoji)}
              role="button"
              tabindex="0"
              aria-pressed={!!r.mine}
              aria-label="{r.mine ? 'Remove your ' : 'Add '}{r.emoji} · {r.count}">{r.emoji} {r.count}</span
            >
          {/each}
          {#if hidden > 0}
            <span
              class="chip-more"
              data-oc-more
              onclick={() => {
                onShowAllReactions?.();
                expanded = true;
                fit = null;
              }}
              role="button"
              tabindex="0">+{hidden}</span
            >
          {/if}
          {#if expanded}
            <span
              class="collapse"
              onclick={() => {
                expanded = false;
                fit = null;
              }}
              role="button"
              tabindex="0"><span class="collapse-icon"></span></span
            >
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap {
    width: 100%;
    display: flex;
    justify-content: flex-start;
  }

  .deleted {
    max-width: 675px;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-12) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-xs) var(--radius-xl) var(--radius-xl) var(--radius-xl);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .deleted.sent {
    border-radius: var(--radius-xl) var(--radius-xs) var(--radius-xl) var(--radius-xl);
  }

  .trash {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink-4, #6e6e7c);
    mask: var(--icon-trash) center/contain no-repeat;
  }

  .deleted-text {
    font: var(--weight-regular) var(--text-base) / 1.4 var(--font-sans);
    font-style: italic;
    color: var(--ink-4, #6e6e7c);
  }

  .deleted-time {
    flex: none;
    margin-inline-start: var(--space-6);
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4, #6e6e7c);
  }

  .column {
    --msg-ink: var(--bubble-recv-text, #e4e4ec);
    --msg-soft: var(--ink-3, #8a8a99);
    --msg-stamp: var(--meta, #9393a2);
    max-width: 675px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .column.sent {
    --msg-ink: var(--bubble-text, #fff);
    --msg-soft: var(--bubble-text-soft, rgba(255, 255, 255, 0.82));
    --msg-stamp: var(--bubble-text-soft, rgba(255, 255, 255, 0.82));
  }

  /* every bubble is left-aligned, so the avatar-facing edge is inline-start for both sides */
  /* never wider than its column: nowrap quote lines would otherwise set the bubble's minimum width */
  .bubble {
    box-sizing: border-box;
    max-width: 100%;
    text-align: start;
    background: var(--bubble-recv-bg, #191921);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    border-start-start-radius: var(--radius-xs);
    border-start-end-radius: var(--radius-xl);
    border-end-end-radius: var(--radius-xl);
    border-end-start-radius: var(--radius-xs);
    padding: var(--space-12) var(--space-14);
  }

  .bubble.last {
    border-end-start-radius: var(--radius-xl);
  }

  .sent .bubble {
    background: var(--bubble-send-bg, #b83e52);
    box-shadow: none;
  }

  /* received: a tinted panel with an accent bar; sent: the bubble's own reply shade */
  .quote {
    --quote-bg: var(--overlay-2, rgba(255, 255, 255, 0.07));
    --quote-bar: var(--accent, #ff5672);
    --quote-name: var(--accent-bright, #ff8298);
    --quote-text: var(--ink-3, #8a8a99);
    display: flex;
    gap: var(--space-8);
    padding: var(--space-8) var(--space-10);
    border-radius: var(--radius-md);
    background: var(--quote-bg);
    margin: -5px -6px 8px;
  }

  .sent .quote {
    --quote-bg: var(--bubble-reply, #8c2a3d);
    --quote-bar: var(--bubble-text-soft, rgba(255, 255, 255, 0.6));
    --quote-name: var(--bubble-text, #fff);
    --quote-text: var(--bubble-text-soft, rgba(255, 255, 255, 0.78));
  }

  .quote-bar {
    flex: none;
    width: 4px;
    border-radius: var(--radius-pill);
    background: var(--quote-bar);
  }

  .quote-body {
    min-width: 0;
  }

  .quote-name {
    font: var(--weight-bold) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--quote-name);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quote-text {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--quote-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .forwarded {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .forward-icon {
    flex: none;
    width: 12px;
    height: 12px;
    background: var(--msg-soft);
    mask: var(--icon-forward) center/contain no-repeat;
  }

  .forward-label {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    font-style: italic;
    color: var(--msg-soft);
  }

  .code {
    margin: 0 0 var(--space-6);
    padding: var(--space-10) var(--space-12);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.28);
    max-width: 100%;
    box-sizing: border-box;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: var(--weight-regular) var(--text-sm) / 1.55 var(--font-mono);
    color: var(--status-online, #2ee6a8);
  }

  .sent .code {
    color: var(--bubble-text, #fff);
  }

  .text {
    position: relative;
    margin: 0;
    font-family: var(--font-sans);
    font-weight: var(--weight-regular);
    color: var(--msg-ink);
    text-wrap: pretty;
    overflow-wrap: anywhere;
  }

  .stamp {
    display: inline-flex;
    align-items: flex-end;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--msg-stamp);
  }

  .sent .stamp {
    gap: var(--space-4);
  }

  /* invisible copy reserves room on the last line so the stamp never overlaps text */
  .spacer {
    visibility: hidden;
    vertical-align: bottom;
    margin-block-end: -1px;
    margin-inline-start: 9px;
  }

  .corner {
    position: absolute;
    inset-inline-end: 0;
    bottom: 0;
  }

  .tick {
    width: 14px;
    height: 14px;
    margin-bottom: -2px;
    background: var(--bubble-tick, rgba(255, 255, 255, 0.9));
  }

  .failed {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    margin-top: var(--space-6);
    padding-inline-start: var(--space-14);
  }

  .sent .failed {
    padding-inline-start: 0;
    padding-inline-end: var(--space-14);
  }

  .failed-text,
  .retry {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .retry {
    font-weight: var(--weight-semibold);
    text-decoration: underline;
    cursor: pointer;
  }

  .thread {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    margin-top: var(--space-6);
    min-height: var(--control-sm, 30px);
    padding: var(--space-6) var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    cursor: pointer;
    align-self: flex-start;
  }

  .thread:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .thread-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--accent, #ff5672);
    mask: var(--icon-reply) center/contain no-repeat;
  }

  .thread-count,
  .thread-meta {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    white-space: nowrap;
  }

  .thread-meta {
    font-weight: var(--weight-regular);
    color: var(--ink-3, #8a8a99);
  }

  .reactions {
    width: 0;
    min-width: 100%;
    box-sizing: border-box;
    padding-inline-start: 8px;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: var(--space-4);
    margin-top: -9px;
    position: relative;
    z-index: 2;
  }

  .reactions.after-thread {
    margin-top: var(--space-6);
  }

  /* chips overlap the bubble's bottom edge, so their backgrounds are opaque */
  .chip {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-6) var(--space-8);
    border-radius: var(--radius-pill);
    background: var(--card-2, #191921);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    cursor: pointer;
    user-select: none;
  }

  .chip.mine {
    background: color-mix(in oklch, var(--accent, #ff5672) 20%, var(--card-2, #191921));
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 55%, transparent);
    color: var(--ink, #ececf1);
  }

  .chip:hover {
    filter: brightness(1.15);
  }

  .chip:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .chip-more,
  .collapse {
    display: flex;
    align-items: center;
    border-radius: var(--radius-pill);
    background: var(--card-2, #191921);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    cursor: pointer;
  }

  .chip-more {
    padding: var(--space-6) var(--space-8);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    white-space: nowrap;
  }

  .collapse {
    justify-content: center;
    height: 24px;
    min-width: 24px;
    box-sizing: border-box;
  }

  .chip-more:hover,
  .collapse:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .collapse-icon {
    width: 10px;
    height: 10px;
    background: var(--ink-2, #b9b9c6);
    mask: var(--icon-close) center/contain no-repeat;
  }
</style>
