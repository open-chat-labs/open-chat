<!-- Generated from lib/UpgradeBanner.dc.html (source hash af894647) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './UpgradeBanner.logic.js';

  interface Props {
    text?: string;
    actionLabel?: string;
    onUpgrade?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:var(--space-10) var(--space-10) var(--space-10) var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:color-mix(in oklch,var(--accent,#FF5672) 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 28%,transparent)">
  <span style="flex:none;width:16px;height:16px;background:var(--accent,#FF5672);mask:{v.gemMask}"></span>
  <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">{t(v.text)}</span>
  <span class="dc-p0" style="flex:none;display:flex;align-items:center;height:30px;padding:0 12px;border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--on-accent,#fff);cursor:pointer;user-select:none;white-space:nowrap" onclick={v.onUpgrade} role="button" tabindex="0">{t(v.actionLabel)}</span>
</div>

<style>
  .dc-p0:hover{filter:brightness(1.08) !important}
</style>
