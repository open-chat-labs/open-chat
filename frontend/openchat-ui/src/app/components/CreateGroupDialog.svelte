<!-- Generated from lib/CreateGroupDialog.dc.html (source hash eedb6471) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './CreateGroupDialog.logic.js';
  import AccessGates from './AccessGates.svelte';
  import Field from '../../lib/components/Field.svelte';
  import Menu from '../../lib/components/Menu.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import TextArea from '../../lib/components/TextArea.svelte';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import UpgradeBanner from './UpgradeBanner.svelte';

  interface Props {
    kind?: string;
    communityName?: string;
    people?: {name: string, handle: string, color: string}[];
    onUpgrade?: () => void;
    advanced?: boolean;
    onCreate?: (group: object) => void;
    onCancel?: () => void;
    isDiamond?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onCancel} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:780px;height:740px;max-height:100%;box-sizing:border-box;display:flex;flex-direction:column;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-14);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0">
        <span style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
          <span style="width:18px;height:18px;background:var(--ink-2,#B9B9C6);mask:{v.groupMask}"></span>
        </span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.dialogTitle)}</span>
          {#if v.hasDialogSub}<span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.dialogSub)}</span>{/if}
        </div>
        <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
          <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
        </span>
      </div>
      <div style="position:relative;display:flex;align-items:center;gap:var(--space-10);min-width:0">
        <div style="flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.tabLabels} counts={v.tabCounts} selectedIndex={v.tabIndex} dotIndexes={v.tabDots} onSelect={v.onTab}></SegmentedTabs></div>
        {#if v.canCollapse}
          <span class="dc-p1" style="position:absolute;z-index:3;inset-block-start:50%;inset-inline-start:{v.collapseAt};transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:var(--radius-pill);background:var(--surface-2,#17171d);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.16)),0 2px 6px rgba(0,0,0,.4);cursor:pointer;user-select:none" onclick={v.onHideAdvanced} role="button" tabindex="0" aria-label="Hide the extra options" title="Hide the extra options">
            <span style="width:11px;height:11px;background:var(--ink-3,#9A9AA8);mask:{v.collapseMask}"></span>
          </span>
        {/if}
        {#if v.showMoreOptions}
          <span class="dc-p2" style="flex:none;display:flex;align-items:center;gap:var(--space-6);padding:var(--space-10) var(--space-12);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#9A9AA8);cursor:pointer;user-select:none;white-space:nowrap" onclick={v.onShowAdvanced} role="button" tabindex="0">
            <span>More options</span>
            <span style="flex:none;width:13px;height:13px;background:currentColor;mask:{v.chevronRightMask}"></span>
          </span>
        {/if}
      </div>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:var(--space-32) var(--space-18);display:flex;flex-direction:column;gap:var(--space-32)" onscroll={v.onBodyScroll}>

      {#if v.isDetails}
        <div style="display:flex;flex-direction:column;min-width:0;margin-block:calc(var(--space-32) * -1);margin-inline:calc(var(--space-18) * -1)">
          {#if v.showCover}
          <div style="position:relative;flex:none;height:{v.coverHeight};background:{v.coverValue}">
            <div style="position:absolute;inset-block-start:12px;inset-inline:0;display:flex;justify-content:center;padding-inline:var(--space-18)">
              <div style="width:100%;max-width:600px;display:flex;justify-content:flex-end;gap:var(--space-8)">
                <input style="display:none" use:ref={v.coverRef} type="file" accept="image/*" oninput={v.onCoverFile}>
                <span class="dc-p3" style="display:flex;align-items:center;gap:var(--space-6);height:36px;padding:0 var(--space-12);border-radius:var(--radius-md);background:var(--on-cover-bg);box-shadow:inset 0 0 0 1px var(--line-2);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink);cursor:pointer;user-select:none" onclick={v.onPickCover} role="button" tabindex="0"><span style="width:14px;height:14px;background:var(--ink);mask:{v.editMask}"></span>{t(v.coverUploadLabel)}</span>
                <div style="display:flex;align-items:center;gap:var(--space-8);margin-inline-end:calc(var(--space-6) * -1);padding:var(--space-6);border-radius:var(--radius-md);background:var(--on-cover-bg);box-shadow:inset 0 0 0 1px var(--line-2)">
                  {#each v.coverChoices ?? [] as c, i0}
                    <span style="width:24px;height:24px;border-radius:38%;background:{c.value};box-shadow:{c.ring};cursor:pointer" onclick={c.onSelect} role="button" tabindex="0" aria-label={c.label} title={c.label}></span>
                  {/each}
                </div>
              </div>
            </div>
          </div>
          {/if}

        <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:var(--space-22) var(--space-18) var(--space-32)">
        <div style="width:100%;max-width:600px;display:flex;flex-direction:column;gap:var(--space-26);min-width:0">
          <div style="display:flex;align-items:flex-end;gap:var(--space-16);min-width:0">
            <div style="position:relative;flex:none;width:96px;height:96px;margin-block-start:{v.avatarLift}">
              <div style="width:96px;height:96px;box-sizing:border-box;border:5px solid var(--surface-1,#0e0e12);border-radius:{v.avatarRadius};background:{v.avatarGradient}">
                <div style="width:100%;height:100%;border-radius:{v.avatarRadius};background:{v.avatarImage}"></div>
              </div>
              <input style="display:none" use:ref={v.avatarRef} type="file" accept="image/*" oninput={v.onAvatarFile}>
              <div class="dc-p4" style="position:absolute;inset-inline-end:-2px;inset-block-end:-2px;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-pill);background:var(--surface-2,#17171d);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.14)),0 4px 12px rgba(0,0,0,.4);cursor:pointer" onclick={v.onPickAvatar} role="button" tabindex="0">
                <span style="width:15px;height:15px;background:var(--ink,#ECECF1);mask:{v.editMask}"></span>
              </div>
            </div>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)">
              <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(v.photoLabel)}</span>
              <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0">
                <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">Upload one, or pick a colour</span>
                <span style="flex:1"></span>
                {#if v.hasPickedPhoto}
                  <span class="dc-p5" style="flex:none;padding:var(--space-4) var(--space-10);border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.onClearAvatar} role="button" tabindex="0">Remove photo</span>
                {/if}
                {#each v.colorChoices ?? [] as c, i1}
                  <span style="flex:none;width:24px;height:24px;border-radius:38%;background:{c.gradient};box-shadow:{c.ring};cursor:pointer" onclick={c.onSelect} role="button" tabindex="0" aria-label={c.label} title={c.label}></span>
                {/each}
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
            <div style="display:flex;align-items:baseline;gap:var(--space-6)">
              <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(v.nameLabel)}</span>
              <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672)">*</span>
            </div>
            <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:0 var(--space-16);height:52px;box-sizing:border-box;border-radius:var(--radius-lg);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.nameLine}">
              {#if v.isChannelKind}<span style="flex:none;margin-inline-end:calc(var(--space-8) * -1);font:var(--weight-bold) var(--text-base)/1 var(--font-sans);color:var(--ink-3,#8A8A99)">#</span>{/if}
              <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.name} oninput={v.onName} placeholder={v.namePlaceholder} maxlength={v.nameMax}>
              <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:{v.nameLeftInk}">{t(v.nameLeft)}</span>
            </div>
            <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:{v.nameHintInk};text-wrap:pretty">{t(v.nameHint)}</span>
          </div>

          {#if v.isCommunityKind}
            <div style="position:relative;display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
              <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Language</span>
              <div style="display:flex;align-items:center;gap:var(--space-12);height:52px;padding:0 var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.langLine};cursor:pointer;user-select:none" onclick={v.onLangToggle} role="button" tabindex="0">
                <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.langLabel)}</span>
                <span style="flex:none;width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{v.chevronDownMask};transform:{v.langChevron}"></span>
              </div>
              <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">The default language for your community, shown in Explore.</span>
              {#if v.langOpen}
                <div style="position:fixed;inset:0;z-index:19" onclick={v.onLangClose}></div>
                <div style="position:absolute;inset-inline:0;top:84px;z-index:20;display:flex;flex-direction:column;gap:var(--space-6);max-height:300px;padding:var(--space-8);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-panel,0 8px 24px rgba(0,0,0,.35))">
                  <div style="flex:none;display:grid;grid-template-columns:minmax(0,1fr)"><Field placeholder="Search languages" value={v.langQuery} onInput={v.onLangQuery} onClear={v.onLangClear} showShortcut={false}></Field></div>
                  <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px">
                    {#each v.langOptions ?? [] as l, i2}
                      <div class="dc-p6" style="display:flex;align-items:center;gap:var(--space-10);min-height:40px;padding:0 var(--space-12);border-radius:var(--radius-sm);background:{l.bg};cursor:pointer;user-select:none" onclick={l.pick} tabindex="0" role="option">
                        <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:{l.ink}">{t(l.label)}</span>
                        <span style="flex:none;width:15px;height:15px;background:var(--accent,#FF5672);mask:{v.checkMask};opacity:{l.checkOpacity}"></span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          {#if v.isEmbedded}
            <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
              <div style="display:flex;align-items:baseline;gap:var(--space-6)">
                <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">External URL</span>
                <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672)">*</span>
              </div>
              <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:0 var(--space-16);height:52px;box-sizing:border-box;border-radius:var(--radius-lg);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.urlLine}">
                <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-medium) var(--text-md)/1.3 var(--font-mono);color:var(--ink,#ECECF1)" value={v.url} oninput={v.onUrl} placeholder="https://">
              </div>
              <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:{v.urlHintInk};text-wrap:pretty">{t(v.urlHint)}</span>
            </div>
          {/if}

          <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
            <div style="display:flex;align-items:baseline;gap:var(--space-8)">
              <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Description</span>
              <span style="font:var(--weight-regular) var(--text-xs)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">Optional</span>
            </div>
            <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><TextArea value={v.about} onInput={v.onAbout} placeholder={v.aboutPlaceholder} maxLength={v.aboutMax} minHeight={49}></TextArea></div>
          </div>


          <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0">
            <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">SETTINGS</span>
            <div style="display:flex;flex-direction:column;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));overflow:hidden">
              {#each v.switches ?? [] as s, i3}
                <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0;padding:var(--space-16);border-block-end:1px solid {s.divider}">
                  {#if s.timed}
                    <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><TimedToggle density="flush" label={s.title} on={s.on} value={v.after} offHint={s.offHint} defaultOpen={true} stayOpen={true} onChange={s.onChange} onDurationChange={v.onAfter}></TimedToggle></div>
                  {/if}
                  {#if s.plain}
                  <div style="display:flex;align-items:flex-start;gap:var(--space-16);min-width:0">
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                      <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(s.title)}</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(s.hint)}</span>
                    </div>
                    <div style="flex:none;display:flex"><Toggle on={s.on} disabled={s.disabled} onChange={s.onChange}></Toggle></div>
                  </div>
                  {/if}
                  {#if s.locked}
                    <UpgradeBanner text="Public groups are a Diamond feature." onUpgrade={v.onUpgrade}></UpgradeBanner>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
        </div>
        </div>
      {/if}

      {#if v.isMembers}
        <div style="display:flex;flex-direction:column;align-items:center;min-width:0">
          <div style="width:100%;max-width:600px;display:flex;flex-direction:column;gap:var(--space-22);min-width:0">

            {#if v.isChannelKind}
              <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
                <div style="display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.memberModeLabels} counts={v.memberModeCounts} selectedIndex={v.memberModeIndex} dotIndexes={v.noDots} onSelect={v.onMemberMode}></SegmentedTabs></div>
                <span style="padding-inline:var(--space-10);font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.memberModeHint)}</span>
              </div>
            {/if}

            <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><Field placeholder={v.memberSearchPlaceholder} value={v.query} onInput={v.onQuery} onClear={v.onClearQuery} showShortcut={false}></Field></div>

            <div style="display:flex;flex-direction:column;gap:var(--space-16);min-width:0">
              <div style="display:flex;align-items:baseline;gap:var(--space-10);min-width:0;padding-inline:var(--space-10)">
                <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(v.invitedLabel)}</span>
                <span style="flex:1"></span>
                {#if v.hasPicked}
                  <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer" onclick={v.onClearAll} role="button" tabindex="0">Clear all</span>
                {/if}
              </div>
              {#if v.hasPicked}
                <div style="display:flex;flex-wrap:wrap;gap:var(--space-8);min-width:0">
                  {#each v.picked ?? [] as p, i4}
                    <span style="display:flex;align-items:center;gap:var(--space-8);padding:4px var(--space-10) 4px 4px;border-radius:var(--radius-pill);background:color-mix(in srgb, var(--status-verified,#3D9BFF) 12%, transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--status-verified,#3D9BFF) 34%, transparent)">
                      <span style="flex:none;width:24px;height:24px;border-radius:var(--radius-pill);background:{p.gradient}"></span>
                      <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap">{t(p.handle)}</span>
                      <span style="flex:none;display:flex;align-items:center;justify-content:center;width:16px;height:16px;cursor:pointer" onclick={p.onToggle} role="button" tabindex="0">
                        <span style="width:11px;height:11px;background:var(--ink-2,#C9C9D4);mask:{v.closeMask}"></span>
                      </span>
                    </span>
                  {/each}
                </div>
              {/if}
              {#if v.nonePicked}
                <span style="padding-inline:var(--space-10);font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.nonePickedText)}</span>
              {/if}
            </div>

            <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07))"></div>

            <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
              <span style="padding-inline-start:var(--space-10);font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(v.listLabel)}</span>
              <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0">
                {#each v.people ?? [] as u, i5}
                  <div class="dc-p7" style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:7px var(--space-8);border-radius:var(--radius-md);background:{u.rowBg};cursor:pointer" onclick={u.onToggle} role="button" tabindex="0">
                    <span style="flex:none;width:36px;height:36px;border-radius:var(--radius-pill);background:{u.gradient}"></span>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
                      <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#E4E4EC);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(u.name)}</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.25 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(u.handle)}</span>
                    </div>
                    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--radius-pill);background:{u.addBg};box-shadow:inset 0 0 0 1px {u.addLine}">
                      <span style="width:14px;height:14px;background:{u.addInk};mask:{u.addMask}"></span>
                    </span>
                  </div>
                {/each}
              </div>
              {#if v.noResults}
                <span style="padding:var(--space-14) var(--space-10);font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">No people match “{t(v.query)}”.</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if v.isChannelsTab}
        <div style="display:flex;flex-direction:column;align-items:center;min-width:0">
          <div style="width:100%;max-width:600px;display:flex;flex-direction:column;gap:var(--space-22);min-width:0">
            <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
              <div style="display:flex;align-items:baseline;gap:var(--space-10)">
                <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-2xl)/1.3 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1)">Public channels</span>
                {#if v.canRemoveAllChannels}
                  <span style="flex:none;font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--status-danger,#F5493D);cursor:pointer;user-select:none" onclick={v.onRemoveAllChannels} role="button" tabindex="0">Remove all</span>
                {/if}
              </div>
              <span style="font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Everyone who joins the community is added to these channels automatically. You can add private channels, and edit these, once the community exists.</span>
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-6);min-width:0">
              {#each v.channelRows ?? [] as c, i6}
                <div style="position:relative;display:flex;align-items:center;gap:var(--space-12);min-height:56px;padding:0 var(--space-8) 0 var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {c.line}">
                  <span style="flex:none;font:var(--weight-bold) var(--text-lg)/1 var(--font-sans);color:var(--accent,#FF5672)">#</span>
                  {#if c.editing}
                    <input style="flex:1;min-width:0;height:40px;background:none;border:0;outline:none;font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.chanEditValue} oninput={v.onChanEditInput} onkeydown={v.onChanEditKey} maxlength={v.chanMax} autofocus={true}>
                    <span style="flex:none;display:flex;align-items:center;height:32px;padding:0 var(--space-12);border-radius:var(--radius-sm);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.onChanEditSave} role="button" tabindex="0">Save</span>
                    <span class="dc-p8" style="flex:none;display:flex;align-items:center;height:32px;padding:0 var(--space-10);border-radius:var(--radius-sm);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.onChanEditCancel} role="button" tabindex="0">Cancel</span>
                  {/if}
                  {#if c.notEditing}
                    <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(c.name)}</span>
                    <span class="dc-p9" style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-sm);background:{c.kebabBg};cursor:pointer" onclick={c.toggleMenu} aria-label="More options" role="button" tabindex="0" title="More options"><span style="width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{v.kebabMask}"></span></span>
                  {/if}
                  {#if c.menuOpen}
                    <div style="position:fixed;inset:0;z-index:19" onclick={v.closeChanMenu}></div>
                    <div style="position:absolute;inset-inline-end:var(--space-8);top:calc(100% - 4px);z-index:20;display:grid;grid-template-columns:max-content"><Menu minWidth="180px" items={c.menuItems}></Menu></div>
                  {/if}
                </div>
              {/each}
              {#if v.noChannels}
                <span style="padding:var(--space-14) var(--space-4);font:var(--weight-regular) var(--text-base)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">No public channels. Newcomers will only see private channels they're added to, so add at least one to give them somewhere to start.</span>
              {/if}
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
              <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Add a channel</span>
              <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0">
                <div style="flex:1;min-width:0;display:flex;align-items:center;gap:var(--space-8);height:48px;padding:0 var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.chanAddLine}">
                  <span style="flex:none;font:var(--weight-bold) var(--text-base)/1 var(--font-sans);color:var(--ink-3,#8A8A99)">#</span>
                  <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.chanDraft} oninput={v.onChanDraft} onkeydown={v.onChanDraftKey} placeholder="channel-name" maxlength={v.chanMax}>
                  <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(v.chanDraftLeft)}</span>
                </div>
                <span style="flex:none;display:flex;align-items:center;gap:var(--space-6);height:48px;padding:0 var(--space-16);box-sizing:border-box;border-radius:var(--radius-md);background:{v.chanAddBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.chanAddInk};cursor:{v.chanAddCursor};user-select:none" onclick={v.onChanAdd} role="button" tabindex="0"><span style="width:15px;height:15px;background:{v.chanAddInk};mask:{v.plusMask}"></span>Add</span>
              </div>
              <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:{v.chanHintInk}">{t(v.chanHint)}</span>
            </div>
          </div>
        </div>
      {/if}

      {#if v.isGates}
        <div style="display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;min-width:0"><div style="width:100%;max-width:600px;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--space-18);min-width:0"><div style="display:flex;align-items:flex-start;gap:var(--space-10);padding:var(--space-12) var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))"><span style="flex:none;width:16px;height:16px;margin-top:2px;background:var(--ink-3,#9A9AA8);mask:{v.infoMask}"></span><span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">People you invite to this {t(v.kindNoun)} <span style="font-weight:var(--weight-semibold);color:var(--status-chit,#FF9F45)">don’t have to pass</span> access gates. Gates only apply to people who find and join it themselves.</span></div><AccessGates isDiamond={v.isDiamond} onUpgrade={v.onUpgrade} value={v.gates} onChange={v.onGatesChange}></AccessGates></div></div>
      {/if}

      {#if v.isRules}
        <div style="display:flex;flex-direction:column;align-items:center;min-width:0">
          <div style="width:100%;max-width:600px;display:flex;flex-direction:column;gap:var(--space-32);min-width:0">

            <div style="display:flex;align-items:flex-start;gap:var(--space-16);min-width:0">
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Enable rules for the group</span>
                <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">New members have to agree to the rules before they join.</span>
              </div>
              <div style="flex:none;display:flex"><Toggle on={v.rulesOn} onChange={v.onRulesOn}></Toggle></div>
            </div>

            {#if v.rulesOn}
              <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
                <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">START FROM A TEMPLATE</span>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-10);min-width:0">
                  {#each v.rulePresets ?? [] as p, i7}
                    <div class="dc-p10" style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0;min-height:86px;padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:{p.bg};box-shadow:inset 0 0 0 1px {p.line};cursor:pointer;user-select:none" onclick={p.onSelect} role="button" tabindex="0">
                      <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:{p.ink}">{t(p.label)}</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(p.desc)}</span>
                    </div>
                  {/each}
                </div>
              </div>

              <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
                <div style="display:flex;align-items:baseline;gap:var(--space-10);min-width:0">
                  <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">RULES</span>
                  <span style="flex:1"></span>
                  {#if v.hasRulesText}
                    <span class="dc-p11" style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onClearRules} role="button" tabindex="0">Clear</span>
                  {/if}
                </div>
                <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><TextArea value={v.rulesText} onInput={v.onRulesText} placeholder="Anything members should know before they join" maxLength={v.rulesMax} minHeight={162} help="The field grows as you type." error={v.rulesError} errorText="Rules are enabled — write them here, or turn rules off."></TextArea></div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if v.isPerms}
        <div style="display:flex;flex-direction:column;align-items:center;min-width:0">
          <div style="width:100%;max-width:600px;display:flex;flex-direction:column;gap:var(--space-22);min-width:0">

            <div style="display:flex;flex-direction:column;gap:5px;min-width:0">
              <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Who can do what</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Each permission is set to the lowest role that has it. Higher roles inherit it automatically.</span>
            </div>

            <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><SegmentedTabs labels={v.permSubLabels} counts={v.permSubCounts} selectedIndex={v.permSub} dotIndexes={v.none} onSelect={v.onPermSub}></SegmentedTabs></div>

            {#if v.permsChanged}
              <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:var(--space-10) var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);border:1px solid color-mix(in srgb, var(--accent,#FF5672) 34%, transparent)">
                <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(v.permsSummary)}</span>
                <span class="dc-p12" style="flex:none;font:var(--weight-semibold) var(--text-sm)/1.4 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onPermsReset} role="button" tabindex="0">Reset to defaults</span>
              </div>
            {/if}

            {#if v.showThreadSwitch}
              <div style="display:flex;align-items:flex-start;gap:var(--space-14);min-width:0;padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                  <span style="font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Use different permissions in threads</span>
                  <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.threadHint)}</span>
                </div>
                <div style="flex:none;display:flex"><Toggle on={v.threadsOverride} onChange={v.onThreadsOverride}></Toggle></div>
              </div>
            {/if}

            {#if v.showPermList}
              {#each v.permGroups ?? [] as g, i8}
                <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
                  {#if g.hasLabel}
                    <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(g.label)}</span>
                  {/if}
                  <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                    {#each g.items ?? [] as p, i9}
                      <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:11px var(--space-14);border-block-end:1px solid {p.divider}">
                        <span style="flex:1;min-width:0;font:{p.weight} var(--text-md)/1.3 var(--font-sans);color:{p.labelInk}">{t(p.label)}</span>
                        <span class="dc-p13" style="flex:none;display:flex;align-items:center;gap:7px;padding:var(--space-6) var(--space-10);border-radius:var(--radius-pill);background:{p.pillBg};box-shadow:inset 0 0 0 1px {p.pillLine};cursor:pointer;user-select:none" onclick={p.onOpen} role="button" tabindex="0">
                          <span style="font:var(--weight-semibold) var(--text-sm)/1.2 var(--font-sans);color:{p.pillInk};white-space:nowrap">{t(p.valueLabel)}</span>
                          <span style="flex:none;width:12px;height:12px;background:{p.pillInk};mask:{v.chevronMask}"></span>
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            {/if}

            {#if v.showThreadsInherited}
              <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-6);padding:var(--space-26) var(--space-18);box-sizing:border-box;border-radius:var(--radius-md);border:1px dashed var(--line-2,rgba(255,255,255,.14))">
                <span style="font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4)">Threads follow the message permissions</span>
                <span style="max-width:340px;text-align:center;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Turn the switch on to give threads their own set.</span>
              </div>
            {/if}

          </div>
        </div>
      {/if}

      {#if v.isPlaceholder}
        <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0;padding-inline:var(--space-4)">
          <span style="font:var(--weight-bold) var(--text-2xl)/1.3 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-wrap:pretty">{t(v.sectionTitle)}</span>
          <span style="font:var(--weight-regular) var(--text-base)/1.55 var(--font-sans);color:var(--ink-2,#B9B9C6);text-wrap:pretty">{t(v.sectionBody)}</span>
        </div>
        {#if v.hasSectionChips}
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-6);min-width:0;padding-inline:var(--space-4)">
            {#each v.sectionChips ?? [] as chip, i10}
              <span style="display:flex;align-items:center;gap:5px;padding:var(--space-6) var(--space-10);border-radius:var(--radius-sm);background:{chip.wash};box-shadow:inset 0 0 0 1px {chip.line}">
                <span style="width:12px;height:12px;background:{chip.ink};mask:{chip.mask}"></span>
                <span style="font:var(--weight-medium) var(--text-sm)/1.2 var(--font-sans);color:{chip.ink}">{t(chip.label)}</span>
              </span>
            {/each}
          </div>
        {/if}
        <div style="display:flex;align-items:center;justify-content:center;min-height:200px;border-radius:var(--radius-lg);border:1px dashed var(--line-2,rgba(255,255,255,.14))">
          <span style="font:var(--weight-medium) var(--text-md)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">Screen to come</span>
        </div>
      {/if}
    </div>

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p14" style="flex:none;padding:var(--space-10) var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onCancel} role="button" tabindex="0">Cancel</span>
      <span style="flex:1"></span>
      {#if v.showFooterNote}
        <span style="margin-inline-end:var(--space-8);font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:{v.footerInk}">{t(v.footerNote)}</span>
      {/if}
      <div class="dc-p15" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:{v.createBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.createInk};cursor:{v.createCursor};user-select:none" onclick={v.onCreate} role="button" tabindex="0">
        <span style="width:17px;height:17px;background:{v.createInk};mask:{v.groupMask}"></span>
        <span>{t(v.createLabel)}</span>
      </div>
    </div>
  </div>

  {#if v.permMenuOpen}
    <div style="position:fixed;inset:0;z-index:60">
      <div style="position:absolute;inset:0" onclick={v.onClosePermMenu} aria-hidden="true"></div>
      <div style="position:absolute;top:{v.permMenuTop};left:{v.permMenuLeft};visibility:{v.permMenuVis};width:238px;display:flex;flex-direction:column;gap:2px;padding:var(--space-8);box-sizing:border-box;border-radius:var(--radius-md);background:var(--surface-2,#17171d);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 18px 40px rgba(0,0,0,.5)" use:ref={v.permPanelRef} role="menu" aria-label="Who can do this">
        <span style="padding:var(--space-6) var(--space-8) var(--space-8);font:var(--weight-regular) var(--text-xs)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.permMenuHint)}</span>
        {#each v.permMenuOptions ?? [] as o, i11}
          <div class="dc-p16" style="display:flex;align-items:center;gap:var(--space-10);min-width:0;padding:var(--space-8);border-radius:var(--radius-sm);background:{o.bg};cursor:pointer" onclick={o.onPick} role="button" tabindex="0">
            <span style="flex:none;display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:var(--radius-pill);background:{o.dotBg};box-shadow:inset 0 0 0 1.5px {o.dotLine}">
              <span style="width:10px;height:10px;background:{o.tick};mask:{v.checkMask}"></span>
            </span>
            <span style="flex:1;min-width:0;font:{o.weight} var(--text-md)/1.3 var(--font-sans);color:{o.ink}">{t(o.label)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.12)) !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important;color:var(--ink-2,#C9C9D4) !important}
  .dc-p3:hover{background:var(--on-cover-bg-hover) !important}
  .dc-p4:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p5:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p6:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p7:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p8:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p9:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p10:hover{background:var(--overlay-2,rgba(255,255,255,.07)) !important}
  .dc-p11:hover{color:var(--accent-bright,#FF8298) !important}
  .dc-p12:hover{color:var(--accent-bright,#FF8298) !important}
  .dc-p13:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p14:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p15:hover{filter:brightness(1.08) !important}
  .dc-p16:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>
