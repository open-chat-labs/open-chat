<!-- Generated from lib/IconButton.dc.html (source hash f00be3d6) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './IconButton.logic.js';

  interface Props {
    icon?: string;
    variant?: string;
    state?: string;
    onClick?: () => void;
    label?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="flex:none;width:{v.boxSize};height:{v.boxSize};display:inline-flex">
  {#if v.isSurface}
    <div class="dc-p0" style="display:flex;flex:none;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-md);cursor:pointer;transform:{v.pressTransform};background:{v.surfaceBg};box-shadow:{v.focusRing};" onclick={v.onPress} role="button" tabindex="0" aria-label={v.ariaLabel} title={v.ariaLabel}>
      <span style="flex:none;width:17px;height:17px;background:var(--ink-2,#B9B9C6);mask:{v.maskCss}"></span>
    </div>
  {/if}
  {#if v.isGhost}
    <div class="dc-p1" style="display:flex;flex:none;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-md);cursor:pointer;transform:{v.pressTransform};background:{v.ghostBg};box-shadow:{v.focusRing};" onclick={v.onPress} role="button" tabindex="0" aria-label={v.ariaLabel} title={v.ariaLabel}>
      <span style="flex:none;width:17px;height:17px;background:{v.ghostInk};mask:{v.maskCss}"></span>
    </div>
  {/if}
  {#if v.isAccent}
    <div class="dc-p2" style="display:flex;flex:none;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);cursor:pointer;transform:{v.pressTransform};background:{v.accentBg};box-shadow:{v.focusRing};" onclick={v.onPress} role="button" tabindex="0" aria-label={v.ariaLabel} title={v.ariaLabel}>
      <span style="flex:none;width:17px;height:17px;background:var(--on-accent,#2E0512);mask:{v.maskCss}"></span>
    </div>
  {/if}
  {#if v.isOverlay}
    <div class="dc-p3" style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer;transform:{v.pressTransform};background:{v.overlayBg};box-shadow:{v.overlayRing};" onclick={v.onPress} role="button" tabindex="0" aria-label={v.ariaLabel} title={v.ariaLabel}>
      <span style="width:16px;height:16px;background:var(--ink-3,#8A8A99);mask:{v.maskCss}"></span>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p1:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p2:hover{background:var(--accent-hover,#ff6d85) !important}
  .dc-p3:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
</style>
