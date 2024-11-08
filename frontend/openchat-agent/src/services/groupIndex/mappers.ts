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
    FreezeCommunityResponse,
    UnfreezeCommunityResponse,
} from "openchat-shared";
import { UnsupportedValueError } from "openchat-shared";
import { publicGroupSummary } from "../common/publicSummaryMapperV2";
import { accessGateConfig, groupSubtype } from "../common/chatMappersV2";
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
    GroupIndexFreezeCommunityResponse,
    GroupIndexUnfreezeCommunityResponse,
} from "../../typebox";

export function activeGroupsResponse(value: GroupIndexActiveGroupsResponse): ActiveGroupsResponse {
    return {
        timestamp: value.Success.timestamp,
        activeGroups: value.Success.active_groups.map(principalBytesToString),
        activeCommunities: value.Success.active_communities.map(principalBytesToString),
        deletedCommunities: value.Success.deleted_communities.map((d) => ({
            id: principalBytesToString(d.id),
            timestamp: d.timestamp,
            deletedBy: principalBytesToString(d.deleted_by),
            name: d.name,
            public: d.public,
        })),
        deletedGroups: value.Success.deleted_groups.map((d) => ({
            id: principalBytesToString(d.id),
            timestamp: d.timestamp,
            deletedBy: principalBytesToString(d.deleted_by),
            name: d.name,
            public: d.public,
        })),
    };
}

export function recommendedGroupsResponse(
    value: GroupIndexRecommendedGroupsResponse,
): GroupChatSummary[] {
    if ("Success" in value) {
        // TODO - we are hard-coding is_invited to false here which is something we have to live with for the moment
        return value.Success.groups.map((g) => publicGroupSummary(g, false));
    }
    throw new Error(`Unknown GroupIndex.RecommendedGroupsResponse of ${value}`);
}

export function lookupChannelResponse(
    value: GroupIndexLookupChannelByGroupIdResponse,
): ChannelIdentifier | undefined {
    if (value !== "NotFound" && "Success" in value) {
        return {
            kind: "channel",
            communityId: principalBytesToString(value.Success.community_id),
            channelId: value.Success.channel_id.toString(),
        };
    }
    console.warn("ApiLookupChannelByGroupIdResponse failed with ", value);
    return undefined;
}

export function exploreCommunitiesResponse(
    value: GroupIndexExploreCommunitiesResponse,
): ExploreCommunitiesResponse {
    if (
        value === "InvalidTerm" ||
        value === "InvalidFlags" ||
        "TermTooShort" in value ||
        "TermTooLong" in value
    ) {
        return { kind: "term_invalid" };
    }
    if ("Success" in value) {
        return {
            kind: "success",
            matches: value.Success.matches.map(communityMatch),
            total: value.Success.total,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected GroupIndex.ExploreCommunitiesResponse type received",
        value,
    );
}

export function exploreGroupsResponse(value: GroupIndexExploreGroupsResponse): GroupSearchResponse {
    if (value === "InvalidTerm" || "TermTooShort" in value || "TermTooLong" in value) {
        return { kind: "term_invalid" };
    }
    if ("Success" in value) {
        return {
            kind: "success",
            matches: value.Success.matches.map(groupMatch),
            total: value.Success.total,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected GroupIndex.ExploreGroupsResponse type received",
        value,
    );
}

export function freezeGroupResponse(value: GroupIndexFreezeGroupResponse): FreezeGroupResponse {
    if (value === "ChatAlreadyFrozen") {
        return "chat_already_frozen";
    }
    if (value === "ChatNotFound") {
        return "chat_not_found";
    }
    if (value === "NotAuthorized") {
        return "not_authorized";
    }
    if ("Success" in value) {
        return {
            event: {
                kind: "chat_frozen",
                frozenBy: principalBytesToString(value.Success.event.frozen_by),
                reason: value.Success.event.reason,
            },
            timestamp: value.Success.timestamp,
            index: value.Success.index,
            expiresAt: mapOptional(value.Success.expires_at, Number),
        };
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiFreezeGroupResponse type received", value);
}

export function freezeCommunityResponse(
    value: GroupIndexFreezeCommunityResponse,
): FreezeCommunityResponse {
    if (value === "CommunityAlreadyFrozen") {
        return "community_already_frozen";
    }
    if (value === "CommunityNotFound") {
        return "community_not_found";
    }
    if (value === "NotAuthorized") {
        return "not_authorized";
    }
    if ("Success" in value) {
        return "success";
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiFreezeCommunityResponse type received", value);
}

export function unfreezeCommunityResponse(
    value: GroupIndexUnfreezeCommunityResponse,
): UnfreezeCommunityResponse {
    if (value === "CommunityNotFrozen") {
        return "community_not_frozen";
    }
    if (value === "CommunityNotFound") {
        return "community_not_found";
    }
    if (value === "NotAuthorized") {
        return "not_authorized";
    }
    if ("Success" in value) {
        return "success";
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiUnfreezeCommunityResponse type received", value);
}

export function unfreezeGroupResponse(
    value: GroupIndexUnfreezeGroupResponse,
): UnfreezeGroupResponse {
    if (value === "ChatNotFrozen") {
        return "chat_not_frozen";
    }
    if (value === "ChatNotFound") {
        return "chat_not_found";
    }
    if (value === "NotAuthorized") {
        return "not_authorized";
    }
    if ("Success" in value) {
        return {
            event: {
                kind: "chat_unfrozen",
                unfrozenBy: principalBytesToString(value.Success.event.unfrozen_by),
            },
            timestamp: value.Success.timestamp,
            index: value.Success.index,
            expiresAt: mapOptional(value.Success.expires_at, Number),
        };
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiUnfreezeGroupResponse type received", value);
}

export function deleteFrozenGroupResponse(
    value: GroupIndexDeleteFrozenGroupResponse,
): DeleteFrozenGroupResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "ChatNotFrozen") {
        return "chat_not_frozen";
    }
    if (value === "ChatNotFound") {
        return "chat_not_found";
    }
    if (value === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteFrozenGroupResponse type received", value);
}

export function addHotGroupExclusionResponse(
    value: GroupIndexAddHotGroupExclusionResponse,
): AddHotGroupExclusionResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "ChatAlreadyExcluded") {
        return "chat_already_excluded";
    }
    if (value === "ChatNotFound") {
        return "chat_not_found";
    }
    if (value === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiAddHotGroupExclusionResponse type received",
        value,
    );
}

export function removeHotGroupExclusionResponse(
    value: GroupIndexRemoveHotGroupExclusionResponse,
): RemoveHotGroupExclusionResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "ChatNotExcluded") {
        return "chat_not_excluded";
    }
    if (value === "ChatNotFound") {
        return "chat_not_found";
    }
    if (value === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiRemoveHotGroupExclusionResponse type received",
        value,
    );
}

export function setUpgradeConcurrencyResponse(
    value: GroupIndexSetCommunityUpgradeConcurrencyResponse,
): SetGroupUpgradeConcurrencyResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSetUpgradeConcurrencyResponse type received",
        value,
    );
}

export function setCommunityModerationFlagsResponse(
    value: GroupIndexSetCommunityModerationFlagsResponse,
): SetCommunityModerationFlagsResponse {
    if (value === "Success" || value === "Unchanged") {
        return "success";
    }
    if (value === "CommunityNotFound") {
        return "community_not_found";
    }
    if (value === "InvalidFlags") {
        return "invalid_flags";
    }
    if (value === "NotAuthorized") {
        return "not_authorized";
    }
    if ("InternalError" in value) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSetCommunityModerationFlagsResponse type received",
        value,
    );
}

function groupMatch(value: TGroupMatch): GroupMatch {
    return {
        chatId: { kind: "group_chat", groupId: principalBytesToString(value.id) },
        name: value.name,
        description: value.description,
        subtype: mapOptional(value.subtype, groupSubtype),
        blobReference: mapOptional(value.avatar_id, (blobId) => ({
            blobId,
            canisterId: principalBytesToString(value.id),
        })),
    };
}

function communityMatch(value: TCommunityMatch): CommunityMatch {
    return {
        id: { kind: "community", communityId: principalBytesToString(value.id) },
        name: value.name,
        description: value.description,
        avatar: {
            blobReference: mapOptional(value.avatar_id, (blobId) => ({
                blobId,
                canisterId: principalBytesToString(value.id),
            })),
        },
        banner: {
            blobReference: mapOptional(value.banner_id, (blobId) => ({
                blobId,
                canisterId: principalBytesToString(value.id),
            })),
        },
        memberCount: value.member_count,
        channelCount: value.channel_count,
        gateConfig: mapOptional(value.gate_config, accessGateConfig) ?? {
            expiry: undefined,
            gate: { kind: "no_gate" },
        },
        flags: value.moderation_flags,
        primaryLanguage: value.primary_language === "" ? "en" : value.primary_language,
    };
}
