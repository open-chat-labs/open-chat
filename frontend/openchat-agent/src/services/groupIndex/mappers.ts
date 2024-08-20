import { mapOptional, principalBytesToString } from "../../utils/mapping";
import type {
    AddHotGroupExclusionResponse,
    DeleteFrozenGroupResponse,
    FreezeGroupResponse,
    GroupChatSummary,
    GroupMatch,
    RemoveHotGroupExclusionResponse,
    SetCommunityModerationFlagsResponse,
    SetGroupUpgradeConcurrencyResponse,
    UnfreezeGroupResponse,
    CommunityMatch,
    GroupSearchResponse,
    ActiveGroupsResponse,
    ExploreCommunitiesResponse,
    ChannelIdentifier,
} from "openchat-shared";
import { UnsupportedValueError } from "openchat-shared";
import { publicGroupSummaryJson } from "../common/publicSummaryMapper";
import { accessGateJson, groupSubtypeJson } from "../common/chatMappers";
import type {
    CommunityMatch as TCommunityMatch,
    GroupIndexActiveGroupsResponse,
    GroupIndexAddHotGroupExclusionResponse,
    GroupIndexDeleteFrozenGroupResponse,
    GroupIndexExploreCommunitiesResponse,
    GroupIndexExploreGroupsResponse,
    GroupIndexFreezeGroupResponse,
    GroupIndexLookupChannelByGroupIdResponse,
    GroupIndexRecommendedGroupsResponse,
    GroupIndexRemoveHotGroupExclusionResponse,
    GroupIndexSetCommunityModerationFlagsResponse,
    GroupIndexSetCommunityUpgradeConcurrencyResponse,
    GroupIndexUnfreezeGroupResponse,
    GroupMatch as TGroupMatch,
} from "../../typebox";

export function activeGroupsResponse(json: GroupIndexActiveGroupsResponse): ActiveGroupsResponse {
    return {
        timestamp: json.Success.timestamp,
        activeGroups: json.Success.active_groups.map(principalBytesToString),
        activeCommunities: json.Success.active_communities.map(principalBytesToString),
        deletedCommunities: json.Success.deleted_communities.map((d) => ({
            id: principalBytesToString(d.id),
            timestamp: d.timestamp,
            deletedBy: principalBytesToString(d.deleted_by),
            name: d.name,
            public: d.public,
        })),
        deletedGroups: json.Success.deleted_groups.map((d) => ({
            id: principalBytesToString(d.id),
            timestamp: d.timestamp,
            deletedBy: principalBytesToString(d.deleted_by),
            name: d.name,
            public: d.public,
        })),
    };
}

export function recommendedGroupsResponse(
    json: GroupIndexRecommendedGroupsResponse,
): GroupChatSummary[] {
    if ("Success" in json) {
        // TODO - we are hard-coding is_invited to false here which is something we have to live with for the moment
        return json.Success.groups.map((g) => publicGroupSummaryJson(g, false));
    }
    throw new Error(`Unknown GroupIndex.RecommendedGroupsResponse of ${json}`);
}

export function lookupChannelResponse(
    json: GroupIndexLookupChannelByGroupIdResponse,
): ChannelIdentifier | undefined {
    if (json !== "NotFound" && "Success" in json) {
        return {
            kind: "channel",
            communityId: principalBytesToString(json.Success.community_id),
            channelId: json.Success.channel_id.toString(),
        };
    }
    console.warn("ApiLookupChannelByGroupIdResponse failed with ", json);
    return undefined;
}

export function exploreCommunitiesResponse(
    json: GroupIndexExploreCommunitiesResponse,
): ExploreCommunitiesResponse {
    if (
        json === "InvalidTerm" ||
        json === "InvalidFlags" ||
        "TermTooShort" in json ||
        "TermTooLong" in json
    ) {
        return { kind: "term_invalid" };
    }
    if ("Success" in json) {
        return {
            kind: "success",
            matches: json.Success.matches.map(communityMatch),
            total: json.Success.total,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected GroupIndex.ExploreCommunitiesResponse type received",
        json,
    );
}

export function exploreGroupsResponse(json: GroupIndexExploreGroupsResponse): GroupSearchResponse {
    if (json === "InvalidTerm" || "TermTooShort" in json || "TermTooLong" in json) {
        return { kind: "term_invalid" };
    }
    if ("Success" in json) {
        return {
            kind: "success",
            matches: json.Success.matches.map(groupMatch),
            total: json.Success.total,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected GroupIndex.ExploreGroupsResponse type received",
        json,
    );
}

export function freezeGroupResponse(json: GroupIndexFreezeGroupResponse): FreezeGroupResponse {
    if (json === "ChatAlreadyFrozen") {
        return "chat_already_frozen";
    }
    if (json === "ChatNotFound") {
        return "chat_not_found";
    }
    if (json === "NotAuthorized") {
        return "not_authorized";
    }
    if ("Success" in json) {
        return {
            event: {
                kind: "chat_frozen",
                frozenBy: principalBytesToString(json.Success.event.frozen_by),
                reason: json.Success.event.reason,
            },
            timestamp: json.Success.timestamp,
            index: json.Success.index,
            expiresAt: mapOptional(json.Success.expires_at, Number),
        };
    }
    if ("InternalError" in json) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiFreezeGroupResponse type received", json);
}

export function unfreezeGroupResponse(
    json: GroupIndexUnfreezeGroupResponse,
): UnfreezeGroupResponse {
    if (json === "ChatNotFrozen") {
        return "chat_not_frozen";
    }
    if (json === "ChatNotFound") {
        return "chat_not_found";
    }
    if (json === "NotAuthorized") {
        return "not_authorized";
    }
    if ("Success" in json) {
        return {
            event: {
                kind: "chat_unfrozen",
                unfrozenBy: principalBytesToString(json.Success.event.unfrozen_by),
            },
            timestamp: json.Success.timestamp,
            index: json.Success.index,
            expiresAt: mapOptional(json.Success.expires_at, Number),
        };
    }
    if ("InternalError" in json) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiUnfreezeGroupResponse type received", json);
}

export function deleteFrozenGroupResponse(
    json: GroupIndexDeleteFrozenGroupResponse,
): DeleteFrozenGroupResponse {
    if (json === "Success") {
        return "success";
    }
    if (json === "ChatNotFrozen") {
        return "chat_not_frozen";
    }
    if (json === "ChatNotFound") {
        return "chat_not_found";
    }
    if (json === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in json) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteFrozenGroupResponse type received", json);
}

export function addHotGroupExclusionResponse(
    json: GroupIndexAddHotGroupExclusionResponse,
): AddHotGroupExclusionResponse {
    if (json === "Success") {
        return "success";
    }
    if (json === "ChatAlreadyExcluded") {
        return "chat_already_excluded";
    }
    if (json === "ChatNotFound") {
        return "chat_not_found";
    }
    if (json === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in json) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiAddHotGroupExclusionResponse type received",
        json,
    );
}

export function removeHotGroupExclusionResponse(
    json: GroupIndexRemoveHotGroupExclusionResponse,
): RemoveHotGroupExclusionResponse {
    if (json === "Success") {
        return "success";
    }
    if (json === "ChatNotExcluded") {
        return "chat_not_excluded";
    }
    if (json === "ChatNotFound") {
        return "chat_not_found";
    }
    if (json === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in json) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiRemoveHotGroupExclusionResponse type received",
        json,
    );
}

export function setUpgradeConcurrencyResponse(
    json: GroupIndexSetCommunityUpgradeConcurrencyResponse,
): SetGroupUpgradeConcurrencyResponse {
    if (json === "Success") {
        return "success";
    }
    if (json === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in json) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSetUpgradeConcurrencyResponse type received",
        json,
    );
}

export function setCommunityModerationFlagsResponse(
    json: GroupIndexSetCommunityModerationFlagsResponse,
): SetCommunityModerationFlagsResponse {
    if (json === "Success" || json === "Unchanged") {
        return "success";
    }
    if (json === "CommunityNotFound") {
        return "community_not_found";
    }
    if (json === "InvalidFlags") {
        return "invalid_flags";
    }
    if (json === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in json) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSetCommunityModerationFlagsResponse type received",
        json,
    );
}

function groupMatch(json: TGroupMatch): GroupMatch {
    return {
        chatId: { kind: "group_chat", groupId: principalBytesToString(json.id) },
        name: json.name,
        description: json.description,
        subtype: mapOptional(json.subtype, groupSubtypeJson),
        blobReference: mapOptional(json.avatar_id, (blobId) => ({
            blobId,
            canisterId: principalBytesToString(json.id),
        })),
    };
}

function communityMatch(json: TCommunityMatch): CommunityMatch {
    return {
        id: { kind: "community", communityId: principalBytesToString(json.id) },
        name: json.name,
        description: json.description,
        avatar: {
            blobReference: mapOptional(json.avatar_id, (blobId) => ({
                blobId,
                canisterId: principalBytesToString(json.id),
            })),
        },
        banner: {
            blobReference: mapOptional(json.banner_id, (blobId) => ({
                blobId,
                canisterId: principalBytesToString(json.id),
            })),
        },
        memberCount: json.member_count,
        channelCount: json.channel_count,
        gate: mapOptional(json.gate, accessGateJson) ?? { kind: "no_gate" },
        flags: json.moderation_flags,
        primaryLanguage: json.primary_language === "" ? "en" : json.primary_language,
    };
}
