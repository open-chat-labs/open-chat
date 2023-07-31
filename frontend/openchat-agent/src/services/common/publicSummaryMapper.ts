import { emptyChatMetrics } from "../../utils/chat";
import type {
    ApiPublicGroupSummary,
    ApiPublicSummaryResponse,
} from "../../services/group/candid/idl";
import { optional } from "../../utils/mapping";
import { apiGroupSubtype, accessGate, message } from "./chatMappers";
import {
    nullMembership,
    type GroupChatSummary,
    PublicGroupSummaryResponse,
    CommonResponses,
} from "openchat-shared";

export function publicGroupSummary(candid: ApiPublicGroupSummary): GroupChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId: candid.chat_id.toString() },
        latestEventIndex: candid.latest_event_index,
        latestMessage: optional(candid.latest_message, (ev) => ({
            index: ev.index,
            timestamp: ev.timestamp,
            event: message(ev.event),
        })),
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
            changeRoles: "owner",
            removeMembers: "owner",
            deleteMessages: "owner",
            updateGroup: "owner",
            pinMessages: "owner",
            inviteUsers: "owner",
            createPolls: "owner",
            sendMessages: "owner",
            reactToMessages: "owner",
            replyInThread: "owner",
        },
        metrics: emptyChatMetrics(),
        subtype: optional(candid.subtype, apiGroupSubtype),
        previewed: true,
        frozen: candid.frozen.length > 0,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "group",
        membership: nullMembership(),
        isDefault: false,
    };
}

export function publicSummaryResponse(
    candid: ApiPublicSummaryResponse
): PublicGroupSummaryResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            group: publicGroupSummary(candid.Success.summary),
        };
    } else {
        console.warn("ApiPublicSummaryResponse failed with ", candid);
        return CommonResponses.failure();
    }
}
