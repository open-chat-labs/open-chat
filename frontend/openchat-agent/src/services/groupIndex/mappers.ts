import { identity, optional } from "../../utils/mapping";
import type {
    AddHotGroupExclusionResponse,
    FilterGroupsResponse,
    FreezeGroupResponse,
    GroupMatch,
    SearchResponse,
    RemoveHotGroupExclusionResponse,
    SetGroupUpgradeConcurrencyResponse,
    UnfreezeGroupResponse,
    CommunityMatch,
    SearchScope,
    GroupSearchResponse,
} from "openchat-shared";
import type {
    ApiAddHotGroupExclusionResponse,
    ApiCommunityMatch,
    ApiDeleteFrozenGroupResponse,
    ApiFilterGroupsResponse,
    ApiFreezeGroupResponse,
    ApiGroupMatch,
    ApiGroupSearchResponse,
    ApiRecommendedGroupsResponse,
    ApiRemoveHotGroupExclusionResponse,
    ApiSearchResponse,
    ApiSearchScope,
    ApiSetUpgradeConcurrencyResponse,
    ApiUnfreezeGroupResponse,
} from "./candid/idl";
import {
    DeleteFrozenGroupResponse,
    GroupChatSummary,
    UnsupportedValueError,
} from "openchat-shared";
import { publicGroupSummary } from "../common/publicSummaryMapper";

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
        upgradesInProgress: candid.Success.upgrades_in_progress.map((c) => c.toString()),
    };
}

export function recommendedGroupsResponse(
    candid: ApiRecommendedGroupsResponse
): GroupChatSummary[] {
    if ("Success" in candid) {
        return candid.Success.groups.map(publicGroupSummary);
    }
    throw new Error(`Unknown GroupIndex.RecommendedGroupsResponse of ${candid}`);
}

export function searchResponse(candid: ApiSearchResponse): SearchResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            groupMatches: candid.Success.group_matches.map(groupMatch),
            communityMatches: candid.Success.community_matches.map(communityMatch),
        };
    }
    if ("TermTooShort" in candid || "TermTooLong" in candid || "InvalidTerm" in candid) {
        return { kind: "term_invalid" };
    }
    throw new Error(`Unknown GroupIndex.SearchResponse of ${candid}`);
}

export function searchGroupsResponse(candid: ApiGroupSearchResponse): GroupSearchResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map(groupMatch),
        };
    }
    if ("TermTooShort" in candid || "TermTooLong" in candid || "InvalidTerm" in candid) {
        return { kind: "term_invalid" };
    }
    throw new Error(`Unknown GroupIndex.GroupSearchResponse of ${candid}`);
}

export function apiSearchScope(scope: SearchScope): ApiSearchScope {
    switch (scope) {
        case "all":
            return { All: null };
        case "communities":
            return { Communities: null };
        case "groups":
            return { Groups: null };
    }
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

export function deleteFrozenGroupResponse(
    candid: ApiDeleteFrozenGroupResponse
): DeleteFrozenGroupResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFrozen" in candid) {
        return "chat_not_frozen";
    }
    if ("ChatNotFrozenLongEnough" in candid) {
        return "chat_not_frozen_long_enough";
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
    throw new UnsupportedValueError(
        "Unexpected ApiDeleteFrozenGroupResponse type received",
        candid
    );
}

export function addHotGroupExclusionResponse(
    candid: ApiAddHotGroupExclusionResponse
): AddHotGroupExclusionResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatAlreadyExcluded" in candid) {
        return "chat_already_excluded";
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
    throw new UnsupportedValueError(
        "Unexpected ApiAddHotGroupExclusionResponse type received",
        candid
    );
}

export function removeHotGroupExclusionResponse(
    candid: ApiRemoveHotGroupExclusionResponse
): RemoveHotGroupExclusionResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotExcluded" in candid) {
        return "chat_not_excluded";
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
    throw new UnsupportedValueError(
        "Unexpected ApiRemoveHotGroupExclusionResponse type received",
        candid
    );
}

export function setUpgradeConcurrencyResponse(
    candid: ApiSetUpgradeConcurrencyResponse
): SetGroupUpgradeConcurrencyResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSetUpgradeConcurrencyResponse type received",
        candid
    );
}

function groupMatch(candid: ApiGroupMatch): GroupMatch {
    return {
        chatId: { kind: "group_chat", groupId: candid.chat_id.toString() },
        name: candid.name,
        description: candid.description,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
    };
}

function communityMatch(candid: ApiCommunityMatch): CommunityMatch {
    return {
        id: { kind: "community", communityId: candid.id.toString() },
        name: candid.name,
        description: candid.description,
        avatar: {
            blobReference: optional(candid.avatar_id, (blobId) => ({
                blobId,
                canisterId: candid.id.toString(),
            })),
        },
        banner: {
            blobReference: optional(candid.banner_id, (blobId) => ({
                blobId,
                canisterId: candid.id.toString(),
            })),
        },
        memberCount: 1000, //TODO fill in
        channelCount: 15, //TODO fill in
    };
}
