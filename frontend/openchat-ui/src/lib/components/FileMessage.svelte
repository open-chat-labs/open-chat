<!-- Generated from lib/FileMessage.dc.html (source hash 1e982d63) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './FileMessage.logic.js';

  interface Props {
    fileName?: string;
    size?: string;
    side?: 'received' | 'sent';
    caption?: string;
    time?: string;
    upload?: { state: 'uploading' | 'failed'; progress?: number; sent?: string };
    failedText?: string;
    lastInGroup?: boolean;
    onDownload?: () => void;
    onCancel?: () => void;
    onRetry?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:100%">
  <div style="width:320px;max-width:100%;padding:4px;box-sizing:border-box;border-radius:{v.shellR};background:{v.bg};box-shadow:{v.ring}">
    <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:{v.rowR};background:{v.seg}">
      {#if v.isIdle}<span style="flex:none;width:40px;height:40px;border-radius:10px;background:{v.typeBg};display:flex;align-items:center;justify-content:center;font:800 10px/1 var(--font-sans);color:{v.typeInk}">{t(v.ext)}</span>{/if}
      {#if v.isUploading}
        <span style="flex:none;position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center">
          <span style="position:absolute;inset:0;border-radius:50%;background:conic-gradient({v.ink} {v.progressDeg},{v.track} 0);mask:radial-gradient(circle,transparent 16px,#000 17px)"></span>
          <span style="width:14px;height:14px;background:{v.ink};mask:var(--icon-close) center/contain no-repeat;cursor:pointer" onclick={v.onCancel} role="button" tabindex="0" aria-label="Cancel upload"></span>
        </span>
      {/if}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <span style="display:flex;min-width:0;font:600 13.5px/1.2 var(--font-sans);color:{v.ink}" title={v.name}><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.nameHead)}</span><span style="flex:none">{t(v.nameTail)}</span></span>
        <span style="font:400 12px/1 var(--font-sans);color:{v.soft}">{t(v.meta)}</span>
      </span>
      {#if v.isIdle}<span class="dc-p0" style="flex:none;width:34px;height:34px;border-radius:50%;background:{v.btnBg};display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.onDownload} role="button" tabindex="0" aria-label={v.downloadLabel}><span style="width:16px;height:16px;background:{v.ink};mask:var(--icon-download) center/contain no-repeat"></span></span>{/if}
      {#if v.isFailed}<span style="flex:none;width:34px;height:34px;border-radius:50%;background:{v.btnBg};display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.onRetry} role="button" tabindex="0" aria-label="Retry upload"><span style="width:15px;height:15px;background:{v.ink};mask:var(--icon-refresh) center/contain no-repeat"></span></span>{/if}
    </div>
    {#if v.hasCaption}<p style="position:relative;margin:0;padding:10px 10px 8px;font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:{v.ink};text-wrap:pretty;overflow-wrap:anywhere">{t(v.caption)}<span style="display:inline-flex;visibility:hidden;align-items:center;gap:4px;margin-left:9px;font:400 11px/1 var(--font-mono);color:{v.soft}" aria-hidden="true">{t(v.time)}<span style="display:{v.tickShow};width:13px;height:13px;background:{v.tick};mask:var(--icon-check-double) center/contain no-repeat"></span></span><span style="position:absolute;right:10px;bottom:8px;display:inline-flex;align-items:center;gap:4px;font:400 11px/1 var(--font-mono);color:{v.soft}">{t(v.time)}<span style="display:{v.tickShow};width:13px;height:13px;background:{v.tick};mask:var(--icon-check-double) center/contain no-repeat"></span></span></p>{/if}
    {#if v.noCaption}<div style="display:flex;justify-content:flex-end;align-items:center;gap:4px;padding:6px 10px 4px;font:400 11px/1 var(--font-mono);color:{v.soft}">{t(v.footTime)}<span style="display:{v.tickShow};width:13px;height:13px;background:{v.tick};mask:var(--icon-check-double) center/contain no-repeat"></span></div>{/if}
  </div>
  {#if v.isFailed}<span style="display:flex;align-items:center;gap:6px;font:500 12.5px/1 var(--font-sans);color:var(--status-danger,#FF4D4D)"><span style="width:13px;height:13px;background:currentColor;mask:var(--icon-failed) center/contain no-repeat"></span>{t(v.failedText)}</span>{/if}
</div>

<style>
  .dc-p0:hover{filter:brightness(1.15) !important}
</style>
