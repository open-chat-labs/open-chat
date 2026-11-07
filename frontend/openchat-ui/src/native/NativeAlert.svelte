<!-- A confirmation (native design notes §1 Structure 4: "Confirmations stay small alerts"): a small card in the middle
     of the screen over the sheets' veil, with a title, an optional message and two buttons side by side, the dismiss
     one first. The confirm button is the accent's, or in the danger colour for a destructive action. The veil, Esc and
     Cancel dismiss it; it scales and fades in and out (fades only with reduced motion). The host registers its close
     with Android's back while it's open. -->
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { useT } from '../lib/i18n';
  import { modal } from '../lib/behaviours/modal';
  import { Presence } from './presence.svelte';

  const LEAVE_MS = 180;

  interface Props {
    open: boolean;
    /** Resource key (or literal text). */
    title: string;
    /** Resource key (or literal text): what happens. */
    message?: string;
    /** Resource key (or literal text): the action. */
    confirmLabel: string;
    /** Resource key (or literal text): the dismiss button; Cancel by default. */
    cancelLabel?: string;
    /** A destructive action (Delete, Sign out): the confirm button in the danger colour. */
    danger?: boolean;
    /** The action is under way: the buttons wait. */
    busy?: boolean;
    onConfirm: () => void;
    /** Cancel, the veil or Esc. The alert plays its way out once `open` turns false. */
    onClose: () => void;
  }

  let { open, title, message = '', confirmLabel, cancelLabel = 'ui.common.cancel', danger = false, busy = false, onConfirm, onClose }: Props =
    $props();
  const t = useT();

  const presence = new Presence(LEAVE_MS);
  $effect.pre(() => {
    const now = open;
    untrack(() => presence.set(now));
  });
  onDestroy(() => presence.dispose());

  function dismiss() {
    if (!busy) onClose();
  }

  // focus goes to the dismiss button, the safe one, and back to what had it once the alert is gone
  function focusCancel(node: HTMLElement) {
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.querySelector<HTMLElement>('.cancel')?.focus({ preventScroll: true });
    return {
      destroy() {
        if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
      },
    };
  }
</script>

{#if presence.mounted}
  <div class="layer" class:leaving={presence.leaving}>
    <!-- Esc and Cancel dismiss it too -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="veil" onclick={dismiss} aria-hidden="true"></div>
    <div
      class="alert"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="native-alert-title"
      aria-describedby={message ? 'native-alert-message' : undefined}
      aria-busy={busy}
      use:modal={presence.leaving ? undefined : dismiss}
      use:focusCancel
    >
      <h2 class="title" id="native-alert-title">{t(title)}</h2>
      {#if message}<p class="message" id="native-alert-message">{t(message)}</p>{/if}
      <div class="buttons">
        <button type="button" class="button cancel" disabled={busy} onclick={dismiss}>{t(cancelLabel)}</button>
        <button type="button" class="button confirm" class:danger disabled={busy} onclick={onConfirm}>{t(confirmLabel)}</button>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .layer {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    display: grid;
    place-items: center;
    padding: 0 24px;

    &.leaving {
      pointer-events: none;
    }
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--veil-sheet);
    animation: fade-in 0.2s ease-out backwards;

    .leaving & {
      opacity: 0;
      transition: opacity 0.18s ease-in;
    }
  }

  .alert {
    position: relative;
    width: min(320px, 100%);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 22px 20px 16px;
    border-radius: 20px;
    background: var(--surface-1);
    box-shadow: var(--shadow-menu);
    color: var(--ink);
    animation: alert-in 0.22s var(--ease-out) backwards;

    .leaving & {
      opacity: 0;
      transform: scale(0.96);
      transition:
        opacity 0.18s ease-in,
        transform 0.18s ease-in;
    }
  }

  .title {
    margin: 0;
    font: var(--weight-bold) text-size(17px) / 1.3 var(--font-sans);
    text-wrap: balance;
  }

  .message {
    margin: 0;
    font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .buttons {
    display: flex;
    gap: 10px;
    margin-top: 12px;
  }

  .button {
    flex: 1;
    min-width: 0;
    min-height: var(--touch-target);
    padding: 0 12px;
    border: 0;
    border-radius: 14px;
    background: var(--overlay-1);
    color: var(--ink);
    font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:focus-visible {
      @include focus-ring;
    }

    &:disabled {
      cursor: default;
      opacity: 0.6;
    }
  }

  .confirm {
    background: var(--accent);
    color: var(--on-accent);

    // the library Button's danger look
    &.danger {
      background: var(--btn-danger-bg);
      color: var(--status-danger);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }

  @keyframes alert-in {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
  }

  @include reduced-motion {
    .alert {
      animation-name: fade-in;

      .leaving & {
        transform: none;
      }
    }
  }
</style>
