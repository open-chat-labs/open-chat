<!-- Generated from lib/VideoTile.dc.html (source hash 3d3f0853) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './VideoTile.logic.js';

  interface Props {
    nameLabel?: string;
    initial?: string;
    grad?: string;
    feed?: string;
    ratio?: number;
    muted?: boolean;
    speaking?: boolean;
    big?: boolean;
    radius?: number;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;height:100%;min-width:0;min-height:0;border-radius:{v.radius};overflow:hidden;background:#121217;container-type:size;isolation:isolate" role="img" aria-label={v.aria}>
        <span style="position:absolute;inset:0;z-index:3;border-radius:inherit;box-shadow:{v.ring};transition:box-shadow 200ms;pointer-events:none" aria-hidden="true"></span>
        <div style="position:absolute;inset:0;margin:auto;width:min(100%, calc(100cqh * {v.ar}));height:min(100%, calc(100cqw / {v.ar}));background:{v.bg};display:flex;align-items:center;justify-content:center"><span style="width:{v.av};height:{v.av};border-radius:50%;background:{v.grad};display:flex;align-items:center;justify-content:center;font:700 {v.avFont}/1 var(--font-sans);color:#0e0e12">{t(v.initial)}</span></div>
        <span style="position:absolute;inset-inline-start:8px;bottom:8px;max-width:calc(100% - 16px);height:24px;padding:0 9px;box-sizing:border-box;display:flex;align-items:center;gap:6px;border-radius:12px;background:rgba(0,0,0,.55);font:600 12px/1 var(--font-sans);white-space:nowrap;overflow:hidden"><span style="flex:none;width:12px;height:12px;background:{v.micInk};mask:{v.micMask}"></span><span style="overflow:hidden;text-overflow:ellipsis">{t(v.who)}</span></span>
      </div>
