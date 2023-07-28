import { writable } from "svelte/store";
import type { Theme } from "../theme/types";
import page from "page";
import { setModifiedTheme } from "../theme/themes";

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

if (window.self !== window.top) {
    console.log("xxx setting listeners");
    window.addEventListener("message", externalMessage);
    if (window.top) {
        console.log("xxx sending ready message to host");
        window.top.postMessage({ kind: "openchat_ready" }, "http://localhost:5173");
    }
}

function externalMessage(ev: MessageEvent) {
    if (ev.origin !== "http://localhost:5173") {
        return;
    }

    console.log("xxx message received from host", ev);

    if (ev.data) {
        try {
            const payload = ev.data as XFrameMessage;
            switch (payload.kind) {
                case "change_route":
                    page(payload.path);
                    break;
                case "update_theme":
                    setModifiedTheme(payload.base, payload.name, payload.overrides);
                    break;
            }
        } catch (err) {
            console.log("Error handling an external message from another window", err);
        }
    }
}
