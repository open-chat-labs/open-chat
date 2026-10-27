import type { CommunityInvite, GroupInvite, Logger, MessageFormatter } from "@shared";

export type OpenChatConfig = {
    mobileLayout: "v1" | "v2";
    icUrl?: string;
    webAuthnOrigin: string | undefined;
    iiDerivationOrigin?: string;
    openStorageIndexCanister: string;
    groupIndexCanister: string;
    notificationsCanister: string;
    identityCanister: string;
    onlineCanister: string;
    dailyPuzzleCanister: string;
    userIndexCanister: string;
    translationsCanister: string;
    registryCanister: string;
    internetIdentityUrl: string;
    nfidUrl: string;
    userGeekApiKey: string;
    videoBridgeUrl: string;
    translateProxyUrl: string;
    meteredApiKey: string;
    enableMultiCrypto?: boolean;
    blobUrlPattern: string;
    // Where the bridges' CDN serves the avatars of the accounts they relay messages from, eg. a
    // Telegram user's photo. Empty where there's none.
    bridgeAvatarsUrl: string;
    // The pricing service, which every token price comes from. Empty where there's none, in which
    // case the prices come from ICPSwap and there are no price charts
    priceServiceUrl: string;
    canisterUrlPath: string;
    proposalBotCanister: string;
    signInWithEmailCanister: string;
    signInWithEthereumCanister: string;
    signInWithSolanaCanister: string;
    oneSecForwarderCanister: string;
    oneSecMinterCanister: string;
    i18nFormatter: MessageFormatter;
    logger: Logger;
    websiteVersion: string;
    rollbarApiKey: string;
    env: string;
    bitcoinMainnetEnabled: boolean;
    groupInvite?: GroupInvite;
    communityInvite?: CommunityInvite;
    vapidPublicKey: string;
    accountLinkingCodesEnabled: boolean;
    baseOrigin: string;
};
