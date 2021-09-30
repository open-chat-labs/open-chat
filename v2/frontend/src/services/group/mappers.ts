import type {
    ApiAddParticipantsResponse,
    ApiEventsResponse,
    ApiEventWrapper,
    ApiGroupChatEvent,
    ApiMakeAdminResponse,
    ApiMarkReadResponse,
    ApiPutChunkResponse,
    ApiRemoveParticipantResponse,
    ApiSendMessageResponse,
    ApiUpdateGroupResponse,
    ApiToggleReactionResponse,
    ApiDeleteMessageResponse,
    ApiEditMessageResponse,
} from "./candid/idl";
import type {
    EventsResponse,
    EventWrapper,
    GroupChatEvent,
    AddParticipantsResponse,
    SendMessageResponse,
    PutChunkResponse,
    ChangeAdminResponse,
    RemoveParticipantResponse,
    MarkReadResponse,
    UpdateGroupResponse,
    ToggleReactionResponse,
    DeleteMessageResponse,
    EditMessageResponse,
} from "../../domain/chat/chat";
import { UnsupportedValueError } from "../../utils/error";
import type { Principal } from "@dfinity/principal";
import { message, updatedMessage } from "../common/chatMappers";

function principalToString(p: Principal): string {
    return p.toString();
}

export function deleteMessageResponse(candid: ApiDeleteMessageResponse): DeleteMessageResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotInGroup" in candid) {
        return "not_in_group";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function toggleReactionResponse(candid: ApiToggleReactionResponse): ToggleReactionResponse {
    if ("Added" in candid) {
        return "added";
    }
    if ("Removed" in candid) {
        return "removed";
    }
    if ("InvalidReaction" in candid) {
        return "invalid";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("MessageNotFound" in candid) {
        return "message_not_found";
    }
    throw new UnsupportedValueError("Unexpected ApiToggleReactionResponse type received", candid);
}

export function updateGroupResponse(candid: ApiUpdateGroupResponse): UpdateGroupResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("DescriptionTooLong" in candid) {
        return "desc_too_long";
    }
    if ("NameTooLong" in candid) {
        return "name_too_long";
    }
    if ("Unchanged" in candid) {
        return "unchanged";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    if ("NameTaken" in candid) {
        return "name_taken";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiUpdateGroupResponse type received", candid);
}

export function markReadResponse(candid: ApiMarkReadResponse): MarkReadResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("SuccessNoChange" in candid) {
        return "success_no_change";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("NotInGroup" in candid) {
        return "not_in_group";
    }
    throw new UnsupportedValueError("Unexpected ApiMarkReadResponse type received", candid);
}

export function putChunkResponse(candid: ApiPutChunkResponse): PutChunkResponse {
    if ("Full" in candid) {
        return "put_chunk_full";
    }
    if ("ChunkTooBig" in candid) {
        return "put_chunk_too_big";
    }
    if ("Success" in candid) {
        return "put_chunk_success";
    }
    if ("ChunkAlreadyExists" in candid) {
        return "chunk_already_exists";
    }
    if ("BlobAlreadyExists" in candid) {
        return "blob_already_exists";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    throw new UnsupportedValueError("Unexpected ApiPutChunkResponse type received", candid);
}

export function editMessageResponse(candid: ApiEditMessageResponse): EditMessageResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("MessageNotFound" in candid) {
        return "message_not_found";
    }
    if ("NotInGroup" in candid) {
        return "not_in_group";
    }
    throw new UnsupportedValueError("Unexpected ApiEditMessageResponse type received", candid);
}

export function sendMessageResponse(candid: ApiSendMessageResponse): SendMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
        };
    }
    if ("NotInGroup" in candid) {
        return { kind: "not_in_group" };
    }
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function changeAdminResponse(candid: ApiMakeAdminResponse): ChangeAdminResponse {
    console.debug(candid);
    if ("Success" in candid) {
        return "success";
    }
    if ("UserNotInGroup" in candid) {
        return "user_not_in_group";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    throw new UnsupportedValueError("Unexpected ApiMakeAdminResonse type received", candid);
}

export function removeParticipantResponse(
    candid: ApiRemoveParticipantResponse
): RemoveParticipantResponse {
    console.debug(candid);
    if ("Success" in candid) {
        return "success";
    }
    if ("UserNotInGroup" in candid) {
        return "user_not_in_group";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    if ("CannotRemoveSelf" in candid) {
        return "cannot_remove_self";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiRemoveParticipantResponse type received",
        candid
    );
}

export function addParticipantsResponse(
    candid: ApiAddParticipantsResponse
): AddParticipantsResponse {
    if ("Failed" in candid) {
        return {
            kind: "add_participants_failed",
            usersAlreadyInGroup: candid.Failed.users_already_in_group.map(principalToString),
            usersBlockedFromGroup: candid.Failed.users_blocked_from_group.map(principalToString),
            usersWhoBlockedRequest: candid.Failed.users_who_blocked_request.map(principalToString),
            errors: candid.Failed.errors.map(principalToString),
        };
    }
    if ("PartialSuccess" in candid) {
        return {
            kind: "add_participants_partial_success",
            usersAdded: candid.PartialSuccess.users_added.map(principalToString),
            usersAlreadyInGroup:
                candid.PartialSuccess.users_already_in_group.map(principalToString),
            usersBlockedFromGroup:
                candid.PartialSuccess.users_blocked_from_group.map(principalToString),
            usersWhoBlockedRequest:
                candid.PartialSuccess.users_who_blocked_request.map(principalToString),
            errors: candid.PartialSuccess.errors.map(principalToString),
        };
    }
    if ("NotAuthorized" in candid) {
        return {
            kind: "add_participants_not_authorised",
        };
    }
    if ("Success" in candid) {
        return {
            kind: "add_participants_success",
        };
    }
    if ("NotInGroup" in candid) {
        return {
            kind: "add_participants_not_in_group",
        };
    }
    throw new UnsupportedValueError("Unexpected ApiAddParticipantsResponse type received", candid);
}

export function getEventsResponse(candid: ApiEventsResponse): EventsResponse<GroupChatEvent> {
    if ("Success" in candid) {
        console.log("event response: ", candid);
        return {
            events: candid.Success.events.map(event),
            affectedEvents: candid.Success.affected_events.map(event),
        };
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    throw new UnsupportedValueError("Unexpected ApiEventsResponse type received", candid);
}

function groupChatEvent(candid: ApiGroupChatEvent): GroupChatEvent {
    if ("Message" in candid) {
        return message(candid.Message);
    }
    if ("GroupChatCreated" in candid) {
        return {
            kind: "group_chat_created",
            name: candid.GroupChatCreated.name,
            description: candid.GroupChatCreated.description,
            created_by: candid.GroupChatCreated.created_by.toString(),
        };
    }
    if ("ParticipantsAdded" in candid) {
        return {
            kind: "participants_added",
            userIds: candid.ParticipantsAdded.user_ids.map((p) => p.toString()),
            addedBy: candid.ParticipantsAdded.added_by.toString(),
        };
    }
    if ("ParticipantJoined" in candid) {
        return {
            kind: "participant_joined",
            userId: candid.ParticipantJoined.user_id.toString(),
        };
    }
    if ("ParticipantsPromotedToAdmin" in candid) {
        return {
            kind: "participants_promoted_to_admin",
            userIds: candid.ParticipantsPromotedToAdmin.user_ids.map((p) => p.toString()),
            promotedBy: candid.ParticipantsPromotedToAdmin.promoted_by.toString(),
        };
    }
    if ("ParticipantsDismissedAsAdmin" in candid) {
        return {
            kind: "participants_dismissed_as_admin",
            userIds: candid.ParticipantsDismissedAsAdmin.user_ids.map((p) => p.toString()),
            dismissedBy: candid.ParticipantsDismissedAsAdmin.dismissed_by.toString(),
        };
    }
    if ("ParticipantsRemoved" in candid) {
        return {
            kind: "participants_removed",
            userIds: candid.ParticipantsRemoved.user_ids.map((p) => p.toString()),
            removedBy: candid.ParticipantsRemoved.removed_by.toString(),
        };
    }
    if ("ParticipantLeft" in candid) {
        return {
            kind: "participant_left",
            userId: candid.ParticipantLeft.user_id.toString(),
        };
    }

    if ("GroupNameChanged" in candid) {
        return {
            kind: "name_changed",
            changedBy: candid.GroupNameChanged.changed_by.toString(),
        };
    }

    if ("GroupDescriptionChanged" in candid) {
        return {
            kind: "desc_changed",
            changedBy: candid.GroupDescriptionChanged.changed_by.toString(),
        };
    }

    if ("AvatarChanged" in candid) {
        return {
            kind: "avatar_changed",
            changedBy: candid.AvatarChanged.changed_by.toString(),
        };
    }

    if ("MessageDeleted" in candid) {
        return {
            kind: "message_deleted",
            message: updatedMessage(candid.MessageDeleted),
        };
    }

    if ("MessageReactionAdded" in candid) {
        return {
            kind: "reaction_added",
            message: updatedMessage(candid.MessageReactionAdded),
        };
    }

    if ("MessageReactionRemoved" in candid) {
        return {
            kind: "reaction_removed",
            message: updatedMessage(candid.MessageReactionRemoved),
        };
    }
    // todo - we know there are other event types that we are not dealing with yet
    // ParticipantJoined
    // GroupDescChanged
    // GroupNameChanged
    throw new Error(`Unexpected ApiEventWrapper type received: ${JSON.stringify(candid)}`);
}

function event(candid: ApiEventWrapper): EventWrapper<GroupChatEvent> {
    return {
        event: groupChatEvent(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
    };
}
