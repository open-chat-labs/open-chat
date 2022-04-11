import type { Action, ActionReturn } from "svelte/action";

export const swipe: Action<HTMLElement, { threshold: number }> = (
    node,
    param = { threshold: 20 }
): ActionReturn => {
    let touchstartX = 0;
    let touchendX = 0;
    let swiping = false;
    let diffx = 0;

    function handleGesture() {
        if (touchendX < touchstartX && touchstartX - touchendX > param.threshold) {
            node.dispatchEvent(new CustomEvent("leftswipe"));
        }

        if (touchendX > touchstartX && touchendX - touchstartX > param.threshold) {
            node.dispatchEvent(new CustomEvent("rightswipe"));
        }
    }

    function touchMove(e: TouchEvent) {
        if (!swiping) return;

        diffx = touchstartX - e.changedTouches[0].screenX;
        node.dispatchEvent(
            new CustomEvent<{ diffx: number }>("swiping", {
                bubbles: true,
                cancelable: true,
                detail: { diffx },
            })
        );
    }

    function touchStart(e: TouchEvent) {
        touchstartX = e.changedTouches[0].screenX;
        swiping = true;
    }

    function touchEnd(e: TouchEvent) {
        touchendX = e.changedTouches[0].screenX;
        swiping = false;
        handleGesture();
    }

    node.addEventListener("touchstart", touchStart, true);
    node.addEventListener("touchend", touchEnd, true);
    node.addEventListener("touchmove", touchMove, true);

    return {
        destroy() {
            node.removeEventListener("touchstart", touchStart, true);
            node.removeEventListener("touchend", touchEnd, true);
            node.removeEventListener("touchmove", touchMove, true);
        },
    };
};
