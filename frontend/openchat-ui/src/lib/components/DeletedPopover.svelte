<!-- A deleted message's "who deleted it and when", by hand (2026-11-19, a mark from 2026-11-20): what it wraps (`children`)
     is a button whose popover (the Tooltip's inverted style) says `deletedBy` ("Deleted by Alice", the host's words) over
     `deletedAt` ("Today at 14:32"), linked by aria-describedby. It opens on hover after 400ms (a mouse, or a pen that
     hovers), keyboard focus or a tap, and closes on leave, blur, Esc, a second tap, a press elsewhere, or when the
     info goes (lib/deletedPopover). While it's open its root carries `data-oc-popover-open`, which brings MessageGroup's
     group forward over its neighbours. Without `deletedBy` or `deletedAt` the content shows plain, with no button.
     `variant`:
     - `placeholder`: a deleted message's placeholder (ChatBubble), the whole bubble; the popover 8px above it at its
       start edge (its end edge `mirror`ed), under it where it wouldn't fit above inside its scroller.
     - `mark`: a revealed deleted message's bin, in its ticks' place (ChatBubble, MediaMessage), `label` its accessible
       name; the popover 8px above it, its end edge at the bin's, placed on the page (`position: fixed`), so a bubble
       that clips its media doesn't clip it, and closed as the page scrolls. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useT } from '../i18n';
  import Tooltip from './Tooltip.svelte';
  import { DELETED_POPOVER_DELAY_MS, DELETED_POPOVER_GAP, deletedPopoverBelow, deletedPopoverOpen, hoversIn, type DeletedPopoverEvent } from '../deletedPopover';

  interface Props {
    variant: 'placeholder' | 'mark';
    /** Who deleted it, the popover's first line as the host words it ("Deleted by Alice"). */
    deletedBy?: string;
    /** When it was deleted ("Today at 14:32"), the popover's second line. */
    deletedAt?: string;
    mirror?: boolean;
    /** Resource key (or literal text): the mark's accessible name. */
    label?: string;
    children: Snippet;
  }

  let { variant, deletedBy = '', deletedAt = '', mirror = false, label = '', children }: Props = $props();
  const t = useT();

  const popoverId = $props.id();
  const hasInfo = $derived(deletedBy !== '' || deletedAt !== '');
  let open = $state(false);
  let below = $state(false);
  // the mark's popover, placed on the page
  let fixed = $state<{ top: number; right: number }>();
  let trigger = $state<HTMLButtonElement>();
  let popover = $state<HTMLDivElement>();
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let press: { pointer: 'mouse' | 'touch' | 'pen'; at: number } | undefined;
  // a pointer that hovered in (a mouse, a pen above the screen), whose leaving closes the popover; a tap's enter and
  // leave (a touch, a pen that only touches) don't count
  let hovering = false;

  // the info gone (revealed, undeleted, hidden), the popover is closed, so it doesn't come back open
  $effect.pre(() => {
    if (!hasInfo && open) {
      clearTimeout(hoverTimer);
      hovering = false;
      open = false;
    }
  });

  function popoverEvent(event: DeletedPopoverEvent) {
    if (event.kind !== 'hover') clearTimeout(hoverTimer);
    const next = deletedPopoverOpen(open, event);
    if (next && !open) place();
    open = next;
  }

  // the top of what shows the conversation: the nearest scroller's, else the page's
  function boundTop(el: HTMLElement): number {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const overflow = getComputedStyle(p).overflowY;
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') return Math.max(0, p.getBoundingClientRect().top);
    }
    return 0;
  }

  // above the trigger, under it only where above it would leave what shows the conversation
  function place() {
    if (!trigger || !popover) return;
    const r = trigger.getBoundingClientRect();
    const height = popover.offsetHeight;
    below = deletedPopoverBelow(r.top, height, boundTop(trigger));
    if (variant === 'mark') {
      fixed = {
        top: below ? r.bottom + DELETED_POPOVER_GAP : r.top - DELETED_POPOVER_GAP - height,
        right: Math.max(8, window.innerWidth - r.right),
      };
    }
  }

  function pointerEnter(e: PointerEvent) {
    if (!hoversIn(e.pointerType, e.buttons)) return;
    hovering = true;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => popoverEvent({ kind: 'hover' }), DELETED_POPOVER_DELAY_MS);
  }

  function pointerLeave() {
    if (!hovering) return;
    hovering = false;
    popoverEvent({ kind: 'leave' });
  }

  function click(e: MouseEvent) {
    // the mark sits in a message whose own click (a media tile's) isn't this one's
    e.stopPropagation();
    // a click from Enter / Space has no press before it (detail 0)
    const pressed = press;
    press = undefined;
    if (e.detail === 0 || !pressed) popoverEvent({ kind: 'click', pointer: 'keyboard', heldMs: 0 });
    else popoverEvent({ kind: 'click', pointer: pressed.pointer, heldMs: Date.now() - pressed.at });
  }

  // a press anywhere else closes it, and so does Esc wherever the focus is (a hover opened it); the mark's, placed on
  // the page, closes as the page scrolls under it
  $effect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (trigger && !trigger.contains(e.target as Node)) popoverEvent({ kind: 'outside' });
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') popoverEvent({ kind: 'escape' });
    };
    const scrolled = () => popoverEvent({ kind: 'outside' });
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    if (variant === 'mark') document.addEventListener('scroll', scrolled, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('scroll', scrolled, true);
    };
  });

  $effect(() => () => clearTimeout(hoverTimer));
</script>

{#if hasInfo}
  <span class="anchor {variant}" data-oc-popover-open={open ? '' : undefined}>
    <button
      bind:this={trigger}
      type="button"
      class="trigger {variant}"
      class:mirror
      aria-label={variant === 'mark' && label ? t(label) : undefined}
      aria-describedby={popoverId}
      onpointerenter={pointerEnter}
      onpointerleave={pointerLeave}
      onpointerdown={(e) => (press = { pointer: e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse', at: Date.now() })}
      onclick={click}
      onfocus={(e) => popoverEvent({ kind: 'focus', keyboard: e.currentTarget.matches(':focus-visible') })}
      onblur={() => popoverEvent({ kind: 'blur' })}
      onkeydown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          popoverEvent({ kind: 'escape' });
        }
      }}
    >
      {@render children()}
    </button>
    <div
      class="popover {variant}"
      class:mirror
      class:below
      class:open
      bind:this={popover}
      style:top={variant === 'mark' && fixed ? `${fixed.top}px` : undefined}
      style:right={variant === 'mark' && fixed ? `${fixed.right}px` : undefined}
    >
      <Tooltip id={popoverId} label={deletedBy} detail={deletedAt} />
    </div>
  </span>
{:else}
  <span class="plain {variant}" class:mirror>{@render children()}</span>
{/if}

<style lang="scss">
  /* a deleted message's placeholder: the bubble's shape whoever sent it, as every bubble on the web (all on the
     inline-start side), its grouped corner on the inline-end side mirrored (your own on mobile and native) */
  .anchor.placeholder {
    position: relative;
    max-width: 675px;
    min-width: 0;
    display: flex;
  }

  .anchor.mark {
    display: inline-flex;
  }

  .trigger.placeholder,
  .plain.placeholder {
    max-width: 675px;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-12) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    border-start-start-radius: var(--radius-xs);
    box-shadow: inset 0 0 0 1px var(--line-2);

    &.mirror {
      border-start-start-radius: var(--radius-xl);
      border-start-end-radius: var(--radius-xs);
    }
  }

  .plain.mark {
    display: inline-flex;
  }

  /* a button's behaviour with the look it wraps */
  .trigger {
    margin: 0;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: default;
    -webkit-tap-highlight-color: transparent;

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .trigger.mark {
    display: inline-flex;
    align-items: center;
    padding: 0;
    border-radius: 3px;
  }

  /* the Tooltip's inverted label; kept in the page while hidden, so aria-describedby always finds it */
  .popover {
    z-index: 20;
    width: max-content;
    max-width: 240px;
    pointer-events: none;
    visibility: hidden;
    opacity: 0;
    transform: translateY(2px);
    transition:
      opacity 120ms ease,
      transform 120ms ease,
      visibility 0s linear 120ms;

    &.below {
      transform: translateY(-2px);
    }

    &.open {
      visibility: visible;
      opacity: 1;
      transform: none;
      transition:
        opacity 120ms ease,
        transform 120ms ease;
    }

    :global(.tooltip) {
      align-items: flex-start;
    }
  }

  /* 8px above the placeholder at its start edge (its end edge mirrored), under it where it wouldn't fit above */
  .popover.placeholder {
    position: absolute;
    bottom: calc(100% + 8px);
    inset-inline-start: 0;

    &.mirror {
      inset-inline-start: auto;
      inset-inline-end: 0;
    }

    &.below {
      bottom: auto;
      top: calc(100% + 8px);
    }
  }

  /* on the page, placed from script (its end edge at the bin's), so a bubble that clips its media doesn't clip it */
  .popover.mark {
    position: fixed;
    top: 0;
    right: 0;
    text-align: start;
    font: var(--weight-regular) var(--text-base) / 1.4 var(--font-sans);
  }
</style>
