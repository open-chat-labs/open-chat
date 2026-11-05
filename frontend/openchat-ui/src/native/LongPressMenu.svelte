<!-- Native long-press menu for rows (native design notes §1 Sheets, menus): chats, channels, communities. The screen
     dims and blurs, a copy of the pressed row lifts in place (the row itself hides), and the menu opens 8px under it,
     or over it near the bottom (menuPlacement.ts); a small target (a strip avatar) lifts as a 240px card. The copy is
     the `row` snippet, or a clone of the row. Rows open it with `use:longPress` (held 450ms, or a context menu, with a
     light haptic). A tap outside or Esc closes it, everything fading out together in 170ms. It's a fixed layer over
     the native root. Reduced motion: no scale or fade. -->
<script lang="ts">
  import { onDestroy, untrack, type Snippet } from 'svelte';
  import { modal } from '../lib/behaviours/modal';
  import NativeMenu from './NativeMenu.svelte';
  import { Presence } from './presence.svelte';
  import { liftPlacement, menuHeight, type LiftPlacement } from './menuPlacement';
  import type { NativeMenuItem } from './types';

  const LEAVE_MS = 170;

  interface Props {
    open: boolean;
    /** The pressed row (what `use:longPress` hands back): where the copy lifts, hidden while the menu is open. */
    target: HTMLElement | null;
    items: NativeMenuItem[];
    /** Resource key (or literal text): the menu's accessible name ("Lucy Linden options"). */
    label: string;
    /** A row was picked; the menu has asked to close (onClose) just before. */
    onSelect: (id: string) => void;
    /** A tap outside, Esc, or a pick. The menu fades out once `open` turns false. */
    onClose: () => void;
    /** The lifted copy (the same row component, not interactive); without it, a clone of the target. */
    row?: Snippet;
  }

  let { open, target, items, label, onSelect, onClose, row }: Props = $props();

  const presence = new Presence(LEAVE_MS);
  // the row it opened on, kept while it fades out
  let lifted = $state<HTMLElement | null>(null);
  $effect.pre(() => {
    const now = open && !!target;
    const el = target;
    untrack(() => {
      if (now) lifted = el;
      presence.set(now);
    });
  });
  onDestroy(() => presence.dispose());

  let frame = $state<HTMLElement>();
  let placement = $state<LiftPlacement | null>(null);

  $effect(() => {
    if (!presence.mounted || !lifted || !frame) {
      placement = null;
      return;
    }
    const box = frame;
    const el = lifted;
    const rows = items;
    const rtl = getComputedStyle(box).direction === 'rtl';
    untrack(() => (placement = liftPlacement(el.getBoundingClientRect(), box.getBoundingClientRect(), menuHeight(rows), rtl)));
  });

  // the row hides while its copy is lifted, until the menu is gone
  $effect(() => {
    const el = presence.mounted ? lifted : null;
    if (!el) return;
    const was = el.style.visibility;
    el.style.visibility = 'hidden';
    return () => {
      el.style.visibility = was;
    };
  });

  function clone(node: HTMLElement, from: HTMLElement | null) {
    if (!from) return;
    const copy = from.cloneNode(true) as HTMLElement;
    copy.style.visibility = '';
    copy.style.margin = '0';
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    node.replaceChildren(copy);
  }

  function pick(id: string) {
    onClose();
    onSelect(id);
  }

  // focus goes back to the row once it's visible again (its visibility comes back after this teardown)
  function returnFocus(_node: HTMLElement, to: HTMLElement | null) {
    return {
      destroy() {
        setTimeout(() => {
          if (to?.isConnected) to.focus({ preventScroll: true });
        }, 0);
      },
    };
  }

  // Tab leaves a menu (it closes, and focus goes back to the row), as menus do
  function keydown(e: KeyboardEvent) {
    if (e.key !== 'Tab' || presence.leaving) return;
    e.preventDefault();
    onClose();
  }
</script>

{#if presence.mounted && lifted}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="layer" class:closing={presence.leaving} use:modal={presence.leaving ? undefined : onClose} use:returnFocus={lifted} onkeydown={keydown}>
    <!-- Esc closes it too -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="veil" onclick={onClose}></div>
    <div class="frame" bind:this={frame}>
      {#if placement}
        <div class="card" style:top="{placement.card.top}px" style:inset-inline-start="{placement.card.inlineStart}px" style:width="{placement.card.width}px" aria-hidden="true" inert>
          {#if row}{@render row()}{:else}<div class="clone" use:clone={lifted}></div>{/if}
        </div>
        <div
          class="pop"
          style:top="{placement.menu.top}px"
          style:inset-inline-start="{placement.menu.inlineStart}px"
          style:max-height="{placement.menu.maxHeight}px"
          style:transform-origin={placement.origin}
        >
          <NativeMenu {items} {label} onSelect={pick} />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .layer {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);

    &.closing {
      pointer-events: none;
    }
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--veil-lift);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    animation: fade-in 0.2s ease-out;
  }

  .frame {
    position: absolute;
    inset: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
    pointer-events: none;
  }

  .card {
    position: absolute;
    overflow: hidden;
    border-radius: 16px;
    background: var(--surface-1);
    box-shadow: var(--shadow-lift);
    pointer-events: none;
    animation: lift-in 0.2s var(--ease-out);
  }

  .pop {
    position: absolute;
    width: 240px;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    animation: menu-in 0.2s var(--ease-out) 0.04s backwards;
  }

  .veil,
  .card,
  .pop {
    transition: opacity 0.18s;

    .closing & {
      opacity: 0;
    }
  }

  // the copy is the row itself, lifting: its shadow grows, it doesn't fade
  @keyframes lift-in {
    from {
      box-shadow: none;
    }
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: scale(0.92);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }

  @include reduced-motion {
    .veil,
    .card,
    .pop {
      transition: none;
      animation: none;
    }
  }
</style>
