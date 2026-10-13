<!-- Generated from lib/BotDialog.dc.html (source hash dccd49b7) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './BotDialog.logic.js';
  import Toggle from '../../lib/components/Toggle.svelte';

  interface Props {
    bot?: { name?: string; title?: string; description?: string; color?: string } | null;
    groupName?: string;
    installed?: boolean;
    initialStep?: string;
    onRemove?: (b: {name: string}) => void;
    onInstall?: (bot: object) => void;
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

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--accent-soft,rgba(255,86,114,.12));box-shadow:inset 0 0 0 1px var(--accent-dim,rgba(255,86,114,.35))">
        <span style="width:19px;height:19px;background:var(--accent,#FF5672);mask:{v.botMask}"></span>
      </span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.headerTitle)}</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.headerSub)}</span>
      </div>
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:var(--space-26) var(--space-18) var(--space-32);display:flex;flex-direction:column;gap:var(--space-26)">

      {#if v.isDetails}
        <div style="display:flex;align-items:center;gap:var(--space-14);min-width:0">
          <span style="flex:none;width:58px;height:58px;border-radius:var(--radius-lg);background:{v.botGradient}"></span>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)">
            <span style="font:var(--weight-bold) var(--text-2xl)/1.2 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-wrap:pretty">{t(v.botName)}</span>
            <span style="font:var(--weight-regular) var(--text-md)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-6)"><span>created by <span style="color:var(--accent,#FF5672)">{t(v.creator)}</span></span>{#if v.installed}<span style="color:var(--ink-4,#7C7C8C)">·</span><span style="display:inline-flex;align-items:center;gap:var(--space-4);font-weight:var(--weight-semibold);color:var(--status-online,#2EE6A8)"><span style="width:13px;height:13px;background:var(--status-online,#2EE6A8);mask:{v.checkMask}"></span>Installed</span>{/if}</span>
          </div>
          {#if v.canRemove}
            <div style="flex:none;display:flex;align-items:center;gap:var(--space-6)">
              {#if true}
                <span class="dc-p1" style="flex:none;display:flex;align-items:center;height:34px;padding:0 var(--space-14);border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--status-danger,#FF5A5F) 50%,transparent);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--status-danger,#FF5A5F);cursor:pointer;user-select:none" onclick={v.askRemove} aria-label="Remove {v.botName} from {v.groupName}" role="button" tabindex="0" title="Remove {v.botName} from {v.groupName}">Remove</span>
              {/if}
            </div>
          {/if}
        </div>

        <span style="font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">{t(v.description)}</span>

        <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          <span style="padding-inline-start:var(--space-2);font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(v.commandsLabel)}</span>
          <div style="display:flex;flex-direction:column;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
            {#each v.commands ?? [] as c, i0}
              <div style="display:flex;align-items:baseline;gap:var(--space-12);min-width:0;padding:var(--space-12) var(--space-14);border-block-end:1px solid {c.divider}">
                <span style="flex:none;font:var(--weight-medium) var(--text-md)/1.3 var(--font-mono);color:var(--accent-bright,#FF8298)">{t(c.name)}</span>
                <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(c.about)}</span>
              </div>
            {/each}
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:var(--space-10);min-width:0;padding:var(--space-14) var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);border:1px solid var(--line-2,rgba(255,255,255,.12))">
          <span style="flex:none;width:16px;height:16px;background:var(--ink-4,#7C7C8C);mask:{v.lockMask}"></span>
          <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-md)/1.45 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">{t(v.plainLead)}<span style="color:var(--status-chit,#FF9F45)">{t(v.plainRisky)}</span>.</span>
        </div>

        <span style="font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.detailsFootnote)}</span>

      {/if}

      {#if v.isRemove}
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-16);padding-top:var(--space-8);text-align:center">
          <div style="position:relative;width:64px;height:64px">
            <span style="position:absolute;inset:0;border-radius:var(--radius-lg);background:{v.botGradient}"></span>
            <span style="position:absolute;right:-6px;bottom:-6px;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-pill);background:var(--status-danger,#FF5A5F);box-shadow:0 0 0 3px var(--surface-1,#0e0e12)"><span style="width:14px;height:14px;background:#fff;mask:{v.trashMask}"></span></span>
          </div>
          <span style="font:var(--weight-bold) var(--text-xl)/1.25 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-wrap:balance">Remove {t(v.botName)} from {t(v.groupName)}?</span>
        </div>
        <div style="display:flex;flex-direction:column;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
          {#each v.removeFacts ?? [] as r, i1}
            <div style="display:flex;align-items:center;gap:var(--space-12);min-height:56px;padding:var(--space-10) var(--space-16);box-sizing:border-box;border-block-start:{r.divider}">
              <span style="flex:none;width:16px;height:16px;background:{r.ink};mask:{r.mask}"></span>
              <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-md)/1.45 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">{t(r.text)}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if v.isConfigure}
        {#if v.showInstallTarget}
        <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:var(--space-12) var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
          <span style="flex:none;width:34px;height:34px;border-radius:var(--radius-md);background:{v.botGradient}"></span>
          <span style="flex:none;min-width:0;font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#E4E4EC);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.botName)}</span>
          <span style="flex:none;width:16px;height:16px;background:var(--ink-4,#7C7C8C);mask:{v.arrowMask}"></span>
          <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink-2,#B9B9C6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.groupName)}</span>
        </div>
        {/if}

        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-8);min-width:0">
          <span style="flex:1;min-width:220px;font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Grant only what this bot needs. Commands that rely on a permission you revoke stop working.</span>
        </div>

        {#each v.groups ?? [] as g, i2}
          <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
            <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0;padding-inline-start:var(--space-2)">
              <span style="flex:none;width:14px;height:14px;background:var(--ink-4,#7C7C8C);mask:{g.mask}"></span>
              <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(g.label)}</span>
            </div>
            <div style="display:flex;flex-direction:column;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
              {#each g.items ?? [] as p, i3}
                <div style="display:flex;align-items:center;gap:var(--space-14);min-width:0;padding:var(--space-12) var(--space-14);border-block-end:1px solid {p.divider}">
                  <span style="flex:1;min-width:0;display:flex;align-items:center;gap:var(--space-8);font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:{p.ink}">
                    <span>{t(p.label)}</span>
                    {#if p.risky}
                      <span style="flex:none;display:flex;align-items:center;gap:4px;padding:2px var(--space-6);border-radius:var(--radius-pill);background:var(--status-chit-soft,rgba(255,159,69,.14));box-shadow:inset 0 0 0 1px var(--status-chit,#FF9F45)" title="Consequential — it can change other people's messages">
                        <span style="flex:none;width:10px;height:10px;background:var(--status-chit,#FF9F45);mask:{v.warnMask}"></span>
                        <span style="font:var(--weight-semibold) var(--text-2xs)/1.3 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--status-chit,#FF9F45)">CONSEQUENTIAL</span>
                      </span>
                    {/if}
                  </span>
                  <div style="flex:none;display:flex"><Toggle on={p.on} onChange={p.onChange}></Toggle></div>
                </div>
              {/each}
            </div>
          </div>
        {/each}

        <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          <span style="padding-inline-start:var(--space-2);font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(v.commandsLabel)}</span>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-6);min-width:0">
            {#each v.commands ?? [] as c, i4}
              {#if c.allowed}
                <span style="padding:5px var(--space-10);border-radius:var(--radius-sm);background:var(--accent-soft,rgba(255,86,114,.12));box-shadow:inset 0 0 0 1px var(--accent-dim,rgba(255,86,114,.35));font:var(--weight-medium) var(--text-sm)/1.3 var(--font-mono);color:var(--accent-bright,#FF8298)" title={c.about}>{t(c.name)}</span>
              {/if}
              {#if c.blocked}
                <span style="padding:5px var(--space-10);border-radius:var(--radius-sm);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));font:var(--weight-medium) var(--text-sm)/1.3 var(--font-mono);color:var(--ink-4,#7C7C8C);text-decoration:line-through" title={c.about}>{t(c.name)}</span>
              {/if}
            {/each}
          </div>
        </div>

        {#if v.hasBlocked}
          <div style="display:flex;flex-direction:column;gap:var(--space-8);padding:var(--space-14) var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--status-chit-soft,rgba(255,159,69,.14));box-shadow:inset 0 0 0 1px var(--status-chit,#FF9F45)">
            <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0">
              <span style="flex:none;width:16px;height:16px;background:var(--status-chit,#FF9F45);mask:{v.warnMask}"></span>
              <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#E4E4EC)">{t(v.blockedTitle)}</span>
            </div>
            <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">{t(v.blockedBody)}</span>
          </div>
        {/if}

        <span style="font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.configureFootnote)}</span>
      {/if}
    </div>

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p2" style="flex:none;padding:var(--space-10) var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onSecondary} role="button" tabindex="0">{t(v.secondaryLabel)}</span>
      <span style="flex:1"></span>
      {#if v.showPrimary}
      <div class="dc-p3" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:{v.primaryBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.primaryInk};cursor:pointer;user-select:none" onclick={v.onPrimary} role="button" tabindex="0">
        <span>{t(v.primaryLabel)}</span>
        <span style="width:16px;height:16px;background:{v.primaryInk};mask:{v.primaryMask}"></span>
      </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:color-mix(in oklch,var(--status-danger,#FF5A5F) 12%,transparent) !important}
  .dc-p2:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p3:hover{filter:brightness(1.08) !important}
</style>
