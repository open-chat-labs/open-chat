<!-- Switch, optionally with a label and help line (then it fills the row). Flips itself on click and reports onChange;
     a parent that changes `on` takes control back (e.g. a cancelled PIN flow). -->
<script lang="ts">
  interface Props {
    on: boolean;
    label?: string;
    help?: string;
    disabled?: boolean;
    onChange?: (on: boolean) => void;
  }

  let { on, label = '', help = '', disabled = false, onChange }: Props = $props();

  let checked = $derived(on);

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onChange?.(checked);
  }
</script>

<div class="toggle" class:labelled={!!label}>
  {#if label}
    <div class="text">
      <span class="label">{label}</span>
      {#if help}
        <span class="help">{help}</span>
      {/if}
    </div>
  {/if}
  <div
    class="track"
    class:on={checked}
    class:disabled
    onclick={toggle}
    role="switch"
    aria-checked={checked}
    aria-label={label || undefined}
    aria-disabled={disabled || undefined}
    tabindex="0"
  >
    <span class="knob"></span>
  </div>
</div>

<style>
  .toggle {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-14);
    width: 42px;
    height: 24px;
  }

  .toggle.labelled {
    width: 100%;
    height: auto;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .label {
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .help {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3, #7c7c8c);
  }

  .track {
    flex: none;
    width: 42px;
    height: 24px;
    border-radius: var(--radius-pill);
    padding: var(--space-4);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: background var(--duration-base, 200ms) var(--ease-out);
    background: var(--overlay-2, rgba(255, 255, 255, 0.14));
  }

  .track.on {
    background: var(--accent, #ff5672);
  }

  .track.disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .knob {
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-pill);
    transition:
      transform var(--duration-base, 200ms) var(--ease-out),
      background var(--duration-base, 200ms) var(--ease-out);
    transform: translateX(0);
    background: var(--ink-4, #6e6e7c);
  }

  .on .knob {
    transform: translateX(calc(var(--oc-dir, 1) * 16px));
    background: #fff;
  }
</style>
