import type {
    NervousSystemSummary,
    RegistryUpdatesResponse,
    CryptocurrencyDetails,
} from "openchat-shared";
import { mapOptional, principalBytesToString } from "../../utils/mapping";
import { UnsupportedValueError } from "openchat-shared";
import { buildTokenLogoUrl } from "../../utils/chat";
import type {
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
            nervousSystemSummary: value.Success.nervous_system_details.map(nervousSystemSummary),
            messageFiltersAdded: value.Success.message_filters_added,
            messageFiltersRemoved: value.Success.message_filters_removed,
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

    return {
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
        howToBuyUrl: value.how_to_buy_url,
        transactionUrlFormat: value.transaction_url_format,
        supportedStandards: value.supported_standards,
        added: value.added,
        enabled: value.enabled,
        lastUpdated: value.last_updated,
    };
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
