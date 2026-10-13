<!-- Generated from lib/WebhookDialog.dc.html (source hash af5a6630) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './WebhookDialog.logic.js';

  interface Props {
    dialogMode?: string;
    webhook?: { name?: string; url?: string; color?: string } | null;
    groupName?: string;
    onSave?: (hook: object) => void;
    onRegenerate?: (url: string) => void;
    onCancel?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onCancel} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:600px;max-height:100%;box-sizing:border-box;display:flex;flex-direction:column;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-26);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.showAvatarTile}
        <span style="position:relative;flex:none;width:38px;height:38px;border-radius:var(--radius-md);background:{v.gradient}">
          <span style="position:absolute;inset:0;border-radius:inherit;background:{v.avatarImage}"></span>
          <span style="position:absolute;inset-inline-end:-5px;inset-block-end:-5px;display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:var(--radius-pill);background:var(--card,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))">
            <span style="width:11px;height:11px;background:var(--accent,#FF5672);mask:{v.hookMask}"></span>
          </span>
        </span>
      {/if}
      {#if v.isConfirm}
        <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--status-chit-soft,rgba(255,159,69,.14));box-shadow:inset 0 0 0 1px var(--status-chit,#FF9F45)">
          <span style="width:19px;height:19px;background:var(--status-chit,#FF9F45);mask:{v.cycleMask}"></span>
        </span>
      {/if}
      {#if v.showAccentTile}
        <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--accent-soft,rgba(255,86,114,.12));box-shadow:inset 0 0 0 1px var(--accent-dim,rgba(255,86,114,.35))">
          <span style="width:19px;height:19px;background:var(--accent,#FF5672);mask:{v.hookMask}"></span>
        </span>
      {/if}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.headerTitle)}</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.headerSub)}</span>
      </div>
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:var(--space-26) var(--space-26) var(--space-32);display:flex;flex-direction:column;gap:var(--space-32)">

      {#if v.isForm}
        <div style="display:flex;flex-direction:column;gap:var(--space-32);min-width:0">
          <div style="display:flex;align-items:flex-end;gap:var(--space-16);min-width:0">
            <div style="position:relative;flex:none;width:64px;height:64px">
              <div style="width:64px;height:64px;border-radius:var(--radius-lg);background:{v.gradient}">
                <div style="width:100%;height:100%;border-radius:var(--radius-lg);background:{v.avatarImage}"></div>
              </div>
              <input style="display:none" use:ref={v.avatarRef} type="file" accept="image/*" oninput={v.onAvatarFile}>
              <div class="dc-p1" style="position:absolute;inset-inline-end:-4px;inset-block-end:-4px;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-pill);background:var(--surface-2,#17171d);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.14)),0 4px 12px rgba(0,0,0,.4);cursor:pointer" onclick={v.onPickAvatar} role="button" tabindex="0" aria-label="Upload an image" title="Upload an image">
                <span style="width:14px;height:14px;background:var(--ink,#ECECF1);mask:{v.editMask}"></span>
              </div>
            </div>
            <div style="flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-8)">
              {#each v.colors ?? [] as c, i0}
                <span style="flex:none;width:26px;height:26px;border-radius:38%;background:{c.gradient};box-shadow:{c.ring};cursor:pointer" onclick={c.onSelect} role="button" tabindex="0" aria-label={c.label} title={c.label}></span>
              {/each}
              {#if v.hasPhoto}
                <span class="dc-p2" style="flex:none;padding:var(--space-4) var(--space-10);border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.onClearAvatar} role="button" tabindex="0">Remove photo</span>
              {/if}
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
            <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">WEBHOOK NAME</span>
            <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:0 var(--space-16);height:52px;box-sizing:border-box;border-radius:var(--radius-lg);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.fieldLine}">
              <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-semibold) var(--text-lg)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.name} oninput={v.onName} placeholder="deploy_notifier" maxlength="30">
              <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(v.nameLeft)}</span>
            </div>
            <span style="padding-inline-start:var(--space-16);font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:{v.hintInk};text-wrap:pretty">{t(v.nameHint)}</span>
            {#if v.isEdit}
              <span style="padding-inline-start:var(--space-16);font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Renaming a webhook does not change its URL.</span>
            {/if}
          </div>

          {#if v.isRegister}
            <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
              <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-8);min-width:0">
                <span style="flex:none;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.registerNote)}</span>
                <span style="flex:none;display:flex;align-items:center;gap:var(--space-4);font:var(--weight-semibold) var(--text-md)/1.5 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.toggleExplainer} role="button" tabindex="0">
                  <span>{t(v.explainerLabel)}</span>
                  <span style="width:13px;height:13px;background:var(--accent,#FF5672);mask:{v.chevronMask};transform:{v.explainerTurn};transition:transform 160ms var(--ease-out)"></span>
                </span>
              </div>
              {#if v.explainerOpen}
                <span style="padding:var(--space-14) var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Your tools send an HTTP POST to the URL and the body arrives here as a message from this webhook. The URL holds a secret, so treat it like a password — anyone with it can post to this group. The full request format is in the <a style="color:var(--accent,#FF5672);text-decoration:none" href="#">bots developer guide</a>.</span>
              {/if}
            </div>
          {/if}
        </div>

        {#if v.isEdit}
          <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0">
            <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">WEBHOOK URL</span>
            {#if v.justRegenerated}
              <div style="display:flex;align-items:center;gap:var(--space-10);min-width:0;padding:var(--space-12) var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:var(--category-b-soft,rgba(46,230,168,.12));box-shadow:inset 0 0 0 1px var(--status-online,#2EE6A8)">
                <span style="flex:none;width:16px;height:16px;background:var(--status-online,#2EE6A8);mask:{v.checkMask}"></span>
                <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1.45 var(--font-sans);color:var(--ink,#E4E4EC);text-wrap:pretty">New URL generated. The old one stopped working — copy this one into your tools.</span>
              </div>
            {/if}
            <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0;padding:var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
              <div style="display:flex;align-items:center;gap:var(--space-10);min-width:0">
                <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.copyHint)}</span>
                <span class="dc-p3" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));cursor:pointer" onclick={v.onCopy} role="button" tabindex="0" aria-label="Copy the URL" title="Copy the URL">
                  <span style="width:16px;height:16px;background:{v.copyInk};mask:{v.copyMask}"></span>
                </span>
              </div>
              <span style="font:var(--weight-regular) var(--text-sm)/1.55 var(--font-mono);color:var(--ink-2,#B9B9C6);word-break:break-all;cursor:pointer" onclick={v.onCopy} role="button" tabindex="0">{t(v.url)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding-inline:var(--space-2)">
              <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Replaces the secret in the URL. Anything posting to the old one stops working.</span>
              <span class="dc-p4" style="flex:none;display:flex;align-items:center;gap:var(--space-6);padding:var(--space-8) var(--space-12);border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px var(--status-chit,#FF9F45);cursor:pointer;user-select:none" onclick={v.onAskRegenerate} role="button" tabindex="0">
                <span style="flex:none;width:14px;height:14px;background:var(--status-chit,#FF9F45);mask:{v.cycleMask}"></span>
                <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--status-chit,#FF9F45)">Regenerate</span>
              </span>
            </div>
          </div>
        {/if}
      {/if}
      {#if v.isConfirm}
        <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">STOPS WORKING</span>
          <div style="display:flex;flex-direction:column;gap:var(--space-8);padding:var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
            <span style="font:var(--weight-regular) var(--text-sm)/1.55 var(--font-mono);color:var(--ink-4,#63636F);word-break:break-all;text-decoration:line-through">{t(v.url)}</span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">AFTER YOU CONFIRM</span>
          <div style="display:flex;gap:var(--space-10);padding:var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);border:1px dashed var(--line-2,rgba(255,255,255,.14))">
            <span style="flex:none;width:16px;height:16px;margin-block-start:2px;background:var(--ink-4,#7C7C8C);mask:{v.copyMask}"></span>
            <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">A new secret is generated on confirm and the URL appears here ready to copy. It cannot be shown in advance.</span>
          </div>
        </div>

        <div style="display:flex;gap:var(--space-10);padding:var(--space-14) var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--status-chit-soft,rgba(255,159,69,.14));box-shadow:inset 0 0 0 1px var(--status-chit,#FF9F45)">
          <span style="flex:none;width:16px;height:16px;margin-block-start:2px;background:var(--status-chit,#FF9F45);mask:{v.warnMask}"></span>
          <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Nothing warns the tools posting to the old URL — they simply start failing. Have the new URL ready to paste before you regenerate.</span>
        </div>
      {/if}
    </div>

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-26);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p5" style="flex:none;padding:var(--space-10) var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onSecondary} role="button" tabindex="0">{t(v.secondaryLabel)}</span>
      <span style="flex:1"></span>
      <div class="dc-p6" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:{v.primaryBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.primaryInk};cursor:{v.primaryCursor};user-select:none" onclick={v.onPrimary} role="button" tabindex="0">
        <span>{t(v.primaryLabel)}</span>
        <span style="width:16px;height:16px;background:{v.primaryInk};mask:{v.primaryMask}"></span>
      </div>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{background:var(--status-chit-soft,rgba(255,159,69,.14)) !important}
  .dc-p5:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p6:hover{filter:brightness(1.08) !important}
</style>
