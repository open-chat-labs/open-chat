<!-- Message with a link preview. Text (with the URL) first, the preview card below it — the card explains the link.
     size: large (image on top, domain, title, 2-line description) or compact (thumbnail row, for repos/profiles without a hero image). -->
<script lang="ts">
  import LinkCard from './LinkCard.svelte';
  interface Props {
    /** Message text; URLs inside it render as bold, underlined links. */
    text: string;
    /** Where the card links; only http(s) URLs are linked, anything else shows the card without a link. */
    url: string;
    domain: string;
    title: string;
    description?: string;
    /** Image URL for the card. */
    image?: string;
    /** CSS background used when there is no image; null hides the image area. */
    imageBg?: string | null;
    size?: 'large' | 'compact';
    side?: 'received' | 'sent';
    time: string;
    lastInGroup?: boolean;
    /** Your own at the inline end (native): the corners mirrored, as ChatBubble's `mirror`. */
    mirror?: boolean;
  }

  let {
    text,
    url,
    domain,
    title,
    description = '',
    image = '',
    imageBg = 'linear-gradient(170deg,#2b1055,#7597de 55%,#ffb36b)',
    size = 'large',
    side = 'received',
    time,
    lastInGroup = true,
    mirror = false,
  }: Props = $props();

  const URL_RE = /((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i;
  const URL_START = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}/i;

  // split() puts the captured URLs at odd indexes; decide by index before dropping empty strings, which shifts them
  const parts = $derived(
    text
      .split(URL_RE)
      .map((x, i) => (i % 2 === 1 && URL_START.test(x) ? { text: x, href: /^https?:/i.test(x) ? x : `https://${x}` } : { text: x }))
      .filter((p) => p.text !== ''),
  );
</script>

<div class="shell" class:sent={side === 'sent'} class:last={lastInGroup} class:mirror data-bubble-sent={side === 'sent' ? '' : undefined}>
  <p class="text">{#each parts as part}{#if part.href}<a class="inline" href={part.href} target="_blank" rel="noopener">{part.text}</a>{:else}{part.text}{/if}{/each}</p>
  <LinkCard {url} {domain} {title} {description} {image} {imageBg} {size} {side} />
  <div class="meta">{time}<span class="tick"></span></div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .shell {
    --msg-ink: var(--bubble-recv-text);
    --msg-soft: var(--ink-3);
    --msg-link: var(--accent-bright);
    width: 320px;
    @include message-shell(var(--bubble-recv-bg));

    &.sent {
      --msg-ink: var(--bubble-text);
      --msg-soft: var(--bubble-text-soft);
      --msg-link: var(--bubble-text);
      background: var(--bubble-send-bg);
      box-shadow: var(--bubble-shadow);
    }
  }

  .text {
    margin: 0;
    padding: 8px 10px 10px;
    font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
    color: var(--msg-ink);
    text-wrap: pretty;
    overflow-wrap: anywhere;
  }

  .inline {
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
    color: var(--msg-link);
  }

  .meta {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    padding: 6px 10px 4px;
    font: 400 11px/1 var(--font-mono);
    color: var(--msg-soft);
  }

  .tick {
    display: none;
    width: 13px;
    height: 13px;
    background: var(--bubble-tick);
    mask: var(--icon-check-double) center/contain no-repeat;

    .sent & {
      display: block;
    }
  }
</style>
