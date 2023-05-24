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

// TODO - this doesn't mean anything in the context of the menu so we need to abstract it somehow
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
): { x: number; y: number } {
    const triggerCenter = center(triggerRect);
    const [flippedPosition, flippedAlign] = flipPositionAndAlignment(position, align);
    switch (flippedPosition) {
        case "right":
            return {
                x: triggerRect.x + triggerRect.width + gutter,
                y: verticalPosition(triggerCenter, elementRect, flippedAlign),
            };
        case "left":
            return {
                x: triggerRect.x - elementRect.width - gutter,
                y: verticalPosition(triggerCenter, elementRect, flippedAlign),
            };
        case "top":
            return {
                x: horizontalPosition(triggerCenter, elementRect, flippedAlign),
                y: triggerRect.y - elementRect.height - gutter,
            };
        case "bottom":
            return {
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

function flipPositionAndAlignment(position: Position, align: Alignment): [Position, Alignment] {
    const rtl = get(rtlStore);
    const vertical = position === "top" || position === "bottom";
    if (position === "right" && rtl) return ["left", align];
    if (position === "left" && rtl) return ["right", align];

    // if we're vertically positioned we might need to flip the alignment
    if (vertical && align === "start" && rtl) return [position, "end"];
    if (vertical && align === "end" && rtl) return ["right", "start"];
    return [position, align];
}
