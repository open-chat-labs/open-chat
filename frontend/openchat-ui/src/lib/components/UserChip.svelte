<!-- Person pill: gradient avatar (optional online dot), name, optional tag, and a remove ×. onClick makes the whole chip pressable.
     variant: neutral | accent | danger. size: sm | md | lg. -->
<script lang="ts">
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
    label: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'neutral' | 'accent' | 'danger';
    color?: keyof typeof GRADIENTS;
    tag?: string;
    showAvatar?: boolean;
    showRemove?: boolean;
    online?: boolean;
    onRemove?: () => void;
    onClick?: () => void;
  }

  let { label, size = 'md', variant = 'neutral', color = 'violet', tag = '', showAvatar = true, showRemove = true, online = false, onRemove, onClick }: Props = $props();
</script>

<div class="chip {size} {variant}" class:pressable={!!onClick} class:bare={!showAvatar} onclick={onClick} role="button" tabindex="0">
  {#if showAvatar}
    <span class="avatar" style:background={GRADIENTS[color] ?? GRADIENTS.violet}>
      {#if online}
        <span class="dot"></span>
      {/if}
    </span>
  {/if}
  <span class="label">{label}</span>
  {#if tag}
    <span class="tag">{tag}</span>
  {/if}
  {#if showRemove}
    <span class="remove" onclick={onRemove} role="button" tabindex="0" aria-label="Remove" title="Remove">
      <span class="remove-icon"></span>
    </span>
  {/if}
</div>

<style>
  .chip {
    --chip-tint: var(--accent, #ff5672);
    display: inline-flex;
    align-items: center;
    gap: var(--space-8);
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 4px var(--space-8) 4px 4px;
    border-radius: var(--radius-pill);
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    cursor: default;
    user-select: none;
  }

  .sm {
    padding: 3px var(--space-6) 3px 3px;
  }

  .lg {
    padding: 5px var(--space-10) 5px 5px;
  }

  .chip.bare {
    padding-left: var(--space-8);
  }

  .danger {
    --chip-tint: var(--status-danger, #f5493d);
  }

  .accent,
  .danger {
    background: color-mix(in srgb, var(--chip-tint) 14%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-tint) 32%, transparent);
  }

  .pressable {
    cursor: pointer;
  }

  .pressable:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
  }

  .avatar {
    position: relative;
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-pill);
  }

  .sm .avatar {
    width: 20px;
    height: 20px;
  }

  .lg .avatar {
    width: 32px;
    height: 32px;
  }

  .dot {
    position: absolute;
    inset-inline-end: -1px;
    inset-block-end: -1px;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--status-online, #2ee6a8);
    box-shadow: 0 0 0 2px var(--surface-2, #17171d);
  }

  .accent .dot,
  .danger .dot {
    box-shadow: 0 0 0 2px var(--surface-1, #0e0e12);
  }

  .label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sm .label {
    font-size: var(--text-sm);
  }

  .lg .label {
    font-size: var(--text-base);
  }

  .accent .label {
    color: var(--accent-bright, #ff8298);
  }

  .danger .label {
    color: var(--status-danger, #f5493d);
  }

  .tag {
    flex: none;
    padding: 2px var(--space-6);
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-2xs) / 1.3 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3, #9a9aa8);
  }

  .remove {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-pill);
    cursor: pointer;
  }

  .sm .remove {
    width: 17px;
    height: 17px;
  }

  .lg .remove {
    width: 24px;
    height: 24px;
  }

  .remove:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.12));
  }

  .remove-icon {
    width: 11px;
    height: 11px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .sm .remove-icon {
    width: 9px;
    height: 9px;
  }

  .lg .remove-icon {
    width: 12px;
    height: 12px;
  }

  .accent .remove-icon {
    background: var(--accent-bright, #ff8298);
  }

  .danger .remove-icon {
    background: var(--status-danger, #f5493d);
  }
</style>
