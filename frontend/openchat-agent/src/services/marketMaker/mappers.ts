import type { ApiUpdateConfigResponse } from "./candid/idl";
import type { UpdateMarketMakerConfigResponse } from "@shared";
import { UnsupportedValueError } from "@shared";

export function updateConfigResponse(
    candid: ApiUpdateConfigResponse
): UpdateMarketMakerConfigResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ExchangeNotFound" in candid) {
        return "exchange_not_found";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiRole type received", candid);
}
