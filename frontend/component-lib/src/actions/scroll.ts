// this is an action that can be added to any element to raise a custom event when the element crosses scroll thresholds in either direction
// One application of this action is to easily add infinite scroll behaviour to a Container component

const THRESHOLD = 400;

export function scrollLimits(
    node: HTMLElement,
    config: { threshold?: number, onStart?: (fromStart: number) => void; onEnd?: (fromEnd: number) => void },
) {
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

    function onScroll() {
        if (insideStartThreshold()) {
            config.onStart?.(fromStart());
        }
        if (insideEndThreshold()) {
            config.onEnd?.(fromEnd());
        }
    }
    node.addEventListener("scroll", onScroll);
    return {
        destroy() {
            node.removeEventListener("scroll", onScroll);
        },
    };
}
