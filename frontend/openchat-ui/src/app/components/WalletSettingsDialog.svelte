<!-- Generated from lib/WalletSettingsDialog.dc.html (source hash a69b5e15) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './WalletSettingsDialog.logic.js';
  import Toggle from '../../lib/components/Toggle.svelte';

  interface Props {
    value?: { pinOn?: boolean; autoConfig?: boolean; minBalance?: string; tokens?: string[]; currency?: string; recipients?: Array<{id:string;name:string;address:string;token?:string|null}> } | null;
    section?: string;
    onChange?: (settings: object) => void;
    onCancel?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" data-screen-label="Wallet settings" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onClose} aria-hidden="true"></div>

  <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:680px;height:606px;max-height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-22);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Wallet settings</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">Changes apply as you make them</span>
      </div>
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onClose} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;display:flex;overflow:hidden">
      <div style="flex:none;width:196px;display:flex;flex-direction:column;gap:2px;padding:var(--space-14) var(--space-10);border-inline-end:1px solid var(--line-1,rgba(255,255,255,.07))">
        {#each v.nav ?? [] as n, i0}
          <span class="dc-p1" style="display:flex;align-items:center;gap:var(--space-10);height:40px;padding:0 var(--space-12);border-radius:var(--radius-md);background:{n.bg};cursor:pointer;user-select:none" onclick={n.onSelect} role="button" tabindex="0">
            <span style="flex:none;width:16px;height:16px;background:{n.ink};mask:{n.mask}"></span>
            <span style="flex:1;min-width:0;font:{n.weight} var(--text-md)/1 var(--font-sans);color:{n.ink}">{t(n.label)}</span>
          </span>
        {/each}
      </div>

      <div style="flex:1;min-width:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-32);padding:var(--space-26) var(--space-22)">
        {#if v.isTokens}
          <div style="flex:none;display:flex;align-items:flex-start;gap:var(--space-16)">
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-6)">
              <span style="font:var(--weight-bold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">Automatic configuration</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.autoDesc)}</span>
            </div>
            <div style="flex:none;margin-block-start:2px"><Toggle on={v.autoOn} onChange={v.onAutoToggle}></Toggle></div>
          </div>

          {#if v.autoOn}
            <div style="flex:none;display:flex;align-items:center;gap:var(--space-12)">
              <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">MINIMUM VALUE</span>
              <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);width:140px;padding:0 var(--space-14);height:40px;box-sizing:border-box;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                <span style="flex:none;font:var(--weight-semibold) var(--text-md)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">$</span>
                <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-semibold) var(--text-md)/1.3 var(--font-mono);color:var(--ink,#ECECF1)" value={v.minBalance} oninput={v.onMinBalance} placeholder="0" inputmode="decimal">
              </div>
            </div>
          {/if}

          <div class="dc-p2" style="flex:none;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-14);border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));cursor:pointer" onclick={v.onOpenList} role="button" tabindex="0">
            <div style="flex:none;display:flex;align-items:center;gap:var(--space-12)">
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                <span style="font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">Token list</span>
                <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.listSub)}</span>
              </div>
              <span style="flex:none;width:14px;height:14px;background:var(--ink-4,#7C7C8C);mask:{v.chevronMask}"></span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-6)">
              {#each v.shownChips ?? [] as c, i1}
                <span style="flex:none;display:flex;align-items:center;gap:var(--space-6);height:26px;padding:0 var(--space-8) 0 3px;box-sizing:border-box;border-radius:var(--radius-pill);background:var(--overlay-1,rgba(255,255,255,.05))">
                  <span style="flex:none;display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:var(--radius-pill);background:{c.gradient};font:var(--weight-bold) 9px/1 var(--font-sans);color:#0b0b0f">{t(c.mark)}</span>
                  <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(c.symbol)}</span>
                </span>
              {/each}
              {#if v.chipsOverflow}
                <span style="flex:none;display:flex;align-items:center;height:26px;padding:0 var(--space-10);box-sizing:border-box;border-radius:var(--radius-pill);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.chipsMore)}</span>
              {/if}
              {#if v.noneShown}
                <span style="font:var(--weight-regular) var(--text-sm)/1.6 var(--font-sans);color:var(--status-danger,#F5493D)">Nothing selected — the wallet is empty.</span>
              {/if}
            </div>
          </div>
        {/if}

        {#if v.isSecurity}
          <div style="flex:none;display:flex;align-items:flex-start;gap:var(--space-16)">
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-6)">
              <div style="display:flex;align-items:center;gap:var(--space-8);flex-wrap:wrap">
                <span style="font:var(--weight-bold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">PIN on transfers</span>
                <span style="flex:none;display:flex;align-items:center;gap:5px;height:20px;padding:0 var(--space-8);box-sizing:border-box;border-radius:var(--radius-pill);background:{v.pinBadgeBg}">
                  <span style="width:10px;height:10px;background:{v.pinBadgeInk};mask:{v.pinBadgeMask}"></span>
                  <span style="font:var(--weight-semibold) 10.5px/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:{v.pinBadgeInk}">{t(v.pinBadge)}</span>
                </span>
              </div>
              <span style="font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.pinDesc)}</span>
            </div>
            <div style="flex:none;margin-block-start:2px"><Toggle on={v.pinSwitch} onChange={v.onPinToggle}></Toggle></div>
          </div>
          {#if v.pinOn}
            <span class="dc-p3" style="flex:none;display:flex;align-items:center;justify-content:center;gap:var(--space-8);height:40px;border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onChangePin} role="button" tabindex="0">
              <span style="font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672)">Change PIN</span>
              <span style="width:14px;height:14px;background:var(--accent,#FF5672);mask:{v.lockMask}"></span>
            </span>
          {/if}
        {/if}

        {#if v.isCurrency}
          <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">SHOW VALUES IN</span>
          <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-6);margin-block-start:calc(-1 * var(--space-22))">
            {#each v.currencies ?? [] as c, i2}
              <span class="dc-p4" style="display:flex;align-items:center;gap:var(--space-12);height:44px;padding:0 var(--space-14);border-radius:var(--radius-md);background:{c.bg};cursor:pointer;user-select:none" onclick={c.onSelect} role="button" tabindex="0">
                <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-md)/1 var(--font-mono);color:var(--ink,#ECECF1)">{t(c.label)}</span>
                <span style="flex:none;font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(c.note)}</span>
                <span style="flex:none;width:16px;height:16px;background:{c.tickInk};mask:{v.checkMask}"></span>
              </span>
            {/each}
          </div>
        {/if}
        {#if v.isRecipients}
          <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-14);margin-block-end:calc(-1 * var(--space-32))">
            <div style="display:flex;align-items:flex-start;gap:var(--space-12)">
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-6)">
                <span style="font:var(--weight-bold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">Saved recipients</span>
                <span style="font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Addresses you can pick when sending. The network is detected from the address itself.</span>
              </div>
              <span class="dc-p5" style="flex:none;display:flex;align-items:center;gap:var(--space-8);height:34px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-md);background:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onAddRecipient} role="button" tabindex="0">
                <span style="width:13px;height:13px;background:var(--on-accent,#2E0512);mask:{v.plusMask}"></span>
                <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--on-accent,#2E0512)">Add</span>
              </span>
            </div>

            {#if v.recipSearchable}
              <div style="display:flex;align-items:center;gap:var(--space-10);height:40px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                <span style="flex:none;width:14px;height:14px;background:var(--ink-4,#7C7C8C);mask:{v.searchMask}"></span>
                <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.recipQuery} oninput={v.onRecipQuery} placeholder="Search name or address…">
              </div>
            {/if}

            <div style="display:flex;flex-direction:column;gap:var(--space-6)">
              {#each v.recipients ?? [] as r, i3}
                <div class="dc-p6" style="display:flex;align-items:center;gap:var(--space-12);min-height:58px;padding:var(--space-8) var(--space-12);box-sizing:border-box;border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                  <span style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-pill);background:{r.gradient};font:var(--weight-bold) var(--text-sm)/1 var(--font-sans);color:{r.markInk}">{t(r.mark)}</span>
                  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                    <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0">
                      <span style="flex:none;max-width:190px;font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(r.name)}</span>
                      <span style="flex:none;display:flex;align-items:center;height:18px;padding:0 var(--space-6);box-sizing:border-box;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.08));font:var(--weight-semibold) 10px/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-2,#C9C9D4)">{t(r.badge)}</span>
                    </div>
                    <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-mono);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(r.short)}</span>
                  </div>
                  {#if r.idle}
                    <div style="flex:none;display:flex;gap:2px">
                      <span class="dc-p7" style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={r.onEdit} role="button" tabindex="0" aria-label="Edit recipient" title="Edit recipient">
                        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.editMask}"></span>
                      </span>
                      <span class="dc-p8" style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={r.onAskRemove} role="button" tabindex="0" aria-label="Remove recipient" title="Remove recipient">
                        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.trashMask}"></span>
                      </span>
                    </div>
                  {/if}
                  {#if r.confirming}
                    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8)">
                      <span class="dc-p9" style="display:flex;align-items:center;height:28px;padding:0 var(--space-10);box-sizing:border-box;border-radius:var(--radius-sm);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={r.onCancelRemove} role="button" tabindex="0">Keep</span>
                      <span class="dc-p10" style="display:flex;align-items:center;height:28px;padding:0 var(--space-10);box-sizing:border-box;border-radius:var(--radius-sm);background:var(--status-danger,#F5493D);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:#2b0704;cursor:pointer;user-select:none" onclick={r.onRemove} role="button" tabindex="0">Remove</span>
                    </div>
                  {/if}
                </div>
              {/each}

              {#if v.recipEmpty}
                <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-10);padding:var(--space-32) var(--space-22);border-radius:var(--radius-lg);border:1px dashed var(--line-2,rgba(255,255,255,.14))">
                  <span style="width:22px;height:22px;background:var(--ink-4,#7C7C8C);mask:{v.usersMask}"></span>
                  <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C);text-align:center;text-wrap:pretty">{t(v.recipEmptyLabel)}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-14) var(--space-22);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.footerNote)}</span>
      <div class="dc-p11" style="flex:none;display:flex;align-items:center;padding:0 var(--space-18);height:38px;box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.onClose} role="button" tabindex="0">Done</div>
    </div>

    {#if v.listOpen}
      <div style="position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:var(--space-22)">
        <div style="position:absolute;inset:0;background:rgba(3,3,6,.66);animation:oc-veil-in 160ms ease-out both" onclick={v.onCloseList} aria-hidden="true"></div>
        <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:420px;height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#15151b);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 24px 60px rgba(0,0,0,.5);overflow:hidden;animation:oc-sheet-in 200ms cubic-bezier(.2,.8,.3,1) both">
          <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
              <span style="font:var(--weight-bold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Token list</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.listHeaderSub)}</span>
            </div>
            <span class="dc-p12" style="flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCloseList} role="button" tabindex="0">
              <span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
            </span>
          </div>

          <div style="flex:none;padding:var(--space-14) var(--space-18) 0">
            <div style="display:flex;align-items:center;gap:var(--space-10);height:42px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
              <span style="flex:none;width:15px;height:15px;background:var(--ink-4,#7C7C8C);mask:{v.searchMask}"></span>
              <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.query} oninput={v.onQuery} placeholder="Search tokens…">
              {#if v.hasQuery}
                <span class="dc-p13" style="flex:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--radius-pill);cursor:pointer" onclick={v.onClearQuery} role="button" tabindex="0">
                  <span style="width:11px;height:11px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
                </span>
              {/if}
            </div>
          </div>

          <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-14) var(--space-18) var(--space-18)">
            {#if v.autoOn}
              <div style="display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-12) var(--space-14);border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
                <span style="font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Automatic configuration decides this list right now — it follows the minimum value. Take it over to choose by hand.</span>
                <span class="dc-p14" style="display:flex;align-items:center;justify-content:center;height:34px;border-radius:var(--radius-sm);box-shadow:inset 0 0 0 1px var(--accent,#FF5672);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onTakeOver} role="button" tabindex="0">Take over the list</span>
              </div>
            {/if}

            <div style="display:flex;flex-direction:column;gap:var(--space-6)">
              {#each v.rows ?? [] as tk, i4}
                <div class="dc-p15" style="display:flex;align-items:center;gap:var(--space-12);height:52px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-md);background:{tk.rowBg};opacity:{tk.opacity};cursor:{tk.cursor};user-select:none;transition:background 160ms ease-out" onclick={tk.onToggle} role="button" tabindex="0">
                  <span style="flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-pill);background:{tk.gradient};font:var(--weight-bold) var(--text-xs)/1 var(--font-sans);color:#0b0b0f">{t(tk.mark)}</span>
                  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
                    <span style="font:var(--weight-bold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(tk.symbol)}</span>
                    <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(tk.value)}</span>
                  </div>
                  <span style="flex:none;width:18px;height:18px;background:{tk.tickInk};mask:{tk.tickMask}"></span>
                </div>
              {/each}
              {#if v.noRows}
                <span style="padding:var(--space-14) var(--space-12);font:var(--weight-regular) var(--text-md)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.noRowsLabel)}</span>
              {/if}
            </div>
          </div>

          <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-14) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:{v.listFootInk}">{t(v.listFootNote)}</span>
            <div style="flex:none;display:flex;align-items:center;padding:0 var(--space-16);height:36px;box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.onCloseList} role="button" tabindex="0">Done</div>
          </div>
        </div>
      </div>
    {/if}

    {#if v.pinOpen}
      <div style="position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;padding:var(--space-22)">
        <div style="position:absolute;inset:0;background:var(--scrim);animation:oc-veil-in 160ms ease-out both" onclick={v.onPinCancel} aria-hidden="true"></div>
        <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:392px;max-height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#15151b);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 24px 60px rgba(0,0,0,.5);overflow:hidden;animation:oc-sheet-in 200ms cubic-bezier(.2,.8,.3,1) both">
          <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
            {#if v.pinIsConfirm}
              <span class="dc-p16" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onPinBack} role="button" tabindex="0">
                <span style="width:15px;height:15px;background:var(--ink-2,#C9C9D4);mask:{v.backMask}"></span>
              </span>
            {/if}
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
              <span style="font:var(--weight-bold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.pinTitle)}</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(v.pinStepLabel)}</span>
            </div>
            <span class="dc-p17" style="flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onPinCancel} role="button" tabindex="0">
              <span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
            </span>
          </div>

          <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-22);padding:var(--space-22) var(--space-18)">
            <span style="font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">{t(v.pinBlurb)}</span>
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-12);padding:var(--space-22) var(--space-14);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.035));cursor:text" onclick={v.pinFocus} role="button" tabindex="0">
              <div style="position:relative;display:flex;gap:var(--space-8)">
                {#each v.pinDigits ?? [] as d, i5}
                  <span style="display:flex;align-items:flex-end;justify-content:center;width:34px;height:42px;box-sizing:border-box;padding-block-end:var(--space-6);border-block-end:2px solid {d.line};font:var(--weight-bold) var(--text-xl,20px)/1 var(--font-mono);color:var(--ink,#ECECF1);transition:border-color 160ms ease-out">{t(d.glyph)}</span>
                {/each}
                <input style="position:absolute;inset:0;width:100%;opacity:0;border:0;outline:none;background:none;caret-color:transparent;cursor:text" use:ref={v.pinRef} value={v.pinValue} oninput={v.onPinInput} inputmode="numeric" autocomplete="off" maxlength="6">
              </div>
              <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:{v.pinNoteInk}">{t(v.pinNote)}</span>
            </div>
          </div>

          <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-14) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span class="dc-p18" style="flex:none;padding:var(--space-8) var(--space-12);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onPinCancel} role="button" tabindex="0">Cancel</span>
            <span style="flex:1"></span>
            <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-16);height:38px;box-sizing:border-box;border-radius:var(--radius-md);background:{v.pinBtnBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.pinBtnInk};cursor:{v.pinBtnCursor};user-select:none" onclick={v.onPinNext} role="button" tabindex="0">
              <span>{t(v.pinBtnLabel)}</span>
              <span style="width:15px;height:15px;background:{v.pinBtnInk};mask:{v.pinBtnMask}"></span>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if v.recipSheet}
      <div style="position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;padding:var(--space-22)">
        <div style="position:absolute;inset:0;background:var(--scrim);animation:oc-veil-in 160ms ease-out both" onclick={v.onRecipCancel} aria-hidden="true"></div>
        <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:440px;max-height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#15151b);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 24px 60px rgba(0,0,0,.5);overflow:hidden;animation:oc-sheet-in 200ms cubic-bezier(.2,.8,.3,1) both">
          <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
              <span style="font:var(--weight-bold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.recipTitle)}</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">The network is detected from the address</span>
            </div>
            <span class="dc-p19" style="flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onRecipCancel} role="button" tabindex="0">
              <span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
            </span>
          </div>

          <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-22);padding:var(--space-22) var(--space-18)">
            <div style="display:flex;flex-direction:column;gap:var(--space-8)">
              <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">ADDRESS</span>
              <textarea style="width:100%;box-sizing:border-box;resize:none;padding:var(--space-12) var(--space-14);border:0;outline:none;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.recipAddrLine};font:var(--weight-medium) var(--text-md)/1.5 var(--font-mono);color:var(--ink,#ECECF1);word-break:break-all" value={v.recipAddress} oninput={v.onRecipAddress} placeholder="Paste the recipient's address" rows="2"></textarea>
              {#if v.recipHasNote}
                <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0;padding:var(--space-10) var(--space-12);border-radius:var(--radius-md);background:{v.recipNoteBg}">
                  <span style="flex:none;width:14px;height:14px;background:{v.recipNoteInk};mask:{v.recipNoteMask}"></span>
                  <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-sm)/1.4 var(--font-sans);color:{v.recipNoteInk};text-wrap:pretty">{t(v.recipNote)}</span>
                </div>
              {/if}
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-8)">
              <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">NAME</span>
              <input style="width:100%;box-sizing:border-box;height:44px;padding:0 var(--space-14);border:0;outline:none;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.recipName} oninput={v.onRecipName} placeholder={v.recipNamePlaceholder}>
              <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">Only you see this — it replaces the address in send screens.</span>
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-8)">
              <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">RESTRICT TO ONE TOKEN <span style="color:var(--ink-4,#6E6E7C)">· OPTIONAL</span></span>
              <div style="display:flex;flex-wrap:wrap;gap:var(--space-6)">
                {#each v.recipTokenChips ?? [] as c, i6}
                  <span class="dc-p20" style="flex:none;display:flex;align-items:center;gap:var(--space-6);height:32px;padding:{c.padding};box-sizing:border-box;border-radius:var(--radius-pill);background:{c.bg};box-shadow:{c.ring};cursor:pointer;user-select:none" onclick={c.onSelect} role="button" tabindex="0">
                    {#if c.hasDot}
                      <span style="flex:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--radius-pill);background:{c.gradient};font:var(--weight-bold) 9px/1 var(--font-sans);color:#0b0b0f">{t(c.mark)}</span>
                    {/if}
                    <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{c.ink}">{t(c.label)}</span>
                  </span>
                {/each}
              </div>
              <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.recipTokenHint)}</span>
            </div>
          </div>

          <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-14) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span class="dc-p21" style="flex:none;padding:var(--space-8) var(--space-12);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onRecipCancel} role="button" tabindex="0">Cancel</span>
            <span style="flex:1"></span>
            <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-16);height:38px;box-sizing:border-box;border-radius:var(--radius-md);background:{v.recipSaveBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.recipSaveInk};cursor:{v.recipSaveCursor};user-select:none" onclick={v.onRecipSave} role="button" tabindex="0">
              <span>{t(v.recipSaveLabel)}</span>
              <span style="width:15px;height:15px;background:{v.recipSaveInk};mask:{v.checkMask}"></span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p2:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p3:hover{background:var(--accent-soft,rgba(255,86,114,.12)) !important}
  .dc-p4:hover{background:var(--overlay-2,rgba(255,255,255,.07)) !important}
  .dc-p5:hover{filter:brightness(1.08) !important}
  .dc-p6:hover{background:var(--overlay-1,rgba(255,255,255,.04)) !important}
  .dc-p7:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p8:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p9:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p10:hover{filter:brightness(1.08) !important}
  .dc-p11:hover{filter:brightness(1.15) !important}
  .dc-p12:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p13:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p14:hover{background:var(--accent-soft,rgba(255,86,114,.12)) !important}
  .dc-p15:hover{background:var(--overlay-2,rgba(255,255,255,.07)) !important}
  .dc-p16:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p17:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p18:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p19:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p20:hover{filter:brightness(1.15) !important}
  .dc-p21:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
</style>
