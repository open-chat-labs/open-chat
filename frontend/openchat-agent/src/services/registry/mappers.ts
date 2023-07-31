import type { ApiTokenDetails, ApiUpdatesResponse } from "./candid/idl";
import type { RegistryUpdatesResponse, TokenDetails } from "openchat-shared";
import { identity, optional } from "../../utils/mapping";
import { UnsupportedValueError } from "openchat-shared";

export function updatesResponse(candid: ApiUpdatesResponse): RegistryUpdatesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            lastUpdated: candid.Success.last_updated,
            tokenDetails: optional(candid.Success.token_details, (t) => t.map(tokenDetails)),
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
        logo: optional(candid.logo, identity),
        snsCanisters: optional(candid.nervous_system, (sns) => ({
            root: sns.root.toString(),
            governance: sns.governance.toString(),
        })),
        infoUrl: optional(candid.info_url, identity),
        howToBuyUrl: optional(candid.how_to_buy_url, identity),
        transactionUrlFormat: optional(candid.transaction_url_format, identity),
        added: candid.added,
        lastUpdated: candid.last_updated,
    };
}
