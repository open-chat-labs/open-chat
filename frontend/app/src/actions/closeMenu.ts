/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { menuStore } from "../stores/menu";

function hideMenu() {
    menuStore.hideMenu();
}

export function menuCloser(node: HTMLElement) {
    menuStore.subscribe((menu) => {
        if (menu !== undefined) {
            node.addEventListener("scroll", hideMenu);
        } else {
            node.removeEventListener("scroll", hideMenu);
        }
    });

    return {
        destroy() {
            node.removeEventListener("scroll", hideMenu);
        },
    };
}
