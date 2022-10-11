import { UnsupportedValueError } from "../../utils/error";
import { apiOptional, apiPermissionRole, groupPermissions, message, updatedMessage, } from "../common/chatMappers";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import { messageMatch } from "../user/mappers";
import { identity, optional } from "../../utils/mapping";
import { codeToText } from "../../domain/inviteCodes";
import { ReplicaNotUpToDateError } from "../error";
function principalToString(p) {
    return p.toString();
}
export function apiRole(role) {
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
export function apiOptionalGroupPermissions(permissions) {
    return {
        block_users: apiOptional(apiPermissionRole, permissions.blockUsers),
        change_permissions: apiOptional(apiPermissionRole, permissions.changePermissions),
        delete_messages: apiOptional(apiPermissionRole, permissions.deleteMessages),
        send_messages: apiOptional(apiPermissionRole, permissions.sendMessages),
        remove_members: apiOptional(apiPermissionRole, permissions.removeMembers),
        update_group: apiOptional(apiPermissionRole, permissions.updateGroup),
        invite_users: apiOptional(apiPermissionRole, permissions.inviteUsers),
        change_roles: apiOptional(apiPermissionRole, permissions.changeRoles),
        add_members: apiOptional(apiPermissionRole, permissions.addMembers),
        create_polls: apiOptional(apiPermissionRole, permissions.createPolls),
        pin_messages: apiOptional(apiPermissionRole, permissions.pinMessages),
        reply_in_thread: apiOptional(apiPermissionRole, permissions.replyInThread),
        react_to_messages: apiOptional(apiPermissionRole, permissions.reactToMessages),
    };
}
function memberRole(candid) {
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
function member(candid) {
    return {
        role: memberRole(candid.role),
        userId: candid.user_id.toString(),
    };
}
function groupRules(candid) {
    return {
        text: candid.text,
        enabled: candid.enabled,
    };
}
export function apiGroupRules(rules) {
    return {
        text: rules.text,
        enabled: rules.enabled,
    };
}
export function groupDetailsUpdatesResponse(candid) {
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
            membersAddedOrUpdated: candid.Success.participants_added_or_updated.map(member),
            membersRemoved: new Set(candid.Success.participants_removed.map((u) => u.toString())),
            blockedUsersAdded: new Set(candid.Success.blocked_users_added.map((u) => u.toString())),
            blockedUsersRemoved: new Set(candid.Success.blocked_users_removed.map((u) => u.toString())),
            pinnedMessagesAdded: new Set(candid.Success.pinned_messages_added),
            pinnedMessagesRemoved: new Set(candid.Success.pinned_messages_removed),
            latestEventIndex: candid.Success.latest_event_index,
            rules: optional(candid.Success.rules, groupRules),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}
export function groupDetailsResponse(candid) {
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("Success" in candid) {
        return {
            members: candid.Success.participants.map(member),
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            pinnedMessages: new Set(candid.Success.pinned_messages),
            latestEventIndex: candid.Success.latest_event_index,
            rules: groupRules(candid.Success.rules),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}
export function makeGroupPrivateResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("AlreadyPrivate" in candid) {
        return "already_private";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    throw new UnsupportedValueError("Unexpected ApiMakePrivateResponse type received", candid);
}
export function unblockUserResponse(candid) {
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
export function blockUserResponse(candid) {
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
export function deleteMessageResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("CallerNotInGroup" in candid) {
        return "not_in_group";
    }
    if ("MessageNotFound" in candid) {
        return "message_not_found";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}
export function addRemoveReactionResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("NoChange" in candid) {
        return "no_change";
    }
    if ("InvalidReaction" in candid) {
        return "invalid";
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
    throw new UnsupportedValueError("Unexpected ApiAddRemoveReactionResponse type received", candid);
}
export function updateGroupResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("DescriptionTooLong" in candid) {
        return "desc_too_long";
    }
    if ("NameTooLong" in candid) {
        return "name_too_long";
    }
    if ("NameTooShort" in candid) {
        return "name_too_short";
    }
    if ("NameReserved" in candid) {
        return "name_reserved";
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
    if ("RulesTooLong" in candid) {
        return "rules_too_long";
    }
    if ("RulesTooShort" in candid) {
        return "rules_too_short";
    }
    throw new UnsupportedValueError("Unexpected ApiUpdateGroupResponse type received", candid);
}
export function editMessageResponse(candid) {
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
export function sendMessageResponse(candid) {
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
    if ("InvalidRequest" in candid) {
        return { kind: "invalid_request", reason: candid.InvalidRequest };
    }
    if ("InvalidPoll" in candid) {
        return { kind: "invalid_poll" };
    }
    if ("NotAuthorized" in candid) {
        return { kind: "not_authorised" };
    }
    if ("ThreadMessageNotFound" in candid) {
        return { kind: "thread_message_not_found" };
    }
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}
export function changeRoleResponse(candid) {
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
export function removeMemberResponse(candid) {
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
    throw new UnsupportedValueError("Unexpected ApiRemoveParticipantResponse type received", candid);
}
export function addMembersResponse(candid) {
    if ("Failed" in candid) {
        return {
            kind: "add_members_failed",
            usersAlreadyInGroup: candid.Failed.users_already_in_group.map(principalToString),
            usersBlockedFromGroup: candid.Failed.users_blocked_from_group.map(principalToString),
            usersWhoBlockedRequest: candid.Failed.users_who_blocked_request.map(principalToString),
            errors: candid.Failed.errors.map(principalToString),
        };
    }
    if ("PartialSuccess" in candid) {
        return {
            kind: "add_members_partial_success",
            usersAdded: candid.PartialSuccess.users_added.map(principalToString),
            usersAlreadyInGroup: candid.PartialSuccess.users_already_in_group.map(principalToString),
            usersBlockedFromGroup: candid.PartialSuccess.users_blocked_from_group.map(principalToString),
            usersWhoBlockedRequest: candid.PartialSuccess.users_who_blocked_request.map(principalToString),
            errors: candid.PartialSuccess.errors.map(principalToString),
        };
    }
    if ("NotAuthorized" in candid) {
        return {
            kind: "add_members_not_authorised",
        };
    }
    if ("ParticipantLimitReached" in candid) {
        return {
            // todo - need some UI changes to deal with this properly
            kind: "member_limit_reached",
        };
    }
    if ("Success" in candid) {
        return {
            kind: "add_members_success",
        };
    }
    if ("CallerNotInGroup" in candid) {
        return {
            kind: "add_members_not_in_group",
        };
    }
    throw new UnsupportedValueError("Unexpected ApiAddParticipantsResponse type received", candid);
}
export function pinMessageResponse(candid) {
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
    if ("MessageNotFound" in candid) {
        return "message_not_found";
    }
    throw new UnsupportedValueError("Unexpected ApiPinMessageResponse type received", candid);
}
export function unpinMessageResponse(candid) {
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
    if ("MessageNotFound" in candid) {
        return "message_not_found";
    }
    throw new UnsupportedValueError("Unexpected ApiUnpinMessageResponse type received", candid);
}
export function getMessagesByMessageIndexResponse(candid, chatId, threadRootMessageIndex, latestClientEventIndexPreRequest) {
    if ("Success" in candid) {
        const latestEventIndex = candid.Success.latest_event_index;
        ensureReplicaIsUpToDate(chatId, threadRootMessageIndex, latestClientEventIndexPreRequest, latestEventIndex);
        return {
            events: candid.Success.messages.map(messageWrapper),
            affectedEvents: [],
            latestEventIndex,
        };
    }
    if ("CallerNotInGroup" in candid) {
        return "events_failed";
    }
    if ("ThreadMessageNotFound" in candid) {
        return "events_failed";
    }
    if ("ReplicaNotUpToDate" in candid) {
        throw ReplicaNotUpToDateError.byEventIndex(candid.ReplicaNotUpToDate, latestClientEventIndexPreRequest !== null && latestClientEventIndexPreRequest !== void 0 ? latestClientEventIndexPreRequest : -1, false);
    }
    throw new UnsupportedValueError("Unexpected ApiMessagesByMessageIndexResponse type received", candid);
}
export function messageWrapper(candid) {
    return {
        event: message(candid.event),
        timestamp: candid.timestamp,
        index: candid.index,
    };
}
export function getEventsResponse(candid, chatId, threadRootMessageIndex, latestClientEventIndexPreRequest) {
    if ("Success" in candid) {
        const latestEventIndex = candid.Success.latest_event_index;
        ensureReplicaIsUpToDate(chatId, threadRootMessageIndex, latestClientEventIndexPreRequest, latestEventIndex);
        return {
            events: candid.Success.events.map(event),
            affectedEvents: candid.Success.affected_events.map(event),
            latestEventIndex,
        };
    }
    if ("ChatNotFound" in candid) {
        return "events_failed";
    }
    if ("CallerNotInGroup" in candid) {
        return "events_failed";
    }
    if ("ThreadMessageNotFound" in candid) {
        return "events_failed";
    }
    if ("ReplicaNotUpToDate" in candid) {
        throw ReplicaNotUpToDateError.byEventIndex(candid.ReplicaNotUpToDate, latestClientEventIndexPreRequest !== null && latestClientEventIndexPreRequest !== void 0 ? latestClientEventIndexPreRequest : -1, false);
    }
    throw new UnsupportedValueError("Unexpected ApiEventsResponse type received", candid);
}
export function searchGroupChatResponse(candid) {
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
    throw new UnsupportedValueError("Unexpected UserIndex.ApiSearchMessagesResponse type received", candid);
}
export function inviteCodeResponse(candid) {
    if ("Success" in candid) {
        return {
            kind: "success",
            code: optional(candid.Success.code, codeToText),
        };
    }
    if ("NotAuthorized" in candid) {
        return {
            kind: "not_authorised",
        };
    }
    throw new UnsupportedValueError("Unexpected Group.ApiInviteCodeResponse type received", candid);
}
export function enableInviteCodeResponse(candid) {
    if ("Success" in candid) {
        return {
            kind: "success",
            code: codeToText(candid.Success.code),
        };
    }
    if ("NotAuthorized" in candid) {
        return {
            kind: "not_authorised",
        };
    }
    throw new UnsupportedValueError("Unexpected Group.ApiEnableInviteCodeResponse type received", candid);
}
export function disableInviteCodeResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    throw new UnsupportedValueError("Unexpected ApiDisableInviteCodeResponse type received", candid);
}
export function threadPreview(chatId, candid) {
    return {
        chatId,
        latestReplies: candid.latest_replies
            .map(messageEvent)
            .sort((e1, e2) => e1.index - e2.index),
        totalReplies: candid.total_replies,
        rootMessage: messageEvent(candid.root_message),
    };
}
function messageEvent(candid) {
    return {
        event: message(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
    };
}
export function threadPreviewsResponse(candid, chatId, latestClientThreadUpdate) {
    if ("Success" in candid) {
        return {
            kind: "thread_previews_success",
            threads: candid.Success.threads.map((t) => threadPreview(chatId, t)),
        };
    }
    if ("CallerNotInGroup" in candid) {
        return {
            kind: "caller_not_in_group",
        };
    }
    if ("ReplicaNotUpToDate" in candid) {
        throw ReplicaNotUpToDateError.byTimestamp(candid.ReplicaNotUpToDate, latestClientThreadUpdate !== null && latestClientThreadUpdate !== void 0 ? latestClientThreadUpdate : BigInt(-1));
    }
    throw new UnsupportedValueError("Unexpected Group.ApiThreadPreviewsResponse type received", candid);
}
export function resetInviteCodeResponse(candid) {
    if ("Success" in candid) {
        return {
            kind: "success",
            code: codeToText(candid.Success.code),
        };
    }
    if ("NotAuthorized" in candid) {
        return {
            kind: "not_authorised",
        };
    }
    throw new UnsupportedValueError("Unexpected Group.ApiResetInviteCodeResponse type received", candid);
}
export function registerPollVoteResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("PollEnded" in candid) {
        return "poll_ended";
    }
    if ("OptionIndexOutOfRange" in candid) {
        return "out_of_range";
    }
    if ("PollNotFound" in candid) {
        return "poll_not_found";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("PollsNotValidForDirectChats" in candid) {
        return "polls_not_valid_for_direct_chats";
    }
    throw new UnsupportedValueError("Unexpected ApiRegisterPollVoteResponse type received", candid);
}
function groupChatEvent(candid) {
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
    if ("DirectChatCreated" in candid) {
        return {
            kind: "direct_chat_created",
        };
    }
    if ("ParticipantsAdded" in candid) {
        return {
            kind: "members_added",
            userIds: candid.ParticipantsAdded.user_ids.map((p) => p.toString()),
            addedBy: candid.ParticipantsAdded.added_by.toString(),
        };
    }
    if ("ParticipantJoined" in candid) {
        return {
            kind: "member_joined",
            userId: candid.ParticipantJoined.user_id.toString(),
        };
    }
    if ("ParticipantsRemoved" in candid) {
        return {
            kind: "members_removed",
            userIds: candid.ParticipantsRemoved.user_ids.map((p) => p.toString()),
            removedBy: candid.ParticipantsRemoved.removed_by.toString(),
        };
    }
    if ("ParticipantLeft" in candid) {
        return {
            kind: "member_left",
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
    if ("GroupRulesChanged" in candid) {
        return {
            kind: "rules_changed",
            enabled: candid.GroupRulesChanged.enabled,
            enabledPrev: candid.GroupRulesChanged.prev_enabled,
            changedBy: candid.GroupRulesChanged.changed_by.toString(),
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
            kind: "member_assumes_super_admin",
            userId: candid.ParticipantAssumesSuperAdmin.user_id.toString(),
        };
    }
    if ("ParticipantDismissedAsSuperAdmin" in candid) {
        return {
            kind: "member_dismissed_as_super_admin",
            userId: candid.ParticipantDismissedAsSuperAdmin.user_id.toString(),
        };
    }
    if ("ParticipantRelinquishesSuperAdmin" in candid) {
        return {
            kind: "member_relinquishes_super_admin",
            userId: candid.ParticipantRelinquishesSuperAdmin.user_id.toString(),
        };
    }
    if ("RoleChanged" in candid) {
        return {
            kind: "role_changed",
            userIds: candid.RoleChanged.user_ids.map((p) => p.toString()),
            changedBy: candid.RoleChanged.changed_by.toString(),
            oldRole: memberRole(candid.RoleChanged.old_role),
            newRole: memberRole(candid.RoleChanged.new_role),
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
    if ("GroupVisibilityChanged" in candid) {
        return {
            kind: "group_visibility_changed",
            nowPublic: candid.GroupVisibilityChanged.now_public,
            changedBy: candid.GroupVisibilityChanged.changed_by.toString(),
        };
    }
    if ("GroupInviteCodeChanged" in candid) {
        let change = "disabled";
        if ("Enabled" in candid.GroupInviteCodeChanged.change) {
            change = "enabled";
        }
        else if ("Reset" in candid.GroupInviteCodeChanged.change) {
            change = "reset";
        }
        return {
            kind: "group_invite_code_changed",
            change,
            changedBy: candid.GroupInviteCodeChanged.changed_by.toString(),
        };
    }
    if ("ThreadUpdated" in candid) {
        return {
            kind: "thread_updated",
            messageIndex: candid.ThreadUpdated.message_index,
            eventIndex: candid.ThreadUpdated.event_index,
        };
    }
    if ("ProposalsUpdated" in candid) {
        return {
            kind: "proposals_updated",
            proposals: candid.ProposalsUpdated.proposals.map((p) => ({
                messageIndex: p.message_index,
                eventIndex: p.event_index,
            })),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiEventWrapper type received", candid);
}
function event(candid) {
    return {
        event: groupChatEvent(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
    };
}
export function registerProposalVoteResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("AlreadyVoted" in candid) {
        return "already_voted";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("NoEligibleNeurons" in candid) {
        return "no_eligible_neurons";
    }
    if ("ProposalNotAcceptingVotes" in candid) {
        return "proposal_not_accepting_votes";
    }
    if ("ProposalNotFound" in candid) {
        return "proposal_not_found";
    }
    if ("ProposalMessageNotFound" in candid) {
        return "proposal_message_not_found";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiVoteOnProposalResponse type received", candid);
}
export function rulesResponse(candid) {
    if ("Success" in candid) {
        const rules = optional(candid.Success.rules, identity);
        return {
            text: rules !== null && rules !== void 0 ? rules : "",
            enabled: rules !== undefined,
        };
    }
}
//# sourceMappingURL=mappers.js.map