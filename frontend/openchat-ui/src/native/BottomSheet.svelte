<!-- Native bottom sheet (native design notes §1 Sheets): pickers and short settings. A 48 × 4px handle, --surface-1
     with a 22px top radius over a dim veil; it slides up in 320ms and down in 280ms. The handle and header drag it:
     past 30% of its height or a downward flick closes it, otherwise it springs back; pulled up it rubber-bands 24px
     (sheetDrag.ts). A sheet whose content changes (search → results → confirm) gets one fixed `height`. Tapping the
     veil or Esc closes it. It's a fixed layer over the native root (the window in the app). Android's system back
     closing it first is the host's. Where the soft keyboard covers the window rather than shrinking it (the host knows:
     `keyboard`), the sheet sits on the keyboard while a field in it has the focus, as tall as it can be under the
     screen's top. Reduced motion: no slides, fades or spring. -->
<script lang="ts">
  import { onDestroy, untrack, type Snippet } from 'svelte';
  import { useT } from '../lib/i18n';
  import { modal } from '../lib/behaviours/modal';
  import { Presence } from './presence.svelte';
  import { releaseVelocity, sheetOffset, sheetRelease, veilOpacity, type DragSample } from './sheetDrag';

  const LEAVE_MS = 280;

  interface Props {
    open: boolean;
    /** The veil, Esc, a drag or a flick down. The sheet plays its way out once `open` turns false. */
    onClose: () => void;
    /** Resource key (or literal text): the header's label, and the sheet's accessible name. */
    title?: string;
    /** Resource key (or literal text): the accessible name when there's no title. */
    label?: string;
    /** Resource key (or literal text): a button at the header's end (Done). */
    actionLabel?: string;
    onAction?: () => void;
    /** A fixed height (a CSS length), for a sheet whose content changes; otherwise it fits its content, up to 82%. */
    height?: string;
    /** More of the drag area, under the title (a step's heading). */
    header?: Snippet;
    /** How much of the window the soft keyboard covers (px; 0 where the window shrinks for it, or it's down): while a
     *  field in the sheet has the focus, the sheet rises above it. */
    keyboard?: number;
    children: Snippet;
  }

  let { open, onClose, title = '', label = '', actionLabel = '', onAction, height, header, keyboard = 0, children }: Props = $props();
  const t = useT();

  let sheet = $state<HTMLElement>();
  let offset = $state(0);
  let dragging = $state(false);
  let drag: { y0: number; height: number; samples: DragSample[] } | null = null;

  // a field in the sheet has the focus (and so the keyboard, when there's one)
  let typing = $state(false);
  const lift = $derived(typing ? keyboard : 0);
  const TYPES = /^(text|search|email|url|tel|password|number)$/;
  function takesTyping(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    return el.isContentEditable || el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TYPES.test(el.type));
  }

  const presence = new Presence(LEAVE_MS);
  $effect.pre(() => {
    const now = open;
    untrack(() => {
      presence.set(now);
      if (now) offset = 0;
    });
  });
  onDestroy(() => presence.dispose());

  // buttons and fields in the header keep their own taps
  const CONTROL = 'button, a, input, textarea, select, [role="button"]';

  function grab(e: PointerEvent & { currentTarget: HTMLElement }) {
    if (e.button > 0 || presence.leaving || !sheet) return;
    const control = (e.target as Element | null)?.closest(CONTROL);
    if (control && control !== e.currentTarget) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag = { y0: e.clientY, height: sheet.offsetHeight, samples: [{ t: e.timeStamp, y: e.clientY }] };
    dragging = true;
  }

  function move(e: PointerEvent) {
    if (!drag) return;
    drag.samples.push({ t: e.timeStamp, y: e.clientY });
    if (drag.samples.length > 6) drag.samples.shift();
    offset = sheetOffset(e.clientY - drag.y0);
  }

  function release(e: PointerEvent) {
    if (!drag) return;
    const { y0, height, samples } = drag;
    drag = null;
    dragging = false;
    const velocity = releaseVelocity([...samples, { t: e.timeStamp, y: e.clientY }], e.timeStamp);
    if (sheetRelease(e.clientY - y0, height, velocity) === 'close') onClose();
    else offset = 0;
  }

  // focus moves into the sheet, and back to what had it once the sheet is gone
  // At rest the sheet has no transform: one would make it the containing block of the fixed layers inside it (a
  // SettingsValue's menu, toasts), confining them to the sheet, and a tap above it would reach the sheet's veil.

  function focusSheet(node: HTMLElement) {
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.focus({ preventScroll: true });
    return {
      destroy() {
        if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
      },
    };
  }
</script>

{#if presence.mounted}
  <div class="layer" class:leaving={presence.leaving}>
    <!-- Esc closes the sheet too -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="veil" class:dragging style:opacity={presence.leaving ? 0 : veilOpacity(offset)} onclick={onClose} aria-hidden="true"></div>
    <div
      class="sheet"
      class:dragging
      class:lifted={lift > 0}
      style:height
      style:bottom={lift > 0 ? `${lift}px` : undefined}
      style:max-height={lift > 0 ? `calc(100% - ${lift}px - var(--safe-top) - 8px)` : undefined}
      onfocusin={(e) => (typing = takesTyping(e.target))}
      onfocusout={(e) => (typing = takesTyping(e.relatedTarget) && !!sheet?.contains(e.relatedTarget as Node))}
      style:transform={presence.leaving ? 'translateY(100%)' : offset || dragging ? `translateY(${offset}px)` : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={t(title || label)}
      tabindex="-1"
      bind:this={sheet}
      use:modal={presence.leaving ? undefined : onClose}
      use:focusSheet
    >
      <!-- the drag is a pointer gesture; Esc and the veil close the sheet -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="grab" onpointerdown={grab} onpointermove={move} onpointerup={release} onpointercancel={release}>
        <div class="handle-row"><span class="handle"></span></div>
        {#if title || onAction}
          <div class="title-row">
            <span class="title">{t(title)}</span>
            {#if onAction}<button type="button" class="action" onclick={onAction}>{t(actionLabel || 'ui.common.done')}</button>{/if}
          </div>
        {/if}
        {#if header}{@render header()}{/if}
      </div>
      <div class="body">{@render children()}</div>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .layer {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    overflow: hidden;

    &.leaving {
      pointer-events: none;
    }
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--veil-sheet);
    transition: opacity 0.28s ease-out;
    animation: veil-in 0.26s ease-out backwards;

    &.dragging {
      transition: none;
    }
  }

  .sheet {
    position: absolute;
    inset: auto 0 0;
    max-height: 82%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding-bottom: var(--safe-bottom);
    border-radius: 22px 22px 0 0;
    background: var(--surface-1);
    box-shadow: var(--shadow-sheet);
    color: var(--ink);
    outline: none;
    transition: transform 0.28s var(--ease-out);
    animation: sheet-in 0.32s var(--ease-out) backwards;

    &.dragging {
      transition: none;
    }

    // on the keyboard, which covers the safe area under it
    &.lifted {
      padding-bottom: 0;
    }
  }

  .grab {
    flex: none;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }

  .handle-row {
    display: flex;
    justify-content: center;
    padding-top: 8px;
  }

  .handle {
    width: 48px;
    height: 4px;
    border-radius: 2px;
    background: var(--overlay-3);
  }

  .title-row {
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 8px 0 20px;
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) text-size(14px) / 1.25 var(--font-sans);
    color: var(--ink-3);
    @include truncate;
  }

  .action {
    flex: none;
    height: var(--touch-target);
    padding: 0 12px;
    border: 0;
    background: none;
    font: var(--weight-semibold) var(--text-lg) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  @keyframes sheet-in {
    from {
      transform: translateY(100%);
    }
  }

  @keyframes veil-in {
    from {
      opacity: 0;
    }
  }

  @include reduced-motion {
    .veil,
    .sheet {
      transition: none;
      animation: none;
    }
  }
</style>
