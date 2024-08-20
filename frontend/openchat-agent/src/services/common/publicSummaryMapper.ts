import { emptyChatMetrics } from "../../utils/chat";
import type {
    ApiPublicGroupSummary,
    ApiPublicSummaryResponse,
} from "../../services/group/candid/idl";
import { identity, mapOptional, optional, principalBytesToString } from "../../utils/mapping";
import {
    apiGroupSubtype,
    accessGate,
    messageEvent,
    groupSubtypeJson,
    accessGateJson,
} from "./chatMappers";
import {
    nullMembership,
    type GroupChatSummary,
    type PublicGroupSummaryResponse,
    CommonResponses,
} from "openchat-shared";
import type { PublicGroupSummary as TPublicGroupSummary } from "../../typebox";

export function publicGroupSummary(
    candid: ApiPublicGroupSummary,
    isInvited: boolean,
): GroupChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId: candid.chat_id.toString() },
        latestEventIndex: candid.latest_event_index,
        latestMessageIndex: optional(candid.latest_message_index, identity),
        latestMessage: optional(candid.latest_message, messageEvent),
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        historyVisible: false,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        lastUpdated: candid.last_updated,
        memberCount: candid.participant_count,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
        permissions: {
            changeRoles: "none",
            removeMembers: "none",
            deleteMessages: "none",
            updateGroup: "none",
            pinMessages: "none",
            inviteUsers: "none",
            addMembers: "none",
            reactToMessages: "none",
            mentionAllMembers: "none",
            startVideoCall: "none",
            messagePermissions: {
                default: "none",
            },
            threadPermissions: undefined,
        },
        eventsTTL: optional(candid.events_ttl, identity),
        eventsTtlLastUpdated: candid.events_ttl_last_updated,
        metrics: emptyChatMetrics(),
        subtype: optional(candid.subtype, apiGroupSubtype),
        previewed: true,
        frozen: candid.frozen.length > 0,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "group",
        membership: nullMembership(),
        localUserIndex: candid.local_user_index_canister_id.toString(),
        isInvited,
        messagesVisibleToNonMembers: candid.messages_visible_to_non_members,
    };
}

export function publicGroupSummaryJson(
    json: TPublicGroupSummary,
    isInvited: boolean,
): GroupChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId: principalBytesToString(json.chat_id) },
        latestEventIndex: json.latest_event_index,
        latestMessageIndex: json.latest_message_index,
        latestMessage: undefined, // mapOptional(json.latest_message, messageEvent),
        name: json.name,
        description: json.description,
        public: json.is_public,
        historyVisible: false,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        lastUpdated: json.last_updated,
        memberCount: json.participant_count,
        blobReference: mapOptional(json.avatar_id, (blobId) => ({
            blobId,
            canisterId: principalBytesToString(json.chat_id),
        })),
        permissions: {
            changeRoles: "none",
            removeMembers: "none",
            deleteMessages: "none",
            updateGroup: "none",
            pinMessages: "none",
            inviteUsers: "none",
            addMembers: "none",
            reactToMessages: "none",
            mentionAllMembers: "none",
            startVideoCall: "none",
            messagePermissions: {
                default: "none",
            },
            threadPermissions: undefined,
        },
        eventsTTL: json.events_ttl,
        eventsTtlLastUpdated: json.events_ttl_last_updated,
        metrics: emptyChatMetrics(),
        subtype: mapOptional(json.subtype, groupSubtypeJson),
        previewed: true,
        frozen: json.frozen !== undefined,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        gate: mapOptional(json.gate, accessGateJson) ?? { kind: "no_gate" },
        level: "group",
        membership: nullMembership(),
        localUserIndex: principalBytesToString(json.local_user_index_canister_id),
        isInvited,
        messagesVisibleToNonMembers: json.messages_visible_to_non_members,
    };
}

export function publicSummaryResponse(
    candid: ApiPublicSummaryResponse,
): PublicGroupSummaryResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            group: publicGroupSummary(candid.Success.summary, candid.Success.is_invited),
        };
    } else {
        console.warn("ApiPublicSummaryResponse failed with ", candid);
        return CommonResponses.failure();
    }
}
