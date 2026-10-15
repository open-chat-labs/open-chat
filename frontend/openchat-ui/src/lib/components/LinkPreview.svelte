<!-- Message with a link preview. Text (with the URL) first, the preview card below it — the card explains the link.
     size: large (image on top, domain, title, 2-line description) or compact (thumbnail row, for repos/profiles without a hero image). -->
<script lang="ts">
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
  // the card links only to http(s): the URL comes from message content, and a javascript: or data: link would run in the app
  const safeUrl = $derived(/^https?:\/\//i.test(url.trim()) ? url.trim() : undefined);

  const art = $derived(image ? `center/cover no-repeat url(${JSON.stringify(image)})` : imageBg || 'linear-gradient(170deg,#2b1055,#7597de 55%,#ffb36b)');
</script>

<div class="shell" class:sent={side === 'sent'} class:last={lastInGroup}>
  <p class="text">{#each parts as part}{#if part.href}<a class="inline" href={part.href} target="_blank" rel="noopener">{part.text}</a>{:else}{part.text}{/if}{/each}</p>
  {#if size === 'large'}
    <a class="card large" href={safeUrl} target="_blank" rel="noopener">
      {#if imageBg !== null}<div class="hero" style:background={art}></div>{/if}
      <div class="body">
        <span class="domain">{domain}</span>
        <span class="title">{title}</span>
        {#if description}<span class="description">{description}</span>{/if}
      </div>
    </a>
  {:else}
    <a class="card compact" href={safeUrl} target="_blank" rel="noopener">
      <span class="thumb" style:background={art}></span>
      <span class="names"><span class="domain">{domain}</span><span class="title">{title}</span></span>
    </a>
  {/if}
  <div class="meta">{time}<span class="tick"></span></div>
</div>

<style>
  .shell {
    --msg-ink: var(--bubble-recv-text, #e4e4ec);
    --msg-soft: var(--ink-3, #9a9aa8);
    --msg-link: var(--accent-bright, #ff8298);
    width: 320px;
    max-width: 100%;
    padding: 4px;
    box-sizing: border-box;
    border-radius: var(--radius-xs, 4px) 22px 22px var(--radius-xs, 4px);
    background: var(--bubble-recv-bg, #191921);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .shell.last {
    border-bottom-left-radius: 22px;
  }

  .shell.sent {
    --msg-ink: var(--bubble-text, #fff);
    --msg-soft: var(--bubble-text-soft, rgba(255, 255, 255, 0.82));
    --msg-link: var(--bubble-text, #fff);
    background: var(--bubble-send-bg, #b83e52);
    box-shadow: none;
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

  .card {
    text-decoration: none;
    border-radius: 6px 6px 18px 18px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .sent .card {
    background: var(--bubble-reply, #8c2a3d);
  }

  .large {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .hero {
    height: 140px;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px 12px 12px;
  }

  .domain {
    font: 600 11.5px/1 var(--font-sans);
    color: var(--accent-bright, #ff8298);
  }

  .sent .domain {
    color: var(--bubble-text-soft, rgba(255, 255, 255, 0.82));
  }

  .title {
    font: 600 14px/1.3 var(--font-sans);
    color: var(--msg-ink);
  }

  .description {
    font: 400 12.5px/1.45 var(--font-sans);
    color: var(--msg-soft);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .compact {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
  }

  .thumb {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 8px;
  }

  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .compact .title {
    font: 600 13.5px/1.25 var(--font-sans);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    background: var(--bubble-tick, #fff);
    mask: var(--icon-check-double) center/contain no-repeat;
  }

  .sent .tick {
    display: block;
  }
</style>
