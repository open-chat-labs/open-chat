import { AuthClient } from "@dfinity/auth-client";
import { routerReadyStore, xframeOverrides, type XFrameOverrides } from "openchat-client";
import page from "page";
import { get } from "svelte/store";
import { setModifiedTheme } from "../theme/themes";
import type { Theme } from "../theme/types";

const FRAME_ANCESTORS = [
    "http://localhost:5173",
    "https://windoge98.com",
    "https://desktop.windoge98.com",
    "https://4hy5z-qaaaa-aaaal-addrq-cai.icp0.io",
    "https://signalsicp.com",
    "https://gooble.app",
    "https://www.vault-bet.com",
    "https://vault-bet.com",
    "https://calm-pasca-49d7be.netlify.app", // betbase proof of concept
    "https://221bravo.app",
    "https://ht7v7-iaaaa-aaaak-qakga-cai.icp0.io", //221bravo
    "https://mdocx-gyaaa-aaaak-qcbsq-cai.icp0.io",
    "https://zexzi-jyaaa-aaaam-abj3q-cai.icp0.io", //Betbase dev
    "https://xw4dq-4yaaa-aaaam-abeuq-cai.ic0.app", //Betbase live
    "https://kjfeq-waaaa-aaaan-qedva-cai.icp0.io", // vaultbet test
    "https://spyzr-gqaaa-aaaan-qd66q-cai.icp0.io", // vaultbet
    "https://zkpoker.app", // ZKP
    "https://panoramablock.com", // Panorama Block Live
    "https://zdgud-kqaaa-aaaal-ajn4q-cai.icp0.io", // tendyzone test
    "https://okowr-oqaaa-aaaag-qkedq-cai.icp0.io", // konecta pre-register
    "https://pre.konecta.one", //konecta pre-register
    "https://konecta.one", //konecta website/webapp
    "https://y7mum-taaaa-aaaag-qklxq-cai.icp0.io", // konecta pre-register test env
    "https://e4tvt-6yaaa-aaaao-a3sdq-cai.icp0.io", // dragon paladin wizard
    "https://dragonwizards.club", // dragon paladin wizard web2 test
    "https://ic-vc.com", // ICVC homepage
    "https://mnc6b-aaaaa-aaaap-qhnrq-cai.icp0.io", // ICVC via canister ID
    "https://platform.ic-vc.com", // ICVC platform
    "https://mitchkurtzman.com", //Mitch's portfolio POC Domain
    "https://wk3k3-vaaaa-aaaak-adtza-cai.icp0.io", //Mitch's portfilio POC canister ID
    "https://fantasyextreme.org", //fantasyextreme prod
    "https://snxxs-viaaa-aaaam-acuba-cai.icp0.io", //fantasyextreme staging
    "https://e7bx6-iiaaa-aaaag-qm7oq-cai.icp0.io", // Partnrship
    "https://pow-3.org", // pow-3 live
    "https://power-3.org", // pow-3 live (alias),
    "https://mimento.ai",
    "https://gboec-sqaaa-aaaah-aredq-cai.icp0.io", //Mimento canister Id url
    "https://lx7ws-diaaa-aaaag-aubda-cai.icp0.io", // TacoDAO Production ID URL
    "https://tacodao.com", // TacoDAO Production Website URL
    "https://wxunf-maaaa-aaaab-qbzga-cai.icp0.io", // TacoDAO Staging ID URL
    "https://staging.tacodao.com", // TacoDAO Staging Website URL
];

type InboundXFrameMessage = UpdateTheme | ChangeRoute | OverrideSettings | Logout;
type OutboundXFrameMessage = UserLoggedIn | "openchat_ready";

type UserLoggedIn = {
    kind: "openchat_user_logged_in";
    userId: string;
};

type OverrideSettings = {
    kind: "override_settings";
    settings: XFrameOverrides;
};

type Logout = {
    kind: "logout";
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

export function init() {
    if (window.self !== window.top) {
        console.debug("XFRAME_TARGET: setting listeners", window.top);
        window.addEventListener("message", externalMessage);
        broadcastMessage("openchat_ready");
    }
}

export function broadcastLoggedInUser(userId: string) {
    broadcastMessage({
        kind: "openchat_user_logged_in",
        userId,
    });
}

function broadcastMessage(msg: OutboundXFrameMessage) {
    if (window.top && window.self !== window.top) {
        console.debug("XFRAME_TARGET: sending message to host: ", msg);
        window.top.postMessage(msg, "*");
    }
}

init();

function pageWhenReady(path: string, timeout = 50, attempts = 0) {
    if (get(routerReadyStore)) {
        console.debug("XFRAME_TARGET: changing path to ", path);
        page(path);
    } else {
        if (attempts < 10) {
            console.debug("XFRAME_TARGET: queueing route change ", path);
            setTimeout(() => {
                pageWhenReady(path, timeout * 2, attempts + 1);
            }, timeout);
        } else {
            console.debug(
                "XFRAME_TARGET: unable to change route because the router is not ready ",
                path,
            );
        }
    }
}

function externalMessage(ev: MessageEvent) {
    if (!FRAME_ANCESTORS.includes(ev.origin)) {
        return;
    }

    console.debug("XFRAME_TARGET: message received from host", ev);
    if (ev.data) {
        try {
            const payload = ev.data as InboundXFrameMessage;
            switch (payload.kind) {
                case "override_settings":
                    console.debug("XFRAME_TARGET: overriding settings", payload.settings);
                    xframeOverrides.set(payload.settings);
                    break;
                case "change_route":
                    pageWhenReady(payload.path);
                    break;
                case "update_theme":
                    setModifiedTheme(payload.base, payload.name, payload.overrides);
                    break;

                case "logout":
                    console.debug("XFRAME_TARGET: logging out");
                    AuthClient.create().then((auth) => {
                        return auth.logout().then(() => window.location.replace("/"));
                    });
            }
        } catch (err) {
            console.debug(
                "XFRAME_TARGET: Error handling an external message from another window",
                err,
            );
        }
    }
}
