import { get, writable } from "svelte/store";
import type { Theme } from "../theme/types";
import page from "page";
import { setModifiedTheme } from "../theme/themes";
import { routerReady } from "../routes";

const FRAME_ANCESTORS = [
    "http://localhost:5173",
    "https://calm-pasca-49d7be.netlify.app", // betbase proof of concept
    "https://221bravo.app",
    "https://ht7v7-iaaaa-aaaak-qakga-cai.icp0.io", //221bravo
    "https://mdocx-gyaaa-aaaak-qcbsq-cai.icp0.io",
    "https://zexzi-jyaaa-aaaam-abj3q-cai.icp0.io", //Betbase dev
    "https://xw4dq-4yaaa-aaaam-abeuq-cai.ic0.app", //Betbase live
    "https://spyzr-gqaaa-aaaan-qd66q-cai.icp0.io", // vaultbet
];

type XFrameMessage = InboundXFrameMessage | OutboundXFrameMessage;
type InboundXFrameMessage = UpdateTheme | ChangeRoute | ConfigureIFrame;
type OutboundXFrameMessage = PathSelected;

type PathSelected = {
    kind: "path_selected";
    path: string;
};

type ConfigureIFrame = {
    kind: "configure_iframe";

    /**
     * Optionally override the selected theme
     */
    theme?: UpdateTheme;

    /**
     * This is required so that we can send messages back to the host
     */
    hostOrigin: string;

    /**
     * This controls whether navigation events within open chat will be handled internally as normal
     * or delegated to the host site.
     *
     * The reason to delegate to the host is so that the host can integrate multiple OpenChat iframes together.
     */
    delegateNavigation: boolean;
};

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

type IFrameConfig = {
    hostOrigin?: string;
    delegateNavigation: boolean;
};

export const framed = writable<IFrameConfig | undefined>(undefined);

export function init() {
    if (window.self !== window.top) {
        framed.set({
            delegateNavigation: false,
        });
        console.debug("XFRAME_TARGET: setting listeners", window.top);
        window.addEventListener("message", externalMessage);
        if (window.top) {
            console.debug("XFRAME_TARGET: sending ready message");
            window.top.postMessage("openchat_ready", "*");
        }
    }
}

export function navigateTo(path: string): void {
    if (window.top) {
        const config = get(framed);
        if (config !== undefined && config.hostOrigin !== undefined) {
            console.debug("XFRAME_TARGET: sending openchat_navigation event", path);
            window.top.postMessage(
                {
                    kind: "openchat_navigation",
                    path,
                },
                config.hostOrigin,
            );
        }
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
    if (!FRAME_ANCESTORS.includes(ev.origin)) {
        return;
    }

    console.debug("XFRAME_TARGET: message received from host", ev);
    if (ev.data) {
        try {
            const payload = ev.data as InboundXFrameMessage;
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
                case "configure_iframe":
                    if (payload.theme !== undefined) {
                        setModifiedTheme(
                            payload.theme.base,
                            payload.theme.name,
                            payload.theme.overrides,
                        );
                    }
                    framed.set({
                        delegateNavigation: payload.delegateNavigation,
                        hostOrigin: ev.origin,
                    });
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
