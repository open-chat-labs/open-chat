import { emptyChatMetrics } from "../../utils/chat";
import type {
    ApiPublicGroupSummary,
    ApiPublicSummaryResponse,
} from "../../services/group/candid/idl";
import { optional } from "../../utils/mapping";
import { apiGroupSubtype, groupGate, message } from "./chatMappers";
import type { GroupChatSummary } from "openchat-shared";

export function publicGroupSummary(candid: ApiPublicGroupSummary): GroupChatSummary {
    return {
        kind: "group_chat",
        chatId: candid.chat_id.toString(),
        id: candid.chat_id.toString(),
        readByMeUpTo: optional(candid.latest_message, (m) => m.event.message_index),
        latestEventIndex: candid.latest_event_index,
        latestMessage: optional(candid.latest_message, (ev) => ({
            index: ev.index,
            timestamp: ev.timestamp,
            event: message(ev.event),
        })),
        notificationsMuted: true,
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        historyVisible: false,
        joined: BigInt(Date.now()),
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        lastUpdated: candid.last_updated,
        memberCount: candid.participant_count,
        myRole: "previewer",
        mentions: [],
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
        permissions: {
            changePermissions: "owner",
            changeRoles: "owner",
            removeMembers: "owner",
            blockUsers: "owner",
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
        myMetrics: emptyChatMetrics(),
        latestThreads: [],
        subtype: optional(candid.subtype, apiGroupSubtype),
        archived: false,
        previewed: true,
        frozen: candid.frozen.length > 0,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        gate: optional(candid.gate, groupGate) ?? { kind: "no_gate" },
        level: "group",
    };
}

export function publicSummaryResponse(
    candid: ApiPublicSummaryResponse
): GroupChatSummary | undefined {
    if ("Success" in candid) {
        return publicGroupSummary(candid.Success.summary);
    }
}
