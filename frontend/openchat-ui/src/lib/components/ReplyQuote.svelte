<!-- A reply's quote: who wrote the quoted message and its text (up to three lines), behind an accent bar. Received: a
     tinted panel with an accent bar; sent: the bubble's own reply shade. With onOpen it's a button: the host goes to the
     quoted message. ChatBubble's quote, its own component by hand so every kind of message (media, voice, file, the
     cards) shows the same one at its top. `tile` shapes it as the first tile of a card in a 4px-inset shell (media, file,
     transfer, swap, poll, prize, link): the shell's top corners above (mirrored with `mirror`), 6px below, 4px over the
     next tile. Without it, rounded all round: the host places it (ChatBubble, VoiceMessage). -->
<script lang="ts">
  interface Props {
    /** Who wrote the quoted message ("You" for your own). */
    name: string;
    text?: string;
    /** On a sent message: the sent bubble's reply shade. */
    sent?: boolean;
    /** The first tile of a card in a 4px-inset shell: the shell's top corners above, 6px below, 4px over the next tile. */
    tile?: boolean;
    /** With `tile`, a mirrored shell's (native, your own at the inline end): the top corners mirrored. */
    mirror?: boolean;
    /** The quote tapped: the host goes to the quoted message. Without it the quote is only shown. */
    onOpen?: () => void;
  }

  let { name, text = '', sent = false, tile = false, mirror = false, onOpen }: Props = $props();
</script>

{#snippet body()}
  <span class="bar"></span>
  <div class="body">
    <div class="name">{name}</div>
    <div class="text">{text}</div>
  </div>
{/snippet}

{#if onOpen}
  <div
    class="reply-quote link"
    class:sent
    class:tile
    class:mirror
    role="button"
    tabindex="0"
    onclick={(e) => {
      e.stopPropagation();
      onOpen();
    }}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    }}
  >
    {@render body()}
  </div>
{:else}
  <div class="reply-quote" class:sent class:tile class:mirror>
    {@render body()}
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .reply-quote {
    --quote-bg: var(--overlay-2);
    --quote-bar: var(--accent);
    --quote-name: var(--accent-bright);
    --quote-text: var(--ink-3);
    display: flex;
    gap: var(--space-8);
    min-width: 0;
    padding: var(--space-8) var(--space-10);
    border-radius: var(--radius-md);
    background: var(--quote-bg);
    text-align: start;

    &.sent {
      --quote-bg: var(--bubble-reply);
      --quote-bar: var(--bubble-text-soft);
      --quote-name: var(--bubble-text);
      --quote-text: var(--bubble-text-soft);
    }

    /* the first tile of a card in a 4px-inset shell, as the cards' own first tiles */
    &.tile {
      margin: 0 0 4px;
      border-radius: 2px 18px 6px 6px;

      &.mirror {
        border-start-start-radius: 18px;
        border-start-end-radius: 2px;
      }
    }
  }

  .link {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .bar {
    flex: none;
    width: 4px;
    border-radius: var(--radius-pill);
    background: var(--quote-bar);
  }

  .body {
    min-width: 0;
  }

  .name {
    font: var(--weight-bold) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--quote-name);
    @include truncate;
  }

  /* quoted text wraps up to three lines, then ends in an ellipsis */
  .text {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--quote-text);
    @include line-clamp(3);
    overflow-wrap: anywhere;
  }
</style>
