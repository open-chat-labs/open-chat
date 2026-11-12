<!-- Text button. variant: primary | secondary | ghost | danger; disabled overrides the variant.
     `state` forces a look (hover / focus / active) for specimens; leave it at default in real use.
     size: md (40px) | lg (52px). An optional icon shows before the label; with an empty label the button is icon-only.
     Labels never wrap: a long one truncates with an ellipsis, and then (only then) the full text is its tooltip.
     An icon-only button needs `ariaLabel`, its accessible name and tooltip.
     busy: a call it started is under way: a spinner (in the label's colour) takes the icon's place, the variant's look stays,
     and it can't be pressed (aria-busy). -->
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
    /** A call it started is under way: a spinner in place of the icon, not pressable. */
    busy?: boolean;
    onClick?: () => void;
  }

  let { label, variant = 'primary', state: look = 'default', size = 'md', icon, ariaLabel, fullWidth = false, disabled = false, busy = false, onClick }: Props = $props();
  const t = useT();

  const text = $derived(label ? t(label) : '');
  const iconOnly = $derived(!!icon && !text);
  const name = $derived(ariaLabel ? t(ariaLabel) : undefined);

  // the full label as a tooltip only when it's cut off (checked as the pointer comes in)
  let labelEl = $state<HTMLSpanElement>();
  let truncated = $state(false);
  const measure = () => (truncated = !!labelEl && labelEl.scrollWidth > labelEl.clientWidth);
  const title = $derived(iconOnly ? name : truncated ? text : undefined);
</script>

{#snippet content()}
  {#if busy}
    <svg class="spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="17.6 62.8" />
    </svg>
  {:else if icon}<span class="icon" style:mask="var(--icon-{icon}) center/contain no-repeat" aria-hidden="true"></span>{/if}
  {#if text}<span class="label" bind:this={labelEl}>{text}</span>{/if}
{/snippet}

<div class="wrap" class:full={fullWidth}>
  {#if busy && !disabled}
    <div
      class="button {variant} busy"
      class:lg={size === 'lg'}
      class:icon-only={iconOnly}
      role="button"
      aria-disabled="true"
      aria-busy="true"
      {title}
      aria-label={name}
    >
      {@render content()}
    </div>
  {:else if disabled}
    <div
      class="button disabled"
      class:lg={size === 'lg'}
      class:icon-only={iconOnly}
      role="button"
      aria-disabled="true"
      {title}
      aria-label={name}
      onpointerenter={measure}
    >
      {@render content()}
    </div>
  {:else}
    <div
      class="button {variant} {look}"
      class:lg={size === 'lg'}
      class:icon-only={iconOnly}
      onclick={onClick}
      role="button"
      tabindex="0"
      {title}
      aria-label={name}
      onpointerenter={measure}
      onfocus={measure}
    >
      {@render content()}
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

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

    &.lg {
      height: 52px;
      border-radius: 14px;
      --icon-size: 18px;
    }

    &.icon-only {
      gap: 0;
      padding: 0;
      aspect-ratio: 1;
    }
  }

  .icon {
    flex: none;
    width: var(--icon-size);
    height: var(--icon-size);
    background: currentColor;
  }

  .spin {
    flex: none;
    width: var(--icon-size);
    height: var(--icon-size);
    animation: oc-spin 0.9s linear infinite;
  }

  .busy {
    cursor: progress;
  }

  .label {
    min-width: 0;
    @include truncate;
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

    &:hover,
    &.hover {
      background: var(--accent-hover);
    }
  }

  .secondary {
    color: var(--ink);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2), var(--ring);

    &.default,
    &.hover {
      box-shadow: inset 0 0 0 1px var(--line-2);
    }

    &:hover,
    &.hover {
      background: var(--btn-hover);
    }
  }

  .ghost {
    padding: 0 var(--space-14);
    color: var(--ink-2);
    background: transparent;

    &:hover,
    &.hover,
    &.active {
      background: var(--overlay-1);
    }
  }

  .danger {
    color: var(--status-danger);
    background: var(--btn-danger-bg);
    box-shadow: inset 0 0 0 1px var(--btn-danger-line), var(--ring);

    &.default,
    &.hover {
      box-shadow: inset 0 0 0 1px var(--btn-danger-line);
    }

    &:hover,
    &.hover {
      background: var(--btn-danger-bg-hover);
    }
  }

  .disabled {
    background: var(--overlay-1);
    color: var(--ink-4);
    cursor: not-allowed;
  }
</style>
