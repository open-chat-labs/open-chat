import { emptyChatMetrics } from "../../utils/chat";
import type {
    ApiPublicGroupSummary,
    ApiPublicSummaryResponse,
} from "../../services/group/candid/idl";
import { identity, optional } from "../../utils/mapping";
import { apiGroupSubtype, messageEvent, accessGateConfig } from "./chatMappers";
import {
    nullMembership,
    type GroupChatSummary,
    type PublicGroupSummaryResponse,
    CommonResponses,
} from "openchat-shared";

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
        gateConfig: optional(candid.gate_config, accessGateConfig) ?? {
            gate: { kind: "no_gate" },
            expiry: undefined,
        },
        level: "group",
        membership: nullMembership(),
        localUserIndex: candid.local_user_index_canister_id.toString(),
        isInvited,
        messagesVisibleToNonMembers: candid.messages_visible_to_non_members,
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
