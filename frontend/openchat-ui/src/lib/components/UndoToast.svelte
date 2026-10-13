<!-- Generated from lib/UndoToast.dc.html (source hash d1ec11e9) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './UndoToast.logic.js';

  interface Props {
    tone?: string;
    size?: string;
    shown?: boolean;
    message?: string;
    actionLabel?: string;
    icon?: string;
    onAction?: () => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

{#if v.mounted}
  <div style="display:flex;align-items:center;gap:{v.gap};min-height:{v.minH};padding:{v.pad};box-sizing:border-box;border-radius:{v.radius};background:{v.bg};box-shadow:{v.shadow};pointer-events:{v.hits};animation:{v.anim}" role="status" aria-live="polite" aria-atomic="true">
    {#if v.hasIcon}
      <span style="flex:none;width:{v.badge};height:{v.badge};border-radius:var(--radius-pill);display:flex;align-items:center;justify-content:center;background:{v.badgeBg}"><span style="width:{v.iconSize};height:{v.iconSize};background:{v.iconInk};mask:{v.iconMask}"></span></span>
    {/if}
    <span style="flex:1;min-width:0;font:{v.msgFont};color:{v.msgInk};text-wrap:pretty">{t(v.message)}</span>
    {#if v.hasAction}
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;height:{v.actH};padding:0 {v.actPad};box-sizing:border-box;border-radius:var(--radius-sm);background:{v.actBg};font:{v.actFont};color:{v.actInk};cursor:pointer;user-select:none;--dc-p0-0-0:{v.actHover};" onclick={v.onAction} role="button" tabindex="0">{t(v.actionLabel)}</span>
    {/if}
    {#if v.hasDismiss}
      <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:{v.closeBox};height:{v.closeBox};border-radius:var(--radius-sm);cursor:pointer;" onclick={v.onDismiss} role="button" tabindex="0" aria-label="Dismiss" title="Dismiss">
        <span style="width:{v.closeSize};height:{v.closeSize};background:var(--ink-4,#7C7C8C);mask:{v.closeMask}"></span>
      </span>
    {/if}
  </div>
{/if}

<style>
  .dc-p0:hover{background:var(--dc-p0-0-0) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>
