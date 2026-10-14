<!-- Bot details → permissions → install (or edit / remove an installed bot). The bot's definition (creator, the
     permissions it asks for, its commands) comes from the host. A new install starts with nothing granted; an installed
     bot starts from its current `granted`. Revoking a permission greys out the commands that need it. Without
     `canManage` (bot rights) the dialog shows details only. Install / save / remove wait on the host's promise: the
     dialog closes when it resolves and stays open with an error if it rejects. -->
<script lang="ts" module>
  export type BotPerm = 'read' | 'summary' | 'members' | 'pinned' | 'threads' | 'react' | 'send' | 'images' | 'remove' | 'pin' | 'everyone';
  export type BotColor = 'violet' | 'amber' | 'teal' | 'blue' | 'rose' | 'plum' | 'slate';

  /** A bot as its definition declares it, plus what it is currently granted in this chat (installed bots). */
  export interface BotDefinition {
    id: string;
    name: string;
    /** Handle of the bot's creator. */
    creator: string;
    /** Resource key (or literal text). */
    description?: string;
    color?: BotColor;
    /** Permissions the bot asks for. */
    perms: BotPerm[];
    /** `about` is a resource key (or literal text); `needs` lists the permissions each command requires. */
    commands: { name: string; about: string; needs: BotPerm[] }[];
    /** Installed bots: what is granted now. Missing = not granted. */
    granted?: Partial<Record<BotPerm, boolean>>;
  }

  export interface BotInstall {
    botId: string;
    /** Every requested permission with its final on/off state. */
    granted: Record<BotPerm, boolean>;
  }
</script>

<script lang="ts">
  import { segments, useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';
  import { onDestroy } from 'svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import { modal } from '../../lib/behaviours/modal';

  type PermKey = BotPerm;
  type Color = BotColor;

  const GRADIENTS: Record<Color, string> = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    rose: 'linear-gradient(140deg,#FF6B8B,#C13584)',
    plum: 'linear-gradient(140deg,#B06BFF,#6A2BFF)',
    slate: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
  };

  // permission vocabulary — the two scopes a bot can be granted in a chat
  const PERMS: Record<PermKey, { label: string; scope: 'chat' | 'message'; risky?: boolean }> = {
    read: { label: 'ui.botDialog.perms.readMessages', scope: 'chat' },
    summary: { label: 'ui.botDialog.perms.readSummary', scope: 'chat' },
    members: { label: 'ui.botDialog.perms.readMembers', scope: 'chat' },
    pinned: { label: 'ui.botDialog.perms.readPinned', scope: 'chat' },
    threads: { label: 'ui.botDialog.perms.readThreads', scope: 'chat' },
    react: { label: 'ui.botDialog.perms.react', scope: 'chat' },
    send: { label: 'ui.botDialog.perms.sendText', scope: 'message' },
    images: { label: 'ui.botDialog.perms.sendImages', scope: 'message' },
    remove: { label: 'ui.botDialog.perms.deleteMessages', scope: 'message', risky: true },
    pin: { label: 'ui.botDialog.perms.pinMessages', scope: 'message', risky: true },
    everyone: { label: 'ui.botDialog.perms.mentionAll', scope: 'message', risky: true },
  };

  // plain-language phrases for the summary sentence, in the order they are listed; `text` names the phrase, which
  // comes in two forms: ui.botDialog.can.* ("reads messages", installed) and ui.botDialog.ask.* ("read messages")
  const CAN_DO: Partial<Record<PermKey, { text: string; risky?: boolean }>> = {
    read: { text: 'read' },
    summary: { text: 'summary' },
    threads: { text: 'threads' },
    pinned: { text: 'pinned' },
    members: { text: 'members' },
    send: { text: 'send' },
    images: { text: 'images' },
    remove: { text: 'remove', risky: true },
    pin: { text: 'pin', risky: true },
    everyone: { text: 'everyone', risky: true },
  };
  const CAN_DO_ORDER: PermKey[] = ['read', 'summary', 'threads', 'pinned', 'members', 'send', 'images', 'remove', 'pin', 'everyone'];

  interface Props {
    bot: BotDefinition;
    /** Group name (data); defaults to "this group". */
    groupName?: string;
    installed?: boolean;
    /** The viewer has bot rights here: can install, change permissions and remove. Without it: details only. */
    canManage?: boolean;
    initialStep?: 'details' | 'configure' | 'remove';
    onRemove?: (b: { botId: string }) => Promise<unknown> | void;
    /** Install a new bot, or save an installed bot's permissions. */
    onInstall?: (bot: BotInstall) => Promise<unknown> | void;
    onCancel?: () => void;
  }

  let { bot, groupName = 'ui.botDialog.thisGroup', installed = false, canManage = false, initialStep = 'details', onRemove, onInstall, onCancel }: Props = $props();

  const t = useT();
  // "a", "a and b", "a, b and c" — separator and final conjunction are translatable
  const list = (a: string[]) =>
    a.length > 1 ? t('ui.botDialog.listAnd', { items: a.slice(0, -1).join(t('ui.botDialog.listSeparator')), last: a[a.length - 1] }) : (a[0] ?? '');
  const group = $derived(t(groupName));

  let stepOverride = $state<'details' | 'configure' | 'remove' | null>(null);
  let grantedOverride = $state<Partial<Record<PermKey, boolean>> | null>(null);
  let closing = $state(false);
  let busy = $state(false);
  let failed = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  const name = $derived(bot.name);
  const spec = $derived(bot);
  const color = $derived<Color>(bot.color ?? 'slate');
  const description = $derived(bot.description || 'ui.botDialog.noDescription');
  const viewOnly = $derived(!canManage);
  // without bot rights only the details step exists
  const step = $derived(viewOnly ? 'details' : (stepOverride ?? initialStep));
  const isConfigure = $derived(step === 'configure');
  const isRemove = $derived(step === 'remove');

  // nothing is granted until the owner switches it on; an installed bot starts from what it has now
  const granted = $derived<Partial<Record<PermKey, boolean>>>(grantedOverride ?? (installed ? { ...(bot.granted ?? {}) } : {}));
  const asked = $derived(spec.perms.map((k) => ({ key: k, ...PERMS[k] })));
  const groups = $derived(
    [
      { label: 'ui.botDialog.inThisChat', icon: 'chat', items: asked.filter((p) => p.scope === 'chat') },
      { label: 'ui.botDialog.forMessages', icon: 'message', items: asked.filter((p) => p.scope === 'message') },
    ].filter((g) => g.items.length > 0),
  );

  // view-only: commands the bot can't run here are simply left out
  const commands = $derived(
    (viewOnly && installed ? spec.commands.filter((c) => c.needs.every((k) => granted[k])) : spec.commands).map((c) => ({
      ...c,
      blocked: isConfigure && c.needs.some((k) => !granted[k]),
    })),
  );
  const blocked = $derived(commands.filter((c) => c.blocked));

  // one plain-language sentence for everyone; the parts that act on people's messages are highlighted
  const summary = $derived.by(() => {
    // installed: what it can do now; not installed: everything it asks for
    const on = CAN_DO_ORDER.filter((k) => spec.perms.includes(k) && (!installed || granted[k]));
    const form = installed ? 'can' : 'ask';
    const plain = list(on.filter((k) => !CAN_DO[k]!.risky).map((k) => t(`ui.botDialog.${form}.${CAN_DO[k]!.text}`)));
    const risky = list(on.filter((k) => CAN_DO[k]!.risky).map((k) => t(`ui.botDialog.ask.${CAN_DO[k]!.text}`)));
    // the risky phrase is highlighted inside the sentence: one message, with {risky} rendered as markup
    const key = plain ? (installed ? 'summaryInstalled' : 'summaryAsk') : installed ? 'summaryInstalledRiskyOnly' : 'summaryAskRiskyOnly';
    const parts = segments(t, `ui.botDialog.${key}`, ['risky'], { plain, group, hasRisky: risky ? 'yes' : 'no' });
    // sentence case: the message can start with a lowercase list item
    const first = parts[0];
    if (first && 'text' in first) parts[0] = { text: first.text.charAt(0).toUpperCase() + first.text.slice(1) };
    return { parts, risky };
  });

  const headerTitle = $derived(t(isRemove ? 'ui.botDialog.removeBot' : isConfigure ? (installed ? 'ui.botDialog.botPermissions' : 'ui.botDialog.installBot') : 'ui.botDialog.botDetails'));
  const headerSub = $derived(t(isConfigure && !installed ? 'ui.botDialog.stepSub' : 'ui.botDialog.sub', { name, group }));
  const primaryLabel = $derived(
    t(isRemove ? 'ui.botDialog.removeBot' : isConfigure ? (installed ? 'ui.botDialog.savePermissions' : 'ui.botDialog.installIntoGroup') : installed ? 'ui.botDialog.editPermissions' : 'ui.botDialog.choosePermissions'),
  );
  const primaryIcon = $derived(isRemove ? 'trash' : isConfigure ? (installed ? 'check' : 'receive') : 'arrow');
  const detailsFootnote = $derived(
    t(viewOnly ? (installed ? 'ui.botDialog.footnoteViewOnly' : 'ui.botDialog.footnoteViewOnlyNotInstalled') : installed ? 'ui.botDialog.footnoteInstalled' : 'ui.botDialog.footnoteInstall', { name, group }),
  );

  // the card animates out before the parent hears about it
  function close(then?: () => void) {
    if (closing) return;
    // like the other dialogs: once it leaves it never comes back; the host unmounts it
    closing = true;
    timer = setTimeout(() => {
      then?.();
    }, 170);
  }

  // waits on the host; closes when it resolves, stays with an error when it rejects
  async function run(call: () => Promise<unknown> | void) {
    if (busy || closing) return;
    busy = true;
    failed = false;
    try {
      await call();
    } catch {
      failed = true;
      return;
    } finally {
      busy = false;
    }
    close(onCancel);
  }

  function primary() {
    // nothing new once closing (cancelled, or the exit after a success)
    if (busy || closing || viewOnly) return;
    if (isRemove) {
      if (onRemove) run(() => onRemove({ botId: bot.id }));
    } else if (isConfigure) {
      if (!onInstall) return;
      const all = Object.fromEntries(spec.perms.map((k) => [k, !!granted[k]])) as Record<PermKey, boolean>;
      run(() => onInstall({ botId: bot.id, granted: all }));
    } else stepOverride = 'configure';
  }

  function secondary() {
    if (busy) return;
    failed = false;
    if (isConfigure || isRemove) stepOverride = 'details';
    else close(onCancel);
  }
</script>

<div class="layer" class:closing role="dialog" aria-modal="true" use:modal={closing ? undefined : () => !busy && close(onCancel)}>
  <div class="veil" class:closing onclick={() => !busy && close(onCancel)} aria-hidden="true"></div>
  <div class="card" class:closing>
    <div class="header">
      <span class="header-tile"><span class="header-icon"></span></span>
      <div class="header-text">
        <span class="header-title">{headerTitle}</span>
        <span class="header-sub">{headerSub}</span>
      </div>
      <span class="close" onclick={() => !busy && close(onCancel)} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-icon"></span></span>
    </div>

    <div class="body">
      {#if !isConfigure && !isRemove}
        <div class="identity">
          <span class="bot-face" style:background={GRADIENTS[color] ?? GRADIENTS.slate}></span>
          <div class="identity-text">
            <span class="bot-name">{name}</span>
            <span class="byline"
              ><span><Translate key="ui.botDialog.createdBy">{#snippet creator()}<span class="creator">{spec.creator}</span>{/snippet}</Translate></span>{#if installed}<span class="dot">·</span><span class="installed"><span class="installed-icon"></span>{t('ui.botDialog.installed')}</span>{/if}</span
            >
          </div>
          {#if installed && !!onRemove && canManage}
            <div class="identity-actions">
              <span
                class="remove"
                onclick={() => (stepOverride = 'remove')}
                aria-label={t('ui.botDialog.removeFrom', { name, group })}
                role="button"
                tabindex="0"
                title={t('ui.botDialog.removeFrom', { name, group })}>{t('ui.common.remove')}</span
              >
            </div>
          {/if}
        </div>

        <span class="description">{t(description)}</span>

        <div class="section">
          <span class="section-label">{t('ui.botDialog.commands', { count: commands.length })}</span>
          <div class="panel">
            {#each commands as c}
              <div class="command">
                <span class="command-name">{c.name}</span>
                <span class="command-about">{t(c.about)}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="plain">
          <span class="lock"></span>
          <span class="plain-text">{#each summary.parts as part}{#if 'slot' in part}<span class="risky-text">{summary.risky}</span>{:else}{part.text}{/if}{/each}</span>
        </div>

        <span class="footnote">{detailsFootnote}</span>
      {/if}

      {#if isRemove}
        <div class="remove-head">
          <div class="remove-face">
            <span class="remove-face-fill" style:background={GRADIENTS[color] ?? GRADIENTS.slate}></span>
            <span class="remove-badge"><span class="remove-badge-icon"></span></span>
          </div>
          <span class="remove-title">{t('ui.botDialog.removeTitle', { name, group })}</span>
        </div>
        <div class="panel">
          <div class="fact"><span class="fact-icon danger" style:mask="var(--icon-warning) center/contain no-repeat"></span><span class="fact-text">{t('ui.botDialog.factCommandsStop', { group })}</span></div>
          <div class="fact"><span class="fact-icon" style:mask="var(--icon-lock) center/contain no-repeat"></span><span class="fact-text">{t('ui.botDialog.factRevoked')}</span></div>
          <div class="fact"><span class="fact-icon" style:mask="var(--icon-rotate-back) center/contain no-repeat"></span><span class="fact-text">{t('ui.botDialog.factReinstall')}</span></div>
        </div>
      {/if}

      {#if isConfigure}
        {#if !installed}
          <div class="target">
            <span class="target-face" style:background={GRADIENTS[color] ?? GRADIENTS.slate}></span>
            <span class="target-bot">{name}</span>
            <span class="target-arrow"></span>
            <span class="target-group">{group}</span>
          </div>
        {/if}

        <div class="intro-row">
          <span class="intro">{t('ui.botDialog.intro')}</span>
        </div>

        {#each groups as g}
          <div class="section">
            <div class="group-head">
              <span class="group-icon" style:mask="var(--icon-{g.icon}) center/contain no-repeat"></span>
              <span class="group-label">{t(g.label)}</span>
            </div>
            <div class="panel">
              {#each g.items as p}
                <div class="perm">
                  <span class="perm-label" class:off={!granted[p.key]}>
                    <span>{t(p.label)}</span>
                    {#if p.risky}
                      <span class="risky" title={t('ui.botDialog.consequentialHint')}>
                        <span class="risky-icon"></span>
                        <span class="risky-label">{t('ui.botDialog.consequential')}</span>
                      </span>
                    {/if}
                  </span>
                  <div class="perm-toggle"><Toggle on={!!granted[p.key]} onChange={(on) => (grantedOverride = { ...granted, [p.key]: on })} /></div>
                </div>
              {/each}
            </div>
          </div>
        {/each}

        <div class="section">
          <span class="section-label">{t('ui.botDialog.commands', { count: commands.length })}</span>
          <div class="chips">
            {#each commands as c}
              <span class="command-chip" class:blocked={c.blocked} title={t(c.about)}>{c.name}</span>
            {/each}
          </div>
        </div>

        {#if blocked.length > 0}
          <div class="blocked">
            <div class="blocked-head">
              <span class="blocked-icon"></span>
              <span class="blocked-title">{t('ui.botDialog.blockedTitle', { count: blocked.length })}</span>
            </div>
            <span class="blocked-body">{t('ui.botDialog.blockedBody', { count: blocked.length, commands: blocked.map((c) => c.name).join(', ') })}</span>
          </div>
        {/if}

        <span class="footnote">{t(installed ? 'ui.botDialog.footnoteSaving' : 'ui.botDialog.footnoteInstalling', { name, group })}</span>
      {/if}
    </div>

    <div class="footer">
      <span class="secondary" onclick={secondary} role="button" tabindex="0">{t(isConfigure || isRemove ? 'ui.common.back' : viewOnly ? 'ui.common.close' : 'ui.common.cancel')}</span>
      <span class="grow"></span>
      {#if failed}
        <span class="error" role="alert">{t(isRemove ? 'ui.botDialog.removeFailed' : installed ? 'ui.botDialog.saveFailed' : 'ui.botDialog.installFailed')}</span>
      {/if}
      {#if !viewOnly && (step === 'details' || (isConfigure ? !!onInstall : !!onRemove))}
        <div class="primary" class:danger={isRemove} class:busy onclick={primary} role="button" tabindex="0" aria-disabled={busy}>
          <span>{busy ? t('ui.botDialog.working') : primaryLabel}</span>
          <span class="primary-icon" style:mask="var(--icon-{primaryIcon}) center/contain no-repeat"></span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .layer.closing {
    pointer-events: none;
  }

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

  .header {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-18);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .header-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
    box-shadow: inset 0 0 0 1px var(--accent-dim, rgba(255, 86, 114, 0.35));
  }

  .header-icon {
    width: 19px;
    height: 19px;
    background: var(--accent, #ff5672);
    mask: var(--icon-bot) center/contain no-repeat;
  }

  .header-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-title,
  .header-sub {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .header-sub {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .close {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .close:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--space-26) var(--space-18) var(--space-32);
    display: flex;
    flex-direction: column;
    gap: var(--space-26);
  }

  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-14);
    min-width: 0;
  }

  .bot-face {
    flex: none;
    width: 58px;
    height: 58px;
    border-radius: var(--radius-lg);
  }

  .identity-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .bot-name {
    font: var(--weight-bold) var(--text-2xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .byline {
    font: var(--weight-regular) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-6);
  }

  .creator {
    color: var(--accent, #ff5672);
  }

  .dot {
    color: var(--ink-4, #7c7c8c);
  }

  .installed {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    font-weight: var(--weight-semibold);
    color: var(--status-online, #2ee6a8);
  }

  .installed-icon {
    width: 13px;
    height: 13px;
    background: var(--status-online, #2ee6a8);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .identity-actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .remove {
    flex: none;
    display: flex;
    align-items: center;
    height: 34px;
    padding: 0 var(--space-14);
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-danger, #ff5a5f) 50%, transparent);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--status-danger, #ff5a5f);
    cursor: pointer;
    user-select: none;
  }

  .remove:hover {
    background: color-mix(in oklch, var(--status-danger, #ff5a5f) 12%, transparent);
  }

  .description {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    text-wrap: pretty;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    min-width: 0;
  }

  .section-label {
    padding-inline-start: var(--space-2);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .panel {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .command,
  .perm {
    display: flex;
    min-width: 0;
    padding: var(--space-12) var(--space-14);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .command:last-child,
  .perm:last-child {
    border-block-end-color: transparent;
  }

  .command {
    align-items: baseline;
    gap: var(--space-12);
  }

  .command-name {
    flex: none;
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-mono);
    color: var(--accent-bright, #ff8298);
  }

  .command-about {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .plain {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
    padding: var(--space-14) var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    border: 1px solid var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .lock {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-4, #7c7c8c);
    mask: var(--icon-lock) center/contain no-repeat;
  }

  .plain-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    text-wrap: pretty;
  }

  .risky-text {
    color: var(--status-chit, #ff9f45);
  }

  .footnote {
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .remove-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-16);
    padding-top: var(--space-8);
    text-align: center;
  }

  .remove-face {
    position: relative;
    width: 64px;
    height: 64px;
  }

  .remove-face-fill {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-lg);
  }

  .remove-badge {
    position: absolute;
    right: -6px;
    bottom: -6px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-pill);
    background: var(--status-danger, #ff5a5f);
    box-shadow: 0 0 0 3px var(--surface-1, #0e0e12);
  }

  .remove-badge-icon {
    width: 14px;
    height: 14px;
    background: #fff;
    mask: var(--icon-trash) center/contain no-repeat;
  }

  .remove-title {
    font: var(--weight-bold) var(--text-xl) / 1.25 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
    text-wrap: balance;
  }

  .fact {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 56px;
    padding: var(--space-10) var(--space-16);
    box-sizing: border-box;
  }

  .fact + .fact {
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .fact-icon {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-3, #9a9aa8);
  }

  .fact-icon.danger {
    background: var(--status-danger, #ff5a5f);
  }

  .fact-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
  }

  .target {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-12) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .target-face {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
  }

  .target-bot,
  .target-group {
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .target-bot {
    flex: none;
    color: var(--ink, #e4e4ec);
  }

  .target-group {
    flex: 1;
    color: var(--ink-2, #b9b9c6);
  }

  .target-arrow {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-4, #7c7c8c);
    mask: var(--icon-arrow) center/contain no-repeat;
  }

  .intro-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .intro {
    flex: 1;
    min-width: 220px;
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    text-wrap: pretty;
  }

  .group-head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
    padding-inline-start: var(--space-2);
  }

  .group-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink-4, #7c7c8c);
  }

  .group-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .section:has(.group-head) {
    gap: var(--space-8);
  }

  .perm {
    align-items: center;
    gap: var(--space-14);
  }

  .perm-label {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .perm-label.off {
    color: var(--ink-4, #7c7c8c);
  }

  .risky {
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px var(--space-6);
    border-radius: var(--radius-pill);
    background: var(--status-chit-soft, rgba(255, 159, 69, 0.14));
    box-shadow: inset 0 0 0 1px var(--status-chit, #ff9f45);
  }

  .risky-icon {
    flex: none;
    width: 10px;
    height: 10px;
    background: var(--status-chit, #ff9f45);
    mask: var(--icon-warning) center/contain no-repeat;
  }

  .risky-label {
    font: var(--weight-semibold) var(--text-2xs) / 1.3 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--status-chit, #ff9f45);
  }

  .perm-toggle {
    flex: none;
    display: flex;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    min-width: 0;
  }

  .command-chip {
    padding: 5px var(--space-10);
    border-radius: var(--radius-sm);
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
    box-shadow: inset 0 0 0 1px var(--accent-dim, rgba(255, 86, 114, 0.35));
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-mono);
    color: var(--accent-bright, #ff8298);
  }

  .command-chip.blocked {
    background: none;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    color: var(--ink-4, #7c7c8c);
    text-decoration: line-through;
  }

  .blocked {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: var(--space-14) var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--status-chit-soft, rgba(255, 159, 69, 0.14));
    box-shadow: inset 0 0 0 1px var(--status-chit, #ff9f45);
  }

  .blocked-head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .blocked-icon {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--status-chit, #ff9f45);
    mask: var(--icon-warning) center/contain no-repeat;
  }

  .blocked-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .blocked-body {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
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

  .secondary {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .secondary:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
  }

  .grow {
    flex: 1;
  }

  .primary {
    --primary-ink: var(--on-accent, #2e0512);
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
    color: var(--primary-ink);
    cursor: pointer;
    user-select: none;
  }

  .primary.busy {
    opacity: 0.6;
    cursor: default;
  }

  .error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .primary.danger {
    --primary-ink: #fff;
    background: var(--status-danger, #ff5a5f);
  }

  .primary:hover {
    filter: brightness(1.08);
  }

  .primary-icon {
    width: 16px;
    height: 16px;
    background: var(--primary-ink);
  }
</style>
