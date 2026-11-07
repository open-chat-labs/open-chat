<!-- Toast with an optional action (Undo) and dismiss ×. Animates in when shown and out when `shown` turns false.
     An inverted snackbar (design pass 7): the --toast-* tokens are light in dark mode and dark in light mode, so a
     toast never reads as a received bubble; the accent only on the action, green only in the success icon.
     tone="success" + size="lg": the prominent confirmation used after wallet sends. icon: undo | hide | trash | check | none.
     detail: a secondary line under the message.
     busy: what it says is still on its way, so a small loader stands in place of the action and the dismiss. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onDestroy, untrack } from 'svelte';
  import Spinner from './Spinner.svelte';

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
    /** Resource key (or literal text): a secondary line under the message. */
    detail?: string;
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
    /** What it says is still on its way: a small loader in place of the action and the dismiss. */
    busy?: boolean;
  }

  let { message, detail, tone = 'neutral', size = 'md', shown = true, actionLabel = 'ui.common.undo', icon = 'undo', onAction, onClose, busy = false }: Props = $props();
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
  // anything at the end (the action, the dismiss or the loader) brings the end padding in
  const trailing = $derived(busy || !!onAction || !!onClose);
</script>

{#if shown || out}
  <div class="toast {size}" class:success={tone === 'success'} class:out class:trailing role="status" aria-live="polite" aria-atomic="true">
    {#if icon !== 'none' && ICONS[icon]}
      <span class="badge"><span class="icon" style:mask={ICONS[icon]}></span></span>
    {/if}
    <span class="text">
      <span class="message">{t(message)}</span>
      {#if detail}
        <span class="detail">{t(detail)}</span>
      {/if}
    </span>
    {#if busy}
      <span class="busy"><Spinner size={16} tone="ink" /></span>
    {:else if onAction}
      <span class="action" onclick={onAction} role="button" tabindex="0">{t(actionLabel)}</span>
    {/if}
    {#if onClose && !busy}
      <span class="close" onclick={onClose} role="button" tabindex="0" aria-label={t('ui.common.dismiss')} title={t('ui.common.dismiss')}>
        <span class="close-icon"></span>
      </span>
    {/if}
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: 48px;
    padding-block: var(--space-8);
    padding-inline: var(--space-14);
    box-sizing: border-box;
    border-radius: 14px;
    background: var(--toast-bg);
    box-shadow: var(--toast-shadow);
    animation: oc-toast-in 160ms var(--ease-out) both;

    &.trailing {
      padding-inline-end: var(--space-8);
    }

    &.lg {
      gap: var(--space-12);
      min-height: 60px;
      padding-block: var(--space-10);
      padding-inline: var(--space-12) var(--space-10);
    }

    &.out {
      pointer-events: none;
      animation: oc-toast-out 190ms var(--ease-standard) both;
    }
  }

  // the focus ring in the action's colour, which reads on the inverted background
  .action,
  .close {
    &:focus-visible {
      outline-color: var(--toast-action);
    }
  }

  .badge {
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-pill);
    @include flex-center;
    background: transparent;
  }

  .icon {
    width: 15px;
    height: 15px;
    background: var(--toast-ink-2);
  }

  .success {
    .badge {
      width: 24px;
      height: 24px;
      background: var(--toast-success-soft);
    }

    .icon {
      width: 13px;
      height: 13px;
      background: var(--toast-success);
    }

    &.lg .badge {
      width: 32px;
      height: 32px;
    }

    &.lg .icon {
      width: 16px;
      height: 16px;
    }
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .message {
    font: var(--weight-semibold) text-size(13px) / 1.35 var(--font-sans);
    color: var(--toast-ink);
    text-wrap: pretty;
  }

  .detail {
    font: var(--weight-medium) text-size(12px) / 1.3 var(--font-sans);
    color: var(--toast-ink-2);
    text-wrap: pretty;
  }

  .action {
    flex: none;
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    background: transparent;
    font: var(--weight-bold) text-size(13px) / 1 var(--font-sans);
    color: var(--toast-action);
    cursor: pointer;
    user-select: none;

    &:hover {
      background: var(--toast-action-soft);
    }

    .lg & {
      height: 36px;
      background: var(--toast-action-soft);

      &:hover {
        background: var(--toast-action-hover);
      }
    }
  }

  // the loader in the toast's own ink, on a track of its hover fill, so it reads on the inverted background
  .busy {
    flex: none;
    @include flex-center;
    width: 28px;
    height: 28px;
    --ink: var(--toast-ink);
    --overlay-2: var(--toast-hover);

    .lg & {
      width: 32px;
      height: 32px;
    }
  }

  .close {
    flex: none;
    @include flex-center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    cursor: pointer;

    .lg & {
      width: 32px;
      height: 32px;
    }

    &:hover {
      background: var(--toast-hover);
    }
  }

  .close-icon {
    width: 11px;
    height: 11px;
    background: var(--toast-ink-2);
    mask: var(--icon-close) center/contain no-repeat;

    .lg & {
      width: 13px;
      height: 13px;
    }
  }
</style>
