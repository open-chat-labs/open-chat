<!-- Text button. variant: primary | secondary | ghost | danger; disabled overrides the variant.
     `state` forces a look (hover / focus / active) for specimens; leave it at default in real use.
     size: md (40px) | lg (52px). An optional icon shows before the label; with an empty label the button is icon-only.
     Labels never wrap: a long one truncates with an ellipsis, the full text in the title. -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    /** Resource key (or literal text). Empty with an `icon` for an icon-only button. */
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    state?: 'default' | 'hover' | 'focus' | 'active';
    size?: 'md' | 'lg';
    /** Icon name (see icons.js), shown before the label. */
    icon?: string;
    /** Resource key (or literal text): the accessible name, for an icon-only button. */
    ariaLabel?: string;
    fullWidth?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }

  let { label, variant = 'primary', state = 'default', size = 'md', icon, ariaLabel, fullWidth = false, disabled = false, onClick }: Props = $props();
  const t = useT();

  const text = $derived(label ? t(label) : '');
  const iconOnly = $derived(!!icon && !text);
</script>

{#snippet content()}
  {#if icon}<span class="icon" style:mask="var(--icon-{icon}) center/contain no-repeat" aria-hidden="true"></span>{/if}
  {#if text}<span class="label">{text}</span>{/if}
{/snippet}

<div class="wrap" class:full={fullWidth}>
  {#if disabled}
    <div class="button disabled" class:lg={size === 'lg'} class:icon-only={iconOnly} title={text || undefined} aria-label={ariaLabel ? t(ariaLabel) : undefined}>
      {@render content()}
    </div>
  {:else}
    <div
      class="button {variant} {state}"
      class:lg={size === 'lg'}
      class:icon-only={iconOnly}
      onclick={onClick}
      role="button"
      tabindex="0"
      title={text || undefined}
      aria-label={ariaLabel ? t(ariaLabel) : undefined}
    >
      {@render content()}
    </div>
  {/if}
</div>

<style>
  .wrap {
    display: inline-flex;
    width: auto;
    min-width: 0;
    max-width: 100%;
  }

  .button {
    --ring: none;
    display: inline-flex;
    width: auto;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: 40px;
    padding: 0 var(--space-18);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;
    box-shadow: var(--ring);
    --icon-size: 16px;
  }

  .button.lg {
    height: 52px;
    border-radius: 14px;
    --icon-size: 18px;
  }

  .button.icon-only {
    gap: 0;
    padding: 0;
    aspect-ratio: 1;
  }

  .icon {
    flex: none;
    width: var(--icon-size);
    height: var(--icon-size);
    background: currentColor;
  }

  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .full,
  .full .button {
    width: 100%;
  }

  .focus {
    --ring: 0 0 0 3px var(--accent-dim);
  }

  .active {
    --ring: inset 0 2px 6px rgba(0, 0, 0, 0.32);
    transform: scale(0.97);
  }

  .primary {
    color: var(--on-accent);
    background: var(--accent);
  }

  .primary:hover,
  .primary.hover {
    background: var(--accent-hover);
  }

  .secondary {
    color: var(--ink);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2), var(--ring);
  }

  .secondary.default,
  .secondary.hover {
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .secondary:hover,
  .secondary.hover {
    background: var(--btn-hover);
  }

  .ghost {
    padding: 0 var(--space-14);
    color: var(--ink-2);
    background: transparent;
  }

  .ghost.icon-only {
    padding: 0;
  }

  .ghost:hover,
  .ghost.hover,
  .ghost.active {
    background: var(--overlay-1);
  }

  .danger {
    color: var(--status-danger);
    background: var(--btn-danger-bg);
    box-shadow: inset 0 0 0 1px var(--btn-danger-line), var(--ring);
  }

  .danger.default,
  .danger.hover {
    box-shadow: inset 0 0 0 1px var(--btn-danger-line);
  }

  .danger:hover,
  .danger.hover {
    background: var(--btn-danger-bg-hover);
  }

  .disabled {
    background: var(--overlay-1);
    color: var(--ink-4);
    cursor: not-allowed;
  }
</style>
