import { ui } from "openchat-client";
import { writable } from "svelte/store";
import { type Alignment, type Position, centerOfScreen } from "../utils/alignment";
import { reposition } from "../utils/position";

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

function positionInCenter(menu: HTMLElement) {
    const rect = menu.getBoundingClientRect();
    const dim = centerOfScreen(rect);
    menu.style.setProperty("left", `${dim.x}px`);
    menu.style.setProperty("top", `${dim.y + window.scrollY}px`);
}

export const menuStore = {
    subscribe,
    position: (
        triggerEl: HTMLElement,
        centered: boolean,
        position: Position = "bottom",
        align: Alignment = "middle",
        gutter = 8,
    ): void =>
        update((menu) => {
            if (menu === undefined) return menu;

            if (centered && ui.mobileWidth) {
                positionInCenter(menu);
            } else {
                reposition(triggerEl, menu, {
                    position: `${position}-${align}`,
                    margin: gutter,
                });
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
                ui.closeNavIfOpen();
            }
            return close(menu);
        }),
};
