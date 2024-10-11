import { emptyChatMetrics } from "../../utils/chat";
import { mapOptional, principalBytesToString } from "../../utils/mapping";
import { accessGate, groupSubtype, messageEvent } from "./chatMappersV2";
import {
    nullMembership,
    type GroupChatSummary,
    type PublicGroupSummaryResponse,
    CommonResponses,
} from "openchat-shared";
import type {
    GroupPublicSummaryResponse,
    PublicGroupSummary as TPublicGroupSummary,
} from "../../typebox";

export function publicGroupSummary(
    value: TPublicGroupSummary,
    isInvited: boolean,
): GroupChatSummary {
    const groupId = principalBytesToString(value.chat_id);
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        latestEventIndex: value.latest_event_index,
        latestMessageIndex: value.latest_message_index,
        latestMessage: mapOptional(value.latest_message, messageEvent),
        name: value.name,
        description: value.description,
        public: value.is_public,
        historyVisible: false,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        lastUpdated: value.last_updated,
        memberCount: value.participant_count,
        blobReference: mapOptional(value.avatar_id, (blobId) => ({
            blobId,
            canisterId: groupId,
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
        eventsTTL: value.events_ttl,
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        metrics: emptyChatMetrics(),
        subtype: mapOptional(value.subtype, groupSubtype),
        previewed: true,
        frozen: value.frozen !== undefined,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        gate: mapOptional(value.gate, accessGate) ?? { kind: "no_gate" },
        level: "group",
        membership: nullMembership(),
        localUserIndex: principalBytesToString(value.local_user_index_canister_id),
        isInvited,
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
    };
}

export function publicSummaryResponse(
    value: GroupPublicSummaryResponse,
): PublicGroupSummaryResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            group: publicGroupSummary(value.Success.summary, value.Success.is_invited),
        };
    } else {
        console.warn("ApiPublicSummaryResponse failed with ", value);
        return CommonResponses.failure();
    }
}
