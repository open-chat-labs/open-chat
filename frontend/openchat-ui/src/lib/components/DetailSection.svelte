<!-- Generated from lib/DetailSection.dc.html (source hash e0ad49a0) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './DetailSection.logic.js';

  interface Props {
    clamp?: number;
    label?: string;
    value?: string;
    variant?: string;
    dot?: boolean;
    highlight?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="padding:var(--space-14) var(--space-16);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04));display:flex;flex-direction:column;align-items:stretch;gap:var(--space-8)">
  <span style="font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#6E6E7C)">{t(v.label)}</span>
  {#if v.isProse}
    <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:{v.lineClamp};-webkit-box-orient:vertical;overflow:hidden">{t(v.value)}</span>
    {#if v.canExpand}
      <span style="align-self:flex-start;font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent-bright,#FF8298);cursor:pointer;user-select:none" onclick={v.toggleMore} role="button" tabindex="0">{t(v.moreLabel)}</span>
    {/if}
  {/if}
  {#if v.isValue}
    <span style="display:flex;align-items:center;gap:7px;font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.valueColor}">
      {#if v.hasDot}
        <span style="flex:none;width:7px;height:7px;border-radius:var(--radius-pill);background:var(--status-online,#2EE6A8)"></span>
      {/if}
      {t(v.value)}
    </span>
  {/if}
</div>
