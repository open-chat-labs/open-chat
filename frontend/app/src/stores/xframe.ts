import { writable } from "svelte/store";
import type { Theme } from "../theme/types";
import page from "page";
import { setModifiedTheme } from "../theme/themes";

type XFrameMessage = UpdateTheme | ChangeRoute;

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

export const framed = writable(false);

window.addEventListener("message", externalMessage);

function externalMessage(ev: MessageEvent) {
    if (ev.origin !== "http://localhost:5173") {
        return;
    }

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
