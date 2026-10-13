<!-- Generated from lib/Skeleton.dc.html (source hash a4b6cf89) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Skeleton.logic.js';

  interface Props {
    variant?: string;
    count?: number;
    label?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column;gap:{v.gap};width:100%" role="status" aria-live="polite" aria-busy="true" aria-label={v.label}>
  {#each (v.rows ?? []) as r, r_i}
    <div style="display:flex;align-items:center;gap:{r?.gap};min-height:{r?.h};padding:{r?.pad};box-sizing:border-box;border-radius:var(--radius-md,12px);background:{r?.card}" aria-hidden="true">
      <span style="flex:none;width:{r?.av};height:{r?.av};border-radius:{r?.avRadius};background:var(--skeleton-base);background-image:var(--skeleton-sheen);background-size:200% 100%;animation:oc-shimmer 1.4s ease-in-out infinite;animation-delay:{r?.delay}"></span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
        <span style="width:{r?.w1};height:11px;border-radius:6px;background:var(--skeleton-base);background-image:var(--skeleton-sheen);background-size:200% 100%;animation:oc-shimmer 1.4s ease-in-out infinite;animation-delay:{r?.delay}"></span>
        <span style="width:{r?.w2};height:9px;border-radius:5px;background:var(--skeleton-base);background-image:var(--skeleton-sheen);background-size:200% 100%;animation:oc-shimmer 1.4s ease-in-out infinite;animation-delay:{r?.delay}"></span>
        {#if r?.bar}<span style="width:{r?.w3};height:3px;border-radius:2px;background:var(--skeleton-base)"></span>{/if}
      </span>
      {#if r?.meta}<span style="flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:8px"><span style="width:{r?.m1};height:10px;border-radius:5px;background:var(--skeleton-base);background-image:var(--skeleton-sheen);background-size:200% 100%;animation:oc-shimmer 1.4s ease-in-out infinite;animation-delay:{r?.delay}"></span>{#if r?.meta2}<span style="width:28px;height:9px;border-radius:5px;background:var(--skeleton-base)"></span>{/if}</span>{/if}
    </div>
  {/each}
</div>
