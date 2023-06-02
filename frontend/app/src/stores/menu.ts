import { writable, get } from "svelte/store";
import { logger } from "utils/logging";
import { navOpen } from "./layout";
import { mobileWidth } from "./screenDimensions";
import {
    Alignment,
    Position,
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
        if (!menuAnchor) {
            // debug logging - will remove later
            logger.error("trying to remove menu when menu anchor is null");
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
        gutter = 8
    ): void =>
        update((menu) => {
            if (menu === undefined) return menu;

            const elementRect = menu.getBoundingClientRect();

            const dim =
                centered && get(mobileWidth)
                    ? centerOfScreen(elementRect)
                    : boundsCheck(
                          triggerRect,
                          derivePosition(triggerRect, elementRect, position, align, gutter)
                      );

            menu.style.setProperty("left", `${dim.x}px`);
            menu.style.setProperty("top", `${dim.y}px`);

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
