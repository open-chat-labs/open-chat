import type {
    ApiAddParticipantsResponse,
    ApiEventsResponse,
    ApiEventWrapper,
    ApiGroupChatEvent,
    ApiChangeRoleResponse,
    ApiRemoveParticipantResponse,
    ApiSendMessageResponse,
    ApiUpdateGroupResponse,
    ApiToggleReactionResponse,
    ApiDeleteMessageResponse,
    ApiEditMessageResponse,
    ApiSelectedInitialResponse,
    ApiParticipant,
    ApiSelectedUpdatesResponse,
    ApiRole,
    ApiDeleteGroupResponse,
    ApiMessagesByMessageIndexResponse,
    ApiMessageEventWrapper,
    ApiPinMessageResponse,
    ApiUnpinMessageResponse,
    ApiSearchGroupChatResponse,
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
    ChangeRoleResponse,
    Participant,
    GroupChatDetailsResponse,
    GroupChatDetailsUpdatesResponse,
    UnblockUserResponse,
    MemberRole,
    DeleteGroupResponse,
    Message,
    PinMessageResponse,
    UnpinMessageResponse,
} from "../../domain/chat/chat";
import { UnsupportedValueError } from "../../utils/error";
import type { Principal } from "@dfinity/principal";
import { groupPermissions, message, updatedMessage } from "../common/chatMappers";
import type { ApiBlockUserResponse, ApiUnblockUserResponse } from "../group/candid/idl";
import { messageMatch } from "../user/mappers";
import type { SearchGroupChatResponse } from "../../domain/search/search";

function principalToString(p: Principal): string {
    return p.toString();
}

export function apiRole(role: MemberRole): ApiRole | undefined {
    switch (role) {
        case "admin":
            return { Admin: null };
        case "participant":
            return { Participant: null };
        case "owner":
            return { Owner: null };
        default:
            return undefined;
    }
}

function participantRole(candid: ApiRole): MemberRole {
    if ("Admin" in candid) {
        return "admin";
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
        return {
            kind: "success_no_updates",
            latestEventIndex: candid.SuccessNoUpdates,
        };
    }
    if ("Success" in candid) {
        return {
            kind: "success",
            participantsAddedOrUpdated:
                candid.Success.participants_added_or_updated.map(participant),
            participantsRemoved: new Set(
                candid.Success.participants_removed.map((u) => u.toString())
            ),
            blockedUsersAdded: new Set(candid.Success.blocked_users_added.map((u) => u.toString())),
            blockedUsersRemoved: new Set(
                candid.Success.blocked_users_removed.map((u) => u.toString())
            ),
            pinnedMessagesAdded: new Set(candid.Success.pinned_messages_added),
            pinnedMessagesRemoved: new Set(candid.Success.pinned_messages_removed),
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
            pinnedMessages: new Set(candid.Success.pinned_messages),
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
    if ("NotAuthorized" in candid) {
        return "not_authorised";
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
    if ("InvalidPoll" in candid) {
        return { kind: "invalid_poll" };
    }
    if ("NotAuthorized" in candid) {
        return { kind: "not_authorised" };
    }
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function changeRoleResponse(candid: ApiChangeRoleResponse): ChangeRoleResponse {
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
    if ("Invalid" in candid) {
        return "invalid";
    }
    throw new UnsupportedValueError("Unexpected ApiChangeRoleResponse type received", candid);
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

export function pinMessageResponse(candid: ApiPinMessageResponse): PinMessageResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    if ("NoChange" in candid) {
        return "no_change";
    }
    if ("MessageIndexOutOfRange" in candid) {
        return "index_out_of_range";
    }
    throw new UnsupportedValueError("Unexpected ApiPinMessageResponse type received", candid);
}

export function unpinMessageResponse(candid: ApiUnpinMessageResponse): UnpinMessageResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    if ("NoChange" in candid) {
        return "no_change";
    }
    throw new UnsupportedValueError("Unexpected ApiUnpinMessageResponse type received", candid);
}

export function getMessagesByMessageIndexResponse(
    candid: ApiMessagesByMessageIndexResponse
): EventsResponse<Message> {
    if ("Success" in candid) {
        console.log("event response: ", candid);
        return {
            events: candid.Success.messages.map(messageWrapper),
            affectedEvents: [],
        };
    }
    if ("CallerNotInGroup" in candid) {
        return "events_failed";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiMessagesByMessageIndexResponse type received",
        candid
    );
}

export function messageWrapper(candid: ApiMessageEventWrapper): EventWrapper<Message> {
    return {
        event: message(candid.event),
        timestamp: candid.timestamp,
        index: candid.index,
    };
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

export function searchGroupChatResponse(
    candid: ApiSearchGroupChatResponse
): SearchGroupChatResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map(messageMatch),
        };
    }
    if ("TermTooShort" in candid) {
        return {
            kind: "term_too_short",
        };
    }
    if ("TermTooLong" in candid) {
        return {
            kind: "term_too_long",
        };
    }
    if ("InvalidTerm" in candid) {
        return {
            kind: "term_invalid",
        };
    }
    if ("CallerNotInGroup" in candid) {
        return {
            kind: "caller_not_in_group",
        };
    }
    throw new UnsupportedValueError(
        "Unknown UserIndex.ApiSearchMessagesResponse type received",
        candid
    );
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

    if ("RoleChanged" in candid) {
        return {
            kind: "role_changed",
            userIds: candid.RoleChanged.user_ids.map((p) => p.toString()),
            changedBy: candid.RoleChanged.changed_by.toString(),
            oldRole: participantRole(candid.RoleChanged.old_role),
            newRole: participantRole(candid.RoleChanged.new_role),
        };
    }

    if ("MessagePinned" in candid) {
        return {
            kind: "message_pinned",
            pinnedBy: candid.MessagePinned.pinned_by.toString(),
            messageIndex: candid.MessagePinned.message_index,
        };
    }

    if ("MessageUnpinned" in candid) {
        return {
            kind: "message_unpinned",
            unpinnedBy: candid.MessageUnpinned.unpinned_by.toString(),
            messageIndex: candid.MessageUnpinned.message_index,
        };
    }

    if ("PollVoteRegistered" in candid) {
        return {
            kind: "poll_vote_registered",
            message: updatedMessage(candid.PollVoteRegistered),
        };
    }

    if ("PollVoteDeleted" in candid) {
        return {
            kind: "poll_vote_deleted",
            message: updatedMessage(candid.PollVoteDeleted),
        };
    }

    if ("PollEnded" in candid) {
        return {
            kind: "poll_ended",
            messageIndex: candid.PollEnded.message_index,
            eventIndex: candid.PollEnded.event_index,
        };
    }

    if ("PermissionsChanged" in candid) {
        return {
            kind: "permissions_changed",
            oldPermissions: groupPermissions(candid.PermissionsChanged.old_permissions),
            newPermissions: groupPermissions(candid.PermissionsChanged.new_permissions),
            changedBy: candid.PermissionsChanged.changed_by.toString(),
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
