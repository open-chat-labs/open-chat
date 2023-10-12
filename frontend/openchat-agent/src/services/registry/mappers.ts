import type { ApiTokenDetails, ApiUpdatesResponse } from "./candid/idl";
import type { RegistryUpdatesResponse, TokenDetails } from "openchat-shared";
import { optional } from "../../utils/mapping";
import { UnsupportedValueError } from "openchat-shared";

export function updatesResponse(candid: ApiUpdatesResponse): RegistryUpdatesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            lastUpdated: candid.Success.last_updated,
            tokenDetails: optional(candid.Success.token_details, (t) => t.map(tokenDetails)) ?? [],
            nervousSystemDetails: candid.Success.nervous_system_details.map((ns) => ({
                governanceCanisterId: ns.governance_canister_id.toString(),
                ledgerCanisterId: ns.ledger_canister_id.toString(),
                isNns: ns.is_nns,
                proposalRejectionFee: ns.proposal_rejection_fee,
                submittingProposalsEnabled: ns.submitting_proposals_enabled,
            })),
        };
    }
    if ("SuccessNoUpdates" in candid) {
        return {
            kind: "success_no_updates",
        };
    }
    throw new UnsupportedValueError("Unexpected ApiUpdatesResponse type received", candid);
}

function tokenDetails(candid: ApiTokenDetails): TokenDetails {
    return {
        ledgerCanisterId: candid.ledger_canister_id.toString(),
        name: candid.name,
        symbol: candid.symbol,
        decimals: candid.decimals,
        fee: candid.fee,
        logo: candid.logo,
        nervousSystem: optional(candid.nervous_system, (ns) => ({
            root: ns.root.toString(),
            governance: ns.governance.toString(),
        })),
        infoUrl: candid.info_url,
        howToBuyUrl: candid.how_to_buy_url,
        transactionUrlFormat: candid.transaction_url_format,
        added: candid.added,
        lastUpdated: candid.last_updated,
    };
}
