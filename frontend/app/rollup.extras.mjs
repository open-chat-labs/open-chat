//* Extra functionality provided to Rollup and Vite for prod/test/dev builds!
import dotenv from "dotenv";
import fs from "fs-extra";
import { sha256 } from "js-sha256";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

// Sass relevant files & directives
export const mixins = path.join(__dirname, "src", "styles", "mixins.scss");
export const sassModulesAndMixins = `@use 'sass:math'; @use 'sass:map'; @use '${mixins}' as *;`;

// Generates content security policy (CSP) hash for the provided entry
function generateCspHashValue(text) {
    const hash = sha256.update(text).arrayBuffer();
    const base64 = Buffer.from(hash).toString("base64");
    return `'sha256-${base64}'`;
}

// frame-src is scheme-only rather than an origin list because external content channels
// (ExternalContent.svelte) frame whatever https url a community owner sets. Known framed
// origins: openchat.daily.co (video calls), maker.memefighter.app (MemeBuilder),
// www.youtube.com and docs.google.com (blog/whitepaper embeds), www.googletagmanager.com
// (noscript GTM). `https:` still blocks javascript:, data:, blob: and http frames.
// img-src, media-src and the native-only connect-src `asset: *` are out of scope of #9338.
// `isNative` is passed explicitly for the OTA bundles, which are built by the website build.
export function generateCspForScripts(
    inlineScripts,
    development,
    isNative = process.env.OC_APP_TYPE === "android" || process.env.OC_APP_TYPE === "ios",
) {
    const cspHashValues = inlineScripts.map(generateCspHashValue);
    const production = !development;
    const csp = `
        default-src 'self';
        img-src * 'self' data: blob:${isNative && development ? ` ${process.env.OC_IC_URL}` : ""}${isNative ? " asset: http://asset.localhost content: *" : ""};
        media-src * 'self' data: blob:${isNative && development ? ` ${process.env.OC_IC_URL}` : ""}${isNative ? " asset: http://asset.localhost content: *" : ""};
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com/ https://cdnjs.cloudflare.com/;
        style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com/ https://cdnjs.cloudflare.com/;
        font-src 'self' https://fonts.gstatic.com/ data:;
        frame-src https:;
        object-src 'none';
        base-uri 'self';
        form-action 'self';${production ? "\nupgrade-insecure-requests;" : ""}
        script-src 'self' https://www.instagram.com https://scripts.wobbl3.com/ https://api.rollbar.com/api/ ${cspHashValues.join(" ")} ${development ? "http://localhost:* http://127.0.0.1:*" : ""};
        connect-src 'self'${development ? " ws: http:" : ""}${production || isNative ? " wss: https:" : ""}${isNative ? " ipc: http://ipc.localhost http://asset.localhost asset: *" : ""};`;

    return csp;
}

// Set up environment
export function initEnv() {
    dotenv.config({ path: path.join(__dirname, "../.env") });

    const dfxNetwork = process.env.OC_DFX_NETWORK;

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
            process.env.OC_DAILY_PUZZLE_CANISTER = canisters.daily_puzzle?.[dfxNetwork] ?? "";
            process.env.OC_PROPOSALS_BOT_CANISTER = canisters.proposals_bot[dfxNetwork];
            process.env.OC_AIRDROP_BOT_CANISTER = canisters.airdrop_bot?.[dfxNetwork] ?? "";
            process.env.OC_STORAGE_INDEX_CANISTER = canisters.storage_index[dfxNetwork];
            process.env.OC_REGISTRY_CANISTER = canisters.registry[dfxNetwork];
            process.env.OC_MARKET_MAKER_CANISTER = canisters.market_maker[dfxNetwork];
            process.env.OC_SIGN_IN_WITH_EMAIL_CANISTER = canisters.sign_in_with_email[dfxNetwork];
            process.env.OC_SIGN_IN_WITH_ETHEREUM_CANISTER =
                canisters.sign_in_with_ethereum[dfxNetwork];
            process.env.OC_SIGN_IN_WITH_SOLANA_CANISTER = canisters.sign_in_with_solana[dfxNetwork];
            process.env.OC_ONESEC_FORWARDER_CANISTER = "lsoct-pyaaa-aaaar-boahq-cai";
            process.env.OC_ONESEC_MINTER_CANISTER = "5okwm-giaaa-aaaar-qbn6a-cai";

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
            console.log("OneSecForwarder: ", process.env.OC_ONESEC_FORWARDER_CANISTER);
            console.log("OneSecMinter: ", process.env.OC_ONESEC_MINTER_CANISTER);
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
    if (production && !process.env.OC_VAPID_PUBLIC_KEY) {
        throw Error("OC_VAPID_PUBLIC_KEY environment variable not set");
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
    };
}

// Cache for the graph-based lazy-reachability check.  Shared across all manualChunks
// calls within a single build so each module is only traversed once.  Reset via the
// resetManualChunksCache plugin below before each Rollup build so that watch-mode
// rebuilds always start with a clean slate.
const lazyModuleCache = new Map();

// The desktop and mobile App trees are loaded from main.ts via dynamic import() so
// that only the selected tree is fetched. For chunking purposes they are still
// treated as roots: a node_modules package statically reachable from either tree
// belongs in the shared, separately-cached vendor chunk, exactly as it did when the
// trees were imported statically. Without this, every dependency would count as
// "only dynamically reachable" and the vendor chunk would dissolve into the app chunks.
const DESKTOP_APP_ROOT = "/src/components/App.svelte";
const MOBILE_APP_ROOT = "/src/components_mobile/App.svelte";
const APP_ROOTS = [DESKTOP_APP_ROOT, MOBILE_APP_ROOT];
function isAppRoot(id) {
    return APP_ROOTS.some((root) => id.endsWith(root));
}

// Returns true when every path from `id` back to a bundle entry point passes through
// at least one dynamic import(), meaning the module will never be loaded on the initial
// page render.  Circular imports are handled by optimistically treating a module as lazy
// while its own reachability is still being computed (the sentinel value).
function isOnlyDynamicallyReachable(id, getModuleInfo) {
    const cached = lazyModuleCache.get(id);
    if (cached !== undefined) return cached;

    // Sentinel: treat as lazy while we compute (handles cycles correctly — if a cycle
    // exists entirely within lazy modules the optimistic true will be confirmed, and if
    // the cycle includes a statically-reachable module the sentinel will be overwritten
    // with false once a non-lazy importer is found).
    lazyModuleCache.set(id, true);

    const info = getModuleInfo(id);
    if (!info || info.isEntry || isAppRoot(id)) {
        lazyModuleCache.set(id, false);
        return false;
    }

    // No static importers and at least one dynamic importer → only reachable via
    // dynamic import().  Guard against orphaned/unreachable modules (zero importers of
    // any kind) by requiring at least one dynamic importer.
    if (info.importers.length === 0) {
        const result = info.dynamicImporters.length > 0;
        lazyModuleCache.set(id, result);
        return result;
    }

    // Lazy only when every static importer is itself only lazily reachable.
    const result = info.importers.every((importer) =>
        isOnlyDynamicallyReachable(importer, getModuleInfo),
    );
    lazyModuleCache.set(id, result);
    return result;
}

// Put external dependencies into their own bundle so that they get cached separately.
// Any node_modules package that is exclusively reachable through dynamic import() calls
// (i.e. no static import path exists from any entry point) is left out of the vendor
// chunk so Rollup can co-locate it with the lazy chunk that first requires it.  This
// automatically covers transitive deps of lazy flows like wallet sign-in or meme builder
// without needing to maintain a manual exclusion list.
export function manualChunks(id, { getModuleInfo }) {
    if (id.includes("node_modules")) {
        if (isOnlyDynamicallyReachable(id, getModuleInfo)) {
            // Return undefined — Rollup places this module in whichever lazy chunk
            // imports it (or a shared lazy chunk when multiple lazy importers exist).
            return undefined;
        }
        return "vendor";
    }
}

// Rollup plugin that clears the manualChunks cache before every build.  Add it to the
// plugins array in rollup.config.mjs so watch-mode rebuilds start with a fresh cache.
export function resetManualChunksCache() {
    return {
        name: "reset-manual-chunks-cache",
        buildStart() {
            lazyModuleCache.clear();
        },
    };
}

// Every chunk which `chunk` statically imports, directly or transitively: what the browser has to
// fetch before it can run `chunk`, which it otherwise only discovers one level at a time.
function staticImports(chunk, chunksByFileName, found = new Set()) {
    for (const fileName of chunk.imports) {
        const imported = chunksByFileName.get(fileName);
        if (imported !== undefined && !found.has(fileName)) {
            found.add(fileName);
            staticImports(imported, chunksByFileName, found);
        }
    }
    return found;
}

// What index.html paints behind a dark theme until the app's own styles arrive: the background of
// the default dark theme (theme/defaultDark.ts), which is near enough to every dark theme's.
export const STARTUP_DARK_BACKGROUND = "#1b1c21";

// The inline script which gets the rest of the startup path downloading while the entry chunks are
// still in flight. Left to itself the browser discovers that path one round trip at a time: the
// entry chunks import the App chunk, which imports its shared chunks, and running that asks for
// the locale and only then starts the worker.
//
// First it paints the page dark if the theme last used was a dark one (themes.ts records it).
// On a first visit it goes by what the app will default to: dark on the mobile layout, and the
// OS preference otherwise. Without this the page stays white until the app's styles have been
// downloaded and run.
//
// It has to be a script rather than <link> tags because which App tree and which locale get loaded
// is only known in the browser. Both choices mirror what the app goes on to do (`selectLayout` in
// utils/layout.ts and `getStoredLocale` in i18n/i18n.ts); if they ever disagree the cost is a
// wasted download, not a broken page.
export function generateStartupScript({ chunks, version, mobileLayout }) {
    const chunksByFileName = new Map(chunks.map((c) => [c.fileName, c]));
    const entry = chunks.find((c) => c.isEntry);
    // The entry's own imports are preloaded by <link> tags, which the preload scanner can see
    const alreadyPreloaded = staticImports(entry, chunksByFileName);

    const appChunks = (root) => {
        const app = chunks.find((c) => c.moduleIds.some((id) => id.endsWith(root)));
        if (app === undefined) {
            throw new Error(`No chunk found for ${root}, so it cannot be preloaded`);
        }
        return [app.fileName, ...staticImports(app, chunksByFileName)].filter(
            (f) => !alreadyPreloaded.has(f),
        );
    };

    const locales = Object.fromEntries(
        chunks.flatMap((c) =>
            c.moduleIds.flatMap((id) => {
                const locale = id.match(/\/src\/i18n\/(\w+)\.json$/)?.[1];
                return locale !== undefined ? [[locale, c.fileName]] : [];
            }),
        ),
    );
    if (locales.en === undefined) {
        throw new Error("No chunk found for the en locale, so it cannot be preloaded");
    }

    return `(function () {
    var mobile = ${mobileLayout} === "v2" && window.innerWidth < 768;
    var mode;
    try {
        mode = localStorage.getItem("openchat_startup_theme_mode");
    } catch (e) {}
    if (mode ? mode === "dark" : mobile || window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.style.backgroundColor = "${STARTUP_DARK_BACKGROUND}";
    }
    function preload(file) {
        var link = document.createElement("link");
        link.rel = "modulepreload";
        link.href = "/" + file;
        document.head.appendChild(link);
    }
    (mobile ? ${JSON.stringify(appChunks(MOBILE_APP_ROOT))} : ${JSON.stringify(appChunks(DESKTOP_APP_ROOT))}).forEach(preload);
    var locales = ${JSON.stringify(locales)};
    var locale;
    try {
        locale = localStorage.getItem("openchat_locale");
    } catch (e) {}
    locale = (locale || navigator.language || "en").split("-")[0];
    preload(locales.en);
    if (locale !== "en" && locales[locale]) preload(locales[locale]);
    try {
        window.OC_PRESTARTED_WORKER = new Worker(${JSON.stringify(`/worker.js?v=${version}`)}, { type: "module" });
    } catch (e) {}
})();`;
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
