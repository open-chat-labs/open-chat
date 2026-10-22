<!-- Text button. variant: primary | secondary | ghost | danger; disabled overrides the variant.
     `state` forces a look (hover / focus / active) for specimens; leave it at default in real use. -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    state?: 'default' | 'hover' | 'focus' | 'active';
    fullWidth?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }

  let { label, variant = 'primary', state = 'default', fullWidth = false, disabled = false, onClick }: Props = $props();
  const t = useT();
</script>

<div class="wrap" class:full={fullWidth}>
  {#if disabled}
    <div class="button disabled">{t(label)}</div>
  {:else}
    <div class="button {variant} {state}" onclick={onClick} role="button" tabindex="0">{t(label)}</div>
  {/if}
</div>

<style>
  .wrap {
    display: inline-flex;
    width: auto;
  }

  .button {
    --ring: none;
    display: inline-flex;
    width: auto;
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
