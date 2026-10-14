<!-- Add or invite people to a group / channel, or share its link. Tabs: Add from community (canAdd: channels inside a
     community), Invite people (search `people`; `frequent` ones are listed until you search) and Share link (toggle,
     copy, share to a chat, QR). embedded renders it as the Invite page of a manage dialog: no veil, own header, no
     footer on Share link, and the host can switch tabs through initialTab.
     People are picked by id. Adding, inviting, switching link sharing, resetting the link and sharing it to a chat all
     wait on the host: the picks are only cleared (and the toast only shown) once it resolves; a rejection keeps them
     and shows an error. The link comes from the host (`shareLink`); without it the link, QR and share are hidden.
     It can't be dismissed while a host call is pending (lib/behaviours/dialog.svelte.ts); the sharing switch is
     optimistic and falls back to the host's value if the latest change is rejected (optimistic.svelte.ts). -->
<script lang="ts" module>
  export type InviteColor = 'violet' | 'amber' | 'teal' | 'blue' | 'slate' | 'plum';

  export interface InvitePerson {
    id: string;
    name: string;
    handle: string;
    color: InviteColor;
    /** Listed before you search. */
    frequent?: boolean;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useT } from '../../lib/i18n';
  import CopyButton from '../../lib/components/CopyButton.svelte';
  import { onDestroy, untrack } from 'svelte';
  import ChatPicker from '../../lib/components/ChatPicker.svelte';
  import Field from '../../lib/components/Field.svelte';
  import MemberRow from '../../lib/components/MemberRow.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { Optimistic } from '../../lib/behaviours/optimistic.svelte';

  type Color = InviteColor;
  type TabKey = 'add' | 'invite' | 'share';

  const GRADIENTS: Record<Color, string> = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    slate: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
    plum: 'linear-gradient(140deg,#b06bff,#6a2bff)',
  };

  interface Props {
    groupName: string;
    /** "people" opens Add from community when canAdd, else Invite people. */
    initialTab?: 'people' | 'invite' | 'share';
    shareOn?: boolean;
    /** The invite link, as the host issued it (a full URL). Without it the link, QR and share-to-chat are hidden. */
    shareLink?: string;
    /** Turn link sharing on or off. Rolls back with an error if it rejects; the switch is read-only without it. */
    onShareToggle?: (on: boolean) => Promise<unknown> | void;
    /** Issue a new link (the old one stops working). Hidden without it. */
    onResetLink?: () => Promise<{ link: string }>;
    /** Renders a QR code for the link (the host brings the QR library). The QR card is hidden without it. */
    qr?: Snippet<[string]>;
    /** Which share copy to use: "group", "channel" or "community". */
    noun?: string;
    /** Channels inside a community: adds the "Add from community" tab. */
    canAdd?: boolean;
    communityName?: string;
    communityMembers?: { id: string; name: string; handle: string; color: Color }[];
    /** User ids already in the channel (shown, not pickable). */
    inChannel?: string[];
    /** Everyone you can invite. */
    people: InvitePerson[];
    /** Invited but not accepted yet. */
    pending?: { title: string; handle: string; color: Color }[];
    /** Invite rights. Without them (the default) the page is view-only: no footer, no sharing switch. */
    canInvite?: boolean;
    embedded?: boolean;
    /** Add community members (user ids) to the channel. */
    onAdd?: (userIds: string[]) => Promise<unknown> | void;
    /** Invite people (user ids). */
    onInvite?: (userIds: string[]) => Promise<unknown> | void;
    onCancel?: () => void;
    /** Embedded: the close button. */
    onClose?: () => void;
    /** Embedded: reports whether anything is picked. */
    onDirtyChange?: (dirty: boolean) => void;
    chats?: { id: string; name: string; kind?: string; grad: string; radius?: string }[];
    onShareToChat?: (v: { chatId: string; message: string; link: string }) => Promise<unknown> | void;
  }

  let {
    groupName,
    initialTab = 'people',
    shareOn: shareOnProp = true,
    shareLink,
    onShareToggle,
    onResetLink,
    qr,
    noun = 'group',
    canAdd = false,
    communityName = 'the community',
    communityMembers = [],
    inChannel = [],
    people,
    pending = [],
    canInvite = false,
    embedded = false,
    onAdd,
    onInvite,
    onCancel,
    onClose,
    onDirtyChange,
    chats = [],
    onShareToChat,
  }: Props = $props();
  const t = useT();

  const keys = $derived<TabKey[]>(canAdd ? ['add', 'invite', 'share'] : ['invite', 'share']);
  const tabFor = (want: Props['initialTab']) => {
    const k: TabKey = want === 'share' ? 'share' : want === 'invite' ? 'invite' : canAdd ? 'add' : 'invite';
    return Math.max(0, keys.indexOf(k));
  };

  let tab = $state(untrack(() => tabFor(initialTab)));
  let addQuery = $state('');
  let addPicked = $state<string[]>([]);
  let query = $state('');
  let picked = $state<string[]>([]);
  // the sharing switch: optimistic, latest change wins, falls back to the host's value when it's rejected
  const share = new Optimistic(() => shareOnProp);
  $effect.pre(() => {
    void shareOnProp;
    untrack(() => share.sync());
  });
  const shareOn = $derived(share.current);
  let linkOverride = $state<string | null>(null);
  let pickerOpen = $state(false);
  // one host call at a time (add, invite, reset, share to chat); `action` says which one is pending.
  // No exit animation here, so it leaves at once (exitMs 0) — but never while a call is pending.
  const flow = new DialogFlow({ exitMs: 0 });
  let action = $state<'add' | 'invite' | 'reset' | 'chat'>('add');
  const busy = $derived(flow.busy ? action : '');
  let toast = $state<{ id: number; text: string; tone: 'success' | 'neutral' } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    clearTimeout(toastTimer);
    flow.destroy();
  });

  // embedded: the host can re-point the open page at another tab
  let lastInitial = untrack(() => initialTab);
  $effect(() => {
    const want = initialTab;
    untrack(() => {
      if (embedded && want !== lastInitial && want) tab = tabFor(want);
      lastInitial = want;
    });
  });

  // embedded: tell the host when there is something picked
  let reportedDirty: boolean | undefined;
  $effect(() => {
    const dirty = picked.length > 0 || addPicked.length > 0;
    untrack(() => {
      if (reportedDirty !== undefined && reportedDirty !== dirty) onDirtyChange?.(dirty);
      reportedDirty = dirty;
    });
  });

  const key = $derived(keys[tab] ?? keys[0]);
  const matches = (p: { name: string; handle: string }, q: string) => `${p.name} ${p.handle}`.toLowerCase().includes(q);

  const aq = $derived(addQuery.trim().toLowerCase());
  const addPool = $derived((aq ? communityMembers.filter((p) => matches(p, aq)) : communityMembers).slice(0, 30));
  const outsideMatch = $derived(!!aq && people.some((p) => !communityMembers.some((m) => m.id === p.id) && matches(p, aq)));

  const q = $derived(query.trim().toLowerCase());
  const pool = $derived(q ? people.filter((p) => matches(p, q)) : people.filter((p) => p.frequent));

  // copied exactly as issued; shown without the scheme
  const link = $derived(linkOverride ?? shareLink ?? '');
  const linkShown = $derived(link.replace(/^https?:\/\//, ''));
  const tabLabels = $derived(keys.map((k) => t(k === 'add' ? 'ui.inviteDialog.tabAdd' : k === 'invite' ? 'ui.inviteDialog.tabInvite' : 'ui.inviteDialog.tabShare')));
  const tabCounts = $derived(keys.map((k) => (k === 'add' ? addPicked.length || null : k === 'invite' ? picked.length || null : null)));

  const personOf = (id: string, list: { id: string; handle: string; color: Color }[]) => list.find((p) => p.id === id);
  const gradientOf = (id: string, list: { id: string; handle: string; color: Color }[]) => GRADIENTS[personOf(id, list)?.color ?? 'violet'] ?? GRADIENTS.slate;
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((h) => h !== id) : [...list, id]);
  const countLabel = (n: number) => t('ui.inviteDialog.selectedCount', { count: n });

  // nothing dismisses while a call (or a sharing change) is pending
  function cancel() {
    if (flow.locked || share.pending) return;
    if (embedded && onClose) onClose();
    else flow.leave(onCancel);
  }

  function showToast(text: string, tone: 'success' | 'neutral' = 'success') {
    const id = Date.now();
    toast = { id, text, tone };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast?.id === id) toast = null;
    }, 4000);
  }

  // runs one host call at a time; resolves true when it succeeded
  async function attempt(what: typeof action, call: () => Promise<unknown> | void): Promise<boolean> {
    if (flow.locked) return false;
    action = what;
    const result = await flow.run(call);
    if (!result.ok) showToast(t('ui.inviteDialog.failed'), 'neutral');
    return result.ok;
  }

  async function sentToChat(x: { chatId: string; chat: string; message: string }) {
    const chat = chats.find((c) => c.id === x.chatId);
    if (!chat || !onShareToChat) return;
    if (await attempt('chat', () => onShareToChat({ chatId: chat.id, message: x.message, link }))) {
      pickerOpen = false;
      showToast(t('ui.inviteDialog.linkSent', { chat: chat.name }));
    }
  }

  async function add() {
    if (!addPicked.length || !onAdd) return;
    const ids = addPicked.slice();
    if (!(await attempt('add', () => onAdd(ids)))) return;
    // done: drop the people just added (so they can't be sent twice) and confirm, embedded or not; anyone picked while
    // the call was pending stays picked
    addPicked = addPicked.filter((id) => !ids.includes(id));
    if (!addPicked.length) addQuery = '';
    showToast(t('ui.inviteDialog.peopleAdded', { count: ids.length }));
  }

  async function send() {
    if (!picked.length || !onInvite) return;
    const ids = picked.slice();
    if (!(await attempt('invite', () => onInvite(ids)))) return;
    picked = picked.filter((id) => !ids.includes(id));
    if (!picked.length) query = '';
    showToast(t('ui.inviteDialog.invitesSent', { count: ids.length }));
  }

  // optimistic: the switch moves at once and goes back if the host rejects
  async function toggleSharing(on: boolean) {
    if (!onShareToggle || flow.closing) return;
    const toggle = onShareToggle;
    if (!(await share.set(on, (v) => toggle(v))) && share.failed) showToast(t('ui.inviteDialog.failed'), 'neutral');
  }

  async function resetLink() {
    if (!onResetLink || flow.locked) return;
    const reset = onResetLink;
    action = 'reset';
    const result = await flow.run(() => reset());
    if (!result.ok) {
      showToast(t('ui.inviteDialog.failed'), 'neutral');
      return;
    }
    linkOverride = result.value.link;
    showToast(t('ui.inviteDialog.linkReset'));
  }
</script>

{#snippet chips(ids: string[], list: { id: string; handle: string; color: Color }[], label: string, clear: () => void, toggle: (h: string) => void)}
  <div class="picked">
    <div class="picked-head">
      <span class="list-label">{label}</span>
      <span class="grow"></span>
      <span class="clear-all" onclick={clear} role="button" tabindex="0">{t('ui.inviteDialog.clearAll')}</span>
    </div>
    <div class="chips">
      {#each ids as id}
        <span class="chip">
          <span class="chip-face" style:background={gradientOf(id, list)}></span>
          <span class="chip-handle">{personOf(id, list)?.handle ?? id}</span>
          <span class="chip-remove" onclick={() => toggle(id)} role="button" tabindex="0"><span class="chip-remove-icon"></span></span>
        </span>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet tabs()}
  <SegmentedTabs labels={tabLabels} counts={tabCounts} selectedIndex={tab} dotIndexes={[]} onSelect={(i) => (tab = i)} />
{/snippet}

<div class="layer" class:embedded use:modal={embedded || flow.closing ? undefined : cancel}>
  {#if !embedded}
    <div class="veil" onclick={cancel} aria-hidden="true"></div>
  {/if}

  <div class="card">
    {#if embedded}
      <div class="embedded-head">
        <span class="embedded-title">{t('ui.inviteDialog.inviteAndShare')}</span>
        <span class="icon-button large" onclick={cancel} role="button" tabindex="0" aria-label={t('ui.common.close')} title={t('ui.common.close')}><span class="close-icon large"></span></span>
      </div>
    {:else}
      <div class="head">
        <div class="head-row">
          <span class="head-tile"><span class="head-icon"></span></span>
          <div class="head-text">
            <span class="head-title">{t(canAdd ? 'ui.inviteDialog.addOrInvite' : 'ui.inviteDialog.tabInvite')}</span>
            <span class="head-sub">{groupName}</span>
          </div>
          <span class="icon-button" onclick={cancel} role="button" tabindex="0" aria-label={t('ui.common.close')} title={t('ui.common.close')}><span class="close-icon"></span></span>
        </div>
        <div class="tabs">{@render tabs()}</div>
      </div>
    {/if}

    <div class="body">
      <div class="column">
        {#if embedded}
          <div class="tabs embedded-tabs">{@render tabs()}</div>
        {/if}

        {#if key === 'add'}
          <div class="field">
            <Field
              placeholder={t('ui.inviteDialog.searchMembers', { community: communityName })}
              value={addQuery}
              onInput={(e) => (addQuery = e.currentTarget.value)}
              onClear={() => (addQuery = '')}
              showShortcut={false}
            />
          </div>
          <span class="hint">{t('ui.inviteDialog.addHint', { group: groupName, community: communityName })}</span>

          {#if addPicked.length > 0}
            {@render chips(addPicked, communityMembers, t('ui.inviteDialog.selected', { count: addPicked.length }), () => (addPicked = []), (h) => (addPicked = toggleIn(addPicked, h)))}
          {/if}

          <div class="list-block">
            <span class="list-label start">{aq ? t('ui.inviteDialog.searchResults') : t('ui.inviteDialog.communityMembers', { community: communityName.toUpperCase() })}</span>
            <div class="rows">
              {#each addPool as u}
                {@const member = inChannel.includes(u.id)}
                <div class="row">
                  <MemberRow
                    title={u.name}
                    subtitle={u.handle}
                    color={u.color || 'slate'}
                    icon="toggle"
                    selected={addPicked.includes(u.id)}
                    disabled={member}
                    badge={member ? t('ui.inviteDialog.inChannel') : ''}
                    onClick={() => !member && (addPicked = toggleIn(addPicked, u.id))}
                  />
                </div>
              {/each}
            </div>
            {#if aq && addPool.length === 0}
              <div class="no-results">
                <span class="no-results-text">{t('ui.inviteDialog.noOneMatches', { community: communityName, query: addQuery })}</span>
                {#if outsideMatch}
                  <span
                    class="invite-instead"
                    onclick={() => {
                      tab = keys.indexOf('invite');
                      query = addQuery;
                    }}
                    role="button"
                    tabindex="0"><span>{t('ui.inviteDialog.inviteInstead', { query: addQuery })}</span></span
                  >
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        {#if key === 'invite'}
          <div class="field">
            <Field placeholder={t('ui.inviteDialog.searchPeople')} value={query} onInput={(e) => (query = e.currentTarget.value)} onClear={() => (query = '')} showShortcut={false} />
          </div>

          {#if picked.length > 0}
            {@render chips(picked, people, t('ui.inviteDialog.selected', { count: picked.length }), () => (picked = []), (h) => (picked = toggleIn(picked, h)))}
          {/if}

          <div class="list-block">
            <span class="list-label start">{t(q ? 'ui.inviteDialog.searchResults' : 'ui.inviteDialog.frequent')}</span>
            <div class="rows">
              {#each pool as u}
                <div class="row">
                  <MemberRow title={u.name} subtitle={u.handle} color={u.color} icon="toggle" selected={picked.includes(u.id)} onClick={() => (picked = toggleIn(picked, u.id))} />
                </div>
              {/each}
            </div>
            {#if q && pool.length === 0}
              <span class="no-people">{t('ui.inviteDialog.noPeopleMatch', { query })}</span>
            {/if}
          </div>

          {#if pending.length > 0 && !q}
            <div class="pending">
              <span class="list-label start">{t('ui.inviteDialog.pendingCount', { count: pending.length })}</span>
              <span class="hint plain">{t('ui.inviteDialog.pendingHint')}</span>
              <div class="rows">
                {#each pending as u}
                  <div class="row"><MemberRow title={u.title} subtitle={u.handle} color={u.color} muted={true} badge={t('ui.inviteDialog.pending')} showMenu={false} /></div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        {#if key === 'share'}
          <div class="share-toggle">
            <div class="share-text">
              <span class="share-title">{t('ui.inviteDialog.enableSharing')}</span>
              <span class="share-sub">{t('ui.inviteDialog.shareSub', { noun })}</span>
            </div>
            <div class="toggle"><Toggle on={shareOn} disabled={!canInvite || !onShareToggle} onChange={toggleSharing} /></div>
          </div>

          {#if shareOn && link}
            <div class="share-body">
              <div class="warning">
                <div class="warning-head">
                  <span class="warning-icon"></span>
                  <span class="warning-title">{t('ui.inviteDialog.anyoneCanJoin')}</span>
                </div>
                <span class="warning-body">{t('ui.inviteDialog.gatesIgnored')}</span>
              </div>

              <div class="link-box">
                <div class="link-text">
                  <span class="link-heading">{t('ui.inviteDialog.shareViaLink', { noun })}</span>
                  <span class="link">{linkShown}</span>
                </div>
                <span class="link-actions">
                  <CopyButton value={link} label="ui.inviteDialog.copyLink" size="md" />
                  {#if onShareToChat && chats.length}
                    <span class="icon-button large" onclick={() => (pickerOpen = true)} role="button" tabindex="0" title={t('ui.inviteDialog.shareToChat')} aria-label={t('ui.inviteDialog.shareToChat')}><span class="send-icon"></span></span>
                  {/if}
                </span>
              </div>
              {#if onResetLink && canInvite}
                <span class="reset-link" onclick={resetLink} role="button" tabindex="0" aria-disabled={busy === 'reset'}>{t(busy === 'reset' ? 'ui.inviteDialog.resetting' : 'ui.inviteDialog.resetLink')}</span>
              {/if}

              {#if qr}
                <div class="qr-box">
                  <span class="qr">{@render qr(link)}</span>
                  <span class="qr-caption">{t('ui.inviteDialog.qrCaption', { noun })}</span>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>

    {#if canInvite && !(embedded && key === 'share')}
      <div class="footer">
        {#if !embedded}
          <span class="cancel" onclick={cancel} role="button" tabindex="0" aria-disabled={flow.locked || share.pending}>{t(key === 'share' ? 'ui.common.done' : 'ui.common.cancel')}</span>
        {/if}
        <span class="grow"></span>
        {#if key === 'add'}
          {#if addPicked.length > 0}
            <span class="note">{countLabel(addPicked.length)}</span>
          {/if}
          <div class="cta" class:ready={addPicked.length > 0 && !busy && !!onAdd} onclick={add} role="button" tabindex="0" aria-disabled={!addPicked.length || !!busy || !onAdd}>
            <span class="cta-icon" style:mask="var(--icon-plus) center/contain no-repeat"></span>
            <span>{t('ui.inviteDialog.addTo', { group: groupName })}</span>
          </div>
        {/if}
        {#if key === 'invite'}
          {#if picked.length > 0}
            <span class="note">{countLabel(picked.length)}</span>
          {/if}
          <div class="cta" class:ready={picked.length > 0 && !busy && !!onInvite} onclick={send} role="button" tabindex="0" aria-disabled={!picked.length || !!busy || !onInvite}>
            <span class="cta-icon" style:mask="var(--icon-invite) center/contain no-repeat"></span>
            <span>{t('ui.inviteDialog.sendInvites')}</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
  {#if pickerOpen}
    <ChatPicker title={t('ui.inviteDialog.shareInviteLink')} previewLabel={t('ui.inviteDialog.inviteLinkCaps')} item={{ title: t('ui.inviteDialog.inviteLink'), sub: linkShown, icon: 'link' }} {chats} z={95} onSend={sentToChat} onClose={() => (pickerOpen = false)} />
  {/if}
  {#if toast}
    <div class="toast-layer">
      <div class="toast">
        {#key toast.id}<UndoToast shown={true} tone={toast.tone} icon={toast.tone === 'success' ? 'check' : 'none'} message={toast.text} actionLabel="" onClose={() => (toast = null)} />{/key}
      </div>
    </div>
  {/if}
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
    box-sizing: border-box;
  }

  .layer.embedded {
    position: absolute;
    padding: 0;
  }

  .reset-link {
    align-self: flex-start;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
  }

  .card {
    position: relative;
    width: 100%;
    max-width: 640px;
    height: min(700px, 100%);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 30px 70px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }

  .embedded .card {
    max-width: none;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
  }

  .embedded-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 71px;
    box-sizing: border-box;
    padding: 0 var(--space-16) 0 var(--space-24);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .embedded-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .icon-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .icon-button.large {
    width: 34px;
    height: 34px;
  }

  .icon-button:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .close-icon.large {
    width: 16px;
    height: 16px;
  }

  .head {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    padding: var(--space-16) var(--space-18);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .head-row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
  }

  .head-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .head-icon {
    width: 18px;
    height: 18px;
    background: var(--ink-2, #b9b9c6);
    mask: var(--icon-invite) center/contain no-repeat;
  }

  .head-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .head-title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .head-sub {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .tabs,
  .field,
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .field {
    min-width: 0;
  }

  .embedded-tabs {
    margin-bottom: calc(var(--space-10) - var(--space-22));
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--space-22) var(--space-18) var(--space-26);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .column {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    gap: var(--space-22);
    min-width: 0;
  }

  .hint {
    padding-inline: var(--space-4);
    margin-top: calc(var(--space-12) * -1);
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .hint.plain {
    margin-top: 0;
  }

  .picked {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    min-width: 0;
    margin-top: var(--space-10);
  }

  .picked-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
    min-width: 0;
    padding-inline: var(--space-4);
  }

  .list-label {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--ink-4, #7c7c8c);
  }

  .list-label.start {
    padding-inline-start: var(--space-4);
  }

  .grow {
    flex: 1;
  }

  .clear-all {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
    min-width: 0;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 4px var(--space-10) 4px 4px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--status-verified, #3d9bff) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-verified, #3d9bff) 34%, transparent);
  }

  .chip-face {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-pill);
  }

  .chip-handle {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
  }

  .chip-remove {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .chip-remove-icon {
    width: 11px;
    height: 11px;
    background: var(--ink-2, #c9c9d4);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .list-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
    margin-top: var(--space-10);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-10);
    padding: var(--space-14) var(--space-10);
  }

  .no-results-text {
    font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .invite-instead {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 38px;
    padding: 0 var(--space-14);
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .invite-instead:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.13));
  }

  .no-people {
    padding: var(--space-14) var(--space-10);
    font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .pending {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }

  .share-toggle {
    display: flex;
    align-items: flex-start;
    gap: var(--space-14);
    min-width: 0;
    padding-inline: var(--space-4);
    margin-top: var(--space-12);
  }

  .share-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .share-title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .share-sub {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .toggle {
    flex: none;
    display: flex;
  }

  .share-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    min-width: 0;
  }

  .warning {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: var(--space-14) var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--status-chit-soft, rgba(255, 159, 69, 0.14));
    box-shadow: inset 0 0 0 1px var(--status-chit, #ff9f45);
  }

  .warning-head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .warning-icon {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--status-chit, #ff9f45);
    mask: var(--icon-warning) center/contain no-repeat;
  }

  .warning-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink, #e4e4ec);
    text-wrap: pretty;
  }

  .warning-body {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .link-box,
  .qr-box {
    padding: var(--space-14) var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
  }

  .link-box {
    display: flex;
    align-items: flex-start;
    gap: var(--space-12);
    min-width: 0;
  }

  .link-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .link-heading {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .link {
    font: var(--weight-semibold) var(--text-md) / 1.5 var(--font-mono);
    color: var(--ink, #e4e4ec);
    overflow-wrap: anywhere;
  }

  .link-actions {
    flex: none;
    display: flex;
    gap: var(--space-4);
  }

  .send-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-3, #9a9aa8);
  }

  .send-icon {
    mask: var(--icon-send) center/contain no-repeat;
  }

  .qr-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-18);
  }

  .qr {
    width: 100%;
    max-width: 230px;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    background: var(--surface-2, #191921);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
    display: flex;
    align-items: center;
    justify-content: center;
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
    text-align: center;
  }

  .qr-caption {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-align: center;
    text-wrap: pretty;
  }

  .footer {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-16) var(--space-18);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .cancel {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .cancel:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
  }

  .note {
    margin-inline-end: var(--space-8);
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .cta {
    --cta-ink: var(--ink-4, #7c7c8c);
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-18);
    height: var(--control-lg, 40px);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--cta-ink);
    cursor: not-allowed;
    user-select: none;
  }

  .cta.ready {
    --cta-ink: var(--on-accent, #2e0512);
    background: var(--accent, #ff5672);
    cursor: pointer;
  }

  .cta:hover {
    filter: brightness(1.08);
  }

  .cta-icon {
    width: 17px;
    height: 17px;
    background: var(--cta-ink);
  }

  .toast-layer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 24px;
    z-index: 96;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    width: min(420px, calc(100% - 48px));
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
</style>
