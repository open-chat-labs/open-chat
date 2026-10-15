<!-- File / document message: type tile, middle-truncated name (extension always visible), size, download.
     upload: { state: 'uploading', progress, sent } → ring + cancel, "3.2 of 5.4 MB · 60%"; { state: 'failed' } → retry + red line. -->
<script lang="ts">
  import { useT } from '../i18n';
  const TYPE: Record<string, string> = {
    pdf: 'var(--status-danger,#FF4D4D)',
    doc: 'var(--status-verified,#3D9BFF)',
    docx: 'var(--status-verified,#3D9BFF)',
    xls: 'var(--status-online,#2EE6A8)',
    xlsx: 'var(--status-online,#2EE6A8)',
    csv: 'var(--status-online,#2EE6A8)',
    zip: 'var(--status-warning,#FFB03D)',
    ppt: 'var(--status-chit,#FF9F45)',
    pptx: 'var(--status-chit,#FF9F45)',
  };

  interface Props {
    fileName: string;
    size?: string;
    side?: 'received' | 'sent';
    caption?: string;
    time: string;
    upload?: { state: 'uploading' | 'failed'; progress?: number; sent?: string } | null;
    /** Resource key (or literal text). */
    failedText?: string;
    lastInGroup?: boolean;
    onDownload?: () => void;
    onCancel?: () => void;
    onRetry?: () => void;
  }

  let {
    fileName,
    size = '',
    side = 'received',
    caption = '',
    time,
    upload = null,
    failedText = 'ui.fileMessage.failed',
    lastInGroup = true,
    onDownload,
    onCancel,
    onRetry,
  }: Props = $props();
  const t = useT();

  const ext = $derived.by(() => {
    const dot = fileName.lastIndexOf('.');
    return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  });
  // keep the extension plus four characters before it; the rest ellipsises
  const tailLen = $derived(Math.min(fileName.length, (ext ? ext.length + 1 : 0) + 4));
  const hue = $derived(TYPE[ext] || 'var(--ink-2,#C9C9D4)');
  const uploading = $derived(upload?.state === 'uploading');
  const failed = $derived(upload?.state === 'failed');
  const pct = $derived(Math.round((upload?.progress || 0) * 100));
  const meta = $derived(
    uploading
      ? upload?.sent
        ? t('ui.fileMessage.uploadProgressOf', { sent: upload.sent, size, pct })
        : t('ui.fileMessage.uploadProgress', { size, pct })
      : [size, ext.toUpperCase()].filter(Boolean).join(' · '),
  );
  const ticked = $derived(side === 'sent' && !uploading && !failed);
</script>

<div class="file" class:sent={side === 'sent'}>
  <div class="shell" class:last={lastInGroup}>
    <div class="row">
      {#if uploading}
        <span class="progress">
          <span class="ring" style:background="conic-gradient(var(--msg-ink) {Math.round(pct * 3.6)}deg,var(--msg-track) 0)"></span>
          <span class="cancel" onclick={onCancel} role="button" tabindex="0" aria-label={t('ui.fileMessage.cancelUpload')}></span>
        </span>
      {:else if !failed}
        <span class="type" style:background="color-mix(in oklch,{hue} 18%,transparent)" style:color={hue}>{(ext || t('ui.fileMessage.genericType')).toUpperCase().slice(0, 4)}</span>
      {/if}
      <span class="names">
        <span class="name" title={fileName}><span class="head">{fileName.slice(0, fileName.length - tailLen)}</span><span class="tail">{fileName.slice(fileName.length - tailLen)}</span></span>
        <span class="meta">{meta}</span>
      </span>
      {#if failed}
        <span class="action" onclick={onRetry} role="button" tabindex="0" aria-label={t('ui.fileMessage.retryUpload')}><span class="retry-icon"></span></span>
      {:else if !uploading}
        <span class="action download" onclick={onDownload} role="button" tabindex="0" aria-label={t('ui.fileMessage.download', { name: fileName })}><span class="download-icon"></span></span>
      {/if}
    </div>
    {#if caption}
      <p class="caption">{caption}<span class="stamp spacer" aria-hidden="true">{time}{#if ticked}<span class="tick"></span>{/if}</span><span class="stamp corner">{time}{#if ticked}<span class="tick"></span>{/if}</span></p>
    {:else}
      <div class="foot">{uploading ? t('ui.fileMessage.sending') : time}{#if ticked}<span class="tick"></span>{/if}</div>
    {/if}
  </div>
  {#if failed}
    <span class="failed"><span class="failed-icon"></span>{t(failedText)}</span>
  {/if}
</div>

<style>
  .file {
    --msg-bg: var(--bubble-recv-bg, #191921);
    --msg-ink: var(--bubble-recv-text, #e4e4ec);
    --msg-soft: var(--ink-4, #8a8a99);
    --msg-tick: var(--ink-4, #8a8a99);
    --msg-seg: var(--overlay-1, rgba(255, 255, 255, 0.04));
    --msg-btn: var(--overlay-2, rgba(255, 255, 255, 0.08));
    --msg-track: var(--overlay-2, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    max-width: 100%;
  }

  .file.sent {
    --msg-bg: var(--bubble-send-bg, #b83e52);
    --msg-ink: var(--bubble-text, #fff);
    --msg-soft: var(--bubble-text-soft, rgba(255, 255, 255, 0.82));
    --msg-tick: var(--bubble-tick, #fff);
    --msg-seg: rgba(0, 0, 0, 0.18);
    --msg-btn: rgba(0, 0, 0, 0.2);
    --msg-track: rgba(255, 255, 255, 0.22);
  }

  .shell {
    width: 320px;
    max-width: 100%;
    padding: 4px;
    box-sizing: border-box;
    border-radius: var(--radius-xs, 4px) 22px 22px var(--radius-xs, 4px);
    background: var(--msg-bg);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .shell.last {
    border-bottom-left-radius: 22px;
  }

  .sent .shell {
    box-shadow: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 2px 18px 6px 6px;
    background: var(--msg-seg);
  }

  .type {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 800 10px/1 var(--font-sans);
  }

  .progress {
    flex: none;
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    mask: radial-gradient(circle, transparent 16px, #000 17px);
  }

  .cancel {
    width: 14px;
    height: 14px;
    background: var(--msg-ink);
    mask: var(--icon-close) center/contain no-repeat;
    cursor: pointer;
  }

  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .name {
    display: flex;
    min-width: 0;
    font: 600 13.5px/1.2 var(--font-sans);
    color: var(--msg-ink);
  }

  .head {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tail {
    flex: none;
  }

  .meta {
    font: 400 12px/1 var(--font-sans);
    color: var(--msg-soft);
  }

  .action {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--msg-btn);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .download:hover {
    filter: brightness(1.15);
  }

  .download-icon {
    width: 16px;
    height: 16px;
    background: var(--msg-ink);
    mask: var(--icon-download) center/contain no-repeat;
  }

  .retry-icon {
    width: 15px;
    height: 15px;
    background: var(--msg-ink);
    mask: var(--icon-refresh) center/contain no-repeat;
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

  .stamp,
  .foot {
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

  .foot {
    display: flex;
    justify-content: flex-end;
    padding: 6px 10px 4px;
  }

  .tick {
    display: block;
    width: 13px;
    height: 13px;
    background: var(--msg-tick);
    mask: var(--icon-check-double) center/contain no-repeat;
  }

  .failed {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 500 12.5px/1 var(--font-sans);
    color: var(--status-danger, #ff4d4d);
  }

  .failed-icon {
    width: 13px;
    height: 13px;
    background: currentColor;
    mask: var(--icon-failed) center/contain no-repeat;
  }
</style>
