<!-- A link's video player (a Twitch stream, video or clip), as ChatBubble shows it under a message's text: a poster
     (its image, a play button, the title over a shade) that loads the player only when clicked, as the player starts
     playing as it loads. Back to the poster whenever the player can't show. Where it can't play (no `src`, or narrower
     than `minWidth`, the least the site plays in) a row linking to the site instead. Nothing lies over the player
     once it's playing: a site may refuse to start under one, even a layer clicks pass through.
     By hand (web 5a), from the old trees' TwitchPlayer: the design has no player. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { cssUrl } from '../cssUrl';

  interface Props {
    /** What's playing: the stream's or the video's title, or where it's from. */
    title: string;
    /** The poster's image URL. */
    image?: string;
    /** The player's URL, loaded on the poster's click (it starts as it loads). None where it can't play: the link row. */
    src?: string;
    /** The video on its own site, for the link row; only an http(s) URL is linked. */
    href: string;
    /** The site's logo (an image URL), before the title. */
    logo?: string;
    /** The narrowest the player plays at (px); narrower, the link row. Twitch's least is 400. */
    minWidth?: number;
    /** The poster's label for screen readers. Resource key or text. */
    playLabel?: string;
    /** The link row's call to action. Resource key or text. */
    watchLabel?: string;
    side?: 'received' | 'sent';
  }

  let {
    title,
    image = '',
    src = '',
    href,
    logo = '',
    minWidth = 400,
    playLabel = 'ui.playerCard.play',
    watchLabel = 'ui.playerCard.watch',
    side = 'received',
  }: Props = $props();
  const t = useT();

  const safeHref = $derived(/^https?:\/\//i.test(href.trim()) ? href.trim() : undefined);

  let width = $state<number>();
  const shown = $derived(src !== '' && width !== undefined && width >= minWidth);
  // set by the poster's click, and back to false whenever the player is hidden: only a click may
  // load it, not the bubble widening again
  let playing = $derived.by(() => {
    void shown;
    return false;
  });
</script>

<div class="player-card" class:sent={side === 'sent'} bind:clientWidth={width}>
  <!-- asks for the player's width but gives way, so a narrower bubble keeps its own, which is then what's measured -->
  <canvas class="sizer" aria-hidden="true"></canvas>
  {#if shown}
    {#if playing}
      <iframe class="frame" {src} {title} allow="autoplay; fullscreen" allowfullscreen></iframe>
    {:else}
      <button class="frame poster" type="button" aria-label={t(playLabel, { title })} onclick={() => (playing = true)}>
        {#if image}<span class="still" style:background="center/cover no-repeat {cssUrl(image)}"></span>{/if}
        <span class="play"><span class="play-icon"></span></span>
        <span class="caption">
          {#if logo}<img class="logo" src={logo} alt="" />{/if}
          <span class="title">{title}</span>
        </span>
      </button>
    {/if}
  {:else if width !== undefined || src === ''}
    <a class="watch" href={safeHref} target="_blank" rel="noopener noreferrer">
      {#if logo}<img class="logo" src={logo} alt="" />{/if}
      <span class="names">
        <span class="title">{title}</span>
        <span class="cta">{t(watchLabel)}</span>
      </span>
    </a>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  /* a 16:9 player at Twitch's least (400x300) needs 534px; a narrower one keeps 300px of height and letterboxes */
  .player-card {
    --card-ink: var(--bubble-recv-text);
    --card-soft: var(--ink-3);
    max-width: 534px;
    border-radius: 6px 6px 18px 18px;
    overflow: hidden;
    background: var(--overlay-1);

    &.sent {
      --card-ink: var(--bubble-text);
      --card-soft: var(--bubble-text-soft);
      background: var(--bubble-reply);
    }
  }

  /* a replaced element's percentage max-width lets it shrink to nothing in a bubble that hugs its content */
  .sizer {
    display: block;
    width: 534px;
    max-width: 100%;
    height: 0;
  }

  .frame {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 300px;
    border: none;
    background: #000;
  }

  .poster {
    position: relative;
    padding: 0;
    cursor: pointer;
    color: #fff;

    &:focus-visible {
      @include focus-ring;
    }
  }

  .still {
    position: absolute;
    inset: 0;
  }

  .play {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.6);
    transition: background var(--duration-fast) ease-in-out;
    @include flex-center;

    .poster:hover & {
      background: rgb(0 0 0 / 0.8);
    }
  }

  .play-icon {
    @include icon(play-filled, 26px, #fff, $flex: null);
  }

  .caption {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-22) var(--space-12) var(--space-10);
    background: linear-gradient(transparent, rgb(0 0 0 / 0.75));
    text-align: start;
  }

  .watch {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-10) var(--space-12);
    color: var(--card-ink);
    text-decoration: none;
  }

  .names {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .cta {
    font: var(--weight-medium) var(--text-xs) / 1.2 var(--font-sans);
    color: var(--card-soft);
    text-transform: uppercase;

    .watch:hover & {
      text-decoration: underline;
    }
  }

  .logo {
    flex: none;
    width: 28px;
    height: 28px;
  }

  .title {
    font: var(--weight-semibold) var(--text-sm) / 1.3 var(--font-sans);
    @include truncate;
  }
</style>
