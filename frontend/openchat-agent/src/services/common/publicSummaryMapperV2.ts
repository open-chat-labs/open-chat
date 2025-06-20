import { emptyChatMetrics } from "../../utils/chat";
import { mapOptional, principalBytesToString } from "../../utils/mapping";
import { accessGateConfig, groupSubtype, messageEvent } from "./chatMappersV2";
import {
    nullMembership,
    ROLE_NONE,
    type GroupChatSummary,
    type PublicGroupSummaryResponse,
} from "openchat-shared";
import type {
    GroupPublicSummarySuccessResult,
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
            changeRoles: ROLE_NONE,
            removeMembers: ROLE_NONE,
            deleteMessages: ROLE_NONE,
            updateGroup: ROLE_NONE,
            pinMessages: ROLE_NONE,
            inviteUsers: ROLE_NONE,
            addMembers: ROLE_NONE,
            reactToMessages: ROLE_NONE,
            mentionAllMembers: ROLE_NONE,
            startVideoCall: ROLE_NONE,
            messagePermissions: {
                default: ROLE_NONE,
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
        gateConfig: mapOptional(value.gate_config, accessGateConfig) ?? {
            gate: { kind: "no_gate" },
            expiry: undefined,
        },
        level: "group",
        membership: nullMembership(),
        localUserIndex: principalBytesToString(value.local_user_index_canister_id),
        isInvited,
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
        verified: false, // TODO - this needs to come from the backend
    };
}

export function publicSummarySuccess(
    value: GroupPublicSummarySuccessResult,
): PublicGroupSummaryResponse {
    return {
        kind: "success",
        group: publicGroupSummary(value.summary, value.is_invited),
    };
}
