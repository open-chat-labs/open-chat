import type { ApiTokenDetails, ApiUpdatesResponse } from "./candid/idl";
import type { RegistryUpdatesResponse, TokenDetails } from "openchat-shared";
import { optional } from "../../utils/mapping";
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
        logo: candid.logo,
        snsCanisters: optional(candid.nervous_system, (sns) => ({
            root: sns.root.toString(),
            governance: sns.governance.toString(),
        })),
        infoUrl: candid.info_url,
        howToBuyUrl: candid.how_to_buy_url,
        transactionUrlFormat: candid.transaction_url_format,
        added: candid.added,
        lastUpdated: candid.last_updated,
    };
}
