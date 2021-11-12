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
    showMenu: (menu: HTMLElement, pos: DOMRect): void =>
        update((currentMenu) => {
            close(currentMenu);
            const l = get(rtlStore) ? 150 : -150;
            menuAnchor.appendChild(menu);
            menu.style.setProperty("top", `${pos.y + 40}px`);
            menu.style.setProperty("left", `${pos.x + l}px`);
            return menu;
        }),
    hideMenu: (): void =>
        update((menu) => {
            return close(menu);
        }),
};
