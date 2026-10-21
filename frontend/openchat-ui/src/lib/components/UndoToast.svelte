<!-- Toast with an optional action (Undo) and dismiss ×. Animates in when shown and out when `shown` turns false.
     tone="success" + size="lg": the prominent confirmation used after wallet sends. icon: undo | hide | trash | check | none. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onDestroy, untrack } from 'svelte';

  const ICONS = {
    undo: 'var(--icon-rotate-back) center/contain no-repeat',
    hide: 'var(--icon-eye-off) center/contain no-repeat',
    trash: 'var(--icon-trash) center/contain no-repeat',
    check: 'var(--icon-check) center/contain no-repeat',
  };
  const LEAVE_MS = 190;

  interface Props {
    /** Resource key (or literal text). */
    message: string;
    tone?: 'neutral' | 'success';
    size?: 'md' | 'lg';
    shown?: boolean;
    /** Resource key (or literal text). */
    actionLabel?: string;
    icon?: keyof typeof ICONS | 'none';
    /** Shows the action button. */
    onAction?: () => void;
    /** Shows the dismiss button. */
    onClose?: () => void;
  }

  let { message, tone = 'neutral', size = 'md', shown = true, actionLabel = 'ui.common.undo', icon = 'undo', onAction, onClose }: Props = $props();
  const t = useT();

  // the toast outlives its own `shown` by one animation so it can leave gracefully
  let leaving = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let was = untrack(() => shown);
  $effect.pre(() => {
    const now = shown;
    untrack(() => {
      if (was && !now) {
        clearTimeout(timer);
        leaving = true;
        timer = setTimeout(() => (leaving = false), LEAVE_MS);
      } else if (!was && now && leaving) {
        clearTimeout(timer);
        leaving = false;
      }
      was = now;
    });
  });
  onDestroy(() => clearTimeout(timer));

  const out = $derived(leaving && !shown);
</script>

{#if shown || out}
  <div class="toast {size}" class:success={tone === 'success'} class:out role="status" aria-live="polite" aria-atomic="true">
    {#if icon !== 'none' && ICONS[icon]}
      <span class="badge"><span class="icon" style:mask={ICONS[icon]}></span></span>
    {/if}
    <span class="message">{t(message)}</span>
    {#if onAction}
      <span class="action" onclick={onAction} role="button" tabindex="0">{t(actionLabel)}</span>
    {/if}
    {#if onClose}
      <span class="close" onclick={onClose} role="button" tabindex="0" aria-label={t('ui.common.dismiss')} title={t('ui.common.dismiss')}>
        <span class="close-icon"></span>
      </span>
    {/if}
  </div>
{/if}

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: 0;
    padding: var(--space-10) var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 14px 34px rgba(0, 0, 0, 0.45);
    animation: oc-toast-in 160ms var(--ease-out) both;
  }

  .toast.out {
    pointer-events: none;
    animation: oc-toast-out 190ms var(--ease-standard) both;
  }

  .lg {
    gap: var(--space-12);
    min-height: 60px;
    padding: var(--space-10) var(--space-10) var(--space-10) var(--space-12);
    border-radius: var(--radius-lg);
  }

  .success {
    background:
      linear-gradient(0deg, rgba(46, 230, 168, 0.1), rgba(46, 230, 168, 0.1)),
      var(--surface-2);
    box-shadow:
      inset 0 0 0 1px rgba(46, 230, 168, 0.38),
      0 18px 44px rgba(0, 0, 0, 0.5);
  }

  .badge {
    flex: none;
    width: 15px;
    height: 15px;
    border-radius: var(--radius-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }

  .icon {
    width: 15px;
    height: 15px;
    background: var(--ink-4);
  }

  .success .badge {
    width: 24px;
    height: 24px;
    background: rgba(46, 230, 168, 0.16);
  }

  .success .icon {
    width: 13px;
    height: 13px;
    background: var(--status-online);
  }

  .success.lg .badge {
    width: 32px;
    height: 32px;
  }

  .success.lg .icon {
    width: 16px;
    height: 16px;
  }

  .message {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.35 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .lg .message {
    font: var(--weight-semibold) var(--text-md) / 1.35 var(--font-sans);
  }

  .success .message,
  .lg .message {
    color: var(--ink);
  }

  .action {
    flex: none;
    display: flex;
    align-items: center;
    height: 26px;
    padding: 0 var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    background: transparent;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .action:hover {
    background: var(--accent-soft);
  }

  .lg .action {
    height: 36px;
    padding: 0 var(--space-14);
    background: var(--overlay-2);
    font: var(--weight-bold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .lg .action:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.14));
  }

  .close {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .lg .close {
    width: 32px;
    height: 32px;
  }

  .close:hover {
    background: var(--overlay-2);
  }

  .close-icon {
    width: 11px;
    height: 11px;
    background: var(--ink-4);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .lg .close-icon {
    width: 13px;
    height: 13px;
  }
</style>
