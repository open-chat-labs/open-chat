<!-- Generated from lib/ProfileDialog.dc.html (source hash 3f17d9eb) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ProfileDialog.logic.js';
  import Badge from '../../lib/components/Badge.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';

  interface Props {
    name?: string;
    handle?: string;
    about?: string;
    isDiamond?: boolean;
    isVerified?: boolean;
    streak?: number;
    balance?: number;
    claimable?: boolean;
    section?: string;
    memberSince?: string;
    userId?: string;
    onClose?: () => void;
    onChit?: () => void;
    onSave?: (v:{name:string,handle:string,about:string}) => void;
    onLogout?: () => void;
    onShare?: () => void;
    onCoverEdit?: (isDiamond:boolean) => void;
    onPhotoEdit?: () => void;
    onVerify?: () => void;
    onDiamond?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onCancel} aria-hidden="true"></div>
  <div style="position:relative;display:flex;width:100%;max-width:860px;height:770px;max-height:100%;box-sizing:border-box;border:1px solid var(--line-2,rgba(255,255,255,.1));border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;width:250px;display:flex;flex-direction:column;background:var(--surface-0,#07070a);border-inline-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:14px 10px 12px">
        {#each v.nav ?? [] as g, i0}
          <div style="display:flex;flex-direction:column;gap:4px">
            <span style="padding:6px 10px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">{t(g.label)}</span>
            {#each g.items ?? [] as n, i1}
              <div class="dc-p0" style="display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:var(--radius-sm);background:{n.bg};cursor:pointer;user-select:none" onclick={n.onPress} role="button" tabindex="0">
                <span style="flex:none;width:15px;height:15px;background:{n.ink};mask:{n.mask}"></span>
                <span style="flex:1;font:{n.weight} var(--text-md)/1 var(--font-sans);color:{n.labelInk}">{t(n.title)}</span>
                <span style="font:var(--weight-semibold) 10.5px/1 var(--font-mono);color:{n.metaInk}">{t(n.meta)}</span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
      <div style="flex:none;padding:8px 10px;border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
        <div class="dc-p1" style="display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:var(--radius-sm);cursor:pointer;user-select:none" onclick={v.onLogout} role="button" tabindex="0">
          <span style="flex:none;width:15px;height:15px;background:var(--ink-3,#8A8A99);mask:{v.m.logout}"></span>
          <span style="flex:1;font:500 var(--text-md)/1 var(--font-sans);color:var(--ink-2,#B9B9C6)">Log out</span>
        </div>
      </div>
    </div>

    <div style="flex:1;min-width:0;display:flex;flex-direction:column">
      <div style="flex:none;display:flex;align-items:center;gap:12px;height:69px;box-sizing:border-box;padding:0 26px;border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
        <span style="flex:1;font:var(--weight-bold) var(--text-lg)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.sectionTitle)}</span>
        <span class="dc-p2" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;margin-inline-end:-8px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} aria-label="Close" role="button" tabindex="0" title="Close"><span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.m.close}"></span></span>
      </div>

      {#if v.isProfile}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:18px">
          <div style="flex:none;position:relative;height:118px;border-radius:var(--radius-lg);background:{v.cover}">
            <span class="dc-p3" style="position:absolute;top:var(--space-8);inset-inline-end:var(--space-8);display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);background:var(--card-2,#1B1B21);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));cursor:pointer" onclick={v.onCoverEdit} aria-label="Change cover" role="button" tabindex="0" title="Change cover"><span style="width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{v.m.edit}"></span></span>
          </div>
          <div style="flex:none;display:flex;align-items:flex-end;gap:16px;margin-top:-44px;padding-inline:16px">
            <span style="position:relative;flex:none;width:88px;height:88px;border-radius:var(--radius-pill);background:{v.avatar};box-shadow:0 0 0 4px var(--surface-1,#0e0e12)">
              <span class="dc-p4" style="position:absolute;bottom:-2px;inset-inline-end:-2px;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);background:var(--card-2,#1B1B21);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 0 0 3px var(--surface-1,#0e0e12);cursor:pointer" onclick={v.onPhotoEdit} aria-label="Change photo" role="button" tabindex="0" title="Change photo"><span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.m.edit}"></span></span>
            </span>
            <div style="position:relative;flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;padding-bottom:4px">
              <div style="display:flex;align-items:center;gap:6px;min-width:0">
                <span style="font:var(--weight-bold) var(--text-xl)/1.2 var(--font-sans);letter-spacing:-.01em;color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.name)}</span>
                {#if v.isVerified}<span style="flex:none;display:grid;grid-template-columns:max-content"><Badge variant="verified"></Badge></span>{/if}
                {#if v.isDiamond}<span style="flex:none;display:grid;grid-template-columns:max-content"><Badge variant="tag" label="DIAMOND"></Badge></span>{/if}
                {#if v.showChitTag}<span class="dc-p5" style="flex:none;display:grid;grid-template-columns:max-content;border-radius:var(--radius-pill);cursor:pointer" onclick={v.onChitTag} aria-label={v.chitTagTitle} role="button" tabindex="0" title={v.chitTagTitle}><Badge variant="chit" label={v.chitTag}></Badge></span>{/if}
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">@{t(v.handle)}</span>
              </div>
            </div>
          </div>

<span style="flex:none;margin-top:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">PUBLIC PROFILE</span>
          <div style="flex:none;margin-top:-10px;display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
            {#each v.fields ?? [] as f, i2}
              <div style="display:flex;flex-direction:column;border-block-start:{f.divider}">
                {#if f.idle}
                  <div class="dc-p6" style="display:flex;align-items:center;gap:14px;min-height:56px;padding:0 16px;cursor:pointer" onclick={f.onEdit} role="button" tabindex="0">
                    <span style="flex:none;width:110px;font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(f.label)}</span>
                    <span style="flex:1;min-width:0;font:{f.font};color:{f.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(f.display)}</span>
                    <span style="flex:none;width:14px;height:14px;background:var(--ink-3,#8A8A99);mask:{v.m.edit}"></span>
                  </div>
                {/if}
                {#if f.editing}
                  <div style="display:flex;flex-direction:column;gap:10px;padding:16px;background:var(--overlay-1,rgba(255,255,255,.05))">
                    <div style="display:flex;align-items:baseline;gap:8px"><span style="flex:1;font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(f.label)}</span><span style="font:var(--weight-medium) 10.5px/1 var(--font-mono);color:var(--ink-4,#6E6E7C)">{t(f.count)}</span></div>
                    {#if f.isArea}
                      <textarea style="box-sizing:border-box;width:100%;resize:none;padding:11px 12px;border:none;outline:none;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:{f.ring};font:var(--weight-regular) 13px/1.5 var(--font-sans);color:var(--ink,#ECECF1)" use:ref={f.ref} value={f.draft} oninput={f.onInput} onkeydown={f.onKey} maxlength={f.max} rows="3"></textarea>
                    {/if}
                    {#if f.isLine}
                      <div style="display:flex;align-items:center;height:40px;padding:0 12px;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:{f.ring}">
                        {#if f.mono}<span style="font:var(--weight-medium) 13px/1 var(--font-mono);color:var(--ink-4,#6E6E7C)">@</span>{/if}
                        <input style="flex:1;min-width:0;height:100%;padding:0;border:none;outline:none;background:transparent;font:{f.font};color:var(--ink,#ECECF1)" use:ref={f.ref} value={f.draft} oninput={f.onInput} onkeydown={f.onKey} maxlength={f.max} placeholder={f.placeholder}>
                      </div>
                    {/if}
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="flex:1;font:var(--weight-regular) 10.5px/1.3 var(--font-sans);color:{f.hintInk}">{t(f.hint)}</span>
                      <span class="dc-p7" style="padding:8px 12px;border-radius:var(--radius-sm);font:var(--weight-semibold) 12px/1 var(--font-sans);color:var(--ink-2,#B9B9C6);cursor:pointer;user-select:none" onclick={f.onCancel} role="button" tabindex="0">Cancel</span>
                      <span class="dc-p8" style="display:flex;align-items:center;height:30px;padding:0 14px;border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) 12px/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none;opacity:{f.saveOpacity};pointer-events:{f.savePointer}" onclick={f.onSave} role="button" tabindex="0">Save</span>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          <span style="flex:none;margin-top:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">ACCOUNT</span>
          <div style="flex:none;margin-top:-10px;display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
            <div style="display:flex;align-items:center;gap:14px;min-height:56px;padding:0 16px">
              <span style="flex:none;width:110px;font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">Status</span>
              <span style="flex:1;display:flex;align-items:center;gap:8px;font:var(--weight-medium) 13px/1 var(--font-sans);color:var(--ink,#ECECF1)"><span style="width:7px;height:7px;border-radius:var(--radius-pill);background:var(--status-online,#2EE6A8)"></span>Online</span>
            </div>
            <div style="display:flex;align-items:center;gap:14px;min-height:56px;padding:0 16px;border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
              <span style="flex:none;width:110px;font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">Member since</span>
              <span style="flex:1;font:var(--weight-medium) 13px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.memberSince)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:14px;min-height:56px;padding:0 16px;border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
              <span style="flex:none;width:110px;font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">User ID</span>
              <span style="flex:1;min-width:0;font:var(--weight-medium) 12px/1 var(--font-mono);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.userId)}</span>
              <span class="dc-p9" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;margin-inline-end:-8px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCopy} aria-label={v.copyTitle} role="button" tabindex="0" title={v.copyTitle}><span style="width:14px;height:14px;background:{v.copyInk};mask:{v.copyMask}"></span></span>
            </div>
          </div>
        </div>
      {/if}

      {#if v.isStats}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-content:start;gap:8px">
          <div style="grid-column:1/-1;display:flex;align-items:flex-end;gap:14px;padding:18px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
            <div style="flex:1;display:flex;flex-direction:column;gap:9px"><span style="font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">Online this month</span><span style="font:var(--weight-bold) var(--text-3xl)/1 var(--font-sans);letter-spacing:-.02em;color:var(--ink,#ECECF1)">{t(v.onlineNow)}<span style="margin-inline-start:6px;font:var(--weight-medium) 13px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">min</span></span></div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px">
              <span style="display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:var(--radius-pill);background:{v.onlineWash};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{v.onlineInk}"><span style="width:11px;height:11px;background:{v.onlineInk};mask:{v.onlineMask}"></span>{t(v.onlineDelta)}</span>
              <span style="font:var(--weight-regular) 11px/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.onlinePrev)} last month</span>
            </div>
          </div>
          {#each v.statExtras ?? [] as e, i3}
            <div style="min-width:0;display:flex;flex-direction:column;gap:10px;padding:20px 16px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))"><span style="font:var(--weight-bold) 24px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(e.count)}</span><span style="font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(e.label)}</span></div>
          {/each}
          <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:14px;padding:18px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
            <div style="display:flex;align-items:baseline"><span style="flex:1;font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">Messages sent</span><span style="font:var(--weight-bold) 15px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.msgTotal)}</span></div>
            {#each v.statMix ?? [] as x, i4}
              <div style="display:grid;grid-template-columns:150px minmax(0,1fr) 44px;align-items:center;gap:12px">
                <span style="font:var(--weight-medium) var(--text-md)/1.2 var(--font-sans);color:var(--ink-2,#C9C9D4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(x.label)}</span>
                <div style="height:6px;border-radius:var(--radius-pill);background:var(--overlay-1,rgba(255,255,255,.06))"><div style="width:{x.rel};min-width:4px;height:100%;border-radius:var(--radius-pill);background:{x.color}"></div></div>
                <span style="text-align:end;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(x.count)}</span>
              </div>
            {/each}
          </div>
          <div style="grid-column:1/-1;display:flex;align-items:center;gap:14px;padding:20px 18px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
            <span style="flex:none;width:17px;height:17px;background:{v.reportInk};mask:{v.m.flag}"></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">Reported messages</span><span style="font:var(--weight-regular) 11px/1.35 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.reportNote)}</span></div>
            <span style="flex:none;font:var(--weight-bold) 24px/1 var(--font-sans);color:{v.reportCountInk}">{t(v.reported)}</span>
          </div>
        </div>
      {/if}

      {#if v.isChit}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:16px">
          <div style="flex:none;display:flex;align-items:center;gap:var(--space-14);padding:var(--space-16);border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
            <span style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:var(--status-chit-soft,rgba(255,159,69,.14))"><span style="width:18px;height:18px;background:var(--status-chit,#FF9F45);mask:{v.m.zap}"></span></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Enable CHIT &amp; related features</span><span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Earn CHIT for using the app and spend it on emoji packs, backgrounds and themes.</span></div>
            <div style="flex:none;display:flex"><Toggle on={v.chitEnabled} onChange={v.setChitEnabled}></Toggle></div>
          </div>
          {#if v.chitEnabled}
            <div style="flex:none;display:flex;flex-direction:column;gap:8px">
              <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">NOTIFICATIONS</span>
              <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);overflow:hidden;background:var(--overlay-1,rgba(255,255,255,.05))">
                {#each v.chitKids ?? [] as k, i5}
                  <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07));display:{k.divider}"></div>
                  <div style="display:flex;align-items:center;gap:var(--space-14);padding:var(--space-16)">
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(k.title)}</span><span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(k.hint)}</span></div>
                    <div style="flex:none;display:flex"><Toggle on={k.on} onChange={k.onChange}></Toggle></div>
                  </div>
                {/each}
              </div>
            </div>
            <div style="flex:none;display:flex;flex-direction:column;gap:8px">
              <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">DAILY PUZZLE</span>
              <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);overflow:hidden;background:var(--overlay-1,rgba(255,255,255,.05));gap:var(--space-12);padding:var(--space-16)">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Daily puzzle</span><span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">A short logic puzzle in the CHIT modal.</span></div>
                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;padding:3px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))" role="radiogroup" aria-label="Daily puzzle">
                  {#each v.puzzleOpts ?? [] as o, i6}
                    <span class="dc-p10" style="display:flex;align-items:center;justify-content:center;gap:6px;height:34px;border-radius:calc(var(--radius-md) - 3px);background:{o.bg};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{o.ink};cursor:pointer;user-select:none" onclick={o.pick} role="radio" aria-checked={o.onStr} tabindex="0"><span style="width:13px;height:13px;background:currentColor;mask:{o.mask}"></span>{t(o.label)}</span>
                  {/each}
                </div>
                <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.puzzleHint)}</span>
              </div>
            </div>
          {/if}
          {#if v.chitDisabled}
            <p style="flex:none;margin:-4px 0 0;padding-inline:4px;font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-3,#8A8A99);text-wrap:pretty">CHIT is off. You won’t earn CHIT, see streaks or get achievement alerts anywhere in OpenChat. Your {t(v.balanceLabel)} balance is kept for when you turn it back on.</p>
          {/if}
          {#if v.chitEnabled}
            <div class="dc-p11" style="flex:none;margin-top:8px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--radius-md);background:var(--status-chit-soft,rgba(255,159,69,.14));cursor:pointer;user-select:none" onclick={v.onEarn} role="button" tabindex="0">
              <span style="flex:none;width:18px;height:18px;background:var(--status-chit,#FF9F45);mask:{v.m.trophy}"></span>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><span style="font:var(--weight-semibold) 13px/1 var(--font-sans);color:var(--ink,#ECECF1)">Ways to earn more</span><span style="font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--status-chit,#FF9F45)">{t(v.earnLeft)}</span></div>
              <span style="flex:none;width:14px;height:14px;background:var(--status-chit,#FF9F45);mask:{v.m.chevRight}"></span>
            </div>
            <div style="flex:none;margin-top:4px;display:flex;align-items:center;gap:8px">
              <span class="dc-p12" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));cursor:pointer;opacity:{v.prevOpacity};pointer-events:{v.prevPointer}" onclick={v.prevMonth} aria-label="Previous month" role="button" tabindex="0" title="Previous month"><span style="width:14px;height:14px;background:var(--ink-2,#B9B9C6);mask:{v.m.chevLeft}"></span></span>
              <div style="display:flex;flex-direction:column;gap:5px;min-width:0;padding-inline:4px">
                <span style="font:var(--weight-bold) 15px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.monthLabel)}</span>
                <span style="font:var(--weight-medium) 11px/1 var(--font-mono);color:var(--ink-3,#8A8A99);white-space:nowrap"><span style="color:var(--status-chit,#FF9F45)">{t(v.monthChit)}</span> · {t(v.monthClaimed)} · <span style="color:{v.insuredInk}">{t(v.monthInsured)}</span></span>
              </div>
              <span class="dc-p13" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));cursor:pointer;opacity:{v.nextOpacity};pointer-events:{v.nextPointer}" onclick={v.nextMonth} aria-label="Next month" role="button" tabindex="0" title="Next month"><span style="width:14px;height:14px;background:var(--ink-2,#B9B9C6);mask:{v.m.chevRight}"></span></span>
              <span style="flex:1"></span>
              <div style="display:flex;gap:2px;padding:3px;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                {#each v.tzOptions ?? [] as tk, i7}
                  <span style="display:flex;align-items:center;height:24px;padding:0 10px;border-radius:6px;background:{tk.bg};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{tk.ink};cursor:pointer;user-select:none" onclick={tk.pick} role="button" tabindex="0">{t(tk.label)}</span>
                {/each}
              </div>
            </div>
            <div style="flex:none;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">
              {#each v.weekdays ?? [] as w, i8}<span style="padding:4px 0;text-align:center;font:var(--weight-medium) 10.5px/1 var(--font-sans);color:var(--ink-4,#6E6E7C)">{t(w)}</span>{/each}
              {#each v.calDays ?? [] as d, i9}
                <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;height:48px;border-radius:var(--radius-sm);background:{d.bg};box-shadow:{d.ring};opacity:{d.opacity};cursor:{d.cursor};user-select:none" onclick={d.onPress} aria-label={d.title} role="button" tabindex="0" onmouseenter={d.onEnter} onmouseleave={d.onLeave} title={d.title}>
                  <span style="font:var(--weight-semibold) 12px/1 var(--font-sans);color:{d.ink}">{t(d.label)}</span>
                  <span style="display:flex;align-items:center;gap:3px;height:10px;font:var(--weight-semibold) 10px/1 var(--font-mono);color:{d.amountInk}"><span style="width:10px;height:10px;background:{d.amountInk};mask:{v.m.shield};display:{d.iconDisplay}"></span>{t(d.amount)}</span>
                  {#if d.pop}
                    <div style="position:absolute;z-index:5;bottom:calc(100% + 6px);{d.popAlign};width:max-content;max-width:240px;display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:var(--radius-md);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 12px 32px rgba(0,0,0,.5);pointer-events:none;text-align:start">
                      <span style="font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(d.popHead)}</span>
                      {#each d.popLines ?? [] as l, i10}<span style="font:var(--weight-medium) 11.5px/1.2 var(--font-sans);color:{l.ink};white-space:nowrap">{t(l.text)}</span>{/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if v.isChats}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:18px">
          {#each v.chatGroupsTop ?? [] as g, i11}
            <div style="flex:none;display:flex;flex-direction:column;gap:8px">
              <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">{t(g.label)}</span>
              <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);overflow:hidden;background:var(--overlay-1,rgba(255,255,255,.05))">
                {#each g.rows ?? [] as r, i12}
                  <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07));display:{r.divider}"></div>
                  <div style="display:flex;align-items:center;gap:var(--space-14);padding:var(--space-16)">
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(r.title)}</span><span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(r.hint)}</span></div>
                    <div style="flex:none;display:flex"><Toggle on={r.on} onChange={r.onChange}></Toggle></div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
          <div style="flex:none;display:flex;flex-direction:column;gap:8px">
            <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">RINGTONE</span>
            <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);overflow:hidden;background:var(--overlay-1,rgba(255,255,255,.05))">
              {#each v.ringtones ?? [] as tk, i13}
                <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07));display:{tk.divider}"></div>
                <div class="dc-p14" style="display:flex;align-items:center;gap:12px;height:52px;padding:0 16px;cursor:pointer;user-select:none" onclick={tk.pick} role="button" tabindex="0">
                  <span style="flex:1;min-width:0;font:{tk.weight} var(--text-base)/1 var(--font-sans);color:var(--ink,#E4E4EC)">{t(tk.label)}</span>
                  <span style="flex:none;display:flex;align-items:center;gap:2px;height:20px">
                    {#each tk.bars ?? [] as b, i14}<span style="width:2px;height:{b.h};border-radius:1px;background:{b.ink}"></span>{/each}
                  </span>
                  <span class="dc-p15" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={tk.preview} aria-label={tk.playTitle} role="button" tabindex="0" title={tk.playTitle}><span style="width:12px;height:12px;background:{tk.playInk};mask:{tk.playMask}"></span></span>
                  <span style="flex:none;display:flex;justify-content:flex-end;width:42px"><span style="width:16px;height:16px;background:var(--accent,#FF5672);mask:{v.m.check};opacity:{tk.checkOpacity}"></span></span>
                </div>
              {/each}
            </div>
          </div>
          {#each v.chatGroupsBottom ?? [] as g, i15}
            <div style="flex:none;display:flex;flex-direction:column;gap:8px">
              <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">{t(g.label)}</span>
              <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);overflow:hidden;background:var(--overlay-1,rgba(255,255,255,.05))">
                {#each g.rows ?? [] as r, i16}
                  <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07));display:{r.divider}"></div>
                  <div style="display:flex;align-items:center;gap:var(--space-14);padding:var(--space-16)">
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(r.title)}</span><span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(r.hint)}</span></div>
                    <div style="flex:none;display:flex"><Toggle on={r.on} onChange={r.onChange}></Toggle></div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if v.isCommunities}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:8px">
          <span style="flex:none;padding-inline:4px;font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Set a different display name in each community you’ve joined. Leave it empty to use your profile name.</span>
          <span style="flex:none;margin-top:10px;padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">YOUR NAME IN EACH COMMUNITY</span>
          {#if v.commFilterShown}
            <div style="flex:none;display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))"><span style="width:13px;height:13px;background:var(--ink-3,#8A8A99);mask:{v.m.search}"></span><input style="flex:1;min-width:0;height:100%;padding:0;border:none;outline:none;background:transparent;font:var(--weight-medium) 13px/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.commQuery} oninput={v.onCommQuery} placeholder="Filter communities"></div>
          {/if}
          <div style="flex:none;display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
            {#each v.communities ?? [] as c, i17}
              <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07));display:{c.divider}"></div>
              {#if c.idle}
                <div class="dc-p16" style="display:flex;align-items:center;gap:12px;padding:16px;cursor:pointer" onclick={c.onEdit} role="button" tabindex="0">
                  <span style="flex:none;width:36px;height:36px;border-radius:12px;background:{c.grad}"></span>
                  <span style="flex:none;width:150px;font:var(--weight-medium) var(--text-md)/1.2 var(--font-sans);color:var(--ink-3,#8A8A99);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(c.name)}</span>
                  <span style="flex:1;min-width:0;font:{c.font};color:{c.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(c.shown)}</span>
                  <span style="font:var(--weight-medium) 10.5px/1 var(--font-mono);color:var(--ink-4,#6E6E7C)">{t(c.tag)}</span>
                  <span style="flex:none;width:14px;height:14px;background:var(--ink-3,#8A8A99);mask:{v.m.edit}"></span>
                </div>
              {/if}
              {#if c.editing}
                <div style="display:flex;flex-direction:column;gap:10px;padding:16px;background:var(--overlay-1,rgba(255,255,255,.05))">
                  <div style="display:flex;align-items:center;gap:10px"><span style="flex:none;width:24px;height:24px;border-radius:8px;background:{c.grad}"></span><span style="font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">Your name in {t(c.name)}</span></div>
                  <div style="display:flex;align-items:center;height:40px;padding:0 12px;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1.5px var(--accent,#FF5672)">
                    <input style="flex:1;min-width:0;height:100%;padding:0;border:none;outline:none;background:transparent;font:var(--weight-medium) 13px/1 var(--font-sans);color:var(--ink,#ECECF1)" use:ref={c.ref} value={c.draft} oninput={c.onInput} onkeydown={c.onKey} maxlength="25" placeholder={v.defaultName}>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    {#if c.hasCustom}<span class="dc-p17" style="padding:8px 0;font:var(--weight-semibold) 11.5px/1 var(--font-sans);color:var(--ink-3,#8A8A99);cursor:pointer" onclick={c.onReset} role="button" tabindex="0">Use default name</span>{/if}
                    <span style="flex:1;font:var(--weight-regular) 10.5px/1.3 var(--font-sans);color:var(--ink-4,#6E6E7C)">{t(c.hint)}</span>
                    <span class="dc-p18" style="padding:8px 12px;border-radius:var(--radius-sm);font:var(--weight-semibold) 12px/1 var(--font-sans);color:var(--ink-2,#B9B9C6);cursor:pointer;user-select:none" onclick={c.onCancel} role="button" tabindex="0">Cancel</span>
                    <span class="dc-p19" style="display:flex;align-items:center;height:30px;padding:0 14px;border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) 12px/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={c.onSave} role="button" tabindex="0">Save</span>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
          {#if v.commEmpty}
            <span style="flex:none;padding:12px 4px;font:var(--weight-regular) var(--text-md)/1.4 var(--font-sans);color:var(--ink-4,#6E6E7C)">No communities match “{t(v.commQuery)}”.</span>
          {/if}
        </div>
      {/if}

      {#if v.isSignin}
        <div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column">
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px 84px;display:flex;flex-direction:column;gap:18px">
          <div style="flex:none;display:flex;align-items:center;gap:14px;padding:16px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--status-online,#2EE6A8) 35%,transparent)">
            <span style="flex:none;display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:13px;background:color-mix(in srgb,var(--status-online,#2EE6A8) 14%,transparent)"><span style="width:20px;height:20px;background:var(--status-online,#2EE6A8);mask:{v.siCurrent.icon}"></span></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><span style="font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--status-online,#2EE6A8)">Signed in with</span><span style="font:var(--weight-semibold) 14px/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.siCurrent.title)}</span><span style="font:var(--weight-regular) 11.5px/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(v.siCurrent.id)}</span></div>
            <span style="flex:none;display:flex;align-items:center;gap:6px;font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-4,#6E6E7C)" title="You’re signed in with this method, so it can’t be unlinked"><span style="width:13px;height:13px;background:var(--ink-4,#6E6E7C);mask:{v.m.lock}"></span>Can’t unlink</span>
          </div>
          <span style="flex:none;padding-inline:4px;font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">The ways you can sign in to this account. You can’t remove the one you’re signed in with right now.</span>
          {#each v.siGroups ?? [] as g, i18}
            <div style="flex:none;display:flex;flex-direction:column;gap:8px">
              <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">{t(g.label)}</span>
              <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
                {#each g.items ?? [] as x, i19}
                  <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
                    <span style="flex:none;width:16px;height:16px;background:var(--ink-3,#8A8A99);mask:{g.icon}"></span>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:var(--weight-semibold) 13px/1.2 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(x.title)}</span><span style="font:var(--weight-regular) 11px/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(x.sub)}</span></div>
                    <span class="dc-p20" style="flex:none;display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;margin-inline-end:-6px;border-radius:var(--radius-sm);font:var(--weight-semibold) 11.5px/1 var(--font-sans);color:var(--ink-3,#8A8A99);cursor:pointer;user-select:none" onclick={x.onUnlink} role="button" tabindex="0"><span style="width:13px;height:13px;background:currentColor;mask:{v.m.unlink}"></span>Unlink</span>
                  </div>
                {/each}
                {#if g.empty}
                  <div style="padding:14px 16px 4px;font:var(--weight-regular) 11.5px/1.4 var(--font-sans);color:var(--ink-4,#6E6E7C)">{t(g.emptyText)}</div>
                {/if}
                {#if g.addIdle}
                  <div class="dc-p21" style="display:flex;align-items:center;gap:10px;height:46px;padding:0 16px;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={g.onAdd} role="button" tabindex="0"><span style="width:13px;height:13px;background:var(--accent,#FF5672);mask:{v.m.plus}"></span>{t(g.addLabel)}</div>
                {/if}
                {#if g.adding}
                  <div style="display:flex;flex-direction:column;gap:12px;padding:16px;background:var(--overlay-1,rgba(255,255,255,.05))">
                    <div style="display:flex;align-items:center;gap:8px"><span style="flex:1;font:var(--weight-semibold) 13px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.si.title)}</span><span class="dc-p22" style="padding:6px 10px;border-radius:var(--radius-sm);font:var(--weight-semibold) 12px/1 var(--font-sans);color:var(--ink-2,#B9B9C6);cursor:pointer;user-select:none" onclick={v.si.onCancel} role="button" tabindex="0">Cancel</span></div>
                    {#if v.si.isEmail}
                      <div style="display:flex;gap:8px"><div style="flex:1;min-width:0;display:flex;align-items:center;height:40px;padding:0 12px;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1.5px var(--accent,#FF5672)"><input style="flex:1;min-width:0;height:100%;padding:0;border:none;outline:none;background:transparent;font:var(--weight-medium) 13px/1 var(--font-sans);color:var(--ink,#ECECF1)" use:ref={v.si.ref} value={v.si.email} oninput={v.si.onEmail} onkeydown={v.si.onEmailKey} placeholder="name@example.com" type="email"></div><span class="dc-p23" style="flex:none;display:flex;align-items:center;height:40px;padding:0 16px;border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) 12.5px/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none;opacity:{v.si.primaryOpacity};pointer-events:{v.si.primaryPointer}" onclick={v.si.onSend} role="button" tabindex="0">Send code</span></div>
                      <span style="font:var(--weight-regular) 11px/1.4 var(--font-sans);color:{v.si.hintInk}">{t(v.si.hint)}</span>
                    {/if}
                    {#if v.si.isCode}
                      <div style="display:flex;gap:8px"><div style="flex:1;min-width:0;display:flex;align-items:center;height:40px;padding:0 12px;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1.5px var(--accent,#FF5672)"><input style="flex:1;min-width:0;height:100%;padding:0;border:none;outline:none;background:transparent;font:var(--weight-medium) 13px/1 var(--font-sans);color:var(--ink,#ECECF1)" use:ref={v.si.ref} value={v.si.code} oninput={v.si.onCode} onkeydown={v.si.onCodeKey} placeholder="6-digit code" inputmode="numeric" maxlength="6"></div><span class="dc-p24" style="flex:none;display:flex;align-items:center;height:40px;padding:0 16px;border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) 12.5px/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none;opacity:{v.si.primaryOpacity};pointer-events:{v.si.primaryPointer}" onclick={v.si.onVerify} role="button" tabindex="0">Verify</span></div>
                      <span style="font:var(--weight-regular) 11px/1.4 var(--font-sans);color:var(--ink-4,#6E6E7C)">Sent to {t(v.si.email)}. For this prototype any 6 digits work.</span>
                    {/if}
                    {#if v.si.isChecklist}
                      {#each v.si.checklist ?? [] as c, i20}
                        <div style="display:flex;align-items:center;gap:10px;min-height:32px">
                          <span style="flex:none;display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:var(--radius-pill);background:{c.bg};box-shadow:{c.ring}"><span style="width:11px;height:11px;background:var(--surface-1,#0e0e12);mask:{v.m.check};display:{c.checkDisplay}"></span></span>
                          <span style="flex:1;min-width:0;font:{c.font};color:{c.ink}">{t(c.label)}</span>
                          {#if c.hasAction}<span class="dc-p25" style="flex:none;display:flex;align-items:center;height:30px;padding:0 12px;border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) 12px/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={c.onAction} role="button" tabindex="0">{t(c.action)}</span>{/if}
                          {#if c.waiting}<span style="flex:none;font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">Waiting…</span>{/if}
                        </div>
                      {/each}
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        {#if v.siToastShown}
          <div style="position:absolute;inset-inline:26px;bottom:18px;display:flex;align-items:center;gap:12px;height:46px;padding:0 8px 0 16px;border-radius:var(--radius-md);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 14px 36px rgba(0,0,0,.5)">
            <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.siToast)}</span>
            {#if v.siCanUndo}<span class="dc-p26" style="flex:none;padding:9px 12px;border-radius:var(--radius-sm);font:var(--weight-bold) var(--text-md)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.siUndo} role="button" tabindex="0">Undo</span>{/if}
          </div>
        {/if}
        </div>
      {/if}

      {#if v.isAppearance}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:22px">
          <div style="flex:none;display:flex;flex-direction:column;gap:10px">
            <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">THEME</span>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
              {#each v.apThemes ?? [] as tk, i21}
                <div class="dc-p27" style="display:flex;flex-direction:column;gap:10px;padding:8px 8px 12px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:{tk.ring};cursor:pointer;user-select:none" onclick={tk.pick} role="button" tabindex="0">
                  <div style="position:relative;height:84px;border-radius:var(--radius-sm);overflow:hidden;background:{tk.bg};box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                    <div style="position:absolute;top:10px;inset-inline-start:10px;width:52%;height:14px;border-radius:7px;background:{tk.recv}"></div>
                    <div style="position:absolute;top:30px;inset-inline-end:10px;width:44%;height:14px;border-radius:7px;background:var(--accent,#FF5672)"></div>
                    <div style="position:absolute;top:50px;inset-inline-start:10px;width:36%;height:14px;border-radius:7px;background:{tk.recv}"></div>
                    <div style="position:absolute;inset-inline:0;bottom:0;height:12px;background:{tk.bar}"></div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;padding-inline:4px">
                    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:var(--radius-pill);box-shadow:{tk.radioRing}"><span style="width:8px;height:8px;border-radius:var(--radius-pill);background:var(--accent,#FF5672);opacity:{tk.dot}"></span></span>
                    <span style="flex:1;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(tk.label)}</span>
                  </div>
                </div>
              {/each}
            </div>
            <span style="padding-inline:4px;font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#6E6E7C)">System follows your device’s light or dark setting.</span>
          </div>
          <div style="flex:none;display:flex;flex-direction:column;gap:10px">
            <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">ACCENT COLOUR</span>
            <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">
              {#each v.apAccents ?? [] as a, i22}
                <div class="dc-p28" style="display:flex;align-items:center;gap:10px;height:48px;padding:0 12px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:{a.ring};cursor:pointer;user-select:none" onclick={a.pick} role="button" tabindex="0">
                  <span style="flex:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--radius-pill);background:{a.color}"><span style="width:12px;height:12px;background:rgba(0,0,0,.7);mask:{v.m.check};opacity:{a.dot}"></span></span>
                  <span style="flex:1;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(a.label)}</span>
                </div>
              {/each}
            </div>
          </div>
          <div style="flex:none;display:flex;flex-direction:column;gap:10px">
            <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">INTERFACE SIZE</span>
            <div style="display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
              <div style="display:flex;gap:2px;padding:3px;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                {#each v.apSizes ?? [] as s, i23}
                  <span style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:36px;border-radius:6px;background:{s.bg};cursor:pointer;user-select:none" onclick={s.pick} role="button" tabindex="0"><span style="font:var(--weight-bold) {s.glyph}/1 var(--font-sans);color:{s.ink}">A</span><span style="font:var(--weight-semibold) 12px/1 var(--font-sans);color:{s.ink}">{t(s.label)}</span></span>
                {/each}
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:var(--radius-md);background:var(--surface-1,#0e0e12)">
                <div style="align-self:flex-start;max-width:78%;padding:var(--space-12) var(--space-14);border-radius:var(--radius-xs) var(--radius-xl) var(--radius-xl) var(--radius-xl);background:var(--bubble-recv-bg,#191921);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));font:var(--weight-regular) {v.apSample}/1.45 var(--font-sans);color:var(--bubble-recv-text,#E4E4EC)">Is this size easier to read?</div>
                <div style="align-self:flex-end;max-width:78%;padding:var(--space-12) var(--space-14);border-radius:var(--radius-xl) var(--radius-xs) var(--radius-xl) var(--radius-xl);background:var(--bubble-send-bg,#B83E52);font:var(--weight-regular) {v.apSample}/1.45 var(--font-sans);color:var(--bubble-text,#FFFFFF)">Much better, thanks.</div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if v.isStorage}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:22px">
          <span style="flex:none;padding-inline:4px;font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Files you send are stored on the network. Cached data lives only on this device.</span>
          <div style="flex:none;display:flex;flex-direction:column;gap:10px">
            <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">REMOTE STORAGE</span>
            <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
              <div style="display:flex;flex-direction:column;gap:14px;padding:18px 16px">
                <div style="display:flex;align-items:baseline;gap:8px">
                  <span style="font:var(--weight-bold) 26px/1 var(--font-sans);letter-spacing:-.01em;color:var(--ink,#ECECF1)">{t(v.stUsed)}</span>
                  <span style="flex:1;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink-3,#8A8A99)">of {t(v.stCap)} used</span>
                  <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);color:{v.stPctInk}">{t(v.stPct)}</span>
                </div>
                <div style="height:8px;border-radius:var(--radius-pill);background:var(--overlay-1,rgba(255,255,255,.06));overflow:hidden"><div style="width:{v.stPct};min-width:4px;height:100%;border-radius:var(--radius-pill);background:{v.stBar}"></div></div>
                <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.stFree)} left for the images, videos and files you send. Deleting messages you sent frees their space.</span>
              </div>
              {#if v.stUpsell}
                <div class="dc-p29" style="display:flex;align-items:center;gap:12px;min-height:56px;padding:0 16px;border-block-start:1px solid var(--line-1,rgba(255,255,255,.07));cursor:pointer" onclick={v.onDiamond} role="button" tabindex="0">
                  <span style="flex:1;font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink-2,#B9B9C6)">Diamond members get 1 GB</span>
                  <span style="font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--accent,#FF5672)">Get Diamond</span>
                </div>
              {/if}
            </div>
          </div>
          <div style="flex:none;display:flex;flex-direction:column;gap:10px">
            <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">CACHE ON THIS DEVICE</span>
            <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
              <div style="display:flex;align-items:center;gap:16px;padding:16px">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Clear cached data</span>
                  <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#8A8A99);text-wrap:pretty">Cached data can occasionally become corrupted and stop the app working as it should. Use this as a last resort — your messages stay safe and reload from the network.</span>
                </div>
                <span class="dc-p30" style="flex:none;display:flex;align-items:center;gap:8px;height:38px;padding:0 16px;border-radius:var(--radius-sm);background:{v.ccBg};box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.ccInk};cursor:{v.ccCursor};white-space:nowrap;user-select:none" onclick={v.onClearCache} role="button" tabindex="0"><span style="width:14px;height:14px;background:{v.ccInk};mask:{v.ccMask};animation:{v.ccSpin}"></span>{t(v.ccLabel)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:16px;padding:16px;border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(v.rpTitle)}</span>
                  <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#8A8A99);text-wrap:pretty">Please report problems even if clearing the cache fixed them — it helps us stop them happening again.</span>
                </div>
                <span class="dc-p31" style="flex:none;display:flex;align-items:center;gap:8px;height:38px;padding:0 16px;border-radius:var(--radius-sm);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;white-space:nowrap;user-select:none" onclick={v.onReport} role="button" tabindex="0"><span style="width:14px;height:14px;background:var(--ink-2,#B9B9C6);mask:{v.m.flag}"></span>Report an issue</span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if v.isBots}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:18px">
          <span style="flex:none;padding-inline:4px;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Building an OpenChat bot? You’ll need these values for this environment — see the <a href="https://github.com/open-chat-labs/open-chat-bots" target="_blank" rel="noopener">bot development docs</a> for where each one goes.</span>
          <div style="flex:none;display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
            {#each v.botRows ?? [] as b, i24}
              <div style="display:flex;align-items:flex-start;gap:14px;padding:16px;border-block-start:{b.divider}">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:9px">
                  <span style="font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(b.label)}</span>
                  <span style="font:var(--weight-medium) 12.5px/1.55 var(--font-mono);color:var(--ink,#ECECF1);white-space:{b.ws};overflow-wrap:anywhere;user-select:all">{t(b.value)}</span>
                </div>
                <span class="dc-p32" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;margin:-6px -8px 0 0;border-radius:var(--radius-sm);cursor:pointer" onclick={b.onCopy} aria-label={b.title} role="button" tabindex="0" title={b.title}><span style="width:15px;height:15px;background:{b.ink};mask:{b.mask}"></span></span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if v.isDevice}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:18px">
          <span style="flex:none;padding-inline:4px;font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Use this account on a phone or tablet with the OpenChat app.</span>
          <div style="flex:none;display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
            {#each v.lcSteps ?? [] as s, i25}
              <div style="display:flex;align-items:center;gap:14px;min-height:56px;padding:0 16px;border-block-start:{s.divider}">
                <span style="flex:none;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.08));font:var(--weight-semibold) 12px/1 var(--font-mono);color:var(--ink-2,#B9B9C6)">{t(s.n)}</span>
                <span style="font:var(--weight-medium) var(--text-md)/1.35 var(--font-sans);color:var(--ink,#E4E4EC)">{t(s.text)}</span>
              </div>
            {/each}
          </div>
          {#if v.lcIdle}
            <div style="flex:none;display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
              <span style="flex:none;width:18px;height:18px;background:var(--status-chit,#FF9F45);mask:{v.m.shield}"></span>
              <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Only use the code on a device you trust — anyone with it can sign in to your account until it expires.</span>
              <span class="dc-p33" style="flex:none;display:flex;align-items:center;height:38px;padding:0 18px;border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#fff);cursor:pointer;white-space:nowrap;user-select:none" onclick={v.onShowLink} role="button" tabindex="0">Show code</span>
            </div>
          {/if}
          {#if v.lcLive}
            <div style="flex:none;display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 45%,transparent)">
              <div style="display:flex;align-items:center;gap:14px">
                <span style="flex:1;min-width:0;font:var(--weight-semibold) 34px/1 var(--font-mono);letter-spacing:.32em;color:var(--ink,#ECECF1);user-select:{v.lcSelect};filter:{v.lcBlur};transition:filter .2s ease">{t(v.lcCodeText)}</span>
                <span class="dc-p34" style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-sm);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));cursor:pointer" onclick={v.onCopyLink} aria-label={v.lcCopyLabel} role="button" tabindex="0" title={v.lcCopyLabel}><span style="width:15px;height:15px;background:{v.lcCopyInk};mask:{v.lcCopyMask}"></span></span>
              </div>
              <div style="height:4px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.08));overflow:hidden"><div style="width:{v.lcPct};height:100%;border-radius:var(--radius-pill);background:{v.lcBar};transition:width .25s linear"></div></div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="flex:1;font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:{v.lcInk};font-variant-numeric:tabular-nums">{t(v.lcStatus)} · trusted devices only</span>
                <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onToggleHide} role="button" tabindex="0">{t(v.lcHideLabel)}</span>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if v.isDelete}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:18px">
          <div style="flex:none;display:flex;flex-direction:column;gap:10px">
            <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">WHAT YOU’LL LOSE</span>
            <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
              {#each v.delLoss ?? [] as l, i26}
                <div style="display:flex;align-items:center;gap:14px;min-height:68px;padding:12px 16px;box-sizing:border-box;border-block-start:{l.divider}">
                  <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.08))"><span style="width:18px;height:18px;background:var(--ink-2,#B9B9C6);mask:{l.mask}"></span></span>
                  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                    <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(l.title)}</span>
                    <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(l.sub)}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
          <div style="flex:none;display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--status-danger,#F5493D) 40%,transparent)">
            <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Deleting your account is permanent and can’t be undone.</span>
            <span class="dc-p35" style="flex:none;display:flex;align-items:center;gap:8px;height:38px;padding:0 18px;border-radius:var(--radius-sm);background:var(--status-danger,#F5493D);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:#fff;cursor:pointer;white-space:nowrap;user-select:none" onclick={v.onDelOpen} role="button" tabindex="0"><span style="width:14px;height:14px;background:#fff;mask:{v.m.trash}"></span>Delete account…</span>
          </div>
        </div>
      {/if}

      {#if v.isAbout}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:22px">
          <div style="flex:none;display:flex;align-items:center;gap:14px;padding-inline:4px">
            <span style="flex:none;position:relative;width:40px;height:40px;border-radius:var(--radius-pill);background:conic-gradient(from 200deg,#FFB23F,#F7641E 45%,#E0237A 70%,#8A2BB5 90%,#FFB23F)"><span style="position:absolute;inset:10px;border-radius:var(--radius-pill);background:var(--surface-1,#0e0e12)"></span></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
              <span style="font:var(--weight-bold) var(--text-lg)/1 var(--font-sans);color:var(--ink,#ECECF1)">OpenChat</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-3,#8A8A99)">Chat that’s owned by its community</span>
            </div>
            <span style="flex:none;display:flex;align-items:center;height:26px;padding:0 10px;border-radius:var(--radius-pill);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));font:var(--weight-medium) 11px/1 var(--font-mono);color:var(--ink-3,#8A8A99);white-space:nowrap">{t(v.platform)} · v{t(v.version)}</span>
          </div>
          {#each v.aboutGroups ?? [] as g, i27}
            <div style="flex:none;display:flex;flex-direction:column;gap:10px">
              <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">{t(g.label)}</span>
              <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
                {#each g.rows ?? [] as a, i28}
                  <a class="dc-p36" style="display:flex;align-items:center;gap:14px;min-height:56px;padding:0 16px;border-block-start:{a.divider};text-decoration:none;color:inherit" href={a.href} target="_blank" rel="noopener">
                    <span style="flex:none;width:16px;height:16px;background:var(--ink-3,#8A8A99);mask:{a.mask}"></span>
                    <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(a.label)}</span>
                    <span style="flex:none;width:14px;height:14px;background:var(--ink-4,#6E6E7C);mask:{v.m.external}"></span>
                  </a>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if v.isInvite}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:22px 26px;display:flex;flex-direction:column;gap:22px">
          <span style="flex:none;padding-inline:4px;font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">Share your link with friends and family. You earn CHIT when someone you invite upgrades.</span>
          <div style="flex:none;display:flex;align-items:stretch;gap:var(--space-22);padding:18px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05))">
            <div style="flex:none;width:156px;height:156px;box-sizing:border-box;padding:10px;border-radius:var(--radius-md);background:#fff">
              <img style="display:block;width:100%;height:100%;image-rendering:pixelated" src={v.invQr} alt="QR code for your invite link">
            </div>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:var(--space-12)">
              <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:.06em;color:var(--ink-4,#7C7C8C)">YOUR INVITE LINK</span>
              <span style="font:var(--weight-medium) 12.5px/1.5 var(--font-mono);color:var(--ink,#ECECF1);overflow-wrap:anywhere;user-select:all">{t(v.invLink)}</span>
              <div style="display:flex;gap:var(--space-10)">
                <span class="dc-p37" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:38px;border-radius:var(--radius-sm);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.onInvCopy} role="button" tabindex="0"><span style="width:14px;height:14px;background:{v.invCopyInk};mask:{v.invCopyMask}"></span>{t(v.invCopyLabel)}</span>
                <span class="dc-p38" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:38px;border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#fff);cursor:pointer;user-select:none" onclick={v.onInvShare} role="button" tabindex="0"><span style="width:14px;height:14px;background:var(--on-accent,#fff);mask:{v.m.share}"></span>Share</span>
              </div>
            </div>
          </div>
          <div style="flex:none;display:flex;flex-direction:column;gap:10px">
            <span style="padding-inline:4px;font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);letter-spacing:.06em;color:var(--ink-4,#6E6E7C)">YOU EARN WHEN A FRIEND…</span>
            <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
              {#each v.invRewards ?? [] as w, i29}
                <div style="display:flex;align-items:center;gap:14px;min-height:56px;padding:0 16px;border-block-start:{w.divider}">
                  <span style="flex:none;width:16px;height:16px;background:var(--ink-3,#8A8A99);mask:{w.mask}"></span>
                  <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#E4E4EC)">{t(w.label)}</span>
                  <span style="flex:none;display:flex;align-items:center;gap:5px;font:var(--weight-bold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);font-variant-numeric:tabular-nums"><span style="width:12px;height:12px;background:var(--status-chit,#FF9F45);mask:{v.m.zap}"></span>{t(w.amount)}</span>
                </div>
              {/each}
            </div>
            <span style="padding-inline:4px;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">If they later move up a tier, you get the difference.</span>
          </div>
        </div>
      {/if}

      {#if v.isOther}
        <div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:26px">
          <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-4,#6E6E7C)">{t(v.sectionTitle)} settings aren’t designed yet.</span>
        </div>
      {/if}
    </div>
  </div>
  {#if v.delOpen}
    <div style="position:fixed;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
      <div style="position:absolute;inset:0;background:var(--scrim);animation:{v.subVeil}" onclick={v.onDelStay} aria-hidden="true"></div>
      <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:480px;max-height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.subCard}">
        <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-24) var(--space-32) var(--space-22);">
          {#if v.delCanBack}
            <span class="dc-p39" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;margin-inline-start:-10px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onDelBack} aria-label="Back" role="button" tabindex="0" title="Back"><span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.m.chevLeft}"></span></span>
          {/if}
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
            <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Delete account</span>
            <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.delStepLabel)}</span>
          </div>
          <span class="dc-p40" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onDelStay} role="button" tabindex="0"><span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.m.close}"></span></span>
        </div>
        <div style="flex:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:0 var(--space-32)">
          {#each v.delDots ?? [] as d, i30}<span style="height:3px;border-radius:var(--radius-pill);background:{d.bg};transition:background .2s"></span>{/each}
        </div>
        <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-22);padding:var(--space-32) var(--space-32) 0">
          {#if v.delStep.hasIcon}
            <span style="flex:none;display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.08))"><span style="width:24px;height:24px;background:{v.delStep.iconInk};mask:{v.delStep.icon}"></span></span>
          {/if}
          <div style="flex:none;display:flex;flex-direction:column;gap:10px">
            <span style="font:var(--weight-bold) 22px/1.25 var(--font-sans);letter-spacing:-.015em;color:var(--ink,#ECECF1);text-wrap:balance">{t(v.delStep.title)}</span>
            <span style="font:var(--weight-regular) var(--text-md)/1.6 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{#each v.delStep.body ?? [] as b, i31}<span style="color:{b.ink};font-weight:{b.w}">{t(b.t)}</span>{/each}</span>
          </div>
          {#if v.delStep.isChit}
            <div style="flex:none;display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));overflow:hidden">
              <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
                <div style="display:flex;flex-direction:column;gap:10px;padding:18px">
                  <span style="display:flex;align-items:center;gap:6px;font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)"><span style="width:12px;height:12px;background:var(--accent,#FF5672);mask:{v.m.zap}"></span>Day streak</span>
                  <span style="font:var(--weight-bold) 30px/1 var(--font-sans);letter-spacing:-.01em;color:var(--ink,#ECECF1)">{t(v.delStreak)}</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;padding:18px;border-inline-start:1px solid var(--line-1,rgba(255,255,255,.07))">
                  <span style="font:var(--weight-medium) 11px/1 var(--font-sans);color:var(--ink-3,#8A8A99)">CHIT balance</span>
                  <span style="font:var(--weight-bold) 30px/1 var(--font-sans);letter-spacing:-.01em;color:var(--ink,#ECECF1)">{t(v.delBalance)}</span>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
                <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(v.delNextMile)}</span>
                <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.delEarned)} earned in total</span>
              </div>
            </div>
          {/if}
          {#if v.delStep.isFinal}
            <div style="flex:none;display:flex;flex-direction:column;gap:8px">
              <span style="font:var(--weight-medium) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-3,#9A9AA8)">Type <span style="font-family:var(--font-mono);color:var(--ink,#ECECF1)">{t(v.delHandle)}</span> to confirm</span>
              <input style="height:44px;box-sizing:border-box;padding:0 14px;border:none;outline:none;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px {v.delInputRing};font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink,#ECECF1)" value={v.delTyped} oninput={v.onDelType} placeholder={v.delHandle} spellcheck="false" autocomplete="off">
            </div>
          {/if}
        </div>
        <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-32)">
          <span class="dc-p41" style="display:flex;align-items:center;justify-content:center;gap:10px;height:44px;border-radius:var(--radius-sm);background:{v.delStep.primaryBg};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.delStep.primaryInk};cursor:{v.delStep.primaryCursor};opacity:{v.delStep.primaryOpacity};user-select:none;transition:opacity .15s" onclick={v.onDelPrimary} role="button" tabindex="0"><span style="width:16px;height:16px;background:{v.delStep.primaryInk};mask:{v.delStep.primaryMask}"></span>{t(v.delStep.primary)}</span>
          <span class="dc-p42" style="display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:var(--radius-sm);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:{v.delStep.secondaryCursor};opacity:{v.delStep.secondaryOpacity};user-select:none" onclick={v.onDelSecondary} role="button" tabindex="0">{t(v.delStep.secondary)}<span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.delStep.secondaryMask}"></span></span>
        </div>
      </div>
    </div>
  {/if}
  {#if v.loOpen}
    <div style="position:fixed;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
      <div style="position:absolute;inset:0;background:var(--scrim);animation:{v.subVeil}" onclick={v.onLoCancel} aria-hidden="true"></div>
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:var(--space-22);width:100%;max-width:380px;box-sizing:border-box;padding:var(--space-32);border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));animation:{v.subCard}">
        <div style="flex:none;display:flex;flex-direction:column;align-items:center;gap:12px">
          <span style="width:64px;height:64px;border-radius:var(--radius-pill);background:{v.avatar};background-size:cover;background-position:center;box-shadow:0 0 0 4px var(--surface-1,#0e0e12),0 0 0 5px var(--line-2,rgba(255,255,255,.1))"></span>
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
            <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.name)}</span>
            <span style="font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">@{t(v.handle)}</span>
          </div>
        </div>
        <div style="flex:none;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">
          <span style="font:var(--weight-bold) var(--text-xl)/1.25 var(--font-sans);letter-spacing:-.01em;color:var(--ink,#ECECF1)">Log out of OpenChat?</span>
          <span style="font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Your chats, wallet and CHIT stay safe. You’ll sign back in with {t(v.loProvider)}.</span>
        </div>
        <div style="flex:none;align-self:stretch;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-10)">
          <span class="dc-p43" style="display:flex;align-items:center;justify-content:center;height:44px;border-radius:var(--radius-sm);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:{v.loCursor};opacity:{v.loCancelOpacity};user-select:none" onclick={v.onLoCancel} role="button" tabindex="0">Cancel</span>
          <span class="dc-p44" style="display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#fff);cursor:{v.loCursor};user-select:none" onclick={v.onLoConfirm} role="button" tabindex="0"><span style="width:15px;height:15px;background:var(--on-accent,#fff);mask:{v.loMask};animation:{v.loSpin}"></span>{t(v.loLabel)}</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p2:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p3:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p4:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p5:hover{filter:brightness(1.15) !important}
  .dc-p6:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p7:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p8:hover{background:var(--accent-hover,#ff6d85) !important}
  .dc-p9:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p10:hover{color:var(--ink,#ECECF1) !important}
  .dc-p11:hover{filter:brightness(1.12) !important}
  .dc-p12:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p13:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p14:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p15:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p16:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p17:hover{color:var(--ink,#ECECF1) !important}
  .dc-p18:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p19:hover{background:var(--accent-hover,#ff6d85) !important}
  .dc-p20:hover{background:var(--btn-danger-bg,rgba(240,68,56,.08)) !important;color:var(--status-danger,#F5493D) !important}
  .dc-p21:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p22:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p23:hover{background:var(--accent-hover,#ff6d85) !important}
  .dc-p24:hover{background:var(--accent-hover,#ff6d85) !important}
  .dc-p25:hover{background:var(--accent-hover,#ff6d85) !important}
  .dc-p26:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p27:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p28:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p29:hover{background:var(--overlay-1,rgba(255,255,255,.04)) !important}
  .dc-p30:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p31:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p32:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p33:hover{filter:brightness(1.08) !important}
  .dc-p34:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p35:hover{filter:brightness(1.08) !important}
  .dc-p36:hover{background:var(--overlay-1,rgba(255,255,255,.04)) !important}
  .dc-p37:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p38:hover{filter:brightness(1.08) !important}
  .dc-p39:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p40:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p41:hover{filter:brightness(1.08) !important}
  .dc-p42:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p43:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p44:hover{filter:brightness(1.08) !important}
</style>
