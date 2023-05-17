import { get, writable } from "svelte/store";
import { rtlStore } from "./rtl";

const { subscribe, update } = writable<HTMLElement | undefined>(undefined);

const tooltipAnchor = document.createElement("div");
tooltipAnchor.className = "tooltip";
document.body.appendChild(tooltipAnchor);

function close(tooltip: HTMLElement | undefined): HTMLElement | undefined {
    if (tooltip !== undefined) {
        if (tooltipAnchor && tooltipAnchor.contains(tooltip)) {
            tooltipAnchor.removeChild(tooltip);
        }
    }
    return undefined;
}

type Position = "top" | "right" | "bottom" | "left";
type Alignment = "start" | "center" | "end";

function center({ left, top, height, width }: DOMRect): { x: number; y: number } {
    return {
        x: left + width / 2,
        y: top + height / 2,
    };
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

const CHEVRON_OFFSET = 16; // half width + offset (4 + 12)

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

function deriveTooltipPosition(
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

export const tooltipStore = {
    subscribe,
    position: (
        targetRect: DOMRect,
        position: Position = "top",
        align: Alignment = "start",
        gutter = 8
    ): void =>
        update((tooltip) => {
            if (tooltip === undefined) return tooltip;

            const pos = deriveTooltipPosition(
                targetRect,
                tooltip.getBoundingClientRect(),
                position,
                align,
                gutter
            );

            tooltip.style.setProperty("left", `${pos.x}px`);
            tooltip.style.setProperty("top", `${pos.y}px`);

            return tooltip;
        }),
    show: (tooltip: HTMLElement): void =>
        update((currentTooltip) => {
            close(currentTooltip);
            tooltipAnchor.appendChild(tooltip);
            return tooltip;
        }),
    hide: (): void =>
        update((tooltip) => {
            return close(tooltip);
        }),
};
