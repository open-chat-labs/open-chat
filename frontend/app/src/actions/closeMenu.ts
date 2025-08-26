 
import { portalState } from "@src/components/portalState.svelte";

function hideMenu() {
    portalState.close();
}

export function menuCloser(node: HTMLElement) {
    node.addEventListener("scroll", hideMenu);

    return {
        destroy() {
            node.removeEventListener("scroll", hideMenu);
        },
    };
}
