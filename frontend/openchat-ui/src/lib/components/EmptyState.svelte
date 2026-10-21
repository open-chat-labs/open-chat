<!-- Centred empty / offline / error message with an icon tile and an optional action.
     A preset fills icon, title, body, action and tone; any of them can be overridden. -->
<script lang="ts">
  import { useT } from '../i18n';
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
    'no-conversations': { icon: 'emoji', title: 'ui.emptyState.noConversationsTitle', body: 'ui.emptyState.noConversationsBody', actionLabel: 'ui.emptyState.newMessage' },
    'no-results': { icon: 'search', title: 'ui.emptyState.noResultsTitle', body: 'ui.emptyState.noResultsBody', actionLabel: '' },
    'no-members': { icon: 'users', title: 'ui.emptyState.noMembersTitle', body: 'ui.emptyState.noMembersBody', actionLabel: 'ui.emptyState.invitePeople' },
    offline: { icon: 'offline', title: 'ui.emptyState.offlineTitle', body: 'ui.emptyState.offlineBody', actionLabel: 'ui.emptyState.retryNow', tone: 'warning' },
    error: { icon: 'alert', title: 'ui.emptyState.errorTitle', body: 'ui.emptyState.errorBody', actionLabel: 'ui.emptyState.tryAgain', tone: 'danger' },
  };

  interface Props {
    preset?: 'no-conversations' | 'no-results' | 'no-members' | 'offline' | 'error';
    /** Resource key (or literal text). Empty uses the preset's. */
    title?: string;
    /** Resource key (or literal text). Empty uses the preset's. */
    body?: string;
    /** Resource key (or literal text). Empty string hides the preset's action. */
    actionLabel?: string;
    icon?: IconKey;
    tone?: Tone;
    actionHandler?: () => void;
  }

  let { preset = 'no-conversations', title, body, actionLabel, icon, tone, actionHandler }: Props = $props();
  const t = useT();

  const p = $derived(PRESETS[preset] ?? PRESETS['no-conversations']);
  const label = $derived(actionLabel ?? p.actionLabel);
</script>

<div class="empty">
  <span class="tile {tone ?? p.tone ?? 'neutral'}">
    <span class="icon" style:mask="var(--icon-{ICONS[icon ?? p.icon] ?? ICONS.emoji}) center/contain no-repeat"></span>
  </span>
  <div class="copy">
    <span class="title">{t(title || p.title)}</span>
    <span class="body">{t(body || p.body)}</span>
  </div>
  {#if label}
    <div class="action" onclick={actionHandler} role="button" tabindex="0">{t(label)}</div>
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
    background: var(--overlay-2);
  }

  .icon {
    width: 24px;
    height: 24px;
    background: var(--ink-3);
  }

  .warning {
    background: var(--status-chit-soft);
  }

  .warning .icon {
    background: var(--status-chit);
  }

  .danger {
    background: var(--btn-danger-bg);
  }

  .danger .icon {
    background: var(--status-danger);
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 340px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.3 var(--font-sans);
    color: var(--ink);
    text-wrap: pretty;
  }

  .body {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
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
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }

  .action:hover {
    background: var(--btn-hover);
  }
</style>
