import { identity, optional } from "../../utils/mapping";
import type {
    FilterGroupsResponse,
    FreezeGroupResponse,
    GroupMatch,
    GroupSearchResponse,
    UnfreezeGroupResponse
} from "openchat-shared";
import type { ApiFilterGroupsResponse, ApiFreezeGroupResponse, ApiGroupMatch, ApiSearchResponse, ApiUnfreezeGroupResponse } from "./candid/idl";
import { UnsupportedValueError } from "openchat-shared";

export function filterGroupsResponse(candid: ApiFilterGroupsResponse): FilterGroupsResponse {
    return {
        timestamp: candid.Success.timestamp,
        activeGroups: candid.Success.active_groups.map((g) => g.toString()),
        deletedGroups: candid.Success.deleted_groups.map((d) => ({
            id: d.id.toString(),
            timestamp: d.timestamp,
            deletedBy: d.deleted_by.toString(),
            groupName: d.group_name,
            public: d.public,
        })),
        upgradesInProgress: candid.Success.upgrades_in_progress.map((c) => c.toString())
    };
}

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
        return {
            event: {
                kind: "chat_frozen",
                frozenBy: candid.Success.event.frozen_by.toString(),
                reason: optional(candid.Success.event.reason, identity),
            },
            timestamp: candid.Success.timestamp,
            index: candid.Success.index,
        };
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
        return {
            event: {
                kind: "chat_unfrozen",
                unfrozenBy: candid.Success.event.unfrozen_by.toString(),
            },
            timestamp: candid.Success.timestamp,
            index: candid.Success.index,
        };
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
