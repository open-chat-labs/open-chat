import { get, writable } from "svelte/store";
import { rollbar } from "utils/logging";
import { fontSizeScale } from "../../../frontend/src/stores/fontSize";
import { rtlStore } from "./rtl";
import { mobileWidth } from "./screenDimensions";

const { subscribe, update } = writable<HTMLElement | undefined>(undefined);

const menuAnchor = document.createElement("div");
menuAnchor.className = "contextMenu";
document.body.appendChild(menuAnchor);

function close(menu: HTMLElement | undefined): HTMLElement | undefined {
    if (menu !== undefined) {
        if (!menuAnchor) {
            // debug logging - will remove later
            rollbar.error("trying to remove menu when menu anchor is null");
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
    position: (pos: DOMRect): void =>
        update((menu) => {
            if (menu === undefined) return menu;

            const scale = get(fontSizeScale) - 2;
            const baseOffset = 180 + scale * offsetStep;
            const xoffset = get(rtlStore) ? baseOffset : -baseOffset;
            const items = menu.querySelectorAll(".menu-item").length;
            const itemHeight = get(mobileWidth)
                ? 36.7 + scale * mobileHeightStep
                : 43 + scale * desktopHeightStep;
            const height = itemHeight * items;
            const left = Math.max(10, pos.x + xoffset);
            const top = pos.y > window.innerHeight / 2 ? pos.y - height : pos.y + pos.height;
            menu.style.setProperty("top", `${top}px`);
            menu.style.setProperty("left", `${left}px`);
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
            return close(menu);
        }),
};
