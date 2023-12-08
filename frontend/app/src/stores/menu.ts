import { writable, get } from "svelte/store";
import { navOpen } from "./layout";
import { mobileWidth } from "./screenDimensions";
import {
    type Alignment,
    type Position,
    boundsCheck,
    centerOfScreen,
    derivePosition,
} from "../utils/alignment";

const { subscribe, update } = writable<HTMLElement | undefined>(undefined);

const menuAnchor = document.createElement("div");
menuAnchor.className = "contextMenu";
document.body.appendChild(menuAnchor);

function close(menu: HTMLElement | undefined): HTMLElement | undefined {
    if (menu !== undefined) {
        menu.style.removeProperty("--override-height");
        if (!menuAnchor) {
            // debug logging - will remove later
            console.error("trying to remove menu when menu anchor is null");
        } else {
            if (menuAnchor.contains(menu)) {
                menuAnchor.removeChild(menu);
            }
        }
    }

    return undefined;
}

export const menuStore = {
    subscribe,
    position: (
        triggerRect: DOMRect,
        centered: boolean,
        position: Position = "bottom",
        align: Alignment = "center",
        gutter = 8,
    ): void =>
        update((menu) => {
            if (menu === undefined) return menu;

            const elementRect = menu.getBoundingClientRect();
            const originalHeight = elementRect.height;

            const dim =
                centered && get(mobileWidth)
                    ? centerOfScreen(elementRect)
                    : boundsCheck(
                          triggerRect,
                          derivePosition(triggerRect, elementRect, position, align, gutter),
                          gutter,
                      );

            menu.style.setProperty("left", `${dim.x}px`);

            // for landing pages we need to offset based on the window scroll
            // for the main app this will always be 0 so it's a no-op
            menu.style.setProperty("top", `${dim.y + window.scrollY}px`);
            if (originalHeight !== dim.h) {
                menu.style.setProperty("--override-height", `${dim.h}px`);
            }

            return menu;
        }),
    showMenu: (menu: HTMLElement): void =>
        update((currentMenu) => {
            close(currentMenu);
            menuAnchor.appendChild(menu);
            return menu;
        }),
    hideMenu: (): void =>
        update((menu) => {
            if (menu) {
                navOpen.set(false);
            }
            return close(menu);
        }),
};
