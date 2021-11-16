import { get, writable } from "svelte/store";
import { rtlStore } from "./rtl";

const { subscribe, update } = writable<HTMLElement | undefined>(undefined);

const menuAnchor = document.createElement("div");
menuAnchor.className = "contextMenu";
document.body.appendChild(menuAnchor);

function close(menu: HTMLElement | undefined): HTMLElement | undefined {
    if (menu !== undefined) {
        menuAnchor.removeChild(menu);
    }
    return undefined;
}

export const menuStore = {
    subscribe,
    position: (pos: DOMRect): void =>
        update((menu) => {
            if (menu === undefined) return menu;
            const xoffset = get(rtlStore) ? 180 : -180;
            const items = menu.querySelectorAll(".menu-item").length;
            const height = 37.2 * items;
            const left = Math.max(10, pos.x + xoffset);
            const top = pos.y > window.innerHeight / 2 ? pos.y - height : pos.y + pos.height;
            menu.style.setProperty("top", `${top}px`);
            menu.style.setProperty("left", `${left}px`);
            return menu;
        }),
    showMenu: (menu: HTMLElement, _pos: DOMRect): void =>
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
