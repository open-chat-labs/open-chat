import { get, writable } from "svelte/store";
import { logger } from "utils/logging";
import { fontSizeScale } from "./fontSize";
import { rtlStore } from "./rtl";
import { mobileWidth } from "./screenDimensions";
import { navOpen } from "./layout";

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

const offsetStep = 25;
const desktopHeightStep = 3;
const mobileHeightStep = 2.8;

export const menuStore = {
    subscribe,
    position: (pos: DOMRect, centered: boolean): void =>
        update((menu) => {
            if (menu === undefined) return menu;

            const scale = get(fontSizeScale) - 2;
            const baseOffset = 180 + scale * offsetStep;
            const xoffset = get(rtlStore) ? baseOffset : -baseOffset;
            const items = menu.querySelectorAll(".menu-item").length;
            const isMobile = get(mobileWidth);
            const itemHeight = isMobile
                ? 36.7 + scale * mobileHeightStep
                : 46.5 + scale * desktopHeightStep;
            const height = itemHeight * items;
            if (centered && isMobile) {
                menu.style.setProperty("top", `calc(50% - ${height / 2}px)`);
                menu.style.setProperty("left", `calc(50% - 35vw)`);
            } else {
                const left = Math.max(10, pos.x + xoffset);
                const top = pos.y > window.innerHeight / 2 ? pos.y - height : pos.y + pos.height;
                menu.style.setProperty("top", `${top}px`);
                menu.style.setProperty("left", `${left}px`);
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
            navOpen.set(false);
            return close(menu);
        }),
};
