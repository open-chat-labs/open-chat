<!-- Image, album, video and GIF messages. Media is inset 4px in the bubble; caption + time below, or time floats on media when there's no caption.
     Natural ratio capped at 360×420 (single), fixed grids for albums (2, 3, 4, 5+ → "+N"). Clicking a tile calls onOpen(index) → fullscreen viewer.
     items: [{ src?, bg?, w?, h? }] — src is an image URL; bg a CSS background fallback (placeholders). -->
<script lang="ts">
  import { useT } from '../i18n';
  import { cssUrl } from '../cssUrl';
  type Status = 'sending' | 'sent' | 'delivered' | 'read';

  interface Props {
    kind?: 'image' | 'album' | 'video' | 'gif';
    side?: 'received' | 'sent';
    items?: { src?: string; bg?: string; w?: number; h?: number }[];
    caption?: string;
    time: string;
    /** Sent messages default to delivered. */
    status?: Status | null;
    /** Video only, e.g. "0:42". */
    duration?: string;
    size?: string;
    upload?: { state: 'uploading' | 'failed'; progress?: number } | null;
    /** Resource key (or literal text). */
    failedText?: string;
    lastInGroup?: boolean;
    onOpen?: (index: number) => void;
    onRetry?: () => void;
    onCancel?: () => void;
    onDelete?: () => void;
  }

  let {
    kind = 'image',
    side = 'received',
    items = [],
    caption = '',
    time,
    status,
    duration = '',
    size = '',
    upload = null,
    failedText = 'ui.mediaMessage.couldNotSend',
    lastInGroup = true,
    onOpen,
    onRetry,
    onCancel,
    onDelete,
  }: Props = $props();
  const t = useT();

  const ALBUM: Record<number, [string, string, number]> = { 1: ['1fr', '1fr', 220], 2: ['1fr 1fr', '1fr', 200], 3: ['1fr 1fr', '1fr 1fr', 260], 4: ['1fr 1fr', '1fr 1fr', 280] };

  const list = $derived(items.length ? items : [{}]);
  const count = $derived(kind === 'album' ? list.length : 1);
  const shown = $derived(Math.min(count, 4));
  const uploading = $derived(upload?.state === 'uploading');
  const failed = $derived(upload?.state === 'failed');
  const tick = $derived(status === undefined ? (side === 'sent' ? 'delivered' : null) : status);

  const box = $derived.by(() => {
    if (kind === 'album') {
      const [cols, rows, height] = ALBUM[shown];
      return { width: '300px', height, cols, rows };
    }
    const it = list[0], w = it.w || 4, h = it.h || 3, maxW = kind === 'gif' ? 240 : 360, maxH = 420;
    const sc = Math.min(maxW / w, maxH / h);
    const W = Math.round(Math.max(160, Math.min(maxW, w * sc)));
    return { width: `${W + 8}px`, height: Math.round(Math.min(maxH, (W * h) / w)), cols: '1fr', rows: '1fr' };
  });

  const tileBg = (it: { src?: string; bg?: string }) =>
    it.src ? `center/cover no-repeat ${cssUrl(it.src)}` : it.bg || 'linear-gradient(170deg,#2b1055,#7597de 55%,#ffb36b)';
</script>

{#snippet stamp()}{time}{#if side === 'sent' && tick}<span class="tick" class:double={tick === 'read' || tick === 'delivered'}></span>{/if}{/snippet}

<div class="media-message" class:sent={side === 'sent'}>
  <div class="shell" class:last={lastInGroup} class:failed style:width={box.width}>
    <div
      class="media"
      class:captioned={!!caption}
      style:grid-template-columns={box.cols}
      style:grid-template-rows={box.rows}
      style:height="{box.height}px"
    >
      {#each list.slice(0, shown) as it, i}
        <div
          class="tile"
          style:background={tileBg(it)}
          style:grid-column={kind === 'album' && shown === 3 && i === 0 ? '1 / -1' : 'auto'}
          onclick={() => onOpen?.(i)}
          role="button"
          tabindex="0"
          aria-label={kind === 'video' ? t('ui.mediaMessage.openVideo') : t('ui.mediaMessage.openImage', { index: i + 1, count })}
        >
          {#if count > 4 && i === 3}<span class="more">+{count - 3}</span>{/if}
        </div>
      {/each}
      {#if kind === 'video' && !uploading && !failed}
        <span class="play" onclick={() => onOpen?.(0)} role="button" tabindex="0" aria-label={t(duration ? 'ui.mediaMessage.playVideoDuration' : 'ui.mediaMessage.playVideo', { duration })}><span class="play-icon"></span></span>
        <span class="chip video-meta"><span class="video-icon"></span>{[duration, size].filter(Boolean).join(' · ')}</span>
      {/if}
      {#if kind === 'gif'}<span class="gif">{t('ui.mediaMessage.gif')}</span>{/if}
      {#if uploading}
        <span class="veil">
          <span class="progress">
            <span class="ring" style:background="conic-gradient(#fff {Math.round((upload?.progress || 0) * 360)}deg,rgba(255,255,255,.22) 0)"></span>
            <span class="cancel" onclick={onCancel} role="button" tabindex="0" aria-label={t('ui.mediaMessage.cancelUpload')}></span>
          </span>
        </span>
      {/if}
      {#if failed}
        <span class="veil dark"><span class="retry" onclick={onRetry} role="button" tabindex="0"><span class="retry-icon"></span>{t('ui.common.retry')}</span></span>
      {/if}
      {#if !caption && !uploading && !failed}<span class="chip on-media">{@render stamp()}</span>{/if}
    </div>
    {#if caption}
      <p class="caption">{caption}<span class="stamp spacer" aria-hidden="true">{@render stamp()}</span><span class="stamp corner">{@render stamp()}</span></p>
    {/if}
  </div>
  {#if failed}<span class="failed-line"><span class="failed-icon"></span>{t(failedText)}{#if onDelete} · <span class="delete" onclick={onDelete} role="button" tabindex="0">{t('ui.common.delete')}</span>{/if}</span>{/if}
</div>

<style>
  .media-message {
    --msg-bg: var(--bubble-recv-bg);
    --msg-ink: var(--bubble-recv-text);
    --msg-soft: var(--ink-4);
    --msg-tick: var(--ink-4);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    max-width: 100%;
  }

  .media-message.sent {
    --msg-bg: var(--bubble-send-bg);
    --msg-ink: var(--bubble-text);
    --msg-soft: var(--bubble-text-soft);
    --msg-tick: var(--bubble-tick);
  }

  .shell {
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

  .sent .shell {
    box-shadow: none;
  }

  .shell.failed {
    opacity: 0.85;
  }

  .media {
    position: relative;
    display: grid;
    gap: 2px;
    border-radius: 2px 18px 18px 2px;
    overflow: hidden;
  }

  .last .media {
    border-bottom-left-radius: 18px;
  }

  .media.captioned {
    border-radius: 2px 18px 6px 6px;
  }

  .tile {
    position: relative;
    cursor: zoom-in;
  }

  .tile:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .more {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    font: 700 24px/1 var(--font-sans);
    color: #fff;
  }

  .play {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 52px;
    height: 52px;
    margin: -26px 0 0 -26px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .play-icon {
    width: 20px;
    height: 20px;
    margin-left: 3px;
    background: #fff;
    mask: var(--icon-play) center/contain no-repeat;
  }

  .chip {
    position: absolute;
    bottom: 8px;
    display: flex;
    align-items: center;
    height: 20px;
    padding: 0 7px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
  }

  .video-meta {
    left: 8px;
    gap: 5px;
    font: 500 11px/1 var(--font-mono);
  }

  .video-icon {
    width: 11px;
    height: 11px;
    background: #fff;
    mask: var(--icon-video) center/contain no-repeat;
  }

  .on-media {
    right: 8px;
    gap: 4px;
    font: 400 11px/1 var(--font-mono);
  }

  .gif {
    position: absolute;
    left: 8px;
    top: 8px;
    height: 18px;
    padding: 0 6px;
    display: flex;
    align-items: center;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.5);
    font: 700 10px/1 var(--font-sans);
    letter-spacing: 0.04em;
    color: #fff;
  }

  .veil {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .veil.dark {
    background: rgba(0, 0, 0, 0.45);
  }

  .progress {
    position: relative;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    mask: radial-gradient(circle, transparent 20px, #000 21px);
  }

  .cancel {
    width: 14px;
    height: 14px;
    background: #fff;
    mask: var(--icon-close) center/contain no-repeat;
    cursor: pointer;
  }

  .retry {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 17px;
    background: rgba(0, 0, 0, 0.6);
    font: 600 13px/1 var(--font-sans);
    color: #fff;
    cursor: pointer;
  }

  .retry-icon {
    width: 14px;
    height: 14px;
    background: #fff;
    mask: var(--icon-refresh) center/contain no-repeat;
  }

  .tick {
    display: block;
    width: 13px;
    height: 13px;
    background: var(--msg-tick);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .tick.double {
    mask: var(--icon-check-double) center/contain no-repeat;
  }

  .on-media .tick {
    background: #fff;
  }

  .caption {
    position: relative;
    margin: 0;
    padding: 10px 10px 8px;
    font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
    color: var(--msg-ink);
    text-wrap: pretty;
    overflow-wrap: anywhere;
  }

  .stamp {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font: 400 11px/1 var(--font-mono);
    color: var(--msg-soft);
  }

  /* invisible copy reserves room on the last line so the stamp never overlaps text */
  .spacer {
    visibility: hidden;
    margin-left: 9px;
  }

  .corner {
    position: absolute;
    right: 10px;
    bottom: 8px;
  }

  .failed-line {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 500 12.5px/1 var(--font-sans);
    color: var(--status-danger);
  }

  .failed-icon {
    width: 13px;
    height: 13px;
    background: currentColor;
    mask: var(--icon-failed) center/contain no-repeat;
  }

  .delete {
    text-decoration: underline;
    cursor: pointer;
  }
</style>
