<!-- Generated from lib/DeleteGroupDialog.dc.html (source hash e8ca1d1b) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './DeleteGroupDialog.logic.js';

  interface Props {
    groupName?: string;
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
  <div style="position:relative;width:100%;max-width:480px;max-height:100%;box-sizing:border-box;display:flex;flex-direction:column;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--btn-danger-bg,rgba(240,68,56,.08));box-shadow:inset 0 0 0 1px var(--btn-danger-line,rgba(240,68,56,.5))">
        <span style="width:19px;height:19px;background:var(--status-danger,#F5493D);mask:{v.trashMask}"></span>
      </span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Delete a {t(v.noun)}</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.groupName)}</span>
      </div>
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;padding:var(--space-32) var(--space-18);display:flex;flex-direction:column;gap:var(--space-32)">
      <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0;padding-inline:var(--space-14)">
        <span style="font:var(--weight-bold) var(--text-2xl)/1.3 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-wrap:pretty">Delete the <span style="color:var(--status-danger,#F5493D)">{t(v.groupName)}</span> chat {t(v.noun)}</span>
        <span style="font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Do you definitely want to delete this {t(v.noun)}? All of your chat history will be lost, and this cannot be undone.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
        <input style="width:100%;box-sizing:border-box;height:var(--control-xl,44px);padding:0 var(--space-14);border:none;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.inputLine};font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1);outline:none" value={v.typed} oninput={v.onType} placeholder={v.groupName}>
        <span style="padding-inline-start:var(--space-14);font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">Type in the name of the {t(v.noun)} to confirm delete</span>
      </div>
    </div>

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p1" style="flex:none;padding:var(--space-10) var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onCancel} role="button" tabindex="0">Keep my {t(v.noun)}</span>
      <span style="flex:1"></span>
      <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:{v.deleteBg};box-shadow:inset 0 0 0 1px {v.deleteLine};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.deleteInk};cursor:{v.deleteCursor};user-select:none" onclick={v.onConfirm} role="button" tabindex="0">
        <span style="width:16px;height:16px;background:{v.deleteInk};mask:{v.trashMask}"></span>
        <span>Delete</span>
      </div>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
</style>
