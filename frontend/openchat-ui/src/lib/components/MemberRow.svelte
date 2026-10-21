<!-- Person / bot / webhook row for member lists and pickers, or the "invite" call-to-action row.
     Right side, in priority: actionLabel button, activity (typing dots / "now" / "2m"), badge, an icon affordance, else a kebab.
     icon "toggle" is a round add/check picker and tints the whole row while selected. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { cssUrl } from '../cssUrl';

  const ICONS = {
    check: 'check',
    plus: 'plus',
    close: 'close',
    chevron: 'chevron-right',
    star: 'star',
    message: 'chat',
  };

  const GRADIENTS = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    rose: 'linear-gradient(140deg,#FF6B8B,#C13584)',
    plum: 'linear-gradient(140deg,#B06BFF,#6A2BFF)',
    slate: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
  };

  interface Props {
    /** The person's / bot's name (data). For variant "invite" it's the call to action: resource key (or literal text). */
    title: string;
    /** Members: a handle (mono). Bots: a description (prose, two lines). */
    subtitle?: string;
    variant?: 'member' | 'bot' | 'webhook' | 'invite';
    /** Role chip next to the name. Resource key (or literal text). */
    /** A role id (OWNER, ADMIN, MODERATOR, MEMBER, YOU, LAPSED, BLOCKED, BOT: shown translated) or a resource key / literal text. */
    tag?: string;
    /** Your own row: adds a YOU chip. */
    isYou?: boolean;
    color?: keyof typeof GRADIENTS;
    /** Photo URL over the gradient. */
    image?: string;
    online?: boolean;
    /** Ring around the online dot; match the surface behind. */
    ringColor?: string;
    /** "typing" (animated dots), "now", or a short "2m"-style time since active. */
    activity?: string;
    icon?: '' | 'toggle' | keyof typeof ICONS;
    selected?: boolean;
    disabled?: boolean;
    /** Dimmed avatar and name (e.g. pending). */
    muted?: boolean;
    /** Resource key (or literal text); counts render as they are. */
    badge?: string;
    /** Row hover colour, for raised surfaces where the default is too faint. */
    hoverBg?: string;
    /** Defaults to onClick. */
    onIcon?: () => void;
    /** Resource key (or literal text). */
    actionLabel?: string;
    onAction?: () => void;
    showMenu?: boolean;
    onMenu?: () => void;
    onClick?: () => void;
  }

  let {
    title,
    subtitle = '',
    variant = 'member',
    tag = '',
    isYou = false,
    color = 'violet',
    image = '',
    online = false,
    ringColor = 'var(--card)',
    activity = '',
    icon = '',
    selected = false,
    disabled = false,
    muted = false,
    badge = '',
    hoverBg = '',
    onIcon,
    actionLabel = '',
    onAction,
    showMenu = true,
    onMenu,
    onClick,
  }: Props = $props();
  // role tags are ids ('OWNER', 'YOU' …) that hosts compare against; only the displayed text is translated
  const TAGS: Record<string, string> = {
    OWNER: 'ui.memberRow.tags.owner',
    ADMIN: 'ui.memberRow.tags.admin',
    MODERATOR: 'ui.memberRow.tags.moderator',
    MEMBER: 'ui.memberRow.tags.member',
    YOU: 'ui.memberRow.you',
    LAPSED: 'ui.memberRow.tags.lapsed',
    BLOCKED: 'ui.memberRow.tags.blocked',
    BOT: 'ui.memberRow.tags.bot',
  };
  const t = useT();

  const invite = $derived(variant === 'invite');
  const toggle = $derived(icon === 'toggle');
</script>

<div
  class="member"
  class:disabled
  class:picked={toggle && selected}
  style:--row-hover={hoverBg && !disabled ? hoverBg : null}
  onclick={onClick}
  role="button"
  tabindex="0"
>
  {#if invite}
    <span class="invite-tile"><span class="invite-icon"></span></span>
  {:else}
    <span class="avatar" class:square={variant === 'bot' || variant === 'webhook'} class:muted style:background={GRADIENTS[color] ?? GRADIENTS.violet}>
      {#if image}
        <span class="photo" style:background="{cssUrl(image)} center/cover no-repeat"></span>
      {/if}
      {#if online}
        <span class="online" style:box-shadow="0 0 0 2px {ringColor}"></span>
      {/if}
      {#if variant === 'webhook'}
        <span class="hook" title={t('ui.memberRow.webhook')}><span class="hook-icon"></span></span>
      {/if}
    </span>
  {/if}
  <div class="body">
    <div class="name-line">
      <span class="name" class:invite class:muted>{invite ? t(title) : title}</span>
      {#if tag}
        <span class="chip">{t(TAGS[tag] ?? tag)}</span>
      {/if}
      {#if isYou}
        <span class="chip you">{t('ui.memberRow.you')}</span>
      {/if}
    </div>
    {#if subtitle}
      <span class="subtitle" class:prose={variant === 'bot'}>{subtitle}</span>
    {/if}
  </div>
  {#if actionLabel}
    <span class="action" onclick={onAction} role="button" tabindex="0">
      <span class="action-icon"></span>
      <span class="action-label">{t(actionLabel)}</span>
    </span>
  {/if}
  {#if activity === 'typing'}
    <span class="typing" title={t('ui.memberRow.typing')}><span class="dots">{#each [0, 1, 2] as d}<span class="typing-dot" style:animation-delay="{d * 0.15}s"></span>{/each}</span></span>
  {:else if activity}
    <span class="activity" class:now={activity === 'now'}>{activity === 'now' ? t('ui.memberRow.now') : activity}</span>
  {/if}
  {#if badge}
    <span class="badge">{t(badge)}</span>
  {/if}
  {#if toggle && !disabled}
    <span class="toggle" class:selected><span class="toggle-icon"></span></span>
  {/if}
  {#if icon && !toggle}
    <span class="icon-button" class:selected onclick={onIcon ?? onClick} role="button" tabindex="0">
      <span class="icon" style:mask="var(--icon-{ICONS[icon] ?? 'chevron-right'}) center/contain no-repeat"></span>
    </span>
  {/if}
  {#if showMenu && !invite && !actionLabel && !icon && !badge}
    <span class="kebab" onclick={onMenu} role="button" tabindex="0">
      <span class="kebab-icon"></span>
    </span>
  {/if}
</div>

<style>
  .member {
    --row-hover: var(--overlay-1);
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-8) var(--space-8);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
  }

  .member.picked {
    --row-hover: color-mix(in srgb, var(--accent) 12%, transparent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .member.disabled {
    --row-hover: transparent;
    opacity: 0.55;
    cursor: default;
  }

  .member:hover {
    background: var(--row-hover);
  }

  .invite-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent-dim);
  }

  .invite-icon,
  .action-icon {
    background: var(--accent);
    mask: var(--icon-invite) center/contain no-repeat;
  }

  .invite-icon {
    width: 18px;
    height: 18px;
  }

  .avatar {
    position: relative;
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-pill);
  }

  .avatar.square {
    border-radius: var(--radius-md);
  }

  .avatar.muted {
    opacity: 0.7;
  }

  .photo {
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  .online {
    position: absolute;
    inset-inline-end: -1px;
    inset-block-end: -1px;
    width: 11px;
    height: 11px;
    border-radius: var(--radius-pill);
    background: var(--status-online);
  }

  .hook {
    position: absolute;
    inset-inline-end: -5px;
    inset-block-end: -5px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-pill);
    background: var(--card);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .hook-icon {
    width: 11px;
    height: 11px;
    background: var(--accent);
    mask: var(--icon-hook) center/contain no-repeat;
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }

  .name {
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name.muted {
    color: var(--ink-2);
  }

  .name.invite {
    color: var(--accent);
  }

  .chip {
    flex: none;
    padding: 2px var(--space-6);
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-2xs) / 1.3 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3);
  }

  .chip.you {
    background: var(--accent-soft);
    color: var(--accent-bright);
  }

  /* members show a handle in mono; bots describe themselves in prose */
  .subtitle {
    font: var(--weight-regular) var(--text-xs) / 1.4 var(--font-mono);
    color: var(--ink-4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .subtitle.prose {
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
  }

  .action {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-6) var(--space-8);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .action:hover {
    background: var(--accent-soft);
  }

  .action-icon {
    width: 15px;
    height: 15px;
  }

  .action-label {
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--accent);
    white-space: nowrap;
  }

  .typing {
    flex: none;
    display: flex;
    align-items: center;
    padding: 0 var(--space-2);
  }

  .dots {
    display: flex;
    gap: 3px;
  }

  .typing-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent-bright);
    animation: ocTypingDot 1.2s infinite ease-in-out;
  }

  .activity {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .activity.now {
    font-weight: var(--weight-semibold);
    color: var(--status-online);
  }

  .badge {
    flex: none;
    padding: 2px var(--space-8);
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-2xs) / 1.4 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
  }

  .toggle {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .toggle.selected {
    background: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .toggle-icon {
    width: 14px;
    height: 14px;
    background: var(--ink-2);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .toggle.selected .toggle-icon {
    background: var(--on-accent);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .icon-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
  }

  .icon-button.selected {
    background: var(--accent);
  }

  .icon-button:hover {
    background: var(--overlay-2);
  }

  .icon {
    width: 16px;
    height: 16px;
    background: var(--ink-3);
  }

  .icon-button.selected .icon {
    background: var(--on-accent);
  }

  .kebab {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-sm);
  }

  .kebab:hover {
    background: var(--overlay-2);
  }

  .kebab-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
    mask: var(--icon-kebab) center/contain no-repeat;
  }
</style>
