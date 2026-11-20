// A deleted message's placeholder (ChatBubble) is a button whose popover says who deleted it and when. It opens on
// hover after a delay (a pointer that hovers), on keyboard focus and on a tap or click; it closes as the pointer
// leaves, the focus goes, on Esc, a second tap, or a press anywhere else. A long-press (the host's message menu,
// where it has one) neither opens nor closes it.

/** How long a hovering pointer rests on the placeholder before its popover opens (the app-wide tooltip's delay). */
export const DELETED_POPOVER_DELAY_MS = 400;

/** How long a press lasts before it's a long-press (MessageGroup opens a message's menu at 500ms). */
export const LONG_PRESS_MS = 500;

/** The popover's gap from the placeholder. */
export const DELETED_POPOVER_GAP = 8;

export type DeletedPopoverEvent =
  | { kind: 'hover' } // a hovering pointer rested for DELETED_POPOVER_DELAY_MS
  | { kind: 'leave' }
  | { kind: 'focus'; keyboard: boolean }
  | { kind: 'blur' }
  | { kind: 'escape' }
  | { kind: 'outside' } // a press elsewhere
  /** A click: `pointer` is the press that made it ('keyboard' for Enter / Space), `heldMs` how long it was held. */
  | { kind: 'click'; pointer: 'mouse' | 'touch' | 'pen' | 'keyboard'; heldMs: number };

/** Whether the popover is open after `event`, open or not before it. */
export function deletedPopoverOpen(open: boolean, event: DeletedPopoverEvent): boolean {
  switch (event.kind) {
    case 'hover':
      return true;
    case 'focus':
      // a click focuses the button too (some browsers): only the keyboard's focus opens it
      return event.keyboard ? true : open;
    case 'leave':
    case 'blur':
    case 'escape':
    case 'outside':
      return false;
    case 'click':
      if (event.pointer !== 'keyboard' && event.heldMs >= LONG_PRESS_MS) return open;
      // a mouse has already hovered it open (or is about to): a click keeps it open rather than closing it
      if (event.pointer === 'mouse') return true;
      return !open;
  }
}

/**
 * Whether the popover goes under the placeholder: only when, above it, it wouldn't fit inside what shows the
 * conversation (`boundTop`, the top of the scroller or the viewport).
 */
export function deletedPopoverBelow(anchorTop: number, popoverHeight: number, boundTop: number): boolean {
  return anchorTop - DELETED_POPOVER_GAP - popoverHeight < boundTop;
}

/**
 * Whether a pointer entering the placeholder is hovering in, so its rest opens the popover and its leaving closes it:
 * a mouse, or a pen above the screen (no buttons). A touch, and a pen that enters as it touches (one that can't hover:
 * its enter and leave come with the tap), are taps, which toggle it with their click.
 */
export function hoversIn(pointerType: string, buttons: number): boolean {
  if (pointerType === 'mouse') return true;
  return pointerType === 'pen' && buttons === 0;
}
