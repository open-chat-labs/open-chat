import { optional } from "../../utils/mapping";
import type { FreezeGroupResponse, GroupMatch, GroupSearchResponse, UnfreezeGroupResponse } from "openchat-shared";
import type { ApiFreezeGroupResponse, ApiGroupMatch, ApiSearchResponse, ApiUnfreezeGroupResponse } from "./candid/idl";
import { UnsupportedValueError } from "openchat-shared";

export function groupSearchResponse(candid: ApiSearchResponse): GroupSearchResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map(groupMatch),
        };
    }
    throw new Error(`Unknown GroupIndex.SearchResponse of ${candid}`);
}

export function freezeGroupResponse(candid: ApiFreezeGroupResponse): FreezeGroupResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatAlreadyFrozen" in candid) {
        return "chat_already_frozen";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiFreezeGroupResponse type received", candid);
}

export function unfreezeGroupResponse(candid: ApiUnfreezeGroupResponse): UnfreezeGroupResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFrozen" in candid) {
        return "chat_not_frozen";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiUnfreezeGroupResponse type received", candid);
}

function groupMatch(candid: ApiGroupMatch): GroupMatch {
    return {
        chatId: candid.chat_id.toString(),
        name: candid.name,
        description: candid.description,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
    };
}
