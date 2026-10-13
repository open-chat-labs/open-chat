<!-- Generated from lib/InviteDialog.dc.html (source hash 408fbcd8) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './InviteDialog.logic.js';
  import ChatPicker from '../../lib/components/ChatPicker.svelte';
  import Field from '../../lib/components/Field.svelte';
  import MemberRow from '../../lib/components/MemberRow.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';

  interface Props {
    groupName?: string;
    initialTab?: string;
    shareOn?: boolean;
    shareLink?: string;
    canAdd?: boolean;
    communityName?: string;
    communityMembers?: {name: string, handle: string, color: string}[];
    inChannel?: string[];
    onAdd?: (handles: string[]) => void;
    onInvite?: (handles: string[]) => void;
    onCancel?: () => void;
    chats?: { name: string, kind?: string, grad: string, radius?: string }[];
    onShareToChat?: (v: { chat: string, message: string }) => void;
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
      <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-lg)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">Invite and share</span>
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0" aria-label="Close" title="Close">
        <span style="width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>
    {/if}

    {#if v.notEmbedded}
    <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-14);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
      <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0">
        <span style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
          <span style="width:18px;height:18px;background:var(--ink-2,#B9B9C6);mask:{v.addUserMask}"></span>
        </span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.dialogTitle)}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.groupName)}</span>
        </div>
        <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCancel} role="button" tabindex="0">
          <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
        </span>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.tabLabels} counts={v.tabCounts} selectedIndex={v.tab} dotIndexes={v.none} onSelect={v.onTab}></SegmentedTabs></div>
    </div>
    {/if}

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:var(--space-22) var(--space-18) var(--space-26);display:flex;flex-direction:column;align-items:center">
      <div style="width:100%;max-width:520px;display:flex;flex-direction:column;gap:var(--space-22);min-width:0">
        {#if v.isEmbedded}
          <div style="display:grid;grid-template-columns:minmax(0,1fr);margin-bottom:calc(var(--space-10) - var(--space-22))"><SegmentedTabs labels={v.tabLabels} counts={v.tabCounts} selectedIndex={v.tab} dotIndexes={v.none} onSelect={v.onTab}></SegmentedTabs></div>
        {/if}

        {#if v.isAddTab}
          <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><Field placeholder={v.addPlaceholder} value={v.addQuery} onInput={v.onAddQuery} onClear={v.onClearAddQuery} showShortcut={false}></Field></div>
          <span style="padding-inline:var(--space-4);margin-top:calc(var(--space-12) * -1);font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">People you add join {t(v.groupName)} straight away. Only {t(v.communityName)} members can be added.</span>

          {#if v.hasAddPicked}
            <div style="display:flex;flex-direction:column;gap:var(--space-16);min-width:0;margin-top:var(--space-10)">
              <div style="display:flex;align-items:baseline;gap:var(--space-10);min-width:0;padding-inline:var(--space-4)">
                <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.addPickedLabel)}</span>
                <span style="flex:1"></span>
                <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onClearAddAll} role="button" tabindex="0">Clear all</span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:var(--space-8);min-width:0">
                {#each v.addPicked ?? [] as p, i0}
                  <span style="display:flex;align-items:center;gap:var(--space-8);padding:4px var(--space-10) 4px 4px;border-radius:var(--radius-pill);background:color-mix(in srgb, var(--status-verified,#3D9BFF) 12%, transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--status-verified,#3D9BFF) 34%, transparent)">
                    <span style="flex:none;width:24px;height:24px;border-radius:var(--radius-pill);background:{p.gradient}"></span>
                    <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap">{t(p.handle)}</span>
                    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:16px;height:16px;cursor:pointer" onclick={p.onToggle} role="button" tabindex="0">
                      <span style="width:11px;height:11px;background:var(--ink-2,#C9C9D4);mask:{v.closeMask}"></span>
                    </span>
                  </span>
                {/each}
              </div>
            </div>
          {/if}

          <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0;margin-top:var(--space-10)">
            <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.addListLabel)}</span>
            <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0">
              {#each v.addPeople ?? [] as u, i1}
                <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow title={u.name} subtitle={u.handle} color={u.color} icon="toggle" selected={u.sel} disabled={u.inChannel} badge={u.badge} onClick={u.onToggle}></MemberRow></div>
              {/each}
            </div>
            {#if v.addNoResults}
              <div style="display:flex;flex-direction:column;align-items:flex-start;gap:var(--space-10);padding:var(--space-14) var(--space-10)">
                <span style="font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">No one in {t(v.communityName)} matches “{t(v.addQuery)}”.</span>
                {#if v.outsideMatch}
                  <span class="dc-p2" style="display:flex;align-items:center;gap:var(--space-8);height:38px;padding:0 var(--space-14);border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.08));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.inviteInstead} role="button" tabindex="0"><span>Invite “{t(v.addQuery)}” instead</span></span>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        {#if v.isPeopleTab}
          <div style="display:grid;grid-template-columns:minmax(0,1fr);min-width:0"><Field placeholder="Search people by name or @handle" value={v.query} onInput={v.onQuery} onClear={v.onClearQuery} showShortcut={false}></Field></div>

          {#if v.hasPicked}
            <div style="display:flex;flex-direction:column;gap:var(--space-16);min-width:0;margin-top:var(--space-10)">
              <div style="display:flex;align-items:baseline;gap:var(--space-10);min-width:0;padding-inline:var(--space-4)">
                <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.pickedLabel)}</span>
                <span style="flex:1"></span>
                <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onClearAll} role="button" tabindex="0">Clear all</span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:var(--space-8);min-width:0">
                {#each v.picked ?? [] as p, i2}
                  <span style="display:flex;align-items:center;gap:var(--space-8);padding:4px var(--space-10) 4px 4px;border-radius:var(--radius-pill);background:color-mix(in srgb, var(--status-verified,#3D9BFF) 12%, transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--status-verified,#3D9BFF) 34%, transparent)">
                    <span style="flex:none;width:24px;height:24px;border-radius:var(--radius-pill);background:{p.gradient}"></span>
                    <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap">{t(p.handle)}</span>
                    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:16px;height:16px;cursor:pointer" onclick={p.onToggle} role="button" tabindex="0">
                      <span style="width:11px;height:11px;background:var(--ink-2,#C9C9D4);mask:{v.closeMask}"></span>
                    </span>
                  </span>
                {/each}
              </div>
            </div>
          {/if}

          <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0;margin-top:var(--space-10)">
            <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.listLabel)}</span>
            <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0">
              {#each v.people ?? [] as u, i3}
                <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow title={u.name} subtitle={u.handle} color={u.color} icon="toggle" selected={u.sel} onClick={u.onToggle}></MemberRow></div>
              {/each}
            </div>
            {#if v.noResults}
              <span style="padding:var(--space-14) var(--space-10);font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">No people match “{t(v.query)}”.</span>
            {/if}
          </div>

          {#if v.hasPending}
            <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0">
              <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.pendingLabel)}</span>
              <span style="padding-inline:var(--space-4);font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Invited, but they have not accepted yet.</span>
              <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0">
                {#each v.pendingUsers ?? [] as u, i4}
                  <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow title={u.title} subtitle={u.handle} color={u.color} muted={true} badge="PENDING" showMenu={false}></MemberRow></div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        {#if v.isShareTab}
          <div style="display:flex;align-items:flex-start;gap:var(--space-14);min-width:0;padding-inline:var(--space-4);margin-top:var(--space-12)">
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Enable sharing via link</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">A link and QR code anyone can use to preview and join the {t(v.noun)}.</span>
            </div>
            <div style="flex:none;display:flex"><Toggle on={v.shareOn} onChange={v.onShareOn}></Toggle></div>
          </div>

          {#if v.shareOn}
            <div style="display:flex;flex-direction:column;gap:var(--space-16);min-width:0">
              <div style="display:flex;flex-direction:column;gap:var(--space-8);padding:var(--space-14) var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--status-chit-soft,rgba(255,159,69,.14));box-shadow:inset 0 0 0 1px var(--status-chit,#FF9F45)">
                <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0">
                  <span style="flex:none;width:16px;height:16px;background:var(--status-chit,#FF9F45);mask:{v.warnMask}"></span>
                  <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#E4E4EC);text-wrap:pretty">Anyone with the link can join</span>
                </div>
                <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Access gates are ignored for people who join by link.</span>
              </div>

              <div style="display:flex;align-items:flex-start;gap:var(--space-12);min-width:0;padding:var(--space-14) var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08))">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)">
                  <span style="font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(v.shareHeading)}</span>
                  <span style="font:var(--weight-semibold) var(--text-md)/1.5 var(--font-mono);color:var(--ink,#E4E4EC);overflow-wrap:anywhere">{t(v.shareLink)}</span>
                </div>
                <span style="flex:none;display:flex;gap:var(--space-4)">
                  <span class="dc-p3" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.copyLink} role="button" tabindex="0" title={v.copyTitle} aria-label={v.copyTitle}><span style="width:16px;height:16px;background:{v.copyInk};mask:{v.copyNowMask}"></span></span>
                  <span class="dc-p4" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.openPicker} role="button" tabindex="0" title="Share to chat" aria-label="Share to chat"><span style="width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:var(--icon-send) center/contain no-repeat"></span></span>
                </span>
              </div>

              <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-10);padding:var(--space-18);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08))">
                <span style="width:100%;max-width:230px;aspect-ratio:1;border-radius:var(--radius-md);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08));display:flex;align-items:center;justify-content:center;font:var(--weight-medium) var(--text-sm)/1.4 var(--font-mono);color:var(--ink-4,#7C7C8C);text-align:center">QR CODE</span>
                <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-align:center;text-wrap:pretty">Scan to preview and join the {t(v.noun)}.</span>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>

    {#if v.showFooter}
    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-18);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.notEmbedded}
      <span class="dc-p5" style="flex:none;padding:var(--space-10) var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onCancel} role="button" tabindex="0">{t(v.cancelLabel)}</span>
      {/if}
      <span style="flex:1"></span>
      {#if v.isAddTab}
        {#if v.hasAddPicked}
          <span style="margin-inline-end:var(--space-8);font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.addNote)}</span>
        {/if}
        <div class="dc-p6" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:{v.addCtaBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.addCtaInk};cursor:{v.addCtaCursor};user-select:none" onclick={v.onAdd} role="button" tabindex="0">
          <span style="width:17px;height:17px;background:{v.addCtaInk};mask:{v.plusMask}"></span>
          <span>{t(v.addCtaLabel)}</span>
        </div>
      {/if}
      {#if v.isPeopleTab}
        {#if v.hasPicked}
          <span style="margin-inline-end:var(--space-8);font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.sendNote)}</span>
        {/if}
        <div class="dc-p7" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:{v.sendBg};font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.sendInk};cursor:{v.sendCursor};user-select:none" onclick={v.onSend} role="button" tabindex="0">
          <span style="width:17px;height:17px;background:{v.sendInk};mask:{v.addUserMask}"></span>
          <span>Send invites</span>
        </div>
      {/if}
    </div>
    {/if}
  </div>
  {#if v.pickerOpen}
    <ChatPicker title="Share invite link" previewLabel="INVITE LINK" item={v.pickerItem} chats={v.pickerChats} z={95} onSend={v.onPickerSend} onClose={v.closePicker}></ChatPicker>
  {/if}
  {#if v.hasSentToast}
    <div style="position:fixed;left:0;right:0;bottom:24px;z-index:96;display:flex;justify-content:center;pointer-events:none"><div style="pointer-events:auto;width:min(420px, calc(100% - 48px));display:grid;grid-template-columns:minmax(0,1fr)">{#key v.sentToastKey}<UndoToast shown={true} tone="success" icon="check" message={v.sentToast} actionLabel="" onClose={v.closeSentToast}></UndoToast>{/key}</div></div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--overlay-3,rgba(255,255,255,.13)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p5:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p6:hover{filter:brightness(1.08) !important}
  .dc-p7:hover{filter:brightness(1.08) !important}
</style>
