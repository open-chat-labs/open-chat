<!-- Generated from lib/LinkPreview.dc.html (source hash ebdc8a5b) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './LinkPreview.logic.js';

  interface Props {
    text?: string;
    url?: string;
    domain?: string;
    title?: string;
    description?: string;
    image?: string;
    imageBg?: string;
    size?: 'large' | 'compact';
    side?: 'received' | 'sent';
    time?: string;
    lastInGroup?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:320px;max-width:100%;padding:4px;box-sizing:border-box;border-radius:{v.shellR};background:{v.bg};box-shadow:{v.ring}">
  <p style="margin:0;padding:8px 10px 10px;font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:{v.ink};text-wrap:pretty;overflow-wrap:anywhere">{#each v.parts ?? [] as pt, i0}{#if pt.plain}{t(pt.t)}{/if}{#if pt.link}<a style="font-weight:700;text-decoration:underline;text-underline-offset:2px;color:{v.linkInk}" href={pt.href} target="_blank" rel="noopener">{t(pt.t)}</a>{/if}{/each}</p>
  {#if v.isLarge}
    <a style="display:flex;flex-direction:column;text-decoration:none;border-radius:6px 6px 18px 18px;overflow:hidden;background:{v.card}" href={v.url} target="_blank" rel="noopener">
      {#if v.hasImage}<div style="height:140px;background:{v.image}"></div>{/if}
      <div style="display:flex;flex-direction:column;gap:5px;padding:10px 12px 12px">
        <span style="font:600 11.5px/1 var(--font-sans);color:{v.domainInk}">{t(v.domain)}</span>
        <span style="font:600 14px/1.3 var(--font-sans);color:{v.ink}">{t(v.title)}</span>
        {#if v.hasDescription}<span style="font:400 12.5px/1.45 var(--font-sans);color:{v.soft};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{t(v.description)}</span>{/if}
      </div>
    </a>
  {/if}
  {#if v.isCompact}
    <a style="display:flex;align-items:center;gap:10px;padding:10px 12px;text-decoration:none;border-radius:6px 6px 18px 18px;background:{v.card}" href={v.url} target="_blank" rel="noopener">
      <span style="flex:none;width:44px;height:44px;border-radius:8px;background:{v.image}"></span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font:600 11.5px/1 var(--font-sans);color:{v.domainInk}">{t(v.domain)}</span><span style="font:600 13.5px/1.25 var(--font-sans);color:{v.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.title)}</span></span>
    </a>
  {/if}
  <div style="display:flex;justify-content:flex-end;align-items:center;gap:4px;padding:6px 10px 4px;font:400 11px/1 var(--font-mono);color:{v.soft}">{t(v.time)}<span style="display:{v.tickShow};width:13px;height:13px;background:{v.tick};mask:var(--icon-check-double) center/contain no-repeat"></span></div>
</div>
