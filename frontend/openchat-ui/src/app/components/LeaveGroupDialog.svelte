<!-- Generated from lib/LeaveGroupDialog.dc.html (source hash 935490b2) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './LeaveGroupDialog.logic.js';

  interface Props {
    groupName?: string;
    body?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onCancel} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:460px;max-height:100%;box-sizing:border-box;display:flex;flex-direction:column;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
        <span style="width:19px;height:19px;background:var(--ink-2,#B9B9C6);mask:{v.leaveMask}"></span>
      </span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Leave a {t(v.noun)}</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.groupName)}</span>
      </div>
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;padding:var(--space-32) var(--space-18);display:flex;flex-direction:column;gap:var(--space-32)">
      <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0;padding-inline:var(--space-14)">
        <span style="font:var(--weight-bold) var(--text-2xl)/1.3 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-wrap:pretty">Leave <span style="color:var(--accent-bright,#FF8298)">{t(v.groupName)}</span>?</span>
        <span style="font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">{t(v.body)}</span>
      </div>
    </div>

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p1" style="flex:none;padding:var(--space-10) var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onCancel} role="button" tabindex="0">Cancel</span>
      <span style="flex:1"></span>
      <div class="dc-p2" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.onConfirm} role="button" tabindex="0">
        <span style="width:16px;height:16px;background:var(--on-accent,#2E0512);mask:{v.leaveMask}"></span>
        <span>Leave {t(v.noun)}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p2:hover{background:var(--accent-hover,#ff6d85) !important}
</style>
