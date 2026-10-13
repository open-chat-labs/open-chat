<!-- Generated from lib/Button.dc.html (source hash 8b5cf575) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Button.logic.js';

  interface Props {
    label?: string;
    variant?: string;
    state?: string;
    fullWidth?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:inline-flex;width:{v.rootWidth}">
  {#if v.isPrimary}
    <div class="dc-p0" style="display:inline-flex;width:{v.rootWidth};box-sizing:border-box;align-items:center;justify-content:center;gap:var(--space-8);height:40px;padding:0 var(--space-18);box-sizing:border-box;border-radius:var(--radius-md);color:var(--on-accent,#2E0512);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);cursor:pointer;user-select:none;transform:{v.pressTransform};background:{v.primaryBg};box-shadow:{v.focusRing};" onclick={v.onPress} role="button" tabindex="0">{t(v.label)}</div>
  {/if}
  {#if v.isSecondary}
    <div class="dc-p1" style="display:inline-flex;width:{v.rootWidth};box-sizing:border-box;align-items:center;justify-content:center;gap:var(--space-8);height:40px;padding:0 var(--space-18);box-sizing:border-box;border-radius:var(--radius-md);color:var(--ink,#ECECF1);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);cursor:pointer;user-select:none;transform:{v.pressTransform};background:{v.secondaryBg};box-shadow:{v.secondaryRing};" onclick={v.onPress} role="button" tabindex="0">{t(v.label)}</div>
  {/if}
  {#if v.isGhost}
    <div class="dc-p2" style="display:inline-flex;width:{v.rootWidth};box-sizing:border-box;align-items:center;justify-content:center;gap:var(--space-8);height:40px;padding:0 var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);color:var(--ink-2,#B9B9C6);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);cursor:pointer;user-select:none;transform:{v.pressTransform};background:{v.ghostBg};box-shadow:{v.focusRing};" onclick={v.onPress} role="button" tabindex="0">{t(v.label)}</div>
  {/if}
  {#if v.isDanger}
    <div class="dc-p3" style="display:inline-flex;width:{v.rootWidth};box-sizing:border-box;align-items:center;justify-content:center;gap:var(--space-8);height:40px;padding:0 var(--space-18);box-sizing:border-box;border-radius:var(--radius-md);color:var(--status-danger,#FF6B6B);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);cursor:pointer;user-select:none;transform:{v.pressTransform};background:{v.dangerBg};box-shadow:{v.dangerRing};" onclick={v.onPress} role="button" tabindex="0">{t(v.label)}</div>
  {/if}
  {#if v.isDisabled}
    <div style="display:inline-flex;width:{v.rootWidth};box-sizing:border-box;align-items:center;justify-content:center;gap:var(--space-8);height:40px;padding:0 var(--space-18);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));color:var(--ink-4,#6E6E7C);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);cursor:not-allowed;user-select:none">{t(v.label)}</div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--accent-hover,#ff6d85) !important}
  .dc-p1:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p2:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p3:hover{background:var(--btn-danger-bg-hover,rgba(224,49,49,.16)) !important}
</style>
