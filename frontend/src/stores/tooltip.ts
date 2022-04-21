import { writable } from "svelte/store";

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
        rightAligned: boolean,
        bottomOffset: number,
        centreChevron: boolean
    ): void =>
        update((tooltip) => {
            if (tooltip === undefined) return tooltip;

            const tooltipWidth = tooltip.getBoundingClientRect().width;
            const chevronOffset = 23;
            const targetCentre = targetRect.left + targetRect.width / 2;

            const left = centreChevron
                ? targetRect.left + chevronOffset
                : Math.max(targetRect.left, targetCentre - tooltipWidth / 2);

            const right = centreChevron
                ? window.innerWidth - targetCentre - chevronOffset
                : Math.max(
                      window.innerWidth - targetCentre - tooltipWidth / 2,
                      window.innerWidth - targetRect.right
                  );

            if (rightAligned) {
                tooltip.style.setProperty("left", "auto");
                tooltip.style.setProperty("right", `${right}px`);
            } else {
                tooltip.style.setProperty("left", `${left}px`);
                tooltip.style.setProperty("right", "auto");
            }

            const bottom = window.innerHeight - targetRect.top - bottomOffset;
            tooltip.style.setProperty("bottom", `${bottom}px`);

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
