<!-- Generated from lib/UserChip.dc.html (source hash 348ce6b7) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './UserChip.logic.js';

  interface Props {
    label?: string;
    size?: string;
    variant?: string;
    color?: string;
    tag?: string;
    showAvatar?: boolean;
    showRemove?: boolean;
    online?: boolean;
    onRemove?: () => void;
    onClick?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div class="dc-p0" style="display:inline-flex;align-items:center;gap:var(--space-8);max-width:100%;min-width:0;box-sizing:border-box;padding:{v.pad};border-radius:var(--radius-pill);background:{v.bg};box-shadow:inset 0 0 0 1px {v.line};cursor:{v.cursor};user-select:none;--dc-p0-0-0:{v.hoverStyle || v.bg};" onclick={v.onPress} role="button" tabindex="0">
  {#if v.showAvatar}
    <span style="position:relative;flex:none;width:{v.avatarSize};height:{v.avatarSize};border-radius:var(--radius-pill);background:{v.gradient}">
      {#if v.online}
        <span style="position:absolute;inset-inline-end:-1px;inset-block-end:-1px;width:8px;height:8px;border-radius:var(--radius-pill);background:var(--status-online,#2EE6A8);box-shadow:0 0 0 2px {v.dotRing}"></span>
      {/if}
    </span>
  {/if}
  <span style="flex:1;min-width:0;font:{v.labelWeight} {v.labelSize}/1.2 var(--font-sans);color:{v.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.label)}</span>
  {#if v.hasTag}
    <span style="flex:none;padding:2px var(--space-6);border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-2xs)/1.3 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">{t(v.tag)}</span>
  {/if}
  {#if v.showRemove}
    <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:{v.removeSize};height:{v.removeSize};border-radius:var(--radius-pill);cursor:pointer;" onclick={v.onRemove} role="button" tabindex="0" aria-label="Remove" title="Remove">
      <span style="width:{v.removeIcon};height:{v.removeIcon};background:{v.removeInk};mask:{v.closeMask}"></span>
    </span>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--dc-p0-0-0) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.12)) !important}
</style>
