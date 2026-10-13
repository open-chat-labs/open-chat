<!-- Generated from lib/NewChannelDialog.dc.html (source hash 01911d9c) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './NewChannelDialog.logic.js';
  import Toggle from '../../lib/components/Toggle.svelte';

  interface Props {
    embedded?: boolean;
    communityName?: string;
    onCancel?: () => void;
    onCreate?: (c: {name: string, about: string, isPublic: boolean, embedded: boolean, url: string}) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onCancel} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:500px;max-height:100%;box-sizing:border-box;display:flex;flex-direction:column;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
        <span style="width:19px;height:19px;background:var(--ink-2,#B9B9C6);mask:{v.headMask}"></span>
      </span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.heading)}</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">in {t(v.communityName)}</span>
      </div>
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;padding:var(--space-24) var(--space-18);display:flex;flex-direction:column;gap:var(--space-18)">
      <label style="display:flex;flex-direction:column;gap:var(--space-8)">
        <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Channel name</span>
        <div style="display:flex;align-items:center;gap:var(--space-4);height:44px;padding:0 var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px {v.nameRing}">
          <span style="flex:none;font:var(--weight-bold) var(--text-base)/1 var(--font-sans);color:var(--ink-3,#8A8A99)">#</span>
          <input style="flex:1;min-width:0;height:100%;border:none;outline:none;background:transparent;font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.name} oninput={v.onName} placeholder="e.g. release-notes" maxlength="40">
        </div>
        <span style="padding-inline-start:var(--space-4);font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">Lowercase, no spaces. Spaces become dashes.</span>
      </label>

      {#if v.isEmbedded}
        <label style="display:flex;flex-direction:column;gap:var(--space-8)">
          <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">App URL</span>
          <input style="height:44px;padding:0 var(--space-14);box-sizing:border-box;border:none;outline:none;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink,#ECECF1)" value={v.url} oninput={v.onUrl} placeholder="https://">
          <span style="padding-inline-start:var(--space-4);font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">The page opens inside the chat area in place of messages. It must allow being embedded.</span>
        </label>
      {/if}

      <label style="display:flex;flex-direction:column;gap:var(--space-8)">
        <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Description <span style="font-weight:var(--weight-regular);color:var(--ink-4,#7C7C8C)">· optional</span></span>
        <textarea style="resize:none;padding:var(--space-12) var(--space-14);box-sizing:border-box;border:none;outline:none;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink,#ECECF1)" value={v.about} oninput={v.onAbout} rows="3" placeholder="What is this channel for?"></textarea>
      </label>

      <div style="display:flex;align-items:center;gap:var(--space-14);padding:var(--space-14) var(--space-16);border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Public channel</span>
          <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#8A8A99);text-wrap:pretty">{t(v.visHint)}</span>
        </div>
        <div style="flex:none;display:flex"><Toggle on={v.isPublic} onChange={v.setPublic}></Toggle></div>
      </div>
    </div>

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p1" style="flex:none;display:flex;align-items:center;height:44px;padding:0 var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onCancel} role="button" tabindex="0">Cancel</span>
      <span style="flex:1"></span>
      <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:44px;box-sizing:border-box;border-radius:var(--radius-md);background:{v.ctaBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.ctaInk};cursor:{v.ctaCursor};user-select:none" onclick={v.onConfirm} role="button" tabindex="0">
        <span style="width:16px;height:16px;background:{v.ctaInk};mask:{v.headMask}"></span>
        <span>{t(v.cta)}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
</style>
