import type { Attachment } from "svelte/attachments";
import type { Box, WindowSize } from "./bottomPlacement";

// What the app's toasts and the achievement toast place themselves by (bottomPlacement): the
// middle panel (Shell), its composer (a chat's own, MessageArea; a thread's, in the right column,
// isn't one) and the app's toast layer while a toast shows (shell/Toasts). Each element says it's
// there with an attachment, and is forgotten when it goes, unless another has taken its place (a
// chat opened as the last one goes).

export type BottomAnchor = "middle" | "composer" | "toasts";

const anchors = $state<Record<BottomAnchor, HTMLElement | undefined>>({
    middle: undefined,
    composer: undefined,
    toasts: undefined,
});

/** The element for `name`, if one is there; reactive. */
export function bottomAnchor(name: BottomAnchor): HTMLElement | undefined {
    return anchors[name];
}

/** Marks an element as the anchor `name` while it's there (`{@attach bottomAnchorFor(name)}`). */
export function bottomAnchorFor(name: BottomAnchor): Attachment<HTMLElement> {
    return (el) => {
        anchors[name] = el;
        return () => {
            if (anchors[name] === el) anchors[name] = undefined;
        };
    };
}

/** The element's box on the window, if there's an element. */
export function boxOf(el: HTMLElement | undefined): Box | undefined {
    return el?.getBoundingClientRect();
}

/** The popups a composer has open above it (the library's `data-composer-popup`). */
export function composerPopups(composer: HTMLElement | undefined): Box[] {
    if (composer === undefined) return [];
    return [...composer.querySelectorAll<HTMLElement>("[data-composer-popup]")].map((p) =>
        p.getBoundingClientRect(),
    );
}

/** The window's size and its bottom safe area (`--safe-bottom`, a home indicator's). */
export function windowSize(): WindowSize {
    const probe = document.createElement("div");
    probe.style.cssText =
        "position: fixed; visibility: hidden; padding-block-end: var(--safe-bottom, 0px)";
    document.body.append(probe);
    const safeBottom = parseFloat(getComputedStyle(probe).paddingBlockEnd) || 0;
    probe.remove();
    return { width: window.innerWidth, height: window.innerHeight, safeBottom };
}

/**
 * Calls `measure` once a frame at most, from the next frame on, and again whenever any of `els`
 * changes size, the window does, something holding them scrolls (Shell's frame, on a window
 * smaller than the shell), or `composer` opens or closes a popup; returns what stops it. A scroll
 * inside them (the messages) doesn't move them, so it doesn't measure.
 */
export function watchBoxes(
    els: (HTMLElement | undefined)[],
    composer: HTMLElement | undefined,
    measure: () => void,
): () => void {
    const present = els.filter((el): el is HTMLElement => el !== undefined);
    let frame: number | undefined;
    // a ResizeObserver calls back for each element as it starts, so the first measure is one
    const schedule = () => {
        if (frame === undefined) {
            frame = requestAnimationFrame(() => {
                frame = undefined;
                measure();
            });
        }
    };
    schedule();
    const resizes = new ResizeObserver(schedule);
    for (const el of present) resizes.observe(el);
    // a popup coming or going (it's laid over the composer, so the composer doesn't resize)
    const popups = new MutationObserver(schedule);
    if (composer !== undefined) popups.observe(composer, { childList: true, subtree: true });
    const scrolled = (e: Event) => {
        const target = e.target === document ? document.documentElement : e.target;
        if (target instanceof Node && present.some((el) => target !== el && target.contains(el))) {
            schedule();
        }
    };
    // the window's size counts on its own: it bounds the spot, and with no middle panel it's the spot
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", scrolled, { capture: true, passive: true });
    return () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        resizes.disconnect();
        popups.disconnect();
        window.removeEventListener("resize", schedule);
        window.removeEventListener("scroll", scrolled, { capture: true });
    };
}
