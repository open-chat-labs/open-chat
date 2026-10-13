<!-- Text button. variant: primary | secondary | ghost | danger; disabled overrides the variant.
     `state` forces a look (hover / focus / active) for specimens; leave it at default in real use. -->
<script lang="ts">
  interface Props {
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    state?: 'default' | 'hover' | 'focus' | 'active';
    fullWidth?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }

  let { label, variant = 'primary', state = 'default', fullWidth = false, disabled = false, onClick }: Props = $props();
</script>

<div class="wrap" class:full={fullWidth}>
  {#if disabled}
    <div class="button disabled">{label}</div>
  {:else}
    <div class="button {variant} {state}" onclick={onClick} role="button" tabindex="0">{label}</div>
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
    --ring: 0 0 0 3px var(--accent-dim, rgba(255, 86, 114, 0.35));
  }

  .active {
    --ring: inset 0 2px 6px rgba(0, 0, 0, 0.32);
    transform: scale(0.97);
  }

  .primary {
    color: var(--on-accent, #2e0512);
    background: var(--accent, #ff5672);
  }

  .primary:hover,
  .primary.hover {
    background: var(--accent-hover, #ff6d85);
  }

  .secondary {
    color: var(--ink, #ececf1);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)), var(--ring);
  }

  .secondary.default,
  .secondary.hover {
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .secondary:hover,
  .secondary.hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.1));
  }

  .ghost {
    padding: 0 var(--space-14);
    color: var(--ink-2, #b9b9c6);
    background: transparent;
  }

  .ghost:hover,
  .ghost.hover,
  .ghost.active {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .danger {
    color: var(--status-danger, #ff6b6b);
    background: var(--btn-danger-bg, rgba(224, 49, 49, 0.07));
    box-shadow: inset 0 0 0 1px var(--btn-danger-line, rgba(224, 49, 49, 0.45)), var(--ring);
  }

  .danger.default,
  .danger.hover {
    box-shadow: inset 0 0 0 1px var(--btn-danger-line, rgba(224, 49, 49, 0.45));
  }

  .danger:hover,
  .danger.hover {
    background: var(--btn-danger-bg-hover, rgba(224, 49, 49, 0.16));
  }

  .disabled {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    color: var(--ink-4, #6e6e7c);
    cursor: not-allowed;
  }
</style>
