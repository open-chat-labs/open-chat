import Panzoom from "@panzoom/panzoom";

// Pan and zoom for a full-screen image (Panzoom), as the mobile viewer has it: pinch or wheel zoom
// toward the pointer, up to 5x; at 1x a short image sits back in the middle, and a zoomed one
// snaps back to the nearest edge when it's dragged past it. Used by every tree's image viewer.

export type ImageZoom = {
    /** Zoom in (2.5x) or, when already zoomed, back to 1x: a double tap or click. */
    toggle(): void;
    /** An image shorter than the screen only pans once zoomed. */
    panOnlyWhenZoomed(): void;
    destroy(): void;
};

const DEFAULT_SCALE = 1;
const SCALE_EPSILON = 0.02;
// the wheel zooms by its delta: a trackpad pinch sends many small deltas, a mouse notch one big
// one (capped, so a notch is about Panzoom's own step)
const WHEEL_SPEED = 0.01;
const MAX_WHEEL_DELTA = 10;
const LINE_HEIGHT = 16;

/** `size` is the image's rendered size. */
export function zoomImage(
    container: HTMLElement,
    size: () => { width: number; height: number },
): ImageZoom {
    const panzoom = Panzoom(container, {
        minScale: 1,
        maxScale: 5,
        animate: true,
        duration: 200,
        easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        zoomOnPointer: true, // zoom toward cursor/fingers
        touchAction: "none",
        pinchAndPan: true,
        smooth: true,
    });

    // Finds the closest edge to snap to, if there is space on any side of the image we're
    // panning / zooming
    function snapToClosestEdge(scale: number) {
        const rect = container.getBoundingClientRect();

        const spaceLeft = rect.x;
        const spaceRight = size().width - rect.x - rect.width;

        const spaceTop = rect.y;
        const spaceBottom = window.innerHeight - rect.y - rect.height;

        let snapXBy = 0;
        let snapYBy = 0;

        // Snap to left
        if (spaceLeft > 0 && spaceRight < 0) {
            snapXBy = -spaceLeft;
        }
        // Snap to right
        else if (spaceLeft < 0 && spaceRight > 0) {
            snapXBy = spaceRight;
        }

        // Snap to top or bottom depending on how much the image is panned outside the viewport,
        // compared to how much space there is to the edge on the opposite side
        if (spaceTop > 0 && spaceBottom < 0) {
            snapYBy = spaceTop > Math.abs(spaceBottom) ? spaceBottom : -spaceTop;
        }
        // Snap to bottom
        else if (spaceTop < 0 && spaceBottom > 0) {
            snapYBy = Math.abs(spaceTop) < spaceBottom ? Math.abs(spaceTop) : spaceBottom;
        }

        if (snapXBy || snapYBy) {
            panzoom.pan(snapXBy / scale, snapYBy / scale, { animate: true, relative: true });
        }
    }

    const onPanzoomEnd = () => {
        const currentScale = panzoom.getScale();
        if (currentScale <= DEFAULT_SCALE + SCALE_EPSILON && size().height <= window.innerHeight) {
            panzoom.reset({ animate: true });
        } else {
            snapToClosestEdge(currentScale);
        }
    };
    container.addEventListener("panzoomend", onPanzoomEnd);
    // Panzoom handles touch pinch itself; the wheel (and a trackpad pinch) is handled here.
    // Panzoom's zoomWithWheel zooms a fixed step per event, far too fast for a trackpad, and its
    // focal point assumes the image sits at its parent's top left, so a centred image drifts.
    // The pointer is moved by the image's offset in its parent to make up for that.
    const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const raw = e.deltaY === 0 ? e.deltaX : e.deltaY;
        const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? raw * LINE_HEIGHT : raw;
        const capped = Math.max(-MAX_WHEEL_DELTA, Math.min(MAX_WHEEL_DELTA, delta));
        const toScale = panzoom.getScale() * Math.exp(-capped * WHEEL_SPEED);
        if (toScale <= DEFAULT_SCALE + SCALE_EPSILON) {
            panzoom.reset({ animate: false });
            return;
        }
        panzoom.zoomToPoint(toScale, {
            clientX: e.clientX - container.offsetLeft,
            clientY: e.clientY - container.offsetTop,
        });
    };
    const wheelTarget = container.parentElement;
    wheelTarget?.addEventListener("wheel", onWheel, { passive: false });

    return {
        toggle() {
            if (panzoom.getScale() <= DEFAULT_SCALE + SCALE_EPSILON) {
                panzoom.zoom(2.5, { animate: true });
            } else {
                panzoom.reset({ animate: true });
            }
        },
        panOnlyWhenZoomed() {
            panzoom.setOptions({ panOnlyWhenZoomed: true });
        },
        destroy() {
            container.removeEventListener("panzoomend", onPanzoomEnd);
            wheelTarget?.removeEventListener("wheel", onWheel);
            panzoom.destroy();
        },
    };
}
