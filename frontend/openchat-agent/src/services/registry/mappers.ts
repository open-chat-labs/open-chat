import type {
    NervousSystemSummary,
    RegistryUpdatesResponse,
    CryptocurrencyDetails,
    DexId,
} from "openchat-shared";
import { mapOptional, optionUpdateV2, principalBytesToString } from "../../utils/mapping";
import { BTC_SYMBOL, CKBTC_SYMBOL, UnsupportedValueError } from "openchat-shared";
import { buildTokenLogoUrl } from "../../utils/chat";
import type {
    ExchangeId as TExchangeId,
    RegistryNervousSystemSummary,
    RegistryTokenDetails,
    RegistryUpdatesResponse as TRegistryUpdatesResponse,
} from "../../typebox";

export function updatesResponse(
    value: TRegistryUpdatesResponse,
    blobUrlPattern: string,
    registryCanisterId: string,
): RegistryUpdatesResponse {
    if (value === "SuccessNoUpdates") {
        return {
            kind: "success_no_updates",
        };
    }
    if ("Success" in value) {
        return {
            kind: "success",
            lastUpdated: value.Success.last_updated,
            tokenDetails:
                mapOptional(value.Success.token_details, (tokens) =>
                    tokens.map((t) => tokenDetails(t, blobUrlPattern, registryCanisterId)),
                ) ?? [],
            tokensUninstalled: value.Success.tokens_uninstalled?.map(principalBytesToString) ?? [],
            nervousSystemSummary: value.Success.nervous_system_details.map(nervousSystemSummary),
            swapProviders: mapOptional(value.Success.swap_providers, (r) => r.map(swapProvider)),
            messageFiltersAdded: value.Success.message_filters_added,
            messageFiltersRemoved: value.Success.message_filters_removed,
            currentAirdropChannel: optionUpdateV2(value.Success.airdrop_config, (cfg) => {
                const communityId = principalBytesToString(cfg.community_id);
                const channelId = Number(cfg.channel_id);

                return {
                    id: {
                        kind: "channel",
                        communityId,
                        channelId,
                    },
                    channelName: cfg.channel_name,
                    communityName: cfg.community_name,
                    url: `/community/${communityId}/channel/${channelId}`
                };
            }),
        };
    }

    throw new UnsupportedValueError("Unexpected ApiUpdatesResponse type received", value);
}

function tokenDetails(
    value: RegistryTokenDetails,
    blobUrlPattern: string,
    registryCanisterId: string,
): CryptocurrencyDetails {
    const ledger = principalBytesToString(value.ledger_canister_id);

    const tokenDetails = {
        ledger,
        name: value.name,
        symbol: value.symbol,
        decimals: value.decimals,
        transferFee: value.fee,
        logo:
            value.logo_id !== undefined
                ? buildTokenLogoUrl(
                      blobUrlPattern,
                      registryCanisterId,
                      ledger,
                      BigInt(value.logo_id),
                  )
                : value.logo,
        infoUrl: value.info_url,
        transactionUrlFormat: value.transaction_url_format,
        supportedStandards: value.supported_standards,
        added: value.added,
        enabled: value.enabled,
        lastUpdated: value.last_updated,
    };

    if (tokenDetails.symbol === CKBTC_SYMBOL) {
        // Override ckBTC to BTC
        tokenDetails.name = "Bitcoin";
        tokenDetails.symbol = BTC_SYMBOL;
        tokenDetails.logo = "/assets/btc_logo.svg";
    }

    return tokenDetails;
}

function nervousSystemSummary(value: RegistryNervousSystemSummary): NervousSystemSummary {
    return {
        rootCanisterId: principalBytesToString(value.root_canister_id),
        governanceCanisterId: principalBytesToString(value.governance_canister_id),
        ledgerCanisterId: principalBytesToString(value.ledger_canister_id),
        indexCanisterId: principalBytesToString(value.index_canister_id),
        isNns: value.is_nns,
        proposalRejectionFee: value.proposal_rejection_fee,
        submittingProposalsEnabled: value.submitting_proposals_enabled,
    };
}

function swapProvider(value: TExchangeId): DexId {
    if (value === "ICPSwap") return "icpswap";
    if (value === "Sonic") return "sonic";
    if (value === "KongSwap") return "kongswap";
    throw new UnsupportedValueError("Unexpected ApiSwapProvider type received", value);
}
