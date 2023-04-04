import { GroupChatSummary, JoinGroupResponse, UnsupportedValueError } from "openchat-shared";
import type { ApiGroupCanisterGroupChatSummary, ApiJoinGroupResponse } from "./candid/idl";
import { identity, optional } from "../../utils/mapping";
import {
    apiGroupSubtype,
    chatMetrics,
    groupGate,
    groupPermissions,
    memberRole,
    message,
} from "../common/chatMappers";

export function joinGroupResponse(candid: ApiJoinGroupResponse): JoinGroupResponse {
    if ("Success" in candid) {
        return groupChatSummary(candid.Success);
    }
    if ("AlreadyInGroupV2" in candid) {
        return groupChatSummary(candid.AlreadyInGroupV2);
    }
    if ("Blocked" in candid) {
        return { kind: "blocked" };
    }
    if ("AlreadyInGroup" in candid) {
        return { kind: "already_in_group" };
    }
    if ("GroupNotPublic" in candid) {
        return { kind: "group_not_public" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("ParticipantLimitReached" in candid) {
        // todo - check if we need to deal with this in the UI
        return { kind: "member_limit_reached" };
    }
    if ("GroupNotFound" in candid) {
        return { kind: "group_not_found" };
    }
    if ("NotSuperAdmin" in candid) {
        return { kind: "not_super_admin" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    throw new UnsupportedValueError("Unexpected ApiJoinGroupResponse type received", candid);
}

function groupChatSummary(candid: ApiGroupCanisterGroupChatSummary): GroupChatSummary {
    const latestMessage = optional(candid.latest_message, (ev) => ({
        index: ev.index,
        timestamp: ev.timestamp,
        event: message(ev.event),
    }));
    return {
        kind: "group_chat",
        chatId: candid.chat_id.toString(),
        latestMessage,
        readByMeUpTo: latestMessage?.event.messageIndex,
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        historyVisibleToNewJoiners: candid.history_visible_to_new_joiners,
        joined: candid.joined,
        minVisibleEventIndex: candid.min_visible_event_index,
        minVisibleMessageIndex: candid.min_visible_message_index,
        latestEventIndex: candid.latest_event_index,
        lastUpdated: candid.last_updated,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
        notificationsMuted: candid.notifications_muted,
        memberCount: candid.participant_count,
        myRole: memberRole(candid.role),
        mentions: [],
        permissions: groupPermissions(candid.permissions),
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
        latestThreads: [],
        subtype: optional(candid.subtype, apiGroupSubtype),
        archived: false,
        previewed: false,
        frozen: candid.frozen.length > 0,
        dateLastPinned: optional(candid.date_last_pinned, identity),
        dateReadPinned: undefined,
        gate: optional(candid.gate, groupGate) ?? { kind: "no_gate" },
    };
}
