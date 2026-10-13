<!-- Generated from lib/ImportToCommunityDialog.dc.html (source hash 601977ac) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ImportToCommunityDialog.logic.js';

  interface Props {
    groupName?: string;
    communities?: {name:string,members:number,channels:number}[];
    onConfirm?: (community: string) => void;
    onCancel?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onCancel} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:520px;max-height:100%;box-sizing:border-box;display:flex;flex-direction:column;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.isConfirm}
        <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onBack} role="button" tabindex="0">
          <span style="width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{v.backMask}"></span>
        </span>
      {/if}
      {#if v.isPick}
        <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--accent-soft,rgba(255,86,114,.12));box-shadow:inset 0 0 0 1px var(--accent-dim,rgba(255,86,114,.35))">
          <span style="width:19px;height:19px;background:var(--accent,#FF5672);mask:{v.importMask}"></span>
        </span>
      {/if}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Import into community</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.groupName)}</span>
      </div>
      <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;padding:var(--space-32) var(--space-18);display:flex;flex-direction:column;gap:var(--space-32)">
      {#if v.isPick}
        <div style="display:flex;flex-direction:column;gap:var(--space-32);min-width:0">
          <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0;padding-inline:var(--space-14)">
            <span style="font:var(--weight-bold) var(--text-2xl)/1.3 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-wrap:pretty">Import <span style="color:var(--accent-bright,#FF8298)">{t(v.groupName)}</span><br>into a community</span>
            <span style="font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Your group becomes a <span style="font-weight:var(--weight-semibold);color:var(--ink,#E4E4EC)">channel</span> inside a community you own. The original group is deleted, but the new channel keeps its full history and all of its members.</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
            <span style="padding-inline-start:var(--space-14);font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(v.pickLabel)}</span>
            <div style="display:flex;flex-direction:column;gap:var(--space-6);min-width:0">
              {#each v.communities ?? [] as c, i0}
                <div class="dc-p2" style="width:100%;box-sizing:border-box;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-10) var(--space-12);border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08));cursor:pointer" onclick={c.onSelect} role="button" tabindex="0">
                  <span style="flex:none;width:40px;height:40px;border-radius:var(--radius-md);background:{c.gradient}"></span>
                  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                    <span style="font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#E4E4EC);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(c.name)}</span>
                    <span style="font:var(--weight-regular) var(--text-md)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(c.meta)}</span>
                  </div>
                  <span style="flex:none;width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{v.chevronMask}"></span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      {#if v.isConfirm}
        <div style="display:flex;flex-direction:column;gap:var(--space-32);min-width:0">
          <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0;padding-inline:var(--space-14)">
            <span style="font:var(--weight-bold) var(--text-2xl)/1.3 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-wrap:pretty">Are you sure you want to proceed?</span>
            <span style="font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">You are importing <span style="font-weight:var(--weight-semibold);color:var(--accent-bright,#FF8298)">{t(v.groupName)}</span> as a channel into the <span style="font-weight:var(--weight-semibold);color:var(--accent-bright,#FF8298)">{t(v.targetName)}</span> community.</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0">
          <div style="display:flex;align-items:center;gap:var(--space-12);padding:var(--space-12);border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08));min-width:0">
            <span style="flex:none;width:40px;height:40px;border-radius:var(--radius-md);background:{v.targetGradient}"></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <span style="font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#E4E4EC);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.targetName)}</span>
              <span style="font:var(--weight-regular) var(--text-md)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.targetMeta)}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-16);border-radius:var(--radius-lg);background:var(--status-chit-soft,rgba(255,159,69,.14));box-shadow:inset 0 0 0 1px var(--status-chit,#FF9F45)">
            <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0">
              <span style="flex:none;width:16px;height:16px;background:var(--status-chit,#FF9F45);mask:{v.warnMask}"></span>
              <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#E4E4EC)">This is irreversible</span>
            </div>
            <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">The group is deleted once the import finishes, and its members are told where the conversation now lives.</span>
          </div>
          </div>
        </div>
      {/if}
    </div>

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p3" style="flex:none;padding:var(--space-10) var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onCancel} role="button" tabindex="0">Cancel</span>
      <span style="flex:1"></span>
      {#if v.isConfirm}
        <div class="dc-p4" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.onConfirm} role="button" tabindex="0">
          <span style="width:16px;height:16px;background:var(--on-accent,#2E0512);mask:{v.importMask}"></span>
          <span>Yes, proceed</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p3:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p4:hover{background:var(--accent-hover,#ff6d85) !important}
</style>
