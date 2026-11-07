<!-- Native toasts (native design notes §1 Sheets, menus, toasts): the library's UndoToast, 12px from the sides, above
     the tab bar (14px clear of it, over the FAB), above a pushed screen's composer or pinned footer, or just above the
     safe area. A destructive action's toast offers Undo (with the trash icon); one whose action is still on its way
     shows a small loader in place of Undo and the close (`pending`). It plays out when `toast` turns null,
     and a replacement plays in again. ToastQueue keeps the timing for a host without its own. Reduced motion: no
     slide or fade. -->
<script lang="ts">
  import UndoToast from '../lib/components/UndoToast.svelte';
  import type { NativeToast } from './toastQueue.svelte';

  interface Props {
    /** The toast showing, or null. */
    toast: NativeToast | null;
    /** What it sits above: the tab bar (a tab's root), a footer (a conversation's composer, a pinned button), or
     *  nothing but the safe area. */
    above?: 'tabBar' | 'footer' | 'none';
    /** Undo on an undoable toast. */
    onUndo: () => void;
    /** Its ×. */
    onDismiss: () => void;
  }

  let { toast, above = 'tabBar', onUndo, onDismiss }: Props = $props();

  // the last toast stays rendered while it plays out
  let last = $state<NativeToast | null>(null);
  $effect.pre(() => {
    if (toast) last = toast;
  });
</script>

<div class="toasts {above}">
  {#if last}
    {#key last.id}
      <div class="slot">
        <UndoToast
          shown={toast?.id === last.id}
          message={last.message}
          icon={last.undoable || last.pending ? 'trash' : 'none'}
          actionLabel="ui.common.undo"
          busy={last.pending}
          onAction={last.undoable ? onUndo : undefined}
          onClose={onDismiss}
        />
      </div>
    {/key}
  {/if}
</div>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .toasts {
    position: fixed;
    inset-inline: 12px;
    bottom: calc(var(--tab-bar-h) + 14px);
    z-index: calc(var(--z-modal) + 5);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    pointer-events: none;

    &.footer {
      bottom: calc(var(--bar-end) + 64px);
    }

    &.none {
      bottom: calc(var(--bar-end) + 4px);
    }
  }

  .slot {
    pointer-events: auto;
  }

  /* an accent edge (1.5px, in place of the library's 1px line), so a toast doesn't read as a received message's
     bubble; the library's shadow stays. Every toast here, with Undo or without, in both modes and every accent */
  .slot :global(.toast) {
    box-shadow:
      inset 0 0 0 1.5px var(--accent),
      0 14px 34px rgba(0, 0, 0, 0.45);
  }

  @include reduced-motion {
    .slot :global(.toast) {
      animation: none;
    }
  }
</style>
