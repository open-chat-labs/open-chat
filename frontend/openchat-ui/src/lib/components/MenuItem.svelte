<!-- One Menu row (icon, label, optional check and shortcut) or a separator. minVw / maxVw show it only within a viewport width range. -->
<script lang="ts">
  interface Props {
    label?: string;
    variant?: 'regular' | 'danger' | 'separator';
    /** Icon name from icons.css (--icon-<name>). */
    icon?: string;
    /** Full CSS mask, used when there is no icon. */
    mask?: string;
    /** Mask for a trailing accent check (selected option). */
    checkMask?: string;
    shortcut?: string;
    minVw?: number;
    maxVw?: number;
    onSelect?: () => void;
  }

  let { label = '', variant = 'regular', icon, mask = '', checkMask = '', shortcut = '', minVw, maxVw, onSelect }: Props = $props();

  let vw = $state(typeof window === 'undefined' ? 1920 : window.innerWidth);

  const visible = $derived((minVw == null || vw >= minVw) && (maxVw == null || vw < maxVw));
  const iconMask = $derived(icon ? `var(--icon-${icon}) center/contain no-repeat` : mask);
</script>

<svelte:window bind:innerWidth={vw} />

<div class="wrap">
  {#if visible && variant === 'separator'}
    <span class="separator"></span>
  {:else if visible}
    <div class="item" class:danger={variant === 'danger'} onclick={onSelect} role="menuitem" tabindex="-1">
      {#if iconMask}
        <span class="icon" style:mask={iconMask}></span>
      {/if}
      <span class="label">{label}</span>
      {#if checkMask}
        <span class="check" style:mask={checkMask}></span>
      {/if}
      {#if shortcut}
        <span class="shortcut">{shortcut}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap {
    width: 100%;
  }

  .separator {
    display: block;
    height: 1px;
    margin: var(--space-4) var(--space-6);
    background: var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: var(--control-xl, 44px);
    padding: var(--space-8) var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    cursor: pointer;
    white-space: nowrap;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
  }

  .item.danger {
    color: var(--status-danger, #f5493d);
  }

  .item:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .icon {
    flex: none;
    width: 16px;
    height: 16px;
    background: currentColor;
  }

  .label {
    flex: 1;
    min-width: 0;
  }

  .check {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--accent, #ff5672);
  }

  .shortcut {
    flex: none;
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4, #6e6e7c);
  }
</style>
