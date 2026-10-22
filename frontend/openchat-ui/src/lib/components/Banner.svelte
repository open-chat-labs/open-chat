<!-- Full-width notice with an optional text action. tone: info (accent) | warning | danger | offline (warning colours, offline icon). -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    /** Resource key (or literal text). */
    text: string;
    tone?: 'info' | 'warning' | 'danger' | 'offline';
    /** Resource key (or literal text). */
    actionLabel?: string;
    actionHandler?: () => void;
  }

  let { text, tone = 'info', actionLabel = '', actionHandler }: Props = $props();
  const t = useT();

  const icon = $derived(tone === 'danger' ? 'warning' : tone);
</script>

<div class="banner {tone}">
  <span class="icon" style:mask="var(--icon-{icon}) center/contain no-repeat"></span>
  <span class="text">{t(text)}</span>
  {#if actionLabel}
    <span class="action" onclick={actionHandler} role="button" tabindex="0">{t(actionLabel)}</span>
  {/if}
</div>

<style>
  .banner {
    --tint: var(--accent);
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-14) var(--space-18);
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent-dim);
  }

  .warning,
  .offline {
    --tint: var(--status-chit);
    background: var(--status-chit-soft);
    box-shadow: inset 0 0 0 1px var(--status-chit);
  }

  .danger {
    --tint: var(--status-danger);
    background: var(--btn-danger-bg);
    box-shadow: inset 0 0 0 1px var(--btn-danger-line);
  }

  .icon {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--tint);
  }

  .text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-md) / 1.4 var(--font-sans);
    color: var(--ink);
    text-wrap: pretty;
  }

  .action {
    flex: none;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--tint);
    cursor: pointer;
    user-select: none;
  }
</style>
