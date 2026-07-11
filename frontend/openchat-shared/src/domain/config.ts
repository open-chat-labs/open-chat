import type { GroupInvite } from "./inviteCodes";

export type AgentConfig = {
    icUrl: string;
    iiDerivationOrigin?: string;
    openStorageIndexCanister: string;
    groupIndexCanister: string;
    notificationsCanister: string;
    identityCanister: string;
    onlineCanister: string;
    userIndexCanister: string;
    translationsCanister: string;
    registryCanister: string;
    internetIdentityUrl: string;
    nfidUrl: string;
    userGeekApiKey: string;
    enableMultiCrypto?: boolean;
    blobUrlPattern: string;
    canisterUrlPath: string;
    proposalBotCanister: string;
    marketMakerCanister: string;
    signInWithEmailCanister: string;
    signInWithEthereumCanister: string;
    signInWithSolanaCanister: string;
    oneSecForwarderCanister: string;
    oneSecMinterCanister: string;
    // When undefined the mock verifier client is used (Phase 0 of #9072)
    verifierCanister?: string;
    logger: {
        error(message?: unknown, ...optionalParams: unknown[]): void;
    };
    websiteVersion: string;
    rollbarApiKey: string;
    env: string;
    bitcoinMainnetEnabled: boolean;
    groupInvite?: GroupInvite;
    accountLinkingCodesEnabled: boolean;
};
