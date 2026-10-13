<!-- Generated from lib/MediaMessage.dc.html (source hash 67e8474e) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './MediaMessage.logic.js';

  interface Props {
    kind?: 'image' | 'album' | 'video' | 'gif';
    side?: 'received' | 'sent';
    items?: { src?: string; bg?: string; w?: number; h?: number }[];
    caption?: string;
    time?: string;
    status?: string;
    duration?: string;
    size?: string;
    upload?: { state: 'uploading' | 'failed'; progress?: number };
    failedText?: string;
    lastInGroup?: boolean;
    onOpen?: (index: number) => void;
    onRetry?: () => void;
    onCancel?: () => void;
    onDelete?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:100%">
  <div style="width:{v.width};max-width:100%;padding:4px;box-sizing:border-box;border-radius:{v.shellR};background:{v.bg};box-shadow:{v.ring};opacity:{v.shellOp}">
    <div style="position:relative;display:grid;grid-template-columns:{v.cols};grid-template-rows:{v.rows};gap:2px;height:{v.height};border-radius:{v.mediaR};overflow:hidden">
      {#each v.tiles ?? [] as tk, i0}
        <div class="dc-p0" style="position:relative;grid-column:{tk.span};background:{tk.bg};cursor:zoom-in" onclick={tk.open} role="button" tabindex="0" aria-label={tk.label}>
          {#if tk.more}<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);font:700 24px/1 var(--font-sans);color:#fff">{t(tk.moreLabel)}</span>{/if}
        </div>
      {/each}
      {#if v.isVideo}
        <span style="position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.onPlayVideo} role="button" tabindex="0" aria-label={v.playLabel}><span style="width:20px;height:20px;margin-left:3px;background:#fff;mask:var(--icon-play) center/contain no-repeat"></span></span>
        <span style="position:absolute;left:8px;bottom:8px;display:flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:10px;background:rgba(0,0,0,.5);font:500 11px/1 var(--font-mono);color:#fff"><span style="width:11px;height:11px;background:#fff;mask:var(--icon-video) center/contain no-repeat"></span>{t(v.videoMeta)}</span>
      {/if}
      {#if v.isGif}<span style="position:absolute;left:8px;top:8px;height:18px;padding:0 6px;display:flex;align-items:center;border-radius:5px;background:rgba(0,0,0,.5);font:700 10px/1 var(--font-sans);letter-spacing:.04em;color:#fff">GIF</span>{/if}
      {#if v.isUploading}
        <span style="position:absolute;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">
          <span style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center">
            <span style="position:absolute;inset:0;border-radius:50%;background:conic-gradient(#fff {v.progressDeg},rgba(255,255,255,.22) 0);mask:radial-gradient(circle,transparent 20px,#000 21px)"></span>
            <span style="width:14px;height:14px;background:#fff;mask:var(--icon-close) center/contain no-repeat;cursor:pointer" onclick={v.onCancel} role="button" tabindex="0" aria-label="Cancel upload"></span>
          </span>
        </span>
      {/if}
      {#if v.isFailed}
        <span style="position:absolute;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center"><span style="display:flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:17px;background:rgba(0,0,0,.6);font:600 13px/1 var(--font-sans);color:#fff;cursor:pointer" onclick={v.onRetry} role="button" tabindex="0"><span style="width:14px;height:14px;background:#fff;mask:var(--icon-refresh) center/contain no-repeat"></span>Retry</span></span>
      {/if}
      {#if v.timeOnMedia}<span style="position:absolute;right:8px;bottom:8px;display:flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:10px;background:rgba(0,0,0,.5);font:400 11px/1 var(--font-mono);color:#fff">{t(v.time)}<span style="display:{v.tickShow};width:13px;height:13px;background:#fff;mask:{v.tickMask}"></span></span>{/if}
    </div>
    {#if v.hasCaption}
      <p style="position:relative;margin:0;padding:10px 10px 8px;font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:{v.ink};text-wrap:pretty;overflow-wrap:anywhere">{t(v.caption)}<span style="display:inline-flex;visibility:hidden;align-items:center;gap:4px;margin-left:9px;font:400 11px/1 var(--font-mono);color:{v.soft}" aria-hidden="true">{t(v.time)}<span style="display:{v.tickShow};width:13px;height:13px;background:{v.tickInk};mask:{v.tickMask}"></span></span><span style="position:absolute;right:10px;bottom:8px;display:inline-flex;align-items:center;gap:4px;font:400 11px/1 var(--font-mono);color:{v.soft}">{t(v.time)}<span style="display:{v.tickShow};width:13px;height:13px;background:{v.tickInk};mask:{v.tickMask}"></span></span></p>
    {/if}
  </div>
  {#if v.isFailed}<span style="display:flex;align-items:center;gap:6px;font:500 12.5px/1 var(--font-sans);color:var(--status-danger,#FF4D4D)"><span style="width:13px;height:13px;background:currentColor;mask:var(--icon-failed) center/contain no-repeat"></span>{t(v.failedText)}{#if v.canDelete} · <span style="text-decoration:underline;cursor:pointer" onclick={v.onDelete} role="button" tabindex="0">Delete</span>{/if}</span>{/if}
</div>

<style>
  .dc-p0:focus-visible{outline:2px solid var(--accent,#FF5672) !important;outline-offset:-2px !important}
</style>
