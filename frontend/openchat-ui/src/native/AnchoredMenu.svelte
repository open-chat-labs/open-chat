<!-- Native anchored menu (native design notes §1 Sheets, menus): a short list (a header's kebab, a settings value)
     opening from the button or row that asked for it. It sits 4px under the anchor with its end edge 4px inside the
     anchor's, or over it near the bottom (menuPlacement.ts), and scales in from that corner in 160ms. Submenus
     replace the rows in place, under a back row. A tap outside or Esc closes it, and focus goes back to the anchor.
     It's a fixed layer over the native root, kept clear of the safe areas. Reduced motion: it just appears. -->
<script lang="ts">
  import { modal } from '../lib/behaviours/modal';
  import NativeMenu from './NativeMenu.svelte';
  import { anchoredPlacement, menuHeight, type AnchoredPlacement } from './menuPlacement';
  import type { NativeMenuItem } from './types';

  interface Props {
    /** What opened it (the kebab, the row); null keeps it closed. */
    anchor: HTMLElement | null;
    items: NativeMenuItem[];
    /** Resource key (or literal text): the menu's accessible name. */
    label: string;
    /** A row was picked; the menu has asked to close (onClose) just before. */
    onSelect: (id: string) => void;
    /** A tap outside, Esc, or a pick. */
    onClose: () => void;
  }

  let { anchor, items, label, onSelect, onClose }: Props = $props();

  let frame = $state<HTMLElement>();
  let placement = $state<AnchoredPlacement | null>(null);

  $effect(() => {
    if (!anchor || !frame) {
      placement = null;
      return;
    }
    const rtl = getComputedStyle(frame).direction === 'rtl';
    placement = anchoredPlacement(anchor.getBoundingClientRect(), frame.getBoundingClientRect(), menuHeight(items), rtl);
  });

  function pick(id: string) {
    onClose();
    onSelect(id);
  }

  // focus goes back to the anchor when the menu goes away
  function returnFocus(_node: HTMLElement, to: HTMLElement | null) {
    return {
      destroy() {
        if (to?.isConnected) to.focus({ preventScroll: true });
      },
    };
  }
</script>

{#if anchor}
  <div class="layer" use:modal={onClose} use:returnFocus={anchor}>
    <!-- Esc closes it too -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="outside" onclick={onClose}></div>
    <div class="frame" bind:this={frame}>
      {#if placement}
        <div
          class="pop"
          style:top={placement.side === 'below' ? `${placement.top}px` : undefined}
          style:bottom={placement.side === 'above' ? `${placement.bottom}px` : undefined}
          style:inset-inline-end="{placement.inlineEnd}px"
          style:max-height="{placement.maxHeight}px"
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
  }

  .outside {
    position: absolute;
    inset: 0;
  }

  .frame {
    position: absolute;
    inset: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
    pointer-events: none;
  }

  .pop {
    position: absolute;
    display: flex;
    flex-direction: column;
    min-width: 230px;
    max-width: calc(100% - 24px);
    pointer-events: auto;
    animation: menu-in 0.16s var(--ease-out);
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: scale(0.92);
    }
  }

  @include reduced-motion {
    .pop {
      animation: none;
    }
  }
</style>
