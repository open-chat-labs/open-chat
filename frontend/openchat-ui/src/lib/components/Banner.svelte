<!-- Full-width notice with an optional text action. tone: info (accent) | warning | danger | offline (warning colours, offline icon). -->
<script lang="ts">
  interface Props {
    text: string;
    tone?: 'info' | 'warning' | 'danger' | 'offline';
    actionLabel?: string;
    actionHandler?: () => void;
  }

  let { text, tone = 'info', actionLabel = '', actionHandler }: Props = $props();

  const icon = $derived(tone === 'danger' ? 'warning' : tone);
</script>

<div class="banner {tone}">
  <span class="icon" style:mask="var(--icon-{icon}) center/contain no-repeat"></span>
  <span class="text">{text}</span>
  {#if actionLabel}
    <span class="action" onclick={actionHandler} role="button" tabindex="0">{actionLabel}</span>
  {/if}
</div>

<style>
  .banner {
    --tint: var(--accent, #ff5672);
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-14) var(--space-18);
    border-radius: var(--radius-md);
    background: var(--accent-soft, rgba(255, 86, 114, 0.09));
    box-shadow: inset 0 0 0 1px var(--accent-dim, rgba(255, 86, 114, 0.35));
  }

  .warning,
  .offline {
    --tint: var(--status-chit, #ff9f45);
    background: var(--status-chit-soft, rgba(255, 159, 69, 0.14));
    box-shadow: inset 0 0 0 1px var(--status-chit, #ff9f45);
  }

  .danger {
    --tint: var(--status-danger, #f5493d);
    background: var(--btn-danger-bg, rgba(240, 68, 56, 0.08));
    box-shadow: inset 0 0 0 1px var(--btn-danger-line, rgba(240, 68, 56, 0.5));
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
    color: var(--ink, #ececf1);
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
