import { OpenChat, type OpenChatConfig } from "@client";

/** Where uploaded blobs (avatars, profile backgrounds …) are served from. */
export const blobUrlPattern: string = import.meta.env.OC_BLOB_URL_PATTERN!;

/** This build of the website. */
export const websiteVersion: string = import.meta.env.OC_WEBSITE_VERSION!;

// The one OpenChat client config, built from the OC_* build env. Each App tree (components,
// components_mobile, web) creates its client with this once at startup.
export function createOpenChatClient(
    i18nFormatter: OpenChatConfig["i18nFormatter"],
    logger: OpenChatConfig["logger"],
): OpenChat {
    return new OpenChat({
        mobileLayout: import.meta.env.OC_MOBILE_LAYOUT,
        icUrl: import.meta.env.OC_IC_URL,
        webAuthnOrigin: import.meta.env.OC_WEBAUTHN_ORIGIN,
        iiDerivationOrigin: import.meta.env.OC_II_DERIVATION_ORIGIN,
        openStorageIndexCanister: import.meta.env.OC_STORAGE_INDEX_CANISTER!,
        groupIndexCanister: import.meta.env.OC_GROUP_INDEX_CANISTER!,
        notificationsCanister: import.meta.env.OC_NOTIFICATIONS_CANISTER!,
        identityCanister: import.meta.env.OC_IDENTITY_CANISTER!,
        onlineCanister: import.meta.env.OC_ONLINE_CANISTER!,
        dailyPuzzleCanister: import.meta.env.OC_DAILY_PUZZLE_CANISTER ?? "",
        userIndexCanister: import.meta.env.OC_USER_INDEX_CANISTER!,
        translationsCanister: import.meta.env.OC_TRANSLATIONS_CANISTER!,
        registryCanister: import.meta.env.OC_REGISTRY_CANISTER!,
        internetIdentityUrl: import.meta.env.OC_INTERNET_IDENTITY_URL!,
        nfidUrl: import.meta.env.OC_NFID_URL!,
        userGeekApiKey: import.meta.env.OC_USERGEEK_APIKEY!,
        videoBridgeUrl: import.meta.env.OC_VIDEO_BRIDGE_URL!,
        translateProxyUrl: import.meta.env.OC_TRANSLATE_PROXY_URL!,
        meteredApiKey: import.meta.env.OC_METERED_APIKEY!,
        blobUrlPattern,
        canisterUrlPath: import.meta.env.OC_CANISTER_URL_PATH!,
        proposalBotCanister: import.meta.env.OC_PROPOSALS_BOT_CANISTER!,
        signInWithEmailCanister: import.meta.env.OC_SIGN_IN_WITH_EMAIL_CANISTER!,
        signInWithEthereumCanister: import.meta.env.OC_SIGN_IN_WITH_ETHEREUM_CANISTER!,
        signInWithSolanaCanister: import.meta.env.OC_SIGN_IN_WITH_SOLANA_CANISTER!,
        oneSecForwarderCanister: import.meta.env.OC_ONESEC_FORWARDER_CANISTER!,
        oneSecMinterCanister: import.meta.env.OC_ONESEC_MINTER_CANISTER!,
        i18nFormatter,
        logger,
        websiteVersion,
        rollbarApiKey: import.meta.env.OC_ROLLBAR_ACCESS_TOKEN!,
        env: import.meta.env.OC_BUILD_ENV!,
        bitcoinMainnetEnabled: import.meta.env.OC_BITCOIN_MAINNET_ENABLED! === "true",
        vapidPublicKey: import.meta.env.OC_VAPID_PUBLIC_KEY!,
        accountLinkingCodesEnabled: import.meta.env.OC_ACCOUNT_LINKING_CODES_ENABLED! === "true",
        baseOrigin: import.meta.env.OC_BASE_ORIGIN!,
    });
}
