/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly OC_ACHIEVEMENT_URL_PATH: string;
    readonly OC_AIRDROP_BOT_CANISTER: string;
    readonly OC_BLOB_URL_PATTERN: string;
    readonly OC_BUILD_ENV: string;
    readonly OC_DFX_NETWORK: string;
    readonly OC_GROUP_INDEX_CANISTER: string;
    readonly OC_IC_URL: string;
    readonly OC_II_DERIVATION_ORIGIN: string;
    readonly OC_IDENTITY_CANISTER: string;
    readonly OC_INTERNET_IDENTITY_CANISTER_ID: string;
    readonly OC_INTERNET_IDENTITY_URL: string;
    readonly OC_MARKET_MAKER_CANISTER: string;
    readonly OC_METERED_APIKEY: string;
    readonly OC_NFID_URL: string;
    readonly OC_NODE_ENV: string;
    readonly OC_NOTIFICATIONS_CANISTER: string;
    readonly OC_ONLINE_CANISTER: string;
    readonly OC_WEBSITE_VERSION: string;
    readonly OC_PREVIEW_PROXY_URL: string;
    readonly OC_PROPOSALS_BOT_CANISTER: string;
    readonly OC_PUBLIC_TRANSLATE_API_KEY: string;
    readonly OC_REGISTRY_CANISTER: string;
    readonly OC_ROLLBAR_ACCESS_TOKEN: string;
    readonly OC_SERVICE_WORKER_PATH: string;
    readonly OC_SIGN_IN_WITH_EMAIL_CANISTER: string;
    readonly OC_SIGN_IN_WITH_ETHEREUM_CANISTER: string;
    readonly OC_SIGN_IN_WITH_SOLANA_CANISTER: string;
    readonly OC_STORAGE_INDEX_CANISTER: string;
    readonly OC_SUSPICIOUS_USERIDS: string[];
    readonly OC_TENOR_APIKEY: string;
    readonly OC_TRANSLATIONS_CANISTER: string;
    readonly OC_USER_INDEX_CANISTER: string;
    readonly OC_USERGEEK_APIKEY: string;
    readonly OC_VIDEO_BRIDGE_URL: string;
    readonly OC_WALLET_CONNECT_PROJECT_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
