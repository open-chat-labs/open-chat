import { Spring } from "svelte/motion";
import { isTouchDevice } from "component-lib";

export type PanDirection = "left" | "right";

// TODO perhaps we disallow right/left movement via props? Not a feature at the moment.
export type PanProps = {
    oncommit?: (dir: PanDirection) => void;
    onmove?: (dir: PanDirection, factor: number) => void;
    threshold?: number; // Threshold in pixels to consider it a "swipe commit"
    stiffness?: number;
    damping?: number;
    precision?: number;
    isScrolling?: boolean;
};

const PAN_VERT_DELTA_DIFF = 50;
const PAN_ACTIVATION_THRESHOOLD = 30; // Pan does not start immediatelly, but after a certain threshold
const PAN_HANDLER_THRESHOLD_FACTOR = 0.8; // Handler will be called if at least % of the threshold is reached

export function panWithSpring(node: HTMLElement, props?: PanProps) {
    // Do not init if no props were given...
    if (!props) return;

    // Props, including spring params – tune these for the feel you want
    let {
        oncommit,
        onmove,
        threshold = 100,
        stiffness = 0.3,
        damping = 0.95,
        precision = 0.95,
        isScrolling = false,
    } = props;

    const spring = new Spring(0, { stiffness, damping, precision });

    let started = false;
    let panning = false;
    let activeX: number | undefined;
    let startX: number | undefined;
    let startY: number | undefined;
    let currentDx: number | undefined;

    // Indicate that transform will be change...
    node.style.willChange = "transform";

    const effectCleanup = $effect.root(() => {
        $effect(() => {
            // TODO preserve original translateX
            node.style.transform = `translateX(${spring.current}px)`;

            // To have access to current spring factor, we call the move handler
            // at this point...
            onmove?.(getDirection(), getThresholdFactor());
        });
    });

    function actionStart(e: TouchEvent) {
        if (started || isScrolling) return;

        started = true;

        // The point at which we're expecting the pan to happen. Remember the
        // starting x point, and once a threshold is passed, we consider panning
        // as active.
        activeX = e.touches[0].clientX;

        // Capturing the Y location here does not affect the translation of
        // the node, while allowing us to have an earlier starting point,
        // compared to X location, which is due to delay ignored.
        startY = e.touches[0].clientY;

        // Update spring!
        spring.set(0, { hard: true });
    }

    function actionMove(e: TouchEvent) {
        if (!started || isScrolling) return;

        // Current pointer x position...
        const currentX = e.touches[0].clientX;

        if (!panning) {
            if (activeX) {
                const activationDelta = Math.abs(currentX - activeX);

                // Check if we can activate panning...
                if (activationDelta > PAN_ACTIVATION_THRESHOOLD) {
                    panning = true;
                    startX = currentX;
                }
            }
        } else {
            // How much the pointer has moved horizontally!
            currentDx = currentX - (startX ?? 0);

            // If vertical movement passes a certain threshold compared to horizontal, cancel pan!
            // TODO should we also check this before panning starts?
            if (isVerticalMovementAboveThreshold(currentDx, e.touches[0].clientY, startY)) {
                actionEnd();
                return;
            }

            // Otherwise set new delta X, up to movement threshold
            if (Math.abs(currentDx) < threshold) {
                spring.set(currentDx, { hard: true });
            }
        }
    }

    function actionEnd() {
        if (!started) return;

        if (isThresholdReached()) {
            // Depending on the direction, we may fire different actions...
            oncommit?.(getDirection());
        }

        // Reset vars
        started = false;
        panning = false;
        startX = undefined;
        startY = undefined;
        currentDx = undefined;

        // Always return to start position
        spring.set(0, { hard: true });
    }

    // Figure out by how much we've moved vertically, relative to horizontal movement.
    function isVerticalMovementAboveThreshold(
        dx: number,
        currentY: number,
        previousY?: number,
    ): boolean {
        const dy = currentY - (previousY ?? 0);
        const delta = Math.abs(dy) - Math.abs(dx);

        // If vertical movement passes a certain threshold compared to
        // horizontal, cancel pan!
        return delta > PAN_VERT_DELTA_DIFF;
    }

    function isThresholdReached(): boolean {
        const adjustedThreshold = threshold * PAN_HANDLER_THRESHOLD_FACTOR;
        return Math.abs(spring.current) > adjustedThreshold;
    }

    function getThresholdFactor(): number {
        return Math.min(Math.abs(spring.current / (threshold * PAN_HANDLER_THRESHOLD_FACTOR)), 1);
    }

    function getDirection(): PanDirection {
        return (spring.current ?? 0) < 0 ? "left" : "right";
    }

    function onContextMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
    }

    if (isTouchDevice) {
        node.addEventListener("touchend", actionEnd);
        node.addEventListener("touchcancel", actionEnd);
        node.addEventListener("touchleave", actionEnd);
        node.addEventListener("touchmove", actionMove, { passive: true });
        node.addEventListener("touchstart", actionStart, { passive: true });
        node.addEventListener("contextmenu", onContextMenu);
    }

    return {
        // Args will be updated whenever they change!
        update(props: PanProps) {
            isScrolling = props.isScrolling ?? false;
            threshold = props.threshold ?? 100;
        },
        destroy() {
            // Cleanup and resets...
            node.style.willChange = "auto";

            effectCleanup();

            if (isTouchDevice) {
                node.removeEventListener("touchend", actionEnd);
                node.removeEventListener("touchcancel", actionEnd);
                node.removeEventListener("touchleave", actionEnd);
                node.removeEventListener("touchmove", actionMove);
                node.removeEventListener("touchstart", actionStart);
                node.removeEventListener("contextmenu", onContextMenu);
            }
        },
    };
}
