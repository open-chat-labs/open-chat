import { cancelAnimation } from "@src/utils/transition";
import { writable } from "svelte/store";
import { type Alignment, type Position } from "../utils/alignment";
import { reposition } from "../utils/position";

const { subscribe, update } = writable<HTMLElement | undefined>(undefined);

const tooltipAnchor = document.createElement("div");
tooltipAnchor.className = "tooltip";
document.body.appendChild(tooltipAnchor);

function close(tooltip: HTMLElement | undefined): HTMLElement | undefined {
    if (tooltip !== undefined) {
        if (tooltipAnchor && tooltipAnchor.contains(tooltip)) {
            cancelAnimation(tooltip);
            tooltip.innerHTML = "";
            tooltipAnchor.removeChild(tooltip);
        }
    }
    return undefined;
}

export const tooltipStore = {
    subscribe,
    position: (
        triggerEl: HTMLElement,
        position: Position = "top",
        align: Alignment = "start",
        gutter = 8,
    ): void =>
        update((tooltip) => {
            if (tooltip === undefined) return tooltip;

            reposition(triggerEl, tooltip, {
                position: `${position}-${align}`,
                margin: gutter,
            });

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
