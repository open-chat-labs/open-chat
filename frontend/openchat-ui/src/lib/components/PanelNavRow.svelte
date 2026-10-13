<!-- Generated from lib/PanelNavRow.dc.html (source hash f29bf4af) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './PanelNavRow.logic.js';

  interface Props {
    label?: string;
    hint?: string;
    value?: string;
    highlight?: boolean;
    onClick?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div class="dc-p0" style="width:100%;box-sizing:border-box;display:flex;align-items:center;gap:var(--space-12);min-height:var(--control-xl,44px);padding:var(--space-8) var(--space-12);border-radius:var(--radius-md);cursor:pointer;" onclick={v.onPress} role="button" tabindex="0">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
    <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(v.label)}</span>
    {#if v.hasHint}
      <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.hint)}</span>
    {/if}
  </div>
  {#if v.hasValue}
    <span style="flex:none;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.valueColor}">{t(v.value)}</span>
  {/if}
  <span style="flex:none;width:16px;height:16px;background:var(--ink-4,#7C7C8C);mask:{v.chevronMask}"></span>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>
