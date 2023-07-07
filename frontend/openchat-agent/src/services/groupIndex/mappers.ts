import { identity, optional } from "../../utils/mapping";
import type {
    AddHotGroupExclusionResponse,
    FilterGroupsResponse,
    FreezeGroupResponse,
    GroupMatch,
    RemoveHotGroupExclusionResponse,
    SetGroupUpgradeConcurrencyResponse,
    UnfreezeGroupResponse,
    CommunityMatch,
    GroupSearchResponse,
    ActiveGroupsResponse,
    ExploreCommunitiesResponse,
} from "openchat-shared";
import type {
    ApiActiveGroupsResponse,
    ApiAddHotGroupExclusionResponse,
    ApiCommunityMatch,
    ApiDeleteFrozenGroupResponse,
    ApiFilterGroupsResponse,
    ApiFreezeGroupResponse,
    ApiGroupMatch,
    ApiSearchResponse,
    ApiRecommendedGroupsResponse,
    ApiRemoveHotGroupExclusionResponse,
    ApiSetUpgradeConcurrencyResponse,
    ApiUnfreezeGroupResponse,
    ApiExploreCommunitiesResponse,
} from "./candid/idl";
import {
    DeleteFrozenGroupResponse,
    GroupChatSummary,
    UnsupportedValueError,
} from "openchat-shared";
import { publicGroupSummary } from "../common/publicSummaryMapper";
import { accessGate } from "../common/chatMappers";

export function activeGroupsResponse(candid: ApiActiveGroupsResponse): ActiveGroupsResponse {
    return {
        timestamp: candid.Success.timestamp,
        activeGroups: candid.Success.active_groups.map((g) => g.toString()),
        activeCommunities: candid.Success.active_communities.map((c) => c.toString()),
        deletedCommunities: candid.Success.deleted_communities.map((d) => ({
            id: d.id.toString(),
            timestamp: d.timestamp,
            deletedBy: d.deleted_by.toString(),
            name: d.name,
            public: d.public,
        })),
        deletedGroups: candid.Success.deleted_groups.map((d) => ({
            id: d.id.toString(),
            timestamp: d.timestamp,
            deletedBy: d.deleted_by.toString(),
            name: d.name,
            public: d.public,
        })),
    };
}

export function filterGroupsResponse(candid: ApiFilterGroupsResponse): FilterGroupsResponse {
    return {
        timestamp: candid.Success.timestamp,
        activeGroups: candid.Success.active_groups.map((g) => g.toString()),
        deletedGroups: candid.Success.deleted_groups.map((d) => ({
            id: d.id.toString(),
            timestamp: d.timestamp,
            deletedBy: d.deleted_by.toString(),
            name: d.group_name,
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

export function exploreCommunitiesResponse(
    candid: ApiExploreCommunitiesResponse
): ExploreCommunitiesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map(communityMatch),
            total: candid.Success.total,
        };
    }
    if ("TermTooShort" in candid || "TermTooLong" in candid || "InvalidTerm" in candid) {
        return { kind: "term_invalid" };
    }
    throw new Error(`Unknown GroupIndex.SearchResponse of ${candid}`);
}

export function searchGroupsResponse(candid: ApiSearchResponse): GroupSearchResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map(groupMatch),
            total: candid.Success.total,
        };
    }
    if ("TermTooShort" in candid || "TermTooLong" in candid || "InvalidTerm" in candid) {
        return { kind: "term_invalid" };
    }
    throw new Error(`Unknown GroupIndex.GroupSearchResponse of ${candid}`);
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
        memberCount: candid.member_count,
        channelCount: candid.channel_count,
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        flags: candid.moderation_flags,
        primaryLanguage: candid.primary_language === "" ? "en" : candid.primary_language,
    };
}
