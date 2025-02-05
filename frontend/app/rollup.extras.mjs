//* Extra functionality provided to Rollup and Vite for prod/test/dev builds!
import fs from "fs-extra";
import dotenv from "dotenv";
import path, { dirname } from "path";
import { fileURLToPath } from 'url';
import { sha256 } from "js-sha256";

const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

// Sass relevant files & directives
export const mixins = path.join(__dirname, "src", "styles", "mixins.scss");
export const sassModulesAndMixins = `@use 'sass:math'; @use 'sass:map'; @use '${mixins}' as *;`

// Generates content security policy (CSP) hash for the provided entry
function generateCspHashValue(text) {
    const hash = sha256.update(text).arrayBuffer();
    const base64 = Buffer.from(hash).toString("base64");
    return `'sha256-${base64}'`;
}

export function generateCspForScripts(inlineScripts, development) {
    const cspHashValues = inlineScripts.map(generateCspHashValue);
    return `
        style-src * 'unsafe-inline'; 
        style-src-elem * 'unsafe-inline';
        font-src 'self' https://fonts.gstatic.com/;
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        upgrade-insecure-requests;
        script-src 'self' 'unsafe-eval' https://scripts.wobbl3.com/ https://api.rollbar.com/api/ https://platform.twitter.com/ https://www.googletagmanager.com/ ${cspHashValues.join(
            " "
        )}` + (development ? " http://localhost:* http://127.0.0.1:*" : "");
}

// Set up environment
export function initEnv() {
    dotenv.config({ path: path.join(__dirname, "../.env") });

    const dfxNetwork = process.env.OC_DFX_NETWORK;
    console.log("OC_DFX_NETWORK: ", dfxNetwork);

    if (dfxNetwork) {
        const dfxJsonPath = path.join(__dirname, "../..", "dfx.json");
        const dfxJson = JSON.parse(fs.readFileSync(dfxJsonPath));
        const canisterPath =
            dfxJson["networks"][dfxNetwork]["type"] === "persistent"
                ? path.join(__dirname, "../..", "canister_ids.json")
                : path.join(__dirname, "../..", ".dfx", dfxNetwork, "canister_ids.json");

        if (fs.existsSync(canisterPath)) {
            const canisters = JSON.parse(fs.readFileSync(canisterPath));
            process.env.OC_TRANSLATIONS_CANISTER = canisters.translations[dfxNetwork];
            process.env.OC_USER_INDEX_CANISTER = canisters.user_index[dfxNetwork];
            process.env.OC_GROUP_INDEX_CANISTER = canisters.group_index[dfxNetwork];
            process.env.OC_NOTIFICATIONS_CANISTER = canisters.notifications_index[dfxNetwork];
            process.env.OC_IDENTITY_CANISTER = canisters.identity[dfxNetwork];
            process.env.OC_ONLINE_CANISTER = canisters.online_users[dfxNetwork];
            process.env.OC_PROPOSALS_BOT_CANISTER = canisters.proposals_bot[dfxNetwork];
            process.env.OC_AIRDROP_BOT_CANISTER = canisters.airdrop_bot[dfxNetwork];
            process.env.OC_STORAGE_INDEX_CANISTER = canisters.storage_index[dfxNetwork];
            process.env.OC_REGISTRY_CANISTER = canisters.registry[dfxNetwork];
            process.env.OC_MARKET_MAKER_CANISTER = canisters.market_maker[dfxNetwork];
            process.env.OC_SIGN_IN_WITH_EMAIL_CANISTER = canisters.sign_in_with_email[dfxNetwork];
            process.env.OC_SIGN_IN_WITH_ETHEREUM_CANISTER = canisters.sign_in_with_ethereum[dfxNetwork];
            process.env.OC_SIGN_IN_WITH_SOLANA_CANISTER = canisters.sign_in_with_solana[dfxNetwork];

            console.log("TranslationsCanisterId: ", process.env.OC_TRANSLATIONS_CANISTER);
            console.log("UserIndexCanisterId: ", process.env.OC_USER_INDEX_CANISTER);
            console.log("GroupIndexCanisterId: ", process.env.OC_GROUP_INDEX_CANISTER);
            console.log("NotificationsCanisterId: ", process.env.OC_NOTIFICATIONS_CANISTER);
            console.log("IdentityCanisterId: ", process.env.OC_IDENTITY_CANISTER);
            console.log("OnlineCanisterId: ", process.env.OC_ONLINE_CANISTER);
            console.log("ProposalsBotCanisterId: ", process.env.OC_PROPOSALS_BOT_CANISTER);
            console.log("AirdropBotCanisterId: ", process.env.OC_AIRDROP_BOT_CANISTER);
            console.log("StorageIndex: ", process.env.OC_STORAGE_INDEX_CANISTER);
            console.log("Registry: ", process.env.OC_REGISTRY_CANISTER);
            console.log("MarketMaker: ", process.env.OC_MARKET_MAKER_CANISTER);
            console.log("SignInWithEmail: ", process.env.OC_SIGN_IN_WITH_EMAIL_CANISTER);
            console.log("SignInWithEthereum: ", process.env.OC_SIGN_IN_WITH_ETHEREUM_CANISTER);
            console.log("SignInWithSolana: ", process.env.OC_SIGN_IN_WITH_SOLANA_CANISTER);
        } else {
            console.log(
                "Couldn't find canisters JSON at: ",
                canisterPath,
                ". Falling back to original env vars.",
            );
        }
    } else {
        console.log(
            "OC_DFX_NETWORK env var not set, cannot load correct canisterIds, falling back to original env vars.",
        );
    }

    const build_env = process.env.OC_BUILD_ENV;
    const production = build_env === "production";
    const development = build_env === "development";
    const env = process.env.NODE_ENV ?? (development ? "development" : "production");
    const version = process.env.OC_WEBSITE_VERSION;

    if (!development && !version) {
        throw Error("OC_WEBSITE_VERSION environment variable not set");
    }
    if (production && !process.env.OC_ROLLBAR_ACCESS_TOKEN) {
        throw Error("OC_ROLLBAR_ACCESS_TOKEN environment variable not set");
    }
    if (production && !process.env.OC_USERGEEK_APIKEY) {
        throw Error("OC_USERGEEK_APIKEY environment variable not set");
    }
    if (production && !process.env.OC_METERED_APIKEY) {
        throw Error("OC_METERED_APIKEY environment variable not set");
    }

    process.env.OC_SERVICE_WORKER_PATH = `/service_worker.js?v=${version}`;

    console.log("BUILD_ENV", build_env);
    console.log("ENV", env);
    console.log("OC_INTERNET IDENTITY URL", process.env.OC_INTERNET_IDENTITY_URL);
    console.log("OC_INTERNET IDENTITY CANISTER", process.env.OC_INTERNET_IDENTITY_CANISTER_ID);
    console.log("OC_NFID URL", process.env.OC_NFID_URL);
    console.log("OC_VERSION", version ?? "undefined");
    console.log("OC_SERVICE WORKER PATH", process.env.OC_SERVICE_WORKER_PATH);

    return {
        env,
        build_env,
        production,
        development,
        version,
        dfxNetwork,
    }
}

// Put external dependencies into their own bundle so that they get cached separately
export function manualChunks(id) {
    if (id.includes("node_modules")) {
        return "vendor";
    }
}

export function copyFile(fromPath, toPath, file) {
    const from = path.join(__dirname, fromPath, file);
    const to = path.join(__dirname, toPath, file);
    if (fs.existsSync(from)) {
        console.log("Copying file -> : ", from, to);
        fs.copySync(from, to, {
            recursive: true,
        });
    }
}

export function maybeStringify(value) {
    return value !== undefined ? JSON.stringify(value) : undefined;
}
