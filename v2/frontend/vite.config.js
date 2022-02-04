/* eslint-disable no-undef */
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import dfxJson from "../dfx.json";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const dfxNetwork = process.env.DFX_NETWORK;

console.log("DFX_NETWORK: ", dfxNetwork);

if (dfxNetwork) {
    const canisterPath = dfxNetwork.startsWith("ic")
        ? path.join(__dirname, "..", "canister_ids.json")
        : path.join(__dirname, "..", ".dfx", dfxNetwork, "canister_ids.json");

    if (fs.existsSync(canisterPath)) {
        const canisters = JSON.parse(fs.readFileSync(canisterPath));
        process.env.USER_INDEX_CANISTER = canisters.user_index[dfxNetwork];
        process.env.GROUP_INDEX_CANISTER = canisters.group_index[dfxNetwork];
        process.env.NOTIFICATIONS_CANISTER = canisters.notifications[dfxNetwork];
        process.env.ONLINE_CANISTER = canisters.online_users_aggregator[dfxNetwork];

        console.log("UserIndexCanisterId: ", process.env.USER_INDEX_CANISTER);
        console.log("GroupIndexCanisterId: ", process.env.GROUP_INDEX_CANISTER);
        console.log("NotificationsCanisterId: ", process.env.NOTIFICATIONS_CANISTER);
        console.log("OnlineCanisterId: ", process.env.ONLINE_CANISTER);
    } else {
        console.log(
            "Couldn't find canisters JSON at: ",
            canisterPath,
            ". Falling back to original env vars."
        );
    }
} else {
    console.log(
        "DFX_NETWORK env var not set, cannot load correct canisterIds, falling back to original env vars."
    );
}

export default defineConfig({
    server: {
        port: 5001,
        proxy: {
            "/api": `http://${dfxJson.networks.local.bind}`,
        },
    },
    plugins: [svelte()],
    define: {
        "process.env": {
            USER_INDEX_CANISTER: process.env.USER_INDEX_CANISTER,
            GROUP_INDEX_CANISTER: process.env.GROUP_INDEX_CANISTER,
            NOTIFICATIONS_CANISTER: process.env.NOTIFICATIONS_CANISTER,
            ONLINE_CANISTER: process.env.ONLINE_CANISTER,
            LEDGER_CANISTER: process.env.LEDGER_CANISTER,
            OPEN_STORAGE_INDEX_CANISTER: process.env.OPEN_STORAGE_INDEX_CANISTER,
            INTERNET_IDENTITY_URL: process.env.INTERNET_IDENTITY_URL,
            USERGEEK_APIKEY: process.env.USERGEEK_APIKEY,
            NODE_ENV: process.env.NODE_ENV,
            CLIENT_CACHING: process.env.CLIENT_CACHING,
            MOCK_SERVICES: process.env.MOCK_SERVICES,
            ROLLBAR_ACCESS_TOKEN: process.env.ROLLBAR_ACCESS_TOKEN,
            WEBPUSH_SERVICE_WORKER_PATH: "_/raw/sw.js",
            BLOB_URL_PATTERN: process.env.BLOB_URL_PATTERN,
        },
    },
});
