<!-- Bot details → permissions → install (or edit / remove an installed bot). Every permission starts granted;
     revoking one greys out the commands that need it. readOnly (installed bots, no bot rights) shows details only. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import { modal } from '../../lib/behaviours/modal';

  type PermKey = 'read' | 'summary' | 'members' | 'pinned' | 'threads' | 'react' | 'send' | 'images' | 'remove' | 'pin' | 'everyone';
  type Color = 'violet' | 'amber' | 'teal' | 'blue' | 'rose' | 'plum' | 'slate';

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
    read: { label: 'Read messages', scope: 'chat' },
    summary: { label: 'Read chat summary', scope: 'chat' },
    members: { label: 'Read members', scope: 'chat' },
    pinned: { label: 'Read pinned messages', scope: 'chat' },
    threads: { label: 'Read thread replies', scope: 'chat' },
    react: { label: 'React to messages', scope: 'chat' },
    send: { label: 'Send text messages', scope: 'message' },
    images: { label: 'Send images and files', scope: 'message' },
    remove: { label: 'Delete messages', scope: 'message', risky: true },
    pin: { label: 'Pin messages', scope: 'message', risky: true },
    everyone: { label: 'Mention all members', scope: 'message', risky: true },
  };

  // plain-language phrases for the summary sentence, in the order they are listed
  const CAN_DO: Partial<Record<PermKey, { text: string; risky?: boolean }>> = {
    read: { text: 'reads messages' },
    summary: { text: 'reads chat summaries' },
    threads: { text: 'reads thread replies' },
    pinned: { text: 'reads pinned messages' },
    members: { text: "sees who's here" },
    send: { text: 'posts messages' },
    images: { text: 'posts images and files' },
    remove: { text: 'delete messages', risky: true },
    pin: { text: 'pin messages', risky: true },
    everyone: { text: 'mention everyone', risky: true },
  };
  const CAN_DO_ORDER: PermKey[] = ['read', 'summary', 'threads', 'pinned', 'members', 'send', 'images', 'remove', 'pin', 'everyone'];

  interface Spec {
    creator: string;
    color: Color;
    description: string;
    perms: PermKey[];
    commands: { name: string; about: string; needs: PermKey[] }[];
  }

  // each bot declares the permissions it asks for and which ones every command needs
  const CATALOG: Record<string, Spec> = {
    ReminderBot: {
      creator: '@jane_smith',
      color: 'slate',
      description: 'Sends one-off and recurring reminder messages into this chat.',
      perms: ['read', 'send'],
      commands: [
        { name: '/remind_at', about: 'One-off reminder at a date and time', needs: ['send'] },
        { name: '/remind_recurring', about: 'Repeating reminder on a schedule', needs: ['send'] },
        { name: '/list_reminders', about: 'Show every reminder set in this chat', needs: ['read', 'send'] },
        { name: '/delete_reminder', about: 'Cancel a reminder you set', needs: ['read'] },
      ],
    },
    LlamaBot: {
      creator: '@openchat_labs',
      color: 'slate',
      description: 'Sends prompts to the Llama 3 LLM and posts the reply in the thread.',
      perms: ['read', 'summary', 'send'],
      commands: [
        { name: '/ask', about: 'Answer a question in the thread', needs: ['send'] },
        { name: '/summarise', about: 'Summarise the recent conversation', needs: ['summary', 'send'] },
      ],
    },
    WelcomeBot: {
      creator: '@jane_smith',
      color: 'plum',
      description: 'Greets new members with a custom message when they join.',
      perms: ['read', 'send'],
      commands: [
        { name: '/set_welcome', about: 'Set the message new members see', needs: ['send'] },
        { name: '/preview_welcome', about: 'Show the current welcome message', needs: ['read'] },
      ],
    },
    YoutubeBot: {
      creator: '@tubetools',
      color: 'rose',
      description: 'Subscribe to a YouTube channel to get updates about new video releases.',
      perms: ['send'],
      commands: [
        { name: '/subscribe', about: 'Follow a channel and post its new videos', needs: ['send'] },
        { name: '/unsubscribe', about: 'Stop following a channel', needs: ['send'] },
      ],
    },
    DiscordBot: {
      creator: '@bridgeworks',
      color: 'blue',
      description: 'Proxy messages from your Discord community into OpenChat.',
      perms: ['read', 'send'],
      commands: [
        { name: '/link_channel', about: 'Bridge a Discord channel to this chat', needs: ['send'] },
        { name: '/unlink_channel', about: 'Remove a bridged channel', needs: ['read'] },
      ],
    },
    AdventureBot: {
      creator: '@mira_dev',
      color: 'amber',
      description: 'Play a selection of classic text-based adventures in chat.',
      perms: ['read', 'send', 'images', 'react'],
      commands: [
        { name: '/play', about: 'Start an adventure in this chat', needs: ['send'] },
        { name: '/inventory', about: 'Show what your party is carrying', needs: ['read', 'send'] },
        { name: '/quit', about: 'End the current game', needs: ['read'] },
      ],
    },
    ModerationBot: {
      creator: '@openchat_labs',
      color: 'teal',
      description: 'Performs automated moderation using rules you configure.',
      perms: ['read', 'summary', 'members', 'pinned', 'threads', 'send', 'remove', 'pin', 'everyone'],
      commands: [
        { name: '/watchlist', about: 'Manage the words and links it acts on', needs: ['read'] },
        { name: '/purge', about: 'Remove the last N messages from a member', needs: ['remove'] },
        { name: '/pin_rules', about: 'Pin the group rules to the top', needs: ['pin'] },
      ],
    },
  };

  const FALLBACK: Spec = {
    creator: '@openchat_labs',
    color: 'slate',
    description: 'This bot has not published a description yet.',
    perms: ['read', 'send'],
    commands: [{ name: '/help', about: 'List what this bot can do', needs: ['send'] }],
  };

  // "a", "a and b", "a, b and c"
  const list = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : (a[0] ?? ''));

  export interface InstalledBot {
    name: string;
    color: Color;
    description: string;
    granted: Partial<Record<PermKey, boolean>>;
  }

  interface Props {
    /** name (or title) picks the catalogue entry; description / color override it. */
    bot: { name?: string; title?: string; description?: string; color?: Color };
    groupName?: string;
    installed?: boolean;
    /** Installed bot shown to someone without bot rights: details only. */
    readOnly?: boolean;
    initialStep?: 'details' | 'configure' | 'remove';
    onRemove?: (b: { name: string }) => void;
    onInstall?: (bot: InstalledBot) => void;
    onCancel?: () => void;
  }

  let { bot, groupName = 'this group', installed = false, readOnly = false, initialStep = 'details', onRemove, onInstall, onCancel }: Props = $props();

  let stepOverride = $state<'details' | 'configure' | 'remove' | null>(null);
  let grantedOverride = $state<Partial<Record<PermKey, boolean>> | null>(null);
  let closing = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  const name = $derived(bot.name ?? bot.title ?? '');
  const spec = $derived(CATALOG[name] ?? FALLBACK);
  const color = $derived(bot.color ?? spec.color);
  const description = $derived(bot.description ?? spec.description);
  const viewOnly = $derived(readOnly && installed);
  const step = $derived(stepOverride ?? initialStep);
  const isConfigure = $derived(step === 'configure');
  const isRemove = $derived(step === 'remove');

  const granted = $derived(grantedOverride ?? Object.fromEntries(spec.perms.map((k) => [k, true])));
  const asked = $derived(spec.perms.map((k) => ({ key: k, ...PERMS[k] })));
  const riskyNames = $derived(list(asked.filter((p) => p.risky).map((p) => p.label.toLowerCase())));
  const groups = $derived(
    [
      { label: 'IN THIS CHAT', icon: 'chat', items: asked.filter((p) => p.scope === 'chat') },
      { label: 'FOR MESSAGES', icon: 'message', items: asked.filter((p) => p.scope === 'message') },
    ].filter((g) => g.items.length > 0),
  );

  // view-only: commands the bot can't run here are simply left out
  const commands = $derived(
    (viewOnly ? spec.commands.filter((c) => !c.needs.some((k) => granted[k] === false)) : spec.commands).map((c) => ({
      ...c,
      blocked: isConfigure && c.needs.some((k) => granted[k] === false),
    })),
  );
  const blocked = $derived(commands.filter((c) => c.blocked));

  // one plain-language sentence for everyone; the parts that act on people's messages are highlighted
  const summary = $derived.by(() => {
    const on = CAN_DO_ORDER.filter((k) => spec.perms.includes(k) && granted[k] !== false);
    const plain = list(on.filter((k) => !CAN_DO[k]!.risky).map((k) => CAN_DO[k]!.text));
    const risky = list(on.filter((k) => CAN_DO[k]!.risky).map((k) => CAN_DO[k]!.text));
    const verbs: Record<string, string> = { reads: 'read', sees: 'see', posts: 'post' };
    const lead = plain
      ? (installed ? plain.charAt(0).toUpperCase() + plain.slice(1) : `Asks to ${plain.replace(/(^|, | and )(reads|sees|posts)/g, (_, p, v) => p + verbs[v])}`) +
        ` in ${groupName}` +
        (risky ? (installed ? ', and can also ' : ', and to ') : '')
      : installed
        ? 'Can '
        : 'Asks to ';
    return { lead, risky };
  });

  const headerTitle = $derived(isRemove ? 'Remove bot' : isConfigure ? (installed ? 'Bot permissions' : 'Install a bot') : 'Bot details');
  const headerSub = $derived(isConfigure && !installed ? `Step 2 of 2 · ${name} in ${groupName}` : `${name} · ${groupName}`);
  const primaryLabel = $derived(
    isRemove ? 'Remove bot' : isConfigure ? (installed ? 'Save permissions' : 'Install into group') : installed ? 'Edit permissions' : 'Choose permissions',
  );
  const primaryIcon = $derived(isRemove ? 'trash' : isConfigure ? (installed ? 'check' : 'receive') : 'arrow');
  const detailsFootnote = $derived(
    installed
      ? viewOnly
        ? `${name} is installed in ${groupName}. Only admins can change its permissions or remove it.`
        : `${name} is installed in ${groupName}. Editing permissions changes what it can do here.`
      : `Installing adds ${name} to ${groupName}. You choose which permissions to grant on the next step.`,
  );

  // the card animates out before the parent hears about it
  function close(then?: () => void) {
    if (closing) return;
    closing = true;
    timer = setTimeout(() => {
      closing = false;
      then?.();
    }, 170);
  }

  function primary() {
    if (isRemove) close(() => onRemove?.({ name }));
    else if (isConfigure)
      close(() => {
        if (onInstall) onInstall({ name, color, description, granted });
        else onCancel?.();
      });
    else stepOverride = 'configure';
  }

  function secondary() {
    if (isConfigure || isRemove) stepOverride = 'details';
    else close(onCancel);
  }
</script>

<div class="layer" role="dialog" aria-modal="true" use:modal={() => close(onCancel)}>
  <div class="veil" class:closing onclick={() => close(onCancel)} aria-hidden="true"></div>
  <div class="card" class:closing>
    <div class="header">
      <span class="header-tile"><span class="header-icon"></span></span>
      <div class="header-text">
        <span class="header-title">{headerTitle}</span>
        <span class="header-sub">{headerSub}</span>
      </div>
      <span class="close" onclick={() => close(onCancel)} role="button" tabindex="0"><span class="close-icon"></span></span>
    </div>

    <div class="body">
      {#if !isConfigure && !isRemove}
        <div class="identity">
          <span class="bot-face" style:background={GRADIENTS[color] ?? GRADIENTS.slate}></span>
          <div class="identity-text">
            <span class="bot-name">{name}</span>
            <span class="byline"
              ><span>created by <span class="creator">{spec.creator}</span></span>{#if installed}<span class="dot">·</span><span class="installed"><span class="installed-icon"></span>Installed</span>{/if}</span
            >
          </div>
          {#if installed && !!onRemove && !viewOnly}
            <div class="identity-actions">
              <span
                class="remove"
                onclick={() => (stepOverride = 'remove')}
                aria-label="Remove {name} from {groupName}"
                role="button"
                tabindex="0"
                title="Remove {name} from {groupName}">Remove</span
              >
            </div>
          {/if}
        </div>

        <span class="description">{description}</span>

        <div class="section">
          <span class="section-label">COMMANDS · {commands.length}</span>
          <div class="panel">
            {#each commands as c}
              <div class="command">
                <span class="command-name">{c.name}</span>
                <span class="command-about">{c.about}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="plain">
          <span class="lock"></span>
          <span class="plain-text">{summary.lead}<span class="risky-text">{summary.risky}</span>.</span>
        </div>

        <span class="footnote">{detailsFootnote}</span>
      {/if}

      {#if isRemove}
        <div class="remove-head">
          <div class="remove-face">
            <span class="remove-face-fill" style:background={GRADIENTS[color] ?? GRADIENTS.slate}></span>
            <span class="remove-badge"><span class="remove-badge-icon"></span></span>
          </div>
          <span class="remove-title">Remove {name} from {groupName}?</span>
        </div>
        <div class="panel">
          <div class="fact"><span class="fact-icon danger" style:mask="var(--icon-warning) center/contain no-repeat"></span><span class="fact-text">Its commands stop working for everyone in {groupName}.</span></div>
          <div class="fact"><span class="fact-icon" style:mask="var(--icon-lock) center/contain no-repeat"></span><span class="fact-text">The permissions you granted are revoked.</span></div>
          <div class="fact"><span class="fact-icon" style:mask="var(--icon-rotate-back) center/contain no-repeat"></span><span class="fact-text">You can reinstall it later from Bots.</span></div>
        </div>
      {/if}

      {#if isConfigure}
        {#if !installed}
          <div class="target">
            <span class="target-face" style:background={GRADIENTS[color] ?? GRADIENTS.slate}></span>
            <span class="target-bot">{name}</span>
            <span class="target-arrow"></span>
            <span class="target-group">{groupName}</span>
          </div>
        {/if}

        <div class="intro-row">
          <span class="intro">Grant only what this bot needs. Commands that rely on a permission you revoke stop working.</span>
        </div>

        {#each groups as g}
          <div class="section">
            <div class="group-head">
              <span class="group-icon" style:mask="var(--icon-{g.icon}) center/contain no-repeat"></span>
              <span class="group-label">{g.label}</span>
            </div>
            <div class="panel">
              {#each g.items as p}
                <div class="perm">
                  <span class="perm-label" class:off={!granted[p.key]}>
                    <span>{p.label}</span>
                    {#if p.risky}
                      <span class="risky" title="Consequential — it can change other people's messages">
                        <span class="risky-icon"></span>
                        <span class="risky-label">CONSEQUENTIAL</span>
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
          <span class="section-label">COMMANDS · {commands.length}</span>
          <div class="chips">
            {#each commands as c}
              <span class="command-chip" class:blocked={c.blocked} title={c.about}>{c.name}</span>
            {/each}
          </div>
        </div>

        {#if blocked.length > 0}
          <div class="blocked">
            <div class="blocked-head">
              <span class="blocked-icon"></span>
              <span class="blocked-title">{blocked.length === 1 ? '1 command will stop working' : `${blocked.length} commands will stop working`}</span>
            </div>
            <span class="blocked-body">{blocked.map((c) => c.name).join(', ')} need{blocked.length === 1 ? 's' : ''} a permission you revoked. You can grant it again at any time.</span>
          </div>
        {/if}

        <span class="footnote">By {installed ? 'saving' : 'installing'}, {name} can act in {groupName} with the permissions above.</span>
      {/if}
    </div>

    <div class="footer">
      <span class="secondary" onclick={secondary} role="button" tabindex="0">{isConfigure || isRemove ? 'Back' : viewOnly ? 'Close' : 'Cancel'}</span>
      <span class="grow"></span>
      {#if !viewOnly}
        <div class="primary" class:danger={isRemove} onclick={primary} role="button" tabindex="0">
          <span>{primaryLabel}</span>
          <span class="primary-icon" style:mask="var(--icon-{primaryIcon}) center/contain no-repeat"></span>
        </div>
      {/if}
    </div>
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
