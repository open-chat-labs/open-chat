<!-- A link's preview card, as LinkPreview shows it under its text (and ChatBubble under a message's):
     large (image on top, domain, title, 2-line description) or compact (thumbnail row). Sits on its bubble's colours. -->
<script lang="ts">
  import { cssUrl } from '../cssUrl';
  interface Props {
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
  }

  let {
    url,
    domain,
    title,
    description = '',
    image = '',
    imageBg = 'linear-gradient(170deg,#2b1055,#7597de 55%,#ffb36b)',
    size = 'large',
    side = 'received',
  }: Props = $props();

  // the card links only to http(s): the URL comes from message content, and a javascript: or data: link would run in the app
  const safeUrl = $derived(/^https?:\/\//i.test(url.trim()) ? url.trim() : undefined);

  const art = $derived(image ? `center/cover no-repeat ${cssUrl(image)}` : imageBg || 'linear-gradient(170deg,#2b1055,#7597de 55%,#ffb36b)');
</script>

{#if size === 'large'}
  <a class="card large" class:sent={side === 'sent'} href={safeUrl} target="_blank" rel="noopener">
    {#if imageBg !== null}<div class="hero" style:background={art}></div>{/if}
    <div class="body">
      <span class="domain">{domain}</span>
      <span class="title">{title}</span>
      {#if description}<span class="description">{description}</span>{/if}
    </div>
  </a>
{:else}
  <a class="card compact" class:sent={side === 'sent'} href={safeUrl} target="_blank" rel="noopener">
    <span class="thumb" style:background={art}></span>
    <span class="names"><span class="domain">{domain}</span><span class="title">{title}</span></span>
  </a>
{/if}

<style>
  .card {
    --card-ink: var(--bubble-recv-text);
    --card-soft: var(--ink-3);
    text-decoration: none;
    border-radius: 6px 6px 18px 18px;
    background: var(--overlay-1);
  }

  .card.sent {
    --card-ink: var(--bubble-text);
    --card-soft: var(--bubble-text-soft);
    background: var(--bubble-reply);
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
    color: var(--accent-bright);
  }

  .sent .domain {
    color: var(--bubble-text-soft);
  }

  .title {
    font: 600 14px/1.3 var(--font-sans);
    color: var(--card-ink);
  }

  .description {
    font: 400 12.5px/1.45 var(--font-sans);
    color: var(--card-soft);
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
</style>
