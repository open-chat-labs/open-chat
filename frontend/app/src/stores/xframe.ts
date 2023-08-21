import { writable } from "svelte/store";
import type { Theme } from "../theme/types";
import page from "page";
import { setModifiedTheme } from "../theme/themes";
import { routerReady } from "../routes";

type XFrameMessage = UpdateTheme | ChangeRoute | OpenChatReady;

type UpdateTheme = {
    kind: "update_theme";
    name: string;
    base: "light" | "dark";
    overrides: Partial<Theme>;
};

type ChangeRoute = {
    kind: "change_route";
    path: string;
};

type OpenChatReady = {
    kind: "openchat_ready";
};

export const framed = writable(false);

export function init() {
    if (window.self !== window.top) {
        console.debug("XFRAME_TARGET: setting listeners");
        window.addEventListener("message", externalMessage);
    }
}

init();

let queuedRoute: string | undefined = undefined;
let isRouterReady = false;

routerReady.subscribe((ready) => {
    console.debug("XFRAME_TARGET: routerReady changed to ", ready, queuedRoute);
    if (ready && queuedRoute !== undefined) {
        page(queuedRoute);
        queuedRoute = undefined;
    }
    isRouterReady = ready;
});

function externalMessage(ev: MessageEvent) {
    if (!process.env.FRAME_ANCESTORS?.includes(ev.origin)) {
        return;
    }

    console.debug("XFRAME_TARGET: message received from host", ev);
    if (ev.data) {
        try {
            const payload = ev.data as XFrameMessage;
            switch (payload.kind) {
                case "change_route":
                    if (isRouterReady) {
                        console.debug("XFRAME_TARGET: changing path to ", payload.path);
                        page(payload.path);
                    } else {
                        console.debug("XFRAME_TARGET: queueing route change ", payload.path);
                        queuedRoute = payload.path;
                    }
                    break;
                case "update_theme":
                    setModifiedTheme(payload.base, payload.name, payload.overrides);
                    break;
            }
        } catch (err) {
            console.debug(
                "XFRAME_TARGET: Error handling an external message from another window",
                err,
            );
        }
    }
}
