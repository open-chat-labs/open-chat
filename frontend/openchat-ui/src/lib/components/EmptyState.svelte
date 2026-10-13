<!-- Centred empty / offline / error message with an icon tile and an optional action.
     A preset fills icon, title, body, action and tone; any of them can be overridden. -->
<script lang="ts">
  // public icon keys → canonical names in lib/icons.js
  const ICONS = {
    search: 'search',
    emoji: 'emoji',
    users: 'users',
    offline: 'offline',
    alert: 'warning',
    send: 'wallet-send',
    receive: 'receive',
    swap: 'swap',
  };

  type IconKey = keyof typeof ICONS;
  type Tone = 'neutral' | 'warning' | 'danger';

  const PRESETS: Record<string, { icon: IconKey; title: string; body: string; actionLabel: string; tone?: Tone }> = {
    'no-conversations': { icon: 'emoji', title: 'No conversations yet', body: 'Start a direct message or join a community to see it here.', actionLabel: 'New message' },
    'no-results': { icon: 'search', title: 'No matches', body: 'Nothing matched that search. Try a different name or keyword.', actionLabel: '' },
    'no-members': { icon: 'users', title: 'Just you in here', body: 'Invite people to the group and their messages will appear in this thread.', actionLabel: 'Invite people' },
    offline: { icon: 'offline', title: "You're offline", body: 'Messages you send will queue and deliver once the connection is back.', actionLabel: 'Retry now', tone: 'warning' },
    error: { icon: 'alert', title: "Couldn't load messages", body: 'Something went wrong on our side. Your drafts are safe.', actionLabel: 'Try again', tone: 'danger' },
  };

  interface Props {
    preset?: 'no-conversations' | 'no-results' | 'no-members' | 'offline' | 'error';
    /** Empty uses the preset's. */
    title?: string;
    /** Empty uses the preset's. */
    body?: string;
    /** Empty string hides the preset's action. */
    actionLabel?: string;
    icon?: IconKey;
    tone?: Tone;
    actionHandler?: () => void;
  }

  let { preset = 'no-conversations', title, body, actionLabel, icon, tone, actionHandler }: Props = $props();

  const p = $derived(PRESETS[preset] ?? PRESETS['no-conversations']);
  const label = $derived(actionLabel ?? p.actionLabel);
</script>

<div class="empty">
  <span class="tile {tone ?? p.tone ?? 'neutral'}">
    <span class="icon" style:mask="var(--icon-{ICONS[icon ?? p.icon] ?? ICONS.emoji}) center/contain no-repeat"></span>
  </span>
  <div class="copy">
    <span class="title">{title || p.title}</span>
    <span class="body">{body || p.body}</span>
  </div>
  {#if label}
    <div class="action" onclick={actionHandler} role="button" tabindex="0">{label}</div>
  {/if}
</div>

<style>
  .empty {
    width: 100%;
    height: 100%;
    min-height: 220px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-14);
    padding: var(--space-32) var(--space-26);
    text-align: center;
  }

  .tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: var(--radius-xl);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .icon {
    width: 24px;
    height: 24px;
    background: var(--ink-3, #8a8a99);
  }

  .warning {
    background: var(--status-chit-soft, rgba(255, 159, 69, 0.14));
  }

  .warning .icon {
    background: var(--status-chit, #ff9f45);
  }

  .danger {
    background: var(--btn-danger-bg, rgba(240, 68, 56, 0.08));
  }

  .danger .icon {
    background: var(--status-danger, #f5493d);
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 340px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .body {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3, #8a8a99);
    text-wrap: pretty;
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: var(--control-md);
    padding: 0 var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .action:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.1));
  }
</style>
