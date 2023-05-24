/**
 * This is used to calculate the position of thing A according to the required
 * alignment to thing B.
 *
 * It is used for both tooltips and menus
 */
import { get } from "svelte/store";
import { rtlStore } from "../stores/rtl";

export type Position = "top" | "right" | "bottom" | "left";
export type Alignment = "start" | "center" | "end";
export type Dimensions = {
    x: number;
    y: number;
    w: number;
    h: number;
};

const CHEVRON_OFFSET = 16; // half width + offset (4 + 12)

function center({ left, top, height, width }: DOMRect): { x: number; y: number } {
    return {
        x: left + width / 2,
        y: top + height / 2,
    };
}

export function derivePosition(
    triggerRect: DOMRect,
    elementRect: DOMRect,
    position: Position,
    align: Alignment,
    gutter: number
): Dimensions {
    const triggerCenter = center(triggerRect);
    const [flippedPosition, flippedAlign] = rtlCheck([position, align]);
    const dim = { w: elementRect.width, h: elementRect.height, position, align };
    switch (flippedPosition) {
        case "right":
            return {
                ...dim,
                x: triggerRect.x + triggerRect.width + gutter,
                y: verticalPosition(triggerCenter, elementRect, flippedAlign),
            };
        case "left":
            return {
                ...dim,
                x: triggerRect.x - elementRect.width - gutter,
                y: verticalPosition(triggerCenter, elementRect, flippedAlign),
            };
        case "top":
            return {
                ...dim,
                x: horizontalPosition(triggerCenter, elementRect, flippedAlign),
                y: triggerRect.y - elementRect.height - gutter,
            };
        case "bottom":
            return {
                ...dim,
                x: horizontalPosition(triggerCenter, elementRect, flippedAlign),
                y: triggerRect.y + triggerRect.height + gutter,
            };
    }
}

function horizontalPosition(
    triggerCenter: { x: number; y: number },
    elementRect: DOMRect,
    align: Alignment
): number {
    switch (align) {
        case "center":
            return triggerCenter.x - elementRect.width / 2;
        case "start":
            return triggerCenter.x - CHEVRON_OFFSET;
        case "end":
            return triggerCenter.x - elementRect.width + CHEVRON_OFFSET;
    }
}

function verticalPosition(
    triggerCenter: { x: number; y: number },
    elementRect: DOMRect,
    align: Alignment
): number {
    switch (align) {
        case "center":
            return triggerCenter.y - elementRect.height / 2;
        case "start":
            return triggerCenter.y - CHEVRON_OFFSET;
        case "end":
            return triggerCenter.y - elementRect.height + CHEVRON_OFFSET;
    }
}

// invert either position or alignment if we are in rtl mode
function rtlCheck([position, align]: [Position, Alignment]): [Position, Alignment] {
    const rtl = get(rtlStore);
    const vertical = position === "top" || position === "bottom";
    if (position === "right" && rtl) return ["left", align];
    if (position === "left" && rtl) return ["right", align];

    // if we're vertically positioned we might need to flip the alignment
    if (vertical && align === "start" && rtl) return [position, "end"];
    if (vertical && align === "end" && rtl) return ["right", "start"];
    return [position, align];
}

function viewportDimensions(): { w: number; h: number } {
    return {
        w: window.innerWidth || document.documentElement.clientWidth,
        h: window.innerHeight || document.documentElement.clientHeight,
    };
}

// Once the coordinates have been figured out we need to check whether the element
// overflows the bounds of the screen. It it does we need make adjustments
export function boundsCheck(trigger: DOMRect, dim: Dimensions): Dimensions {
    const viewport = viewportDimensions();
    const right = dim.x + dim.w;
    const left = dim.x;
    const top = dim.y;
    const bottom = dim.y + dim.h;
    const topOverflow = top < 0;
    const bottomOverflow = bottom > viewport.h;
    const leftOverflow = left < 0;
    const rightOverflow = right > viewport.w;
    const offsetH = trigger.height / 2;
    const offsetW = trigger.width / 2;

    if (topOverflow) {
        return {
            ...dim,
            y: dim.y + dim.h - offsetH,
        };
    }

    if (bottomOverflow) {
        return {
            ...dim,
            y: dim.y - dim.h + offsetH,
        };
    }

    if (rightOverflow) {
        return {
            ...dim,
            x: dim.x - dim.w + offsetW,
        };
    }

    if (leftOverflow) {
        return {
            ...dim,
            x: dim.x + dim.w - offsetW,
        };
    }

    return dim;
}

export function centerOfScreen(elementRect: DOMRect): Dimensions {
    const viewport = viewportDimensions();
    const centerX = viewport.w / 2;
    const centerY = viewport.h / 2;
    return {
        x: centerX - elementRect.width / 2,
        y: centerY - elementRect.height / 2,
        w: elementRect.width,
        h: elementRect.height,
    };
}
