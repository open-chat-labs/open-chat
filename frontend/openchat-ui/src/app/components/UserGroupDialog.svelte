<!-- Generated from lib/UserGroupDialog.dc.html (source hash 2c0cc062) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './UserGroupDialog.logic.js';

  interface Props {
    dialogMode?: string;
    communityName?: string;
    group?: { key?: string; title: string; members: {name: string; handle: string; color: string}[] } | null;
    people?: {name: string; handle: string; color: string}[];
    takenNames?: string[];
    onCancel?: () => void;
    onSave?: (g: {key: string|null, title: string, members: string[]}) => void;
    onDelete?: (key: string) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" data-screen-label="User group dialog" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onCancel} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:{v.cardWidth};height:{v.cardHeight};max-height:100%;box-sizing:border-box;display:flex;flex-direction:column;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:{v.headBg};box-shadow:inset 0 0 0 1px {v.headLine}">
        <span style="width:19px;height:19px;background:{v.headInk};mask:{v.headMask}"></span>
      </span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.heading)}</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.headSub)}</span>
      </div>
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    {#if v.isDelete}
      <div style="flex:1;min-height:0;overflow-y:auto;padding:var(--space-26) var(--space-18) var(--space-26);display:flex;flex-direction:column;gap:var(--space-10)">
        <span style="padding-inline:var(--space-4);font:var(--weight-bold) var(--text-xl)/1.3 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-wrap:pretty">Delete <span style="color:var(--status-danger,#F5493D)">{t(v.groupName)}</span>?</span>
        <span style="padding-inline:var(--space-4);font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Its {t(v.memberCountText)} stay in {t(v.communityName)}. Mentions of <span style="font-family:var(--font-mono);color:var(--ink,#ECECF1)">{t(v.mention)}</span> stop working, and permissions given to this group are removed.</span>
      </div>
    {/if}

    {#if v.isForm}
      <div style="flex:1;min-height:0;display:flex;flex-direction:column">
        <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-8);padding:var(--space-22) var(--space-18) 0">
          <label style="display:flex;flex-direction:column;gap:var(--space-8)">
            <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Name</span>
            <input style="height:44px;padding:0 var(--space-14);box-sizing:border-box;border:none;outline:none;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px {v.nameRing};font:var(--weight-medium) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.name} oninput={v.onName} placeholder="e.g. Developers" maxlength="40">
            <span style="padding-inline-start:var(--space-4);font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.nameHelp)}</span>
          </label>
        </div>

        <div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-18) var(--space-18) 0">
          <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Members <span style="font-weight:var(--weight-regular);color:var(--ink-4,#7C7C8C)">· {t(v.pickedCount)}</span></span>
          <div style="position:relative;flex:none;z-index:3">
            <div style="flex:none;display:flex;align-items:center;gap:var(--space-10);height:44px;padding:0 var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px {v.searchRing}">
              <span style="flex:none;width:16px;height:16px;background:var(--ink-4,#7C7C8C);mask:{v.addMask}"></span>
              <input style="flex:1;min-width:0;height:100%;border:none;outline:none;background:transparent;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.query} oninput={v.onQuery} onkeydown={v.onQueryKey} onfocus={v.onSearchFocus} onblur={v.onSearchBlur} placeholder="Add people by name or @handle">
            </div>
              {#if v.dropOpen}
              <div style="position:absolute;inset-inline:0;top:calc(100% + 6px);z-index:3;display:flex;flex-direction:column;max-height:260px;overflow-y:auto;padding:var(--space-6);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-pop,0 16px 40px rgba(0,0,0,.55))">
                {#each v.results ?? [] as r, i0}
                  <div style="display:flex;align-items:center;gap:var(--space-12);min-height:52px;padding:var(--space-6) var(--space-10);box-sizing:border-box;border-radius:var(--radius-md);background:{r.bg};cursor:pointer;user-select:none" onmousedown={r.add} onmouseenter={r.hover} role="option">
                    <span style="flex:none;width:32px;height:32px;border-radius:var(--radius-pill);background:{r.grad}"></span>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
                      <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#E4E4EC);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(r.name)}</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(r.handle)}</span>
                    </div>
                    <span style="flex:none;font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#7C7C8C);opacity:{r.hintOpacity}">↵ add</span>
                  </div>
                {/each}
                {#if v.noResults}
                  <span style="padding:var(--space-14) var(--space-10);font:var(--weight-regular) var(--text-md)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.noResultsText)}</span>
                {/if}
            </div>

            {/if}
          </div>

          <div style="flex:1;min-height:0;overflow-y:auto;margin:0 calc(var(--space-6) * -1);padding:0 var(--space-6) var(--space-14);opacity:{v.listOpacity};transition:opacity var(--duration-base,200ms) var(--ease-out)">
            {#each v.picked ?? [] as p, i1}
              <div style="display:flex;align-items:center;gap:var(--space-12);min-height:56px;padding:var(--space-8) var(--space-4);box-sizing:border-box">
                <span style="flex:none;width:38px;height:38px;border-radius:var(--radius-pill);background:{p.grad}"></span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
                  <span style="font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#E4E4EC);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(p.name)}</span>
                  <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(p.handle)}</span>
                </div>
                <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={p.remove} aria-label="Remove from group" role="button" tabindex="0" title="Remove from group"><span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span></span>
              </div>
            {/each}
            {#if v.noPicked}
              <span style="display:block;padding:var(--space-26) var(--space-8);text-align:center;font:var(--weight-regular) var(--text-md)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">No members yet. Search above to add people from {t(v.communityName)}.</span>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p2" style="flex:none;display:flex;align-items:center;height:44px;padding:0 var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onCancel} role="button" tabindex="0">Cancel</span>
      <span style="flex:1"></span>
      <div class="dc-p3" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:44px;box-sizing:border-box;border-radius:var(--radius-md);background:{v.ctaBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.ctaInk};cursor:{v.ctaCursor};user-select:none" onclick={v.onConfirm} role="button" tabindex="0">
        <span style="width:16px;height:16px;background:{v.ctaInk};mask:{v.ctaMask}"></span>
        <span>{t(v.cta)}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p3:hover{filter:brightness(1.08) !important}
</style>
