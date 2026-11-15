<!-- Full-width notice with an optional text action and an optional dismiss (×). tone: info (accent) | warning | danger | offline (warning colours, offline icon). -->
<script lang="ts">
  import { useT } from '../i18n';
  import IconButton from './IconButton.svelte';

  interface Props {
    /** Resource key (or literal text). */
    text: string;
    tone?: 'info' | 'warning' | 'danger' | 'offline';
    /** Resource key (or literal text). */
    actionLabel?: string;
    actionHandler?: () => void;
    /** Shows a dismiss (×) at the end; called when it's pressed. */
    onDismiss?: () => void;
  }

  let { text, tone = 'info', actionLabel = '', actionHandler, onDismiss }: Props = $props();
  const t = useT();

  // the action is a role=button span: Enter and Space press it, as they would a button
  function actionKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      actionHandler?.();
    }
  }

  const icon = $derived(tone === 'danger' ? 'warning' : tone);
</script>

<div class="banner {tone}">
  <span class="icon" style:mask="var(--icon-{icon}) center/contain no-repeat"></span>
  <span class="text">{t(text)}</span>
  {#if actionLabel}
    <span class="action" onclick={actionHandler} onkeydown={actionKey} role="button" tabindex="0">{t(actionLabel)}</span>
  {/if}
  {#if onDismiss}
    <span class="dismiss"><IconButton icon="close" variant="ghost" label="ui.common.dismiss" onClick={onDismiss} /></span>
  {/if}
</div>

<style lang="scss">
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

  .dismiss {
    flex: none;
    /* the 34px button inside the banner's padding, so the bar keeps its height */
    margin-block: -9px;
    margin-inline-end: calc(-1 * var(--space-10));
  }

  .action {
    flex: none;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--tint);
    cursor: pointer;
    user-select: none;
  }
</style>
