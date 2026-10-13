<!-- Generated from lib/WalletRecipients.dc.html (source hash 8d8543ca) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './WalletRecipients.logic.js';
  import PageHeader from '../../lib/components/PageHeader.svelte';

  interface Props {
    tokens?: Array<{symbol:string;mark:string;grad:string;held:number}>;
    recipients?: Array<{id:string;name:string;address:string;token?:string|null;last?:string}>;
    onChange?: (list) => void;
    onSend?: (recipient) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-1,#0e0e12)" data-screen-label="Wallet recipients">
  <PageHeader title={v.title} onBack={v.back} backLabel={v.backLabel}></PageHeader>
  <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:var(--space-32,32px) var(--space-24)">
    <div style="width:100%;max-width:640px;display:flex;flex-direction:column;gap:var(--space-16)">

      {#if v.isList}
        <div style="display:flex;gap:var(--space-10)">
          <div style="flex:1;min-width:0;display:flex;align-items:center;gap:var(--space-10);height:44px;padding:0 var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:none;width:15px;height:15px;background:var(--ink-4,#7C7C8C);mask:var(--icon-search) center/contain no-repeat"></span>
            <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.query} oninput={v.onQuery} placeholder="Search name or address" aria-label="Search recipients">
          </div>
          <span class="dc-p0" style="flex:none;display:flex;align-items:center;gap:var(--space-8);height:44px;padding:0 var(--space-16);box-sizing:border-box;border-radius:var(--radius-md);background:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onAdd} role="button" tabindex="0">
            <span style="width:14px;height:14px;background:var(--on-accent,#2E0512);mask:var(--icon-plus) center/contain no-repeat"></span>
            <span style="font:var(--weight-bold) var(--text-sm)/1 var(--font-sans);color:var(--on-accent,#2E0512)">Add recipient</span>
          </span>
        </div>

        <div style="display:flex;flex-direction:column;gap:var(--space-8)">
          {#each v.rows ?? [] as r, i0}
            <div style="position:relative;display:flex;align-items:center;gap:var(--space-14);min-height:66px;padding:var(--space-12) var(--space-12) var(--space-12) var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.045));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))">
              <span style="flex:none;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:{r.grad};font:var(--weight-bold) 15px/1 var(--font-sans);color:#0e0e12">{t(r.initial)}</span>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
                <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0">
                  <span style="flex:0 1 auto;min-width:3em;font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(r.name)}</span>
                  <span style="flex:none;height:18px;display:flex;align-items:center;padding:0 6px;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.08));font:var(--weight-semibold) 10px/1 var(--font-mono);letter-spacing:.06em;color:var(--ink-2,#C9C9D4)">{t(r.net)}</span>
                  {#if r.locked}<span style="flex:none;height:18px;display:flex;align-items:center;gap:4px;padding:0 6px;border-radius:var(--radius-sm);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));font:var(--weight-semibold) 10px/1 var(--font-mono);color:var(--ink-3,#9A9AA8)" title={r.lockTitle}><span style="width:9px;height:9px;background:currentColor;mask:var(--icon-lock) center/contain no-repeat"></span>{t(r.token)}</span>{/if}
                </div>
                <div style="display:flex;align-items:baseline;gap:var(--space-6);min-width:0;white-space:nowrap"><span style="min-width:0;font:var(--weight-regular) var(--text-sm)/1.2 var(--font-mono);color:{r.addrInk};overflow:hidden;text-overflow:ellipsis">{t(r.short)}</span><span style="flex:none;font:var(--weight-regular) var(--text-xs)/1.2 var(--font-sans);color:var(--ink-4,#7C7C8C)">· {t(r.last)}</span></div>
              </div>
              {#if r.idle}
                <span class="dc-p1" style="flex:none;display:flex;align-items:center;gap:6px;height:34px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={r.onSend} role="button" tabindex="0" aria-label={r.sendAria}><span style="width:13px;height:13px;background:currentColor;mask:var(--icon-send) center/contain no-repeat"></span>Send</span>
                <span class="dc-p2" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);background:{r.menuBg};cursor:pointer" onclick={r.onMenu} oncontextmenu={r.onMenu} role="button" tabindex="0" aria-label="Recipient options" aria-expanded={r.menuStr}><span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:var(--icon-more) center/contain no-repeat"></span></span>
              {/if}
              {#if r.confirming}
                <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Remove?</span>
                <span class="dc-p3" style="flex:none;display:flex;align-items:center;height:34px;padding:0 var(--space-12);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer" onclick={r.onCancelRemove} role="button" tabindex="0">Cancel</span>
                <span class="dc-p4" style="flex:none;display:flex;align-items:center;height:34px;padding:0 var(--space-12);border-radius:var(--radius-md);background:var(--status-danger,#F5493D);font:var(--weight-bold) var(--text-sm)/1 var(--font-sans);color:#fff;cursor:pointer" onclick={r.onRemove} role="button" tabindex="0">Remove</span>
              {/if}
              {#if r.menuOpen}
                <div style="position:fixed;inset:0;z-index:4" onclick={v.closeMenu}></div>
                <div style="position:absolute;z-index:5;inset-inline-end:10px;top:calc(100% - 8px);width:200px;padding:6px;border-radius:var(--radius-md);background:var(--surface-3,#24242e);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 12px 30px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:2px" role="menu">
                  {#each r.menu ?? [] as m, i1}<span class="dc-p5" style="display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:var(--radius-sm);font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:{m.ink};cursor:pointer" onclick={m.press} role="menuitem" tabindex="0"><span style="flex:none;width:15px;height:15px;background:{m.ink};mask:{m.mask}"></span>{t(m.label)}</span>{/each}
                </div>
              {/if}
            </div>
          {/each}
          {#if v.empty}
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-10);padding:var(--space-48,48px) var(--space-24);text-align:center">
              <span style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:var(--overlay-2,rgba(255,255,255,.08))"><span style="width:20px;height:20px;background:var(--ink-3,#9A9AA8);mask:var(--icon-users) center/contain no-repeat"></span></span>
              <span style="font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.emptyTitle)}</span>
              <span style="max-width:340px;font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.emptyBody)}</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if v.isForm}
        <div style="display:flex;flex-direction:column;gap:var(--space-22,22px)">
          <div style="display:flex;flex-direction:column;gap:var(--space-8)">
            <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">ADDRESS</span>
            <textarea style="width:100%;box-sizing:border-box;resize:none;padding:var(--space-12) var(--space-14);border:0;outline:none;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.addrLine};font:var(--weight-medium) var(--text-md)/1.5 var(--font-mono);color:var(--ink,#ECECF1);word-break:break-all" value={v.fAddress} oninput={v.onAddress} placeholder="Paste the recipient's address" rows="2"></textarea>
            {#if v.hasNote}
              <div style="display:flex;align-items:center;gap:var(--space-8);padding:var(--space-10) var(--space-12);border-radius:var(--radius-md);background:{v.noteBg}">
                <span style="flex:none;width:14px;height:14px;background:{v.noteInk};mask:{v.noteMask}"></span>
                <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-sm)/1.4 var(--font-sans);color:{v.noteInk};text-wrap:pretty">{t(v.note)}</span>
              </div>
            {/if}
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-8)">
            <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">NAME</span>
            <input style="width:100%;box-sizing:border-box;height:44px;padding:0 var(--space-14);border:0;outline:none;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.fName} oninput={v.onName} placeholder={v.namePlaceholder}>
            <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">Only you see this. It replaces the address on send screens.</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-8)">
            <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">RESTRICT TO ONE TOKEN · OPTIONAL</span>
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-6)">
              {#each v.chips ?? [] as c, i2}
                <span class="dc-p6" style="flex:none;display:flex;align-items:center;gap:var(--space-6);height:32px;padding:{c.pad};box-sizing:border-box;border-radius:var(--radius-pill);background:{c.bg};box-shadow:{c.ring};cursor:pointer;user-select:none" onclick={c.pick} role="button" tabindex="0" aria-pressed={c.onStr}>
                  {#if c.hasDot}<span style="flex:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:{c.grad};font:var(--weight-bold) 9px/1 var(--font-sans);color:#0b0b0f">{t(c.mark)}</span>{/if}
                  <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{c.ink}">{t(c.label)}</span>
                </span>
              {/each}
            </div>
            <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.tokenHint)}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:var(--space-8);padding-block-start:var(--space-8)">
            <span class="dc-p7" style="display:flex;align-items:center;height:44px;padding:0 var(--space-16);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer" onclick={v.back} role="button" tabindex="0">Cancel</span>
            <span style="display:flex;align-items:center;height:44px;padding:0 var(--space-20,20px);border-radius:var(--radius-md);background:{v.saveBg};font:var(--weight-bold) var(--text-base)/1 var(--font-sans);color:{v.saveInk};cursor:{v.saveCursor};user-select:none" onclick={v.onSave} role="button" tabindex="0" aria-disabled={v.saveDisabled}>{t(v.saveLabel)}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{filter:brightness(1.08) !important}
  .dc-p1:hover{background:var(--overlay-3,rgba(255,255,255,.14)) !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{filter:brightness(1.08) !important}
  .dc-p5:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p6:hover{filter:brightness(1.15) !important}
  .dc-p7:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>
