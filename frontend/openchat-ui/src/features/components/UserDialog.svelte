<!-- Profile dialog for a person: cover, avatar, name, facts and about, then Block and Message.
     dmTabs (opened from your DM with them): Mute / Favourite pills and Profile / This chat tabs instead of Message.
     isSelf: your own profile — nothing to message, block or favourite. Closing plays the exit animation first.
     Mute / favourite / chat settings apply at once and roll back with an error if the host rejects. Block asks first and
     waits for the host; Block, Message and Favourite are hidden when their callbacks are absent. -->
<script lang="ts">
  import { onDestroy, untrack, type ComponentProps } from 'svelte';
  import Badge from '../../lib/components/Badge.svelte';
  import DetailSection from '../../lib/components/DetailSection.svelte';
  import DmChatSettings from './DmChatSettings.svelte';
  import PanelCover from '../../lib/components/PanelCover.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { Optimistic } from '../../lib/behaviours/optimistic.svelte';
  import { useT } from '../../lib/i18n';

  type MuteKey = '8h' | '1w' | 'always';

  const GRADIENTS = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    rose: 'linear-gradient(140deg,#FF6B8B,#C13584)',
    plum: 'linear-gradient(140deg,#B06BFF,#6A2BFF)',
    slate: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
  };
  // label / tile: resource keys
  const MUTE_SPANS: { key: MuteKey; label: string; tile: string }[] = [
    { key: '8h', label: 'ui.userDialog.mute8h', tile: 'ui.userDialog.muted8h' },
    { key: '1w', label: 'ui.userDialog.mute1w', tile: 'ui.userDialog.muted1w' },
    { key: 'always', label: 'ui.userDialog.muteAlways', tile: 'ui.userDialog.muted' },
  ];

  type Settings = ComponentProps<typeof DmChatSettings>;

  interface Props {
    title: string;
    handle?: string;
    about?: string;
    color?: keyof typeof GRADIENTS;
    /** CSS background (image URL or gradient) for the avatar; falls back to the colour gradient. */
    avatar?: string;
    online?: boolean;
    verified?: boolean;
    cover?: string;
    /** The same fields the DM panel shows (member since, CHIT, status), one column each. Labels: resource keys (or literal text). */
    facts: { label: string; value: string; dot?: boolean; highlight?: boolean }[];
    isSelf?: boolean;
    dmTabs?: boolean;
    initialTab?: 'profile' | 'chat';
    muted?: MuteKey | null;
    fav?: boolean;
    disappearOn?: boolean;
    disappearAfter?: string;
    readReceipts?: boolean;
    onMuteChange?: (key: MuteKey | null) => Promise<unknown> | void;
    /** Receives the new state. */
    onToggleFavourite?: (fav: boolean) => Promise<unknown> | void;
    onDisappearChange?: Settings['onDisappearChange'];
    onReadReceiptsChange?: Settings['onReadReceiptsChange'];
    /** Hidden without it. */
    onMessage?: () => void;
    /** You have blocked this person (shows Unblock instead of Block). */
    blocked?: boolean;
    /** Block after the user confirms; the dialog closes once it resolves. Hidden without it. */
    onBlock?: () => Promise<unknown> | void;
    onUnblock?: () => Promise<unknown> | void;
    onCancel?: () => void;
  }

  let {
    title,
    handle = '',
    about = '',
    color = 'violet',
    avatar,
    online = false,
    verified = false,
    cover = '',
    facts,
    isSelf = false,
    dmTabs = false,
    initialTab = 'profile',
    muted = null,
    fav = false,
    disappearOn = false,
    disappearAfter = '12 hours',
    readReceipts = false,
    onMuteChange,
    onToggleFavourite,
    onDisappearChange,
    onReadReceiptsChange,
    onMessage,
    blocked = false,
    onBlock,
    onUnblock,
    onCancel,
  }: Props = $props();
  const t = useT();

  // the dialog contract (busy / leaving / exit) and optimistic fields: lib/behaviours
  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());
  const mute = new Optimistic<MuteKey | null>(() => muted);
  const favourite = new Optimistic(() => fav);
  $effect.pre(() => {
    void muted;
    untrack(() => mute.sync());
  });
  $effect.pre(() => {
    void fav;
    untrack(() => favourite.sync());
  });

  let tabOverride = $state<'profile' | 'chat' | null>(null);
  const isMuted = $derived(mute.current);
  const isFav = $derived(favourite.current);
  let muteMenu = $state<{ top: number; left: number } | null>(null);
  // the error belongs to whichever toggle changed last
  let lastToggle = $state<'mute' | 'fav'>('mute');
  const toggleFailed = $derived(lastToggle === 'mute' ? mute.failed : favourite.failed);
  let blockStep = $state<'idle' | 'confirm'>('idle');
  let blockError = $state<string | null>(null);

  const dm = $derived(dmTabs && !isSelf);
  const tab = $derived(dm ? (tabOverride ?? initialTab) : 'profile');
  const span = $derived(MUTE_SPANS.find((o) => o.key === isMuted));
  const muteOptions = $derived(
    isMuted
      ? [{ label: 'ui.userDialog.unmute', key: null }, ...MUTE_SPANS.filter((o) => o.key !== isMuted).map((o) => ({ label: o.label, key: o.key }))]
      : MUTE_SPANS.map((o) => ({ label: o.label, key: o.key })),
  );

  // Esc, the veil and the cover's close: never while a block / unblock is in flight (it closes itself when done)
  const dismiss = () => flow.dismiss(onCancel);

  function setMute(key: MuteKey | null) {
    muteMenu = null;
    lastToggle = 'mute';
    mute.set(key, () => onMuteChange?.(key));
  }

  function toggleFav() {
    if (!onToggleFavourite) return;
    lastToggle = 'fav';
    const next = !isFav;
    favourite.set(next, () => onToggleFavourite(next));
  }

  function cancelBlock() {
    if (flow.busy) return;
    blockStep = 'idle';
    blockError = null;
  }

  async function confirmBlock() {
    // the host may flip `blocked` before it resolves, so decide everything from the state the user acted on
    const wasBlocked = blocked;
    const call = wasBlocked ? onUnblock : onBlock;
    if (!call) return;
    blockError = null;
    const result = await flow.run(call);
    if (!result.ok) {
      // { ok: false } is also an ignored press (busy / leaving): only a real rejection shows an error
      if (flow.failed) blockError = wasBlocked ? 'ui.userDialog.unblockFailed' : 'ui.userDialog.blockFailed';
      return;
    }
    blockStep = 'idle';
    if (!wasBlocked) flow.leave(onCancel);
  }

  function openMuteMenu(e: MouseEvent & { currentTarget: HTMLElement }) {
    const el = e.currentTarget, root = el.closest('[data-panel-root]');
    if (!root) return;
    const r = el.getBoundingClientRect(), b = root.getBoundingClientRect();
    muteMenu = { top: r.bottom - b.top + 6, left: Math.max(16, Math.min(r.left - b.left, b.width - 232)) };
  }
</script>

<div class="layer" class:closing={flow.closing} role="dialog" aria-modal="true" use:modal={flow.escape(onCancel)}>
  <div class="veil" class:closing={flow.closing} onclick={dismiss} aria-hidden="true"></div>
  <div class="card" class:closing={flow.closing} data-panel-root="true">
    <div class="cover">
      <!-- in a DM the favourite lives in the pill row, so the cover only closes -->
      <PanelCover
        {cover}
        actions={['close']}
        trailActions={isSelf || dm || !onToggleFavourite ? [] : ['favourite']}
        handlers={{ close: dismiss, favourite: toggleFav }}
        labels={{ favourite: isFav ? 'ui.userDialog.favourited' : 'ui.userDialog.favourite' }}
      />
    </div>

    <div class="scroll" onscroll={() => (muteMenu = null)}>
      <span class="avatar" style:background={avatar || (GRADIENTS[color] ?? GRADIENTS.violet)}>
        {#if online}
          <span class="online"></span>
        {/if}
      </span>
      <div class="names">
        <div class="title-line">
          <span class="title">{title}</span>
          {#if verified}
            <span class="badge"><Badge variant="verified" /></span>
          {/if}
        </div>
        {#if handle}
          <span class="handle">{handle}</span>
        {/if}
      </div>

      {#if dm}
        <div class="pills">
          <span class="pill mute" class:on={!!isMuted} onclick={openMuteMenu} aria-label={t(isMuted ? 'ui.userDialog.changeMute' : 'ui.userDialog.muteNotifications')} role="button" tabindex="0" title={t(isMuted ? 'ui.userDialog.changeMute' : 'ui.userDialog.muteNotifications')}>
            <span class="pill-icon" style:mask="var(--icon-{isMuted ? 'bell-off' : 'bell'}) center/contain no-repeat"></span>{t(span ? span.tile : 'ui.userDialog.mute')}
            <span class="pill-divider"></span><span class="caret"></span>
          </span>
          {#if onToggleFavourite}<span class="pill fav" class:on={isFav} onclick={toggleFav} role="button" tabindex="0" aria-pressed={isFav}
              ><span class="pill-icon heart"></span>{t(isFav ? 'ui.userDialog.favourited' : 'ui.userDialog.favourite')}</span
            >{/if}
        </div>
        <div class="tabs">
          <SegmentedTabs labels={[t('ui.userDialog.profile'), t('ui.userDialog.thisChat')]} selectedIndex={tab === 'chat' ? 1 : 0} dotOnLast={false} onSelect={(i) => (tabOverride = i === 1 ? 'chat' : 'profile')} />
        </div>
      {/if}

      {#if tab === 'profile'}
        <div class="profile" class:in-dm={dm}>
          <div class="facts" style:grid-template-columns="repeat({facts.length},minmax(0,1fr))">
            {#each facts as f}
              <div class="cell"><DetailSection label={t(f.label)} value={t(f.value)} dot={f.dot ?? false} highlight={f.highlight ?? false} /></div>
            {/each}
          </div>
          {#if about}
            <div class="cell"><DetailSection label={t('ui.userDialog.about')} value={about} variant="prose" /></div>
          {/if}
        </div>
      {:else}
        <div class="chat-tab"><DmChatSettings peerName={title} {disappearOn} {disappearAfter} {readReceipts} {onDisappearChange} {onReadReceiptsChange} /></div>
      {/if}
    </div>

    {#if toggleFailed && blockStep === 'idle'}<span class="error" role="alert">{t('ui.userDialog.actionFailed')}</span>{/if}
    {#if !isSelf && blockStep !== 'idle'}
      <div class="footer confirm">
        <span class="confirm-text" class:failed={!!blockError} role={blockError ? 'alert' : undefined}
          >{blockError ? t(blockError) : t(blocked ? 'ui.userDialog.unblockConfirm' : 'ui.userDialog.blockConfirm', { name: title })}</span
        >
        <span class="cancel" onclick={cancelBlock} role="button" tabindex="0">{t('ui.common.cancel')}</span>
        <span class="block" class:busy={flow.busy} onclick={confirmBlock} role="button" tabindex="0" aria-disabled={flow.locked}
          >{t(flow.busy ? 'ui.userDialog.working' : blocked ? 'ui.userDialog.unblock' : 'ui.userDialog.block')}</span
        >
      </div>
    {:else if !isSelf && ((blocked ? onUnblock : onBlock) || (!dm && onMessage))}
      <div class="footer">
        {#if blocked ? onUnblock : onBlock}
          <span class="block" onclick={() => (blockStep = 'confirm')} role="button" tabindex="0">{t(blocked ? 'ui.userDialog.unblock' : 'ui.userDialog.block')}</span>
        {/if}
        <span class="grow"></span>
        {#if !dm && onMessage && !blocked}
          <div class="message" onclick={() => flow.dismiss(onMessage)} role="button" tabindex="0">
            <span>{t('ui.userDialog.message')}</span>
            <span class="message-icon"></span>
          </div>
        {/if}
      </div>
    {/if}
    {#if muteMenu}
      <div class="mute-backdrop" onclick={() => (muteMenu = null)} aria-hidden="true"></div>
      <div class="mute-menu" style:top="{muteMenu.top}px" style:left="{muteMenu.left}px">
        <span class="mute-title">{t(isMuted ? 'ui.userDialog.muted' : 'ui.userDialog.muteFor')}</span>
        {#each muteOptions as o}
          <div class="mute-option" onclick={() => setMute(o.key)} role="button" tabindex="0">{t(o.label)}</div>
        {/each}
      </div>
    {/if}
  </div>
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
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
    animation: oc-veil-in var(--duration-base, 200ms) var(--ease-out) both;
  }

  .layer.closing {
    pointer-events: none;
  }

  .veil.closing {
    animation: oc-veil-out 170ms var(--ease-standard) both;
  }

  .card {
    position: relative;
    width: 100%;
    max-width: 600px;
    max-height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-modal, 0 30px 70px rgba(0, 0, 0, 0.45));
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow, 280ms) var(--ease-out) both;
  }

  .card.closing {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .cover {
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .cell {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    margin-top: -40px;
    padding: 0 var(--space-26) var(--space-26);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
  }

  .avatar {
    position: relative;
    flex: none;
    width: 88px;
    height: 88px;
    border-radius: var(--radius-pill);
    box-shadow: 0 0 0 4px var(--surface-1, #0e0e12);
  }

  .online {
    position: absolute;
    bottom: 3px;
    inset-inline-end: 3px;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-pill);
    background: var(--status-online, #2ee6a8);
    border: 3px solid var(--surface-1, #0e0e12);
  }

  .names {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    max-width: 100%;
  }

  .title-line {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    max-width: 100%;
  }

  .title {
    font: var(--weight-bold) var(--text-2xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    flex: none;
    display: grid;
    grid-template-columns: max-content;
  }

  .handle {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .pills {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--space-8);
    margin-top: var(--space-8);
  }

  .pill {
    --pill-ink: var(--ink-2, #c9c9d4);
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--pill-ink);
    cursor: pointer;
    user-select: none;
  }

  .pill.on {
    --pill-ink: var(--accent-bright, #ff8298);
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .pill:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .mute {
    padding: 0 9px 0 12px;
  }

  .fav {
    padding: 0 13px 0 12px;
  }

  .pill-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--pill-ink);
  }

  .pill-icon.heart {
    mask: var(--icon-heart) center/contain no-repeat;
  }

  .pill-divider {
    width: 1px;
    height: 16px;
    margin: 0 2px 0 3px;
    background: var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .caret {
    flex: none;
    width: 12px;
    height: 12px;
    background: var(--pill-ink);
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .tabs {
    width: 100%;
    margin-top: var(--space-14);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .profile {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-10);
    margin-top: var(--space-16);
  }

  .profile.in-dm {
    margin-top: var(--space-10);
  }

  .facts {
    width: 100%;
    display: grid;
    gap: var(--space-6);
  }

  .chat-tab {
    width: 100%;
    margin-top: var(--space-10);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .footer {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-16) var(--space-26);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .error {
    padding: var(--space-8) var(--space-26) 0;
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .footer.confirm {
    gap: var(--space-12);
  }

  .confirm-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .cancel {
    flex: none;
    padding: var(--space-10) var(--space-12);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
  }

  .block.busy {
    opacity: 0.6;
    cursor: default;
  }

  .block {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--status-danger, #f5493d);
    cursor: pointer;
    user-select: none;
  }

  .block:hover {
    background: var(--btn-danger-bg, rgba(240, 68, 56, 0.08));
  }

  .grow {
    flex: 1;
  }

  .message {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-18);
    height: var(--control-lg, 40px);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--accent, #ff5672);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--on-accent, #2e0512);
    cursor: pointer;
    user-select: none;
  }

  .message:hover {
    background: var(--accent-hover, #ff6d85);
  }

  .message-icon {
    width: 16px;
    height: 16px;
    background: var(--on-accent, #2e0512);
    mask: var(--icon-chat) center/contain no-repeat;
  }

  .mute-backdrop {
    position: absolute;
    inset: 0;
    z-index: 44;
  }

  .mute-menu {
    position: absolute;
    z-index: 45;
    width: 216px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-8);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--surface-2, #17171d);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12)),
      0 18px 40px rgba(0, 0, 0, 0.5);
  }

  .mute-title {
    padding: var(--space-6) var(--space-8) var(--space-8);
    font: var(--weight-regular) var(--text-xs) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .mute-option {
    display: flex;
    align-items: center;
    min-width: 0;
    padding: var(--space-8);
    border-radius: var(--radius-sm);
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
    user-select: none;
  }

  .mute-option:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }
</style>
