<!-- Generated from lib/GroupSettingsDialog.dc.html (source hash 68b6847a) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './GroupSettingsDialog.logic.js';
  import type { GroupSettings } from '../../lib/types';
  import AccessGates from './AccessGates.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import TextArea from '../../lib/components/TextArea.svelte';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';

  interface Props {
    value?: Partial<GroupSettings> | null;
    initialTab?: string;
    isDiamond?: boolean;
    onSave?: (all: GroupSettings) => void;
    onCancel?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:{v.rootPos};inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:{v.rootPad};box-sizing:border-box">
  {#if v.notEmbedded}
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px))" onclick={v.onCancel} aria-hidden="true"></div>
  {/if}

  <div style="position:relative;width:100%;max-width:{v.cardMax};height:{v.cardH};display:flex;flex-direction:column;box-sizing:border-box;border-radius:{v.cardRadius};background:var(--surface-1,#0e0e12);box-shadow:{v.cardShadow};overflow:hidden">

    {#if v.isEmbedded}
    <div style="flex:none;display:flex;align-items:center;gap:var(--space-10);height:71px;box-sizing:border-box;padding:0 var(--space-16) 0 var(--space-24);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-lg)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.embeddedTitle)}</span>

      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onClose} role="button" tabindex="0" aria-label="Close" title="Close">
        <span style="width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>
    {/if}

    {#if v.notEmbedded}
    <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-14);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0">
        <span style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
          <span style="width:18px;height:18px;background:var(--ink-2,#B9B9C6);mask:{v.gearMask}"></span>
        </span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Group settings</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.groupName)}</span>
        </div>
        <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
          <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
        </span>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.tabLabels} counts={v.tabCounts} selectedIndex={v.tab} dotIndexes={v.tabDots} onSelect={v.onTab}></SegmentedTabs></div>
    </div>
    {/if}

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column" onscroll={v.onBodyScroll}>
    <div style="flex:1;display:flex;flex-direction:column;min-width:0" inert={v.inertAttr}>

      {#if v.isGroupTab}
        <div style="display:flex;flex-direction:column;min-width:0">
          <div style="position:relative;flex:none;height:{v.coverHeight};background:{v.coverValue}">
            {#if v.canEdit}
            <div style="position:absolute;inset-block-start:12px;inset-inline:0;display:flex;justify-content:center;padding-inline:var(--space-18)">
              <div style="width:100%;max-width:600px;display:flex;justify-content:flex-end;gap:var(--space-8)">
                {#if v.canUploadCover}
                  <input style="display:none" use:ref={v.coverRef} type="file" accept="image/*" oninput={v.onCoverFile}>
                  <span class="dc-p2" style="display:flex;align-items:center;gap:var(--space-6);height:36px;padding:0 var(--space-12);border-radius:var(--radius-md);background:var(--on-cover-bg);box-shadow:inset 0 0 0 1px var(--line-2);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink);cursor:pointer;user-select:none" onclick={v.onPickCover} role="button" tabindex="0"><span style="width:14px;height:14px;background:var(--ink);mask:{v.cameraMask}"></span>{t(v.coverUploadLabel)}</span>
                {/if}
                <div style="display:flex;align-items:center;gap:var(--space-8);margin-inline-end:calc(var(--space-6) * -1);padding:var(--space-6);border-radius:var(--radius-md);background:var(--on-cover-bg);box-shadow:inset 0 0 0 1px var(--line-2)">
                  {#each v.coverChoices ?? [] as c, i0}
                    <span style="width:24px;height:24px;border-radius:38%;background:{c.value};box-shadow:{c.ring};cursor:pointer" onclick={c.onSelect} role="button" tabindex="0" aria-label={c.label} title={c.label}></span>
                  {/each}
                </div>
              </div>
            </div>
            {/if}
          </div>

          <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:var(--space-22) var(--space-18) var(--space-32)">
            <div style="width:100%;max-width:600px;display:flex;flex-direction:column;gap:var(--space-26);min-width:0">

              <div style="display:flex;align-items:flex-end;gap:var(--space-16);min-width:0">
                <div style="position:relative;flex:none;width:96px;height:96px;margin-block-start:-64px">
                  <div style="width:96px;height:96px;box-sizing:border-box;border:5px solid var(--surface-1,#0e0e12);border-radius:34%;background:{v.avatarGradient}">
                    <div style="width:100%;height:100%;border-radius:30%;background:{v.avatarImage}"></div>
                  </div>
                  <input style="display:none" use:ref={v.avatarRef} type="file" accept="image/*" oninput={v.onAvatarFile}>
                  {#if v.canEdit}
                  <div class="dc-p3" style="position:absolute;inset-inline-end:-2px;inset-block-end:-2px;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-pill);background:var(--surface-2,#17171d);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.14)),0 4px 12px rgba(0,0,0,.4);cursor:pointer" onclick={v.onPickAvatar} role="button" tabindex="0">
                    <span style="width:15px;height:15px;background:var(--ink,#ECECF1);mask:{v.cameraMask}"></span>
                  </div>
                  {/if}
                </div>
                {#if v.canEdit}
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)">
                  <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Group photo</span>
                  <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0">
                    <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">Upload one, or pick a colour</span>
                    <span style="flex:1"></span>
                    {#if v.hasPickedPhoto}
                      <span class="dc-p4" style="flex:none;padding:var(--space-4) var(--space-10);border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.onClearAvatar} role="button" tabindex="0">Remove photo</span>
                    {/if}
                    {#each v.colorChoices ?? [] as c, i1}
                      <span style="flex:none;width:24px;height:24px;border-radius:38%;background:{c.gradient};box-shadow:{c.ring};cursor:pointer" onclick={c.onSelect} role="button" tabindex="0" aria-label={c.label} title={c.label}></span>
                    {/each}
                  </div>
                </div>
                {/if}
              </div>

              <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
                <div style="display:flex;align-items:baseline;gap:var(--space-6)">
                  <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Group name</span>
                  {#if v.canEdit}<span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672)">*</span>{/if}
                </div>
                <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:0 var(--space-16);height:52px;box-sizing:border-box;border-radius:var(--radius-lg);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.nameLine}">
                  <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.name} oninput={v.onName} placeholder="Group name" maxlength={v.nameMax}>
                  {#if v.canEdit}<span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:{v.nameLeftInk}">{t(v.nameLeft)}</span>{/if}
                </div>
                {#if v.nameBad}
                  <span style="font:var(--weight-medium) var(--text-sm)/1.4 var(--font-sans);color:var(--status-danger,#F5493D)">A group needs a name.</span>
                {/if}
              </div>

              {#if v.showAbout}
              <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
                <div style="display:flex;align-items:baseline;gap:var(--space-8)">
                  <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Description</span>
                  {#if v.canEdit}<span style="font:var(--weight-regular) var(--text-xs)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">Optional</span>{/if}
                </div>
                <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><TextArea value={v.about} onInput={v.onAbout} placeholder="Tell people what your group is about" maxLength={v.aboutMax} minHeight={49}></TextArea></div>
              </div>
              {/if}

              <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0">
                <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">SETTINGS</span>
                <div style="display:flex;flex-direction:column;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));overflow:hidden">
                  {#each v.switches ?? [] as s, i2}
                    <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0;padding:var(--space-16);border-block-end:1px solid {s.divider}">
                      {#if s.timed}
                        <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><TimedToggle density="flush" label={s.title} on={s.on} value={v.after} offHint={s.offHint} readOnly={v.readOnly} onChange={s.onChange} onDurationChange={v.onAfter}></TimedToggle></div>
                      {/if}
                      {#if s.plain}
                      <div style="display:flex;align-items:flex-start;gap:var(--space-16);min-width:0">
                        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                          <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(s.title)}</span>
                          <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(s.hint)}</span>
                        </div>
                        {#if v.canEdit}<div style="flex:none;display:flex"><Toggle on={s.on} onChange={s.onChange}></Toggle></div>{/if}
{#if v.readOnly}<span style="flex:none;padding:5px 10px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(s.status)}</span>{/if}
                      </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </div>
          {#if v.hasOwnerMoves}
            <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0;padding:var(--space-22) var(--space-18) var(--space-26);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
              <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">Move to a community</span>
              <div style="display:flex;flex-direction:column;border-radius:var(--radius-lg);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));overflow:hidden">
                {#each v.ownerMoves ?? [] as mv, i3}
                  <div class="dc-p5" style="display:flex;align-items:center;gap:var(--space-12);padding:var(--space-12) var(--space-14);border-block-start:{mv.divider};cursor:pointer" onclick={mv.onPress} role="button" tabindex="0">
                    <span style="flex:none;width:30px;height:30px;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));display:flex;align-items:center;justify-content:center"><span style="width:15px;height:15px;background:var(--ink-2,#C9C9D4);mask:{mv.mask}"></span></span>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
                      <span style="font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(mv.label)}</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(mv.desc)}</span>
                    </div>
                    <span style="flex:none;width:14px;height:14px;background:var(--ink-4,#7C7C8C);mask:{v.chevMask}" data-oc-flip=""></span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}


      {#if v.isAboutView}
        <div style="display:flex;flex-direction:column;align-items:center;min-width:0">
          <div style="align-self:stretch;flex:none;height:{v.coverHeight};background:{v.coverValue}"></div>
          <div style="width:100%;max-width:520px;display:flex;flex-direction:column;align-items:center;gap:var(--space-22);padding:0 var(--space-24) var(--space-32);box-sizing:border-box;min-width:0">
            <div style="flex:none;width:96px;height:96px;margin-block-start:-52px;box-sizing:border-box;border:5px solid var(--surface-1,#0e0e12);border-radius:34%;background:{v.avatarGradient}">
              <div style="width:100%;height:100%;border-radius:30%;background:{v.avatarImage}"></div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-8);margin-block-start:calc(var(--space-8) * -1);min-width:0">
              <span style="font:var(--weight-bold) var(--text-2xl,21px)/1.2 var(--font-sans);color:var(--ink,#ECECF1);text-align:center;text-wrap:balance">{t(v.name)}</span>
              <span style="font:var(--weight-regular) var(--text-md)/1.3 var(--font-sans);color:var(--ink-3,#8A8A99);text-align:center">{t(v.aboutMeta)}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:var(--space-8)">
              {#if v.hasRoleLabel}
                <span style="flex:none;display:flex;align-items:center;height:32px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-pill);background:var(--overlay-1,rgba(255,255,255,.05));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(v.roleLabel)}</span>
              {/if}
              {#each v.aboutActions ?? [] as a, i4}
                <span class="dc-p6" style="flex:none;display:flex;align-items:center;gap:var(--space-6);height:32px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-pill);background:{a.bg};box-shadow:inset 0 0 0 1px {a.line};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{a.ink};cursor:pointer;user-select:none" onclick={a.onPress} role="button" tabindex="0">
                  <span style="flex:none;width:14px;height:14px;background:{a.ink};mask:{a.mask}"></span>{t(a.label)}
                </span>
              {/each}
            </div>
            {#if v.hasAbout}
              <p style="margin:0;font:var(--weight-regular) var(--text-base)/1.6 var(--font-sans);color:var(--ink-2,#C9C9D4);text-align:center;text-wrap:pretty;white-space:pre-line">{t(v.about)}</p>
            {/if}
            <div style="align-self:stretch;display:flex;flex-direction:column;gap:var(--space-12);min-width:0">
              <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">How this {t(v.nounLower)} works</span>
              <div style="display:flex;flex-direction:column;border-radius:var(--radius-lg);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));overflow:hidden">
                {#each v.aboutFacts ?? [] as f, i5}
                  <div class="dc-p7" style="display:flex;align-items:center;gap:var(--space-12);padding:var(--space-12) var(--space-14);border-block-start:{f.divider};cursor:{f.cursor};--dc-p7-0:{f.hoverBg};" onclick={f.onPress} tabindex="0" role={f.role}>
                    <span style="flex:none;width:30px;height:30px;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05));display:flex;align-items:center;justify-content:center"><span style="width:15px;height:15px;background:var(--ink-2,#C9C9D4);mask:{f.mask}"></span></span>
                    <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-base)/1.35 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">{t(f.text)}</span>
                    {#if f.isLink}<span style="flex:none;width:14px;height:14px;background:var(--ink-4,#7C7C8C);mask:{v.chevMask}" data-oc-flip=""></span>{/if}
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {/if}
      {#if v.isGatesTab}
        <div style="display:flex;flex-direction:column;align-items:center;padding:var(--space-32);box-sizing:border-box;min-width:0">
          <div style="width:100%;max-width:600px;display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><AccessGates readOnly={v.gatesReadOnly} isDiamond={v.isDiamond} value={v.gates} onChange={v.onGatesChange}></AccessGates></div>
        </div>
      {/if}

      {#if v.isRulesTab}
        <div style="display:flex;flex-direction:column;align-items:center;padding:var(--space-32) var(--space-18);box-sizing:border-box;min-width:0">
          <div style="width:100%;max-width:600px;display:flex;flex-direction:column;gap:var(--space-32);min-width:0">
            <div style="display:flex;align-items:flex-start;gap:var(--space-16);min-width:0">
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Enable rules for the group</span>
                <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">New members have to agree to the rules before they join.</span>
              </div>
              {#if v.canEdit}<div style="flex:none;display:flex"><Toggle on={v.rulesOn} onChange={v.onRulesOn}></Toggle></div>{/if}
{#if v.readOnly}<span style="flex:none;padding:5px 10px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.rulesStatus)}</span>{/if}
            </div>

            {#if v.rulesOn}
              {#if v.canEdit}
              <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
                <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">START FROM A TEMPLATE</span>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--space-10);min-width:0">
                  {#each v.ruleTemplates ?? [] as p, i6}
                    <div class="dc-p8" style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0;min-height:86px;padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:{p.bg};box-shadow:inset 0 0 0 1px {p.line};cursor:pointer;user-select:none" onclick={p.onSelect} role="button" tabindex="0">
                      <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:{p.ink}">{t(p.label)}</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(p.desc)}</span>
                    </div>
                  {/each}
                </div>
              </div>
              {/if}

              <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
                <div style="display:flex;align-items:baseline;gap:var(--space-10);min-width:0">
                  <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">RULES</span>
                  <span style="flex:1"></span>
                  {#if v.hasRulesText}
                    <span class="dc-p9" style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onClearRules} role="button" tabindex="0">Clear</span>
                  {/if}
                </div>
                <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><TextArea value={v.rulesText} onInput={v.onRulesText} placeholder="Anything members should know before they join" maxLength={v.rulesMax} minHeight={162} help="The field grows as you type." error={v.rulesError} errorText="Rules are enabled — write them here, or turn rules off."></TextArea></div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if v.isPermsTab}
        <div style="display:flex;flex-direction:column;align-items:center;padding:var(--space-32) var(--space-18);box-sizing:border-box;min-width:0">
          <div style="width:100%;max-width:600px;display:flex;flex-direction:column;gap:var(--space-22);min-width:0">
            <div style="display:flex;flex-direction:column;gap:5px;min-width:0">
              <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Who can do what</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Each permission is set to the lowest role that has it. Higher roles inherit it automatically.</span>
            </div>

            <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><SegmentedTabs labels={v.permSubLabels} counts={v.permSubCounts} selectedIndex={v.permSub} dotIndexes={v.none} onSelect={v.onPermSub}></SegmentedTabs></div>

            {#if v.permsChanged}
              <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:var(--space-10) var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);border:1px solid color-mix(in srgb, var(--accent,#FF5672) 34%, transparent)">
                <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(v.permsSummary)}</span>
                <span class="dc-p10" style="flex:none;font:var(--weight-semibold) var(--text-sm)/1.4 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onPermsReset} role="button" tabindex="0">Reset to defaults</span>
              </div>
            {/if}

            {#if v.showThreadSwitch}
              <div style="display:flex;align-items:flex-start;gap:var(--space-14);min-width:0;padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                  <span style="font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Use different permissions in threads</span>
                  <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.threadHint)}</span>
                </div>
                {#if v.canEdit}<div style="flex:none;display:flex"><Toggle on={v.threadsOverride} onChange={v.onThreadsOverride}></Toggle></div>{/if}
{#if v.readOnly}<span style="flex:none;padding:5px 10px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.threadsStatus)}</span>{/if}
              </div>
            {/if}

            {#if v.showPermList}
              {#each v.permGroups ?? [] as g, i7}
                <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
                  {#if g.hasLabel}
                    <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(g.label)}</span>
                  {/if}
                  <div style="display:flex;flex-direction:column;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                    {#each g.items ?? [] as p, i8}
                      <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:11px var(--space-14);border-block-end:1px solid {p.divider}">
                        <span style="flex:1;min-width:0;font:{p.weight} var(--text-md)/1.3 var(--font-sans);color:{p.labelInk};text-wrap:pretty">{t(p.label)}</span>
                        <span class="dc-p11" style="flex:none;display:flex;align-items:center;gap:7px;padding:var(--space-6) var(--space-10);border-radius:var(--radius-pill);background:{p.pillBg};box-shadow:inset 0 0 0 1px {p.pillLine};cursor:pointer;user-select:none" onclick={p.onOpen} role="button" tabindex="0">
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
    </div>
    </div>

    {#if v.showFooter}
    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.showCancel}
      <span class="dc-p12" style="flex:none;padding:var(--space-10) var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onCancelPress} role="button" tabindex="0">{t(v.cancelLabel)}</span>
      {/if}
      <span style="flex:1"></span>
      {#if v.showNote}
        <span style="margin-inline-end:var(--space-8);font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:{v.noteInk}">{t(v.note)}</span>
      {/if}
      <div class="dc-p13" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:{v.saveBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.saveInk};cursor:{v.saveCursor};user-select:none" onclick={v.onSave} role="button" tabindex="0">
        <span style="width:17px;height:17px;background:{v.saveInk};mask:{v.checkMask}"></span>
        <span>Save changes</span>
      </div>
    </div>
    {/if}
  </div>

  {#if v.permMenuOpen}
    <div style="position:fixed;inset:0;z-index:80">
      <div style="position:absolute;inset:0" onclick={v.onClosePermMenu} aria-hidden="true"></div>
      <div style="position:absolute;top:{v.permMenuTop};left:{v.permMenuLeft};visibility:{v.permMenuVis};width:238px;display:flex;flex-direction:column;gap:2px;padding:var(--space-8);box-sizing:border-box;border-radius:var(--radius-md);background:var(--surface-2,#17171d);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 18px 40px rgba(0,0,0,.5)" use:ref={v.permPanelRef} role="menu" aria-label="Who can do this">
        <span style="padding:var(--space-6) var(--space-8) var(--space-8);font:var(--weight-regular) var(--text-xs)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.permMenuHint)}</span>
        {#each v.permMenuOptions ?? [] as o, i9}
          <div class="dc-p14" style="display:flex;align-items:center;gap:var(--space-10);min-width:0;padding:var(--space-8);border-radius:var(--radius-sm);background:{o.bg};cursor:pointer" onclick={o.onPick} role="button" tabindex="0">
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
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--on-cover-bg-hover) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p5:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p6:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p7:hover{background:var(--dc-p7-0) !important}
  .dc-p8:hover{background:var(--overlay-2,rgba(255,255,255,.07)) !important}
  .dc-p9:hover{color:var(--accent-bright,#FF8298) !important}
  .dc-p10:hover{color:var(--accent-bright,#FF8298) !important}
  .dc-p11:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p12:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p13:hover{filter:brightness(1.08) !important}
  .dc-p14:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>
