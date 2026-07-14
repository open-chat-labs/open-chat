import type { Logger } from "@shared";
import { type GroupInvite } from "@shared";

export type AgentConfig = {
    icUrl: string;
    iiDerivationOrigin?: string;
    openStorageIndexCanister: string;
    groupIndexCanister: string;
    notificationsCanister: string;
    onlineCanister: string;
    userIndexCanister: string;
    translationsCanister: string;
    registryCanister: string;
    identityCanister: string;
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
    bitcoinMainnetEnabled: boolean;
    groupInvite?: GroupInvite;
    logger: Logger;
    accountLinkingCodesEnabled: boolean;
};
