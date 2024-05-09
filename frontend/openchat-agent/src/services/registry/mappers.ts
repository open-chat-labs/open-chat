import type { ApiNervousSystemSummary, ApiTokenDetails, ApiUpdatesResponse } from "./candid/idl";
import type {
    NervousSystemSummary,
    RegistryUpdatesResponse,
    CryptocurrencyDetails,
} from "openchat-shared";
import { optional } from "../../utils/mapping";
import { UnsupportedValueError } from "openchat-shared";
import { buildTokenLogoUrl } from "../../utils/chat";

export function updatesResponse(
    candid: ApiUpdatesResponse,
    blobUrlPattern: string,
    registryCanisterId: string,
): RegistryUpdatesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            lastUpdated: candid.Success.last_updated,
            tokenDetails:
                optional(candid.Success.token_details, (tokens) =>
                    tokens.map((t) => tokenDetails(t, blobUrlPattern, registryCanisterId)),
                ) ?? [],
            nervousSystemSummary: candid.Success.nervous_system_details.map(nervousSystemSummary),
            messageFiltersAdded: candid.Success.message_filters_added,
            messageFiltersRemoved: Array.from(candid.Success.message_filters_removed),
        };
    }
    if ("SuccessNoUpdates" in candid) {
        return {
            kind: "success_no_updates",
        };
    }
    throw new UnsupportedValueError("Unexpected ApiUpdatesResponse type received", candid);
}

function tokenDetails(
    candid: ApiTokenDetails,
    blobUrlPattern: string,
    registryCanisterId: string,
): CryptocurrencyDetails {
    const ledger = candid.ledger_canister_id.toString();
    const logoId = candid.logo_id[0];

    return {
        ledger,
        name: candid.name,
        symbol: candid.symbol,
        decimals: candid.decimals,
        transferFee: candid.fee,
        logo:
            logoId !== undefined
                ? buildTokenLogoUrl(blobUrlPattern, registryCanisterId, ledger, BigInt(logoId))
                : candid.logo,
        infoUrl: candid.info_url,
        howToBuyUrl: candid.how_to_buy_url,
        transactionUrlFormat: candid.transaction_url_format,
        supportedStandards: candid.supported_standards,
        added: candid.added,
        enabled: candid.enabled,
        lastUpdated: candid.last_updated,
    };
}

function nervousSystemSummary(candid: ApiNervousSystemSummary): NervousSystemSummary {
    return {
        rootCanisterId: candid.root_canister_id.toString(),
        governanceCanisterId: candid.governance_canister_id.toString(),
        ledgerCanisterId: candid.ledger_canister_id.toString(),
        indexCanisterId: candid.index_canister_id.toString(),
        isNns: candid.is_nns,
        proposalRejectionFee: candid.proposal_rejection_fee,
        submittingProposalsEnabled: candid.submitting_proposals_enabled,
    };
}
