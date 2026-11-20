<!-- Text message bubble: optional reply quote, forwarded tag, code block, text with an inline time/status stamp,
     link preview cards (LinkCard) under the text: with any, the bubble takes LinkPreview's shape (its 320px width,
     cards flush to a 4px inset, the stamp in a footer under them), and an X on each card for the sender with onRemovePreview,
     failed + Retry line, reaction chips and the thread link under them. By hand (web 5a): video players for its links
     (PlayerCard, a Twitch link's) before the cards, in a wider bubble (534px, the least a player plays at and more). Emoji-only messages of one or two emoji render large.
     Reaction chips are limited to maxReactionRows; the rest fold into a "+N" chip that expands them. -->
<script lang="ts">
  import { useT } from '../i18n';
  import type { ComponentProps, Snippet } from 'svelte';
  import LinkCard from './LinkCard.svelte';
  import PlayerCard from './PlayerCard.svelte';
  import ReactionChips, { type Reaction, type Tip } from './ReactionChips.svelte';
  import ReplyQuote from './ReplyQuote.svelte';
  import ThreadLink from './ThreadLink.svelte';

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

  interface Props {
    text: string;
    /** The text as the host renders it (markdown, mentions, links), shown in its place. `text` still sizes emoji-only messages. */
    body?: Snippet;
    time: string;
    side?: 'sent' | 'received';
    lastInGroup?: boolean;
    /** Right-aligned layouts (native sent bubbles): the bubble, its reactions and its thread link at the inline end, its grouped / tail corners on that side. */
    mirror?: boolean;
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
    /** The quote tapped: the host goes to the quoted message. Without it the quote is only shown. */
    onQuote?: () => void;
    reactions?: Reaction[];
    maxReactionRows?: number;
    onToggleReaction?: (emoji: string) => void;
    onShowAllReactions?: () => void;
    /** The tips the message got, a chip per token before its reactions (by hand, web 5a). */
    tips?: Tip[];
    /** Replies in the message's thread: the thread link under the reactions. */
    threadCount?: number;
    threadLastAt?: string;
    /** Up to three of those in the thread, as CSS backgrounds (colours or gradients); the reply arrow without them. */
    threadFaces?: string[];
    /** Unread replies: "· N new" after the count. */
    threadNew?: number;
    /** Its thread is the one open: the link on the accent. */
    threadActive?: boolean;
    onOpenThread?: () => void;
    /** Previews of the links in the text, a card each under it. */
    previews?: Omit<ComponentProps<typeof LinkCard>, 'side'>[];
    /** The sender removes a preview (by its index in `previews`): an X on each card. None without it. */
    onRemovePreview?: (index: number) => void;
    /** Video players for the links in the text (a Twitch link's), before the cards; the bubble widens for them. */
    players?: Omit<ComponentProps<typeof PlayerCard>, 'side'>[];
  }

  let {
    text,
    body,
    time,
    side = 'sent',
    lastInGroup = true,
    mirror = false,
    status = 'delivered',
    failedText = '',
    retryAction,
    code = '',
    forwarded = false,
    edited = false,
    deleted = false,
    deletedText = 'ui.chatBubble.deleted',
    quoteName = '',
    quoteText = '',
    onQuote,
    reactions = [],
    maxReactionRows = 1,
    onToggleReaction,
    onShowAllReactions,
    tips = [],
    threadCount = 0,
    threadLastAt = '',
    threadFaces = [],
    threadNew = 0,
    threadActive = false,
    onOpenThread,
    previews = [],
    onRemovePreview,
    players = [],
  }: Props = $props();
  const t = useT();

  const sent = $derived(side === 'sent');
  const carded = $derived(previews.length > 0 || players.length > 0);
  const emojiCount = $derived(emojiOnlyCount(text));
  const scale = $derived(
    emojiCount === 1 ? { size: '42px', leading: '1.15' } : emojiCount === 2 ? { size: '32px', leading: '1.2' } : { size: 'var(--text-base)', leading: '1.5' },
  );

  // the stamp's width, for a body ending in a list to keep its room (below)
  let stampWidth = $state(0);

</script>

{#snippet stamp()}{edited ? t('ui.chatBubble.edited') + ' · ' : ''}{time}{#if sent}<span class="tick" style:mask="var(--icon-{STATUS[status] ?? 'check-double'}) center/contain no-repeat"></span>{/if}{/snippet}

<div class="wrap" class:mirror>
  {#if deleted}
    <div class="deleted" class:mirror>
      <span class="trash"></span>
      <span class="deleted-text">{t(deletedText)}</span>
      <span class="deleted-time">{time}</span>
    </div>
  {:else}
    <div class="column" class:sent class:mirror>
      <div class="bubble" class:last={lastInGroup} class:mirror class:carded class:players={players.length > 0} data-oc-bubble data-bubble-sent={side === 'sent' ? '' : undefined}>
        {#if quoteName}
          <ReplyQuote name={quoteName} text={quoteText} {sent} onOpen={onQuote} />
        {/if}
        {#if forwarded}
          <div class="forwarded"><span class="forward-icon"></span><span class="forward-label">{t('ui.chatBubble.forwarded')}</span></div>
        {/if}
        {#if code}
          <pre class="code">{code}</pre>
        {/if}
        {#if body}
          <div class="text body" style:font-size={scale.size} style:line-height={scale.leading} style:--oc-stamp-room="{stampWidth + 9}px">{@render body()}{#if !carded}<span class="stamp spacer" aria-hidden="true">{@render stamp()}</span><span class="stamp corner" bind:offsetWidth={stampWidth}>{@render stamp()}</span>{/if}</div>
        {:else}
          <p class="text" style:font-size={scale.size} style:line-height={scale.leading}>{text}{#if !carded}<span class="stamp spacer" aria-hidden="true">{@render stamp()}</span><span class="stamp corner">{@render stamp()}</span>{/if}</p>
        {/if}
        {#if carded}
          <div class="previews">
            {#each players as p}
              <PlayerCard {...p} {side} />
            {/each}
            {#each previews as p, i}
              <div class="preview">
                <LinkCard {...p} {side} />
                {#if onRemovePreview}
                  <button class="remove" type="button" aria-label={t('ui.chatBubble.removePreview')} title={t('ui.chatBubble.removePreview')} onclick={() => onRemovePreview(i)}></button>
                {/if}
              </div>
            {/each}
          </div>
          <div class="meta"><span class="stamp">{@render stamp()}</span></div>
        {/if}
      </div>
      {#if status === 'failed'}
        <div class="failed">
          <span class="failed-text">{t(failedText || (sent ? 'ui.chatBubble.notDelivered' : 'ui.chatBubble.couldNotLoad'))}</span>
          <span class="retry" onclick={retryAction} role="button" tabindex="0">{t('ui.common.retry')}</span>
        </div>
      {/if}
      <ReactionChips {reactions} {tips} maxRows={maxReactionRows} {mirror} onToggle={onToggleReaction} onShowAll={onShowAllReactions} />
      <!-- the thread under the reactions, which overlap the bubble's edge (pass 8) -->
      {#if threadCount > 0}
        <ThreadLink
          count={threadCount}
          lastAt={threadLastAt}
          faces={threadFaces}
          newCount={threadNew}
          active={threadActive}
          {mirror}
          onOpen={onOpenThread}
        />
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .wrap {
    width: 100%;
    display: flex;
    justify-content: flex-start;

    /* a right-aligned layout (native sent bubbles): the bubble, and what's under it, at the inline end */
    &.mirror {
      justify-content: flex-end;
    }
  }

  .deleted {
    max-width: 675px;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-12) var(--space-14);
    box-sizing: border-box;
    /* the bubble's shape whoever sent it, as every bubble on the web (all on the inline-start side) */
    border-radius: var(--radius-xl);
    border-start-start-radius: var(--radius-xs);
    box-shadow: inset 0 0 0 1px var(--line-2);

    /* mirrored, like the bubble (your own on the inline-end side: mobile, native): the grouped
       corner on the inline-end side */
    &.mirror {
      border-start-start-radius: var(--radius-xl);
      border-start-end-radius: var(--radius-xs);
    }
  }

  .trash {
    @include icon(trash, 14px, var(--ink-4));
  }

  .deleted-text {
    font: var(--weight-regular) var(--text-base) / 1.4 var(--font-sans);
    font-style: italic;
    color: var(--ink-4);
  }

  .deleted-time {
    flex: none;
    margin-inline-start: var(--space-6);
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .column {
    --msg-ink: var(--bubble-recv-text);
    --msg-soft: var(--ink-3);
    --msg-stamp: var(--meta);
    --msg-link: var(--accent-bright);
    /* the message-link mixin's weight, for a link the mixin can't reach (in a host's shadow root, e.g. a spoiler) and
       an @user mention (the app's <profile-link>, whose inline style takes it, else bold); global.css sets it for the
       whole page too, and lets a bold run (strong, b, a heading) keep its own weight */
    --msg-link-weight: var(--weight-semibold);
    max-width: 675px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    &.sent {
      --msg-ink: var(--bubble-text);
      --msg-soft: var(--bubble-text-soft);
      --msg-stamp: var(--bubble-text-soft);
      --msg-link: var(--bubble-text);
    }

    &.mirror {
      align-items: flex-end;
    }
  }

  /* every bubble is left-aligned, so the avatar-facing edge is inline-start for both sides */
  /* never wider than its column: nowrap quote lines would otherwise set the bubble's minimum width */
  .bubble {
    box-sizing: border-box;
    max-width: 100%;
    text-align: start;
    background: var(--bubble-recv-bg);
    box-shadow: var(--bubble-ring), var(--bubble-shadow);
    border-start-start-radius: var(--radius-xs);
    border-start-end-radius: var(--radius-xl);
    border-end-end-radius: var(--radius-xl);
    border-end-start-radius: var(--radius-xs);
    padding: var(--space-12) var(--space-14);

    &.last {
      border-end-start-radius: var(--radius-xl);
    }

    &.mirror {
      border-start-start-radius: var(--radius-xl);
      border-start-end-radius: var(--radius-xs);
      border-end-end-radius: var(--radius-xs);
      border-end-start-radius: var(--radius-xl);

      &.last {
        border-end-end-radius: var(--radius-xl);
      }
    }

    .sent & {
      background: var(--bubble-send-bg);
      box-shadow: var(--bubble-shadow);
    }
  }

  /* the quote (ReplyQuote: received, a tinted panel with an accent bar; sent, the bubble's own reply shade) reaches
     into the bubble's padding */
  .column .bubble > :global(.reply-quote) {
    margin: -5px -6px 8px;
  }

  .forwarded {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .forward-icon {
    @include icon(forward, 12px, var(--msg-soft));
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
    color: var(--status-online);

    .sent & {
      color: var(--bubble-text);
    }
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

  /* links in the host's body (its markdown's <a>s), as LinkPreview's: accent-bright on received, the bubble's own
     text colour on sent (every theme), underlined either way */
  .bubble .text.body :global(a) {
    @include message-link;
  }

  /* group mentions are links in the markdown (@everyone `?everyone`, a user group `?usergroup=…`) but mentions to the
     eye: the text's colour, semibold and underlined, as an @user mention (<profile-link>, semibold by --msg-link-weight) */
  .bubble .text.body :global(a:is([href^='?everyone'], [href^='?usergroup'])) {
    @include message-link(inherit);
  }

  /* a link in a bold run (strong, b, a heading) keeps the run's weight: semibold would be lighter than the text around
     it (a group mention is a link in a strong of the host's own, and stays semibold) */
  .bubble .text.body :global(:is(strong, b, h1, h2, h3, h4, h5, h6) a:not([href^='?everyone'], [href^='?usergroup'])) {
    font-weight: inherit;
  }

  /* a host's body flows inline where it ends (its root, and a paragraph closing it), so the
     stamp's spacer stays on its last line rather than opening a line of its own (specific enough
     to win over a host's own block display) */
  .bubble .text.body > :global(:first-child),
  .bubble .text.body > :global(:first-child > p:last-child) {
    display: inline;
  }

  /* a body ending in a list can't flow inline: its last item keeps the stamp's room at its end
     instead, where the corner stamp sits, and the spacer isn't needed (a code block at the end
     still takes a line of its own: its text ends in a line break) */
  .bubble .text.body:has(> :global(:first-child > :is(ul, ol):last-child)) > .spacer {
    display: none;
  }

  .bubble .text.body > :global(:first-child > :is(ul, ol):last-child > li:last-child::after) {
    content: '';
    display: inline-block;
    width: var(--oc-stamp-room, 0);
  }

  /* with link previews: LinkPreview's shell, the cards flush to its inset and the rest padded as its text */
  .bubble.carded {
    width: 320px;
    padding: var(--space-4);
  }

  /* a player plays at 400px or more: the player's own width (534px), as wide as the bubble may be */
  .bubble.carded.players {
    width: 542px;
  }

  .column .bubble.carded > :global(.reply-quote) {
    margin: 0 0 var(--space-8);
  }

  .carded {
    > .forwarded,
    > .code,
    > .text {
      margin-inline: var(--space-10);
    }

    > :is(.forwarded, .code, .text):first-child {
      margin-top: var(--space-8);
    }

    > .text {
      padding-bottom: var(--space-10);
    }
  }

  .previews {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .preview {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  /* on the bubble's own colour, so it reads over a card's image too; shown on hover or focus where there's a pointer */
  .remove {
    position: absolute;
    top: var(--space-6);
    inset-inline-end: var(--space-6);
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--bubble-recv-bg);
    cursor: pointer;
    opacity: 0;

    &::before {
      content: '';
      position: absolute;
      inset: 6px;
      background: var(--msg-ink);
      mask: var(--icon-close) center/contain no-repeat;
    }

    .sent & {
      background: var(--bubble-send-bg);
    }

    .preview:hover &,
    &:focus-visible {
      opacity: 1;
    }

    @media (hover: none) {
      opacity: 1;
    }
  }

  .meta {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-6) var(--space-10) var(--space-4);
  }

  .stamp {
    display: inline-flex;
    align-items: flex-end;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--msg-stamp);

    .sent & {
      gap: var(--space-4);
    }
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
    background: var(--bubble-tick);
  }

  .failed {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    margin-top: var(--space-6);
    padding-inline-start: var(--space-14);

    .sent & {
      padding-inline-start: 0;
      padding-inline-end: var(--space-14);
    }
  }

  .failed-text,
  .retry {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--status-danger);
  }

  .retry {
    font-weight: var(--weight-semibold);
    text-decoration: underline;
    cursor: pointer;
  }

</style>
