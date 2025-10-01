// this is an action that can be added to any element to raise a custom event when the element crosses scroll thresholds in either direction
// One application of this action is to easily add infinite scroll behaviour to a Container component

const THRESHOLD = 400;

export function scrollLimits(
    node: HTMLElement,
    config: { onStart?: (fromStart: number) => void; onEnd?: (fromEnd: number) => void },
) {
    function fromEnd(): number {
        return -node.scrollTop;
    }

    function fromStart(): number {
        return node.scrollHeight - node.clientHeight - fromEnd();
    }

    const insideEndThreshold = () => {
        return fromEnd() < THRESHOLD;
    };

    const insideStartThreshold = () => {
        return fromStart() < THRESHOLD;
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
