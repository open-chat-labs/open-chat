<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** Resource key (or literal text). */
    hint?: string;
    /** Resource key or literal text (counts and names render as they are). */
    value?: string;
    highlight?: boolean;
    onClick?: () => void;
  }

  let { label, hint = '', value = '', highlight = false, onClick }: Props = $props();
  const t = useT();
</script>

<div class="nav-row" onclick={onClick} role="button" tabindex="0">
  <div class="text">
    <span class="label">{t(label)}</span>
    {#if hint}<span class="hint">{t(hint)}</span>{/if}
  </div>
  {#if value}<span class="value" class:highlight>{t(value)}</span>{/if}
  <span class="chevron"></span>
</div>

<style>
  .nav-row {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: var(--control-xl);
    padding: var(--space-8) var(--space-12);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .nav-row:hover {
    background: var(--overlay-1);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .hint {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value {
    flex: none;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .highlight {
    color: var(--accent-bright);
  }

  .chevron {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-4);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }
</style>
