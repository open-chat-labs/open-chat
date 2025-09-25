import type { Action, ActionReturn } from "svelte/action";

export function clamp(min: number, max: number, val: number): number {
    return Math.min(max, Math.max(min, val));
}

export const swipe: Action<HTMLElement, { threshold: number }> = (
    node,
    param: { threshold: number } = { threshold: 20 },
): ActionReturn<{ threshold: number }> => {
    let start = 0;
    let end = 0;
    let swiping = false;

    function handleGesture() {
        if (end < start && start - end > param.threshold) {
            node.dispatchEvent(new CustomEvent("leftswipe"));
        }

        if (end > start && end - start > param.threshold) {
            node.dispatchEvent(new CustomEvent("rightswipe"));
        }
    }

    function touchMove(e: TouchEvent) {
        if (!swiping) return;

        const diffx = start - e.changedTouches[0].screenX;
        node.dispatchEvent(
            new CustomEvent<{ diffx: number }>("swiping", {
                bubbles: true,
                cancelable: true,
                detail: { diffx },
            }),
        );
    }

    function touchStart(e: TouchEvent) {
        start = e.changedTouches[0].screenX;
        swiping = true;
    }

    function touchEnd(e: TouchEvent) {
        end = e.changedTouches[0].screenX;
        swiping = false;
        handleGesture();
    }

    const options: AddEventListenerOptions = {
        capture: true,
        passive: true,
    };

    node.addEventListener("touchstart", touchStart, options);
    node.addEventListener("touchend", touchEnd, options);
    node.addEventListener("touchmove", touchMove, options);

    return {
        destroy() {
            node.removeEventListener("touchstart", touchStart, true);
            node.removeEventListener("touchend", touchEnd, true);
            node.removeEventListener("touchmove", touchMove, true);
        },
    };
};
