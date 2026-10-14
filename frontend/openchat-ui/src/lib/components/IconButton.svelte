<!-- Square icon-only button. variant: surface (tinted) | ghost (bare until hover; `pressed` keeps the tint for open menus/panels)
     | accent | overlay (smaller, ringed, for use on covers). `state` forces a look for specimens.
     icon: any name from icons.css, or a legacy alias (userPlus). The accessible name falls back to a label derived from the icon. -->
<script lang="ts">
  // legacy aliases → canonical names in lib/icons.js
  const ALIASES: Record<string, string> = { userPlus: 'invite' };
  // glyphs that point along the reading direction; mirrored under dir="rtl" via [data-oc-flip]
  const DIRECTIONAL = new Set(['arrow', 'back', 'chevron-right', 'chevrons-right', 'exit', 'forward', 'reply', 'send']);
  const LABELS: Record<string, string> = { back: 'Back', close: 'Close', more: 'More options', kebab: 'More options', search: 'Search', plus: 'Add', userPlus: 'Add members', copy: 'Copy', share: 'Share', edit: 'Edit', settings: 'Settings', bell: 'Notifications', send: 'Send', menu: 'Menu' };

  interface Props {
    icon: string;
    variant?: 'surface' | 'ghost' | 'accent' | 'overlay';
    state?: 'default' | 'hover' | 'focus' | 'active';
    pressed?: boolean;
    label?: string;
    onClick?: () => void;
  }

  let { icon, variant = 'surface', state: look = 'default', pressed = false, label = '', onClick }: Props = $props();

  const name = $derived(label || LABELS[icon] || icon.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()));
</script>

<div class="box" class:accent={variant === 'accent'}>
  <div class="button {variant} {look}" class:pressed onclick={onClick} role="button" tabindex="0" aria-label={name} title={name}>
    <span class="icon" style:mask="var(--icon-{ALIASES[icon] ?? icon}) center/contain no-repeat" data-oc-flip={DIRECTIONAL.has(icon) ? '' : undefined}></span>
  </div>
</div>

<style>
  .box {
    flex: none;
    width: 34px;
    height: 34px;
    display: inline-flex;
  }

  .box.accent {
    width: 36px;
    height: 36px;
  }

  .button {
    --ring: none;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    cursor: pointer;
    box-shadow: var(--ring);
  }

  .focus {
    --ring: 0 0 0 3px var(--accent-dim, rgba(255, 86, 114, 0.35));
  }

  .active {
    --ring: inset 0 2px 6px rgba(0, 0, 0, 0.32);
    transform: scale(0.94);
  }

  .icon {
    flex: none;
    width: 17px;
    height: 17px;
    background: var(--ink-2, #b9b9c6);
  }

  .surface {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .ghost {
    background: transparent;
  }

  .ghost.hover .icon,
  .ghost.pressed .icon {
    background: var(--ink, #ececf1);
  }

  .surface:hover,
  .surface.hover,
  .ghost:hover,
  .ghost.hover,
  .ghost.pressed {
    background: var(--btn-hover, rgba(255, 255, 255, 0.1));
  }

  .button.accent {
    width: 36px;
    height: 36px;
    background: var(--accent, #ff5672);
  }

  .button.accent .icon {
    background: var(--on-accent, #2e0512);
  }

  .button.accent:hover,
  .button.accent.hover {
    background: var(--accent-hover, #ff6d85);
  }

  .overlay {
    flex: initial;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: var(--card-2, #191921);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12)), var(--ring);
  }

  .overlay.default,
  .overlay.hover {
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .overlay:hover,
  .overlay.hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.1));
  }

  .overlay .icon {
    flex: initial;
    width: 16px;
    height: 16px;
    background: var(--ink-3, #8a8a99);
  }
</style>
