// this is an action that can be added to any element to raise a custom event when the element crosses scroll thresholds in either direction
// One application of this action is to easily add infinite scroll behaviour to a Container component

const THRESHOLD = 300;

export function scrollLimits(
    node: HTMLElement,
    config: {
        threshold?: number;
        onStart?: (fromStart: number) => void;
        onEnd?: (fromEnd: number) => void;
    },
) {
    let rafId: number | undefined;

    function fromEnd(): number {
        return node.scrollHeight - node.clientHeight - fromStart();
    }

    function fromStart(): number {
        return node.scrollTop;
    }

    const insideEndThreshold = () => {
        return fromEnd() < (config.threshold ?? THRESHOLD);
    };

    const insideStartThreshold = () => {
        return fromStart() < (config.threshold ?? THRESHOLD);
    };

    function check() {
        rafId = undefined;
        if (config.onStart && insideStartThreshold()) {
            config.onStart(fromStart());
        }
        if (config.onEnd && insideEndThreshold()) {
            config.onEnd(fromEnd());
        }
    }

    // Coalesce scroll events to one layout read per frame
    function onScroll() {
        if (rafId === undefined) {
            rafId = requestAnimationFrame(check);
        }
    }

    if (config.onEnd || config.onStart) {
        node.addEventListener("scroll", onScroll, { passive: true });
        return {
            destroy() {
                node.removeEventListener("scroll", onScroll);
                if (rafId !== undefined) {
                    cancelAnimationFrame(rafId);
                }
            },
        };
    }
}
