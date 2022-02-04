import type {
    ApiAddParticipantsResponse,
    ApiEventsResponse,
    ApiEventWrapper,
    ApiGroupChatEvent,
    ApiMakeAdminResponse,
    ApiRemoveParticipantResponse,
    ApiSendMessageResponse,
    ApiUpdateGroupResponse,
    ApiToggleReactionResponse,
    ApiDeleteMessageResponse,
    ApiEditMessageResponse,
    ApiDismissAdminResponse,
    ApiSelectedInitialResponse,
    ApiParticipant,
    ApiSelectedUpdatesResponse,
    ApiRole,
    ApiTransferOwnershipResponse,
    ApiDeleteGroupResponse,
} from "./candid/idl";
import type {
    EventsResponse,
    EventWrapper,
    GroupChatEvent,
    AddParticipantsResponse,
    SendMessageResponse,
    RemoveParticipantResponse,
    UpdateGroupResponse,
    ToggleReactionResponse,
    DeleteMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    MakeAdminResponse,
    DismissAdminResponse,
    Participant,
    GroupChatDetailsResponse,
    GroupChatDetailsUpdatesResponse,
    UnblockUserResponse,
    ParticipantRole,
    TransferOwnershipResponse,
    DeleteGroupResponse,
} from "../../domain/chat/chat";
import { UnsupportedValueError } from "../../utils/error";
import type { Principal } from "@dfinity/principal";
import { message, updatedMessage } from "../common/chatMappers";
import type { ApiBlockUserResponse, ApiUnblockUserResponse } from "../group/candid/idl";
import { identity, optional } from "../../utils/mapping";

function principalToString(p: Principal): string {
    return p.toString();
}

function participantRole(candid: ApiRole): ParticipantRole {
    if ("Admin" in candid) {
        return "admin";
    }
    if ("Viewer" in candid) {
        return "viewer";
    }
    if ("Participant" in candid) {
        return "participant";
    }
    if ("Owner" in candid) {
        return "owner";
    }
    if ("SuperAdmin" in candid) {
        return "super_admin";
    }
    throw new UnsupportedValueError("Unexpected ApiRole type received", candid);
}

function participant(candid: ApiParticipant): Participant {
    return {
        role: participantRole(candid.role),
        userId: candid.user_id.toString(),
    };
}

export function groupDetailsUpdatesResponse(
    candid: ApiSelectedUpdatesResponse
): GroupChatDetailsUpdatesResponse {
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("SuccessNoUpdates" in candid) {
        return "success_no_updates";
    }
    if ("Success" in candid) {
        return {
            participantsAddedOrUpdated:
                candid.Success.participants_added_or_updated.map(participant),
            participantsRemoved: new Set(
                candid.Success.participants_removed.map((u) => u.toString())
            ),
            blockedUsersAdded: new Set(candid.Success.blocked_users_added.map((u) => u.toString())),
            blockedUsersRemoved: new Set(
                candid.Success.blocked_users_removed.map((u) => u.toString())
            ),
            latestEventIndex: candid.Success.latest_event_index,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function groupDetailsResponse(candid: ApiSelectedInitialResponse): GroupChatDetailsResponse {
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("Success" in candid) {
        return {
            participants: candid.Success.participants.map(participant),
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            latestEventIndex: candid.Success.latest_event_index,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function deleteGroupResponse(candid: ApiDeleteGroupResponse): DeleteGroupResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteGroupResponse type received", candid);
}

export function transferOwnershipResponse(
    candid: ApiTransferOwnershipResponse
): TransferOwnershipResponse {
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("Success" in candid) {
        return "success";
    }
    if ("UserNotInGroup" in candid) {
        return "user_not_in_group";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    if ("UserAlreadySuperAdmin" in candid) {
        return "user_already_super_admin";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiTransferOwnershipResponse type received",
        candid
    );
}

export function unblockUserResponse(candid: ApiUnblockUserResponse): UnblockUserResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("GroupNotPublic" in candid) {
        return "group_not_public";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    if ("CannotUnblockSelf" in candid) {
        return "cannot_unblock_self";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function blockUserResponse(candid: ApiBlockUserResponse): BlockUserResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("GroupNotPublic" in candid) {
        return "group_not_public";
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
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("CannotBlockSelf" in candid) {
        return "cannot_block_self";
    }
    if ("CannotBlockUser" in candid) {
        return "cannot_block_user";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function deleteMessageResponse(candid: ApiDeleteMessageResponse): DeleteMessageResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("CallerNotInGroup" in candid) {
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
    if ("CallerNotInGroup" in candid) {
        return "not_in_group";
    }
    if ("CallerIsViewer" in candid) {
        return "caller_is_viewer";
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
    if ("CallerNotInGroup" in candid) {
        return "not_in_group";
    }
    if ("AvatarTooBig" in candid) {
        return "avatar_too_big";
    }
    throw new UnsupportedValueError("Unexpected ApiUpdateGroupResponse type received", candid);
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
    if ("CallerNotInGroup" in candid) {
        return "not_in_group";
    }
    if ("CallerIsViewer" in candid) {
        return "caller_is_viewer";
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
    if ("CallerNotInGroup" in candid) {
        return { kind: "not_in_group" };
    }
    if ("TextTooLong" in candid) {
        return { kind: "text_too_long" };
    }
    if ("MessageEmpty" in candid) {
        return { kind: "message_empty" };
    }
    if ("CallerIsViewer" in candid) {
        return { kind: "caller_is_viewer" };
    }
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function makeAdminResponse(candid: ApiMakeAdminResponse): MakeAdminResponse {
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

export function dismissAdminResponse(candid: ApiDismissAdminResponse): DismissAdminResponse {
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
    if ("CannotDismissSelf" in candid) {
        return "cannot_dismiss_self";
    }
    if ("UserNotAdmin" in candid) {
        return "user_not_admin";
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
    if ("CannotRemoveUser" in candid) {
        return "cannot_remove_user";
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
    if ("ParticipantLimitReached" in candid) {
        return {
            // todo - need some UI changes to deal with this properly
            kind: "participant_limit_reached",
        };
    }
    if ("Success" in candid) {
        return {
            kind: "add_participants_success",
        };
    }
    if ("CallerNotInGroup" in candid) {
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
        return "events_failed";
    }
    if ("CallerNotInGroup" in candid) {
        return "events_failed";
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
            joinAsViewer: candid.GroupChatCreated.join_as_viewer,
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

    if ("JoinAsViewerChanged" in candid) {
        return {
            kind: "join_as_viewer_changed",
            changedBy: candid.JoinAsViewerChanged.changed_by.toString(),
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

    if ("MessageEdited" in candid) {
        return {
            kind: "message_edited",
            message: updatedMessage(candid.MessageEdited),
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

    if ("UsersBlocked" in candid) {
        return {
            kind: "users_blocked",
            userIds: candid.UsersBlocked.user_ids.map((p) => p.toString()),
            blockedBy: candid.UsersBlocked.blocked_by.toString(),
        };
    }

    if ("UsersUnblocked" in candid) {
        return {
            kind: "users_unblocked",
            userIds: candid.UsersUnblocked.user_ids.map((p) => p.toString()),
            unblockedBy: candid.UsersUnblocked.unblocked_by.toString(),
        };
    }

    if ("OwnershipTransferred" in candid) {
        return {
            kind: "ownership_transferred",
            oldOwner: candid.OwnershipTransferred.old_owner.toString(),
            newOwner: candid.OwnershipTransferred.new_owner.toString(),
        };
    }

    if ("ParticipantAssumesSuperAdmin" in candid) {
        return {
            kind: "participant_assumes_super_admin",
            userId: candid.ParticipantAssumesSuperAdmin.user_id.toString(),
        };
    }

    if ("ParticipantDismissedAsSuperAdmin" in candid) {
        return {
            kind: "participant_dismissed_as_super_admin",
            userId: candid.ParticipantDismissedAsSuperAdmin.user_id.toString(),
        };
    }

    if ("ParticipantRelinquishesSuperAdmin" in candid) {
        return {
            kind: "participant_relinquishes_super_admin",
            userId: candid.ParticipantRelinquishesSuperAdmin.user_id.toString(),
        };
    }

    if ("PinnedMessageUpdated" in candid) {
        return {
            kind: "pinned_message_updated",
            newValue: optional(candid.PinnedMessageUpdated.new_value, identity),
            updatedBy: candid.PinnedMessageUpdated.updated_by.toString(),
        };
    }

    throw new UnsupportedValueError("Unexpected ApiEventWrapper type received", candid);
}

function event(candid: ApiEventWrapper): EventWrapper<GroupChatEvent> {
    return {
        event: groupChatEvent(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
    };
}
