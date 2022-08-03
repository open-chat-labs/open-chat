import { emptyChatMetrics } from "../../domain/chat/chat.utils.shared";
import DRange from "drange";
import type { GroupChatSummary } from "../../domain/chat/chat";
import type {
    ApiPublicGroupSummary,
    ApiPublicSummaryResponse,
} from "../../services/group/candid/idl";
import { optional } from "../../utils/mapping";
import { message } from "./chatMappers";
import { apiGroupSubtype } from "../../services/user/mappers";

export function publicGroupSummary(candid: ApiPublicGroupSummary): GroupChatSummary {
    return {
        kind: "group_chat",
        chatId: candid.chat_id.toString(),
        readByMe: new DRange(),
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
        historyVisibleToNewJoiners: false,
        joined: BigInt(Date.now()),
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        lastUpdated: candid.last_updated,
        participantCount: candid.participant_count,
        myRole: "previewer",
        mentions: [],
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
        ownerId: candid.owner_id.toString(),
        permissions: {
            changePermissions: "owner",
            changeRoles: "owner",
            addMembers: "owner",
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
    };
}

export function publicSummaryResponse(
    candid: ApiPublicSummaryResponse
): GroupChatSummary | undefined {
    if ("Success" in candid) {
        return publicGroupSummary(candid.Success.summary);
    }
}
