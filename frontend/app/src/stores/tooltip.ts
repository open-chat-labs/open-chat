import { writable } from "svelte/store";
import { Alignment, Position, derivePosition } from "../utils/alignment";

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

            const pos = derivePosition(
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
