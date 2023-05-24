/** This is used to calculate the position of thing A according to the required
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
    target: DOMRect,
    tooltip: DOMRect,
    position: Position,
    align: Alignment,
    gutter: number
): { x: number; y: number } {
    const targetCenter = center(target);
    const [flippedPosition, flippedAlign] = flipPositionAndAlignment(position, align);
    switch (flippedPosition) {
        case "right":
            return {
                x: target.x + target.width + gutter,
                y: verticalPosition(targetCenter, tooltip, flippedAlign),
            };
        case "left":
            return {
                x: target.x - tooltip.width - gutter,
                y: verticalPosition(targetCenter, tooltip, flippedAlign),
            };
        case "top":
            return {
                x: horizontalPosition(targetCenter, tooltip, flippedAlign),
                y: target.y - tooltip.height - gutter,
            };
        case "bottom":
            return {
                x: horizontalPosition(targetCenter, tooltip, flippedAlign),
                y: target.y + target.height + gutter,
            };
    }
}

function horizontalPosition(
    targetCenter: { x: number; y: number },
    tooltip: DOMRect,
    align: Alignment
): number {
    switch (align) {
        case "center":
            return targetCenter.x - tooltip.width / 2;
        case "start":
            return targetCenter.x - CHEVRON_OFFSET;
        case "end":
            return targetCenter.x - tooltip.width + CHEVRON_OFFSET;
    }
}

function verticalPosition(
    targetCenter: { x: number; y: number },
    tooltip: DOMRect,
    align: Alignment
): number {
    switch (align) {
        case "center":
            return targetCenter.y - tooltip.height / 2;
        case "start":
            return targetCenter.y - CHEVRON_OFFSET;
        case "end":
            return targetCenter.y - tooltip.height + CHEVRON_OFFSET;
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
