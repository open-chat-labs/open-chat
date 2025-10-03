import { portalState } from "component-lib";

function hideMenu() {
    portalState.close();
}

export function menuCloser(node: HTMLElement, enabled: boolean = true) {
    if (enabled) {
        node.addEventListener("scroll", hideMenu);

        return {
            destroy() {
                node.removeEventListener("scroll", hideMenu);
            },
        };
    }
}
