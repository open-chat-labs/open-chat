// The soft keyboard over a native screen. With the WebView's viewport resize off (the keyboard
// covers the bottom of the screen, so a pinned button stays down rather than riding up on it), the
// page doesn't shrink: a scroller has to make room for the keyboard itself and bring the field
// being typed in above it. These work out how; `aboveKeyboard` (aboveKeyboard.svelte.ts) applies
// them.

/** The space kept between a field and the keyboard (or the scroller's top). */
export const FIELD_MARGIN = 16;

/**
 * How much of a scroller the keyboard covers: from the keyboard's top (the window's height less
 * the keyboard's) to the scroller's bottom. None while the keyboard is down, or while the viewport
 * resizes, when the page has already shrunk above it.
 */
export function keyboardOverlap(
    scrollerBottom: number,
    windowHeight: number,
    keyboardHeight: number,
    viewportResizes: boolean,
): number {
    if (keyboardHeight <= 0 || viewportResizes) return 0;
    return Math.max(0, Math.round(scrollerBottom - (windowHeight - keyboardHeight)));
}

/**
 * How far to scroll (down is positive) so a field shows within what's left of the scroller above
 * the keyboard, `margin` clear of its edges: none when it already does. A field taller than that
 * space shows from its top.
 */
export function scrollToShow(
    field: { top: number; bottom: number },
    visible: { top: number; bottom: number },
    margin: number = FIELD_MARGIN,
): number {
    const top = visible.top + margin;
    const bottom = visible.bottom - margin;
    if (field.top < top) return field.top - top;
    if (field.bottom > bottom) return Math.min(field.bottom - bottom, field.top - top);
    return 0;
}

/** Whether an element takes typing: a text field, a text area or editable content. */
export function takesTyping(el: EventTarget | null): el is HTMLElement {
    if (!(el instanceof HTMLElement)) return false;
    if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
    return (
        el instanceof HTMLInputElement &&
        ![
            "button",
            "checkbox",
            "color",
            "file",
            "hidden",
            "image",
            "radio",
            "range",
            "reset",
            "submit",
        ].includes(el.type)
    );
}
