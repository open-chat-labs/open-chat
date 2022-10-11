import { bytesToHexString, identity, optional, optionUpdate } from "../../utils/mapping";
import { UnsupportedValueError } from "../../utils/error";
import { completedCryptoTransfer, groupPermissions, message, messageContent, token, updatedMessage, } from "../common/chatMappers";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import { publicGroupSummary } from "../common/publicSummaryMapper";
import { ReplicaNotUpToDateError } from "../error";
export function publicProfileResponse(candid) {
    const profile = candid.Success;
    return {
        username: profile.username,
        avatarId: optional(profile.avatar_id, identity),
        bio: profile.bio,
        isPremium: profile.is_premium,
        phoneIsVerified: profile.phone_is_verified,
        created: profile.created,
    };
}
export function setBioResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("TooLong" in candid) {
        return "bio_too_long";
    }
    throw new UnsupportedValueError(`Unexpected ApiSetBioResponse type received`, candid);
}
export function recommendedGroupsResponse(candid) {
    if ("Success" in candid) {
        return candid.Success.groups.map(publicGroupSummary);
    }
    if ("InternalError" in candid) {
        return [];
    }
    throw new UnsupportedValueError(`Unexpected ApiRecommendedGroupsResponse type received`, candid);
}
export function searchAllMessagesResponse(candid) {
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
    throw new UnsupportedValueError("Unknown UserIndex.ApiSearchMessagesResponse type received", candid);
}
export function searchDirectChatResponse(candid) {
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
    if ("ChatNotFound" in candid) {
        return {
            kind: "chat_not_found",
        };
    }
    throw new UnsupportedValueError("Unknown UserIndex.ApiSearchMessagesResponse type received", candid);
}
export function messageMatch(candid) {
    const sender = candid.sender.toString();
    return {
        chatId: candid.chat_id.toString(),
        messageIndex: candid.message_index,
        content: messageContent(candid.content, sender),
        sender,
        score: candid.score,
    };
}
export function deleteMessageResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
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
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("MessageNotFound" in candid) {
        return "message_not_found";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    throw new UnsupportedValueError("Unexpected ApiAddRemoveReactionResponse type received", candid);
}
export function setAvatarResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("AvatarTooBig" in candid) {
        return "avatar_too_big";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiSetAvatarResponse type received", candid);
}
export function markReadResponse(_candid) {
    // currently only one success type which makes mapping this a bit redundant but I'll
    // leave the pattern in place in case we have other return types in the future.
    return "success";
}
export function leaveGroupResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("CallerNotInGroup" in candid) {
        return "not_in_group";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("GroupNotFound" in candid) {
        return "group_not_found";
    }
    if ("GroupNotPublic" in candid) {
        return "group_not_public";
    }
    if ("OwnerCannotLeave" in candid) {
        return "owner_cannot_leave";
    }
    throw new UnsupportedValueError("Unexpected ApiLeaveGroupResponse type received", candid);
}
export function joinGroupResponse(candid) {
    if ("Success" in candid) {
        return groupChatSummary(candid.Success);
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
    throw new UnsupportedValueError("Unexpected ApiLeaveGroupResponse type received", candid);
}
export function blockResponse(_candid) {
    return "success";
}
export function unblockResponse(_candid) {
    return "success";
}
export function pinChatResponse(candid) {
    if ("Success" in candid) {
        return { kind: "success" };
    }
    if ("PinnedLimitReached" in candid) {
        return { kind: "pinned_limit_reached", limit: candid.PinnedLimitReached };
    }
    throw new UnsupportedValueError("Unexpected ApiPinChatResponse type received", candid);
}
export function unpinChatResponse(_candid) {
    return "success";
}
export function archiveChatResponse(candid) {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    throw new UnsupportedValueError("Unexpected ApiArchiveChatResponse type received", candid);
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
    if ("UserBlocked" in candid) {
        return "user_blocked";
    }
    throw new UnsupportedValueError("Unexpected ApiEditMessageResponse type received", candid);
}
export function transferWithinGroupResponse(candid, sender, recipient) {
    if ("Success" in candid) {
        const transfer = "NNS" in candid.Success.transfer
            ? candid.Success.transfer.NNS
            : candid.Success.transfer.SNS;
        return {
            kind: "transfer_success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
            transfer: completedCryptoTransfer(transfer, sender, recipient),
        };
    }
    if ("TransferCannotBeZero" in candid) {
        return { kind: "transfer_cannot_be_zero" };
    }
    if ("RecipientBlocked" in candid) {
        return { kind: "recipient_blocked" };
    }
    if ("InvalidRequest" in candid) {
        return { kind: "invalid_request", reason: candid.InvalidRequest };
    }
    if ("TextTooLong" in candid) {
        return { kind: "text_too_long" };
    }
    if ("MessageEmpty" in candid) {
        return { kind: "message_empty" };
    }
    if ("RecipientNotFound" in candid) {
        return { kind: "recipient_not_found" };
    }
    if ("TransferFailed" in candid) {
        return { kind: "transfer_failed" };
    }
    if ("CallerNotInGroup" in candid) {
        return { kind: "caller_not_in_group" };
    }
    if ("CryptocurrencyNotSupported" in candid) {
        return { kind: "cryptocurrency_not_supported" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("TransferLimitExceeded" in candid) {
        return { kind: "transfer_limit_exceeded" };
    }
    if ("InvalidPoll" in candid) {
        return { kind: "invalid_poll" };
    }
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}
export function sendMessageResponse(candid, sender, recipient) {
    if ("Success" in candid) {
        return {
            kind: "success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
        };
    }
    if ("TransferSuccessV2" in candid) {
        const transfer = "NNS" in candid.TransferSuccessV2.transfer
            ? candid.TransferSuccessV2.transfer.NNS
            : candid.TransferSuccessV2.transfer.SNS;
        return {
            kind: "transfer_success",
            timestamp: candid.TransferSuccessV2.timestamp,
            messageIndex: candid.TransferSuccessV2.message_index,
            eventIndex: candid.TransferSuccessV2.event_index,
            transfer: completedCryptoTransfer(transfer, sender, recipient),
        };
    }
    if ("TransferCannotBeZero" in candid) {
        return { kind: "transfer_cannot_be_zero" };
    }
    if ("RecipientBlocked" in candid) {
        return { kind: "recipient_blocked" };
    }
    if ("InvalidRequest" in candid) {
        return { kind: "invalid_request", reason: candid.InvalidRequest };
    }
    if ("TextTooLong" in candid) {
        return { kind: "text_too_long" };
    }
    if ("MessageEmpty" in candid) {
        return { kind: "message_empty" };
    }
    if ("RecipientNotFound" in candid) {
        return { kind: "recipient_not_found" };
    }
    if ("TransferFailed" in candid) {
        return { kind: "transfer_failed" };
    }
    if ("TransferLimitExceeded" in candid) {
        return { kind: "transfer_limit_exceeded" };
    }
    if ("InvalidPoll" in candid) {
        return { kind: "invalid_poll" };
    }
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}
export function createGroupResponse(candid) {
    if ("Success" in candid) {
        return { kind: "success", canisterId: candid.Success.chat_id.toString() };
    }
    if ("NameTaken" in candid) {
        return { kind: "group_name_taken" };
    }
    if ("NameTooLong" in candid) {
        return { kind: "name_too_long" };
    }
    if ("NameTooShort" in candid) {
        return { kind: "name_too_short" };
    }
    if ("NameReserved" in candid) {
        return { kind: "name_reserved" };
    }
    if ("DescriptionTooLong" in candid) {
        return { kind: "description_too_long" };
    }
    if ("Throttled" in candid) {
        return { kind: "throttled" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("AvatarTooBig" in candid) {
        return { kind: "avatar_too_big" };
    }
    if ("MaxGroupsCreated" in candid) {
        // todo - make sure we handle this in the UI
        return { kind: "max_groups_created" };
    }
    if ("RulesTooLong" in candid) {
        return { kind: "rules_too_long" };
    }
    if ("RulesTooShort" in candid) {
        return { kind: "rules_too_short" };
    }
    throw new UnsupportedValueError("Unexpected ApiCreateGroupResponse type received", candid);
}
export function deleteGroupResponse(candid) {
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
export function getEventsResponse(candid, chatId, latestClientEventIndexPreRequest) {
    if ("Success" in candid) {
        const latestEventIndex = candid.Success.latest_event_index;
        ensureReplicaIsUpToDate(chatId, undefined, latestClientEventIndexPreRequest, latestEventIndex);
        return {
            events: candid.Success.events.map(event),
            affectedEvents: candid.Success.affected_events.map(event),
            latestEventIndex,
        };
    }
    if ("ChatNotFound" in candid) {
        return "events_failed";
    }
    if ("ReplicaNotUpToDate" in candid) {
        throw ReplicaNotUpToDateError.byEventIndex(candid.ReplicaNotUpToDate, latestClientEventIndexPreRequest !== null && latestClientEventIndexPreRequest !== void 0 ? latestClientEventIndexPreRequest : -1, false);
    }
    throw new UnsupportedValueError("Unexpected ApiEventsResponse type received", candid);
}
function event(candid) {
    return {
        event: directChatEvent(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
    };
}
function directChatEvent(candid) {
    if ("Message" in candid) {
        return message(candid.Message);
    }
    if ("DirectChatCreated" in candid) {
        return {
            kind: "direct_chat_created",
        };
    }
    if ("MessageReactionAdded" in candid) {
        return {
            kind: "reaction_added",
            message: updatedMessage(candid.MessageReactionAdded),
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
    if ("MessageReactionRemoved" in candid) {
        return {
            kind: "reaction_removed",
            message: updatedMessage(candid.MessageReactionRemoved),
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
    if ("ThreadUpdated" in candid) {
        return {
            kind: "thread_updated",
            messageIndex: candid.ThreadUpdated.message_index,
            eventIndex: candid.ThreadUpdated.event_index,
        };
    }
    // todo - we know there are other event types that we are not dealing with yet
    throw new Error(`Unexpected ApiEventWrapper type received: ${JSON.stringify(candid)}`);
}
export function initialStateResponse(candid) {
    if ("Success" in candid) {
        return {
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            pinnedChats: candid.Success.pinned_chats.map((u) => u.toString()),
            chats: candid.Success.chats.map(chatSummary),
            timestamp: candid.Success.timestamp,
            cyclesBalance: candid.Success.cycles_balance,
        };
    }
    throw new Error(`Unexpected ApiUpdatesResponse type received: ${candid}`);
}
export function getUpdatesResponse(candid) {
    if ("Success" in candid) {
        return {
            blockedUsers: optional(candid.Success.blocked_users_v2, (user_ids) => new Set(user_ids.map((u) => u.toString()))),
            chatsUpdated: candid.Success.chats_updated.map(updatedChatSummary),
            chatsAdded: candid.Success.chats_added.map(chatSummary),
            chatsRemoved: new Set(candid.Success.chats_removed.map((p) => p.toString())),
            avatarIdUpdate: optionUpdate(candid.Success.avatar_id, (id) => id),
            timestamp: candid.Success.timestamp,
            cyclesBalance: optional(candid.Success.cycles_balance, identity),
            transactions: [],
            pinnedChats: optional(candid.Success.pinned_chats, (chat_ids) => chat_ids.map((u) => u.toString())),
        };
    }
    throw new Error(`Unexpected ApiUpdatesResponse type received: ${candid}`);
}
function updatedChatSummary(candid) {
    if ("Group" in candid) {
        const chatId = candid.Group.chat_id.toString();
        return {
            kind: "group_chat",
            chatId,
            lastUpdated: candid.Group.last_updated,
            readByMeUpTo: optional(candid.Group.read_by_me_up_to, identity),
            latestMessage: optional(candid.Group.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event),
            })),
            name: optional(candid.Group.name, identity),
            description: optional(candid.Group.description, identity),
            latestEventIndex: optional(candid.Group.latest_event_index, identity),
            avatarBlobReferenceUpdate: optionUpdate(candid.Group.avatar_id, (blobId) => ({
                blobId,
                canisterId: chatId,
            })),
            notificationsMuted: optional(candid.Group.notifications_muted, identity),
            memberCount: optional(candid.Group.participant_count, identity),
            myRole: optional(candid.Group.role, memberRole),
            mentions: candid.Group.mentions
                .filter((m) => m.thread_root_message_index.length === 0)
                .map(mention),
            ownerId: optional(candid.Group.owner_id, (id) => id.toString()),
            permissions: optional(candid.Group.permissions, (permissions) => groupPermissions(permissions)),
            affectedEvents: [...candid.Group.affected_events],
            metrics: optional(candid.Group.metrics, chatMetrics),
            myMetrics: optional(candid.Group.my_metrics, chatMetrics),
            public: optional(candid.Group.is_public, identity),
            latestThreads: candid.Group.latest_threads.map(threadSyncDetailsUpdates),
            subtype: updatedSubtype(candid.Group.subtype),
            archived: optional(candid.Group.archived, identity),
        };
    }
    if ("Direct" in candid) {
        const chatId = candid.Direct.chat_id.toString();
        return {
            kind: "direct_chat",
            chatId,
            readByMeUpTo: optional(candid.Direct.read_by_me_up_to, identity),
            readByThemUpTo: optional(candid.Direct.read_by_them_up_to, identity),
            latestMessage: optional(candid.Direct.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event),
            })),
            latestEventIndex: optional(candid.Direct.latest_event_index, identity),
            notificationsMuted: optional(candid.Direct.notifications_muted, identity),
            affectedEvents: [...candid.Direct.affected_events],
            metrics: optional(candid.Direct.metrics, chatMetrics),
            myMetrics: optional(candid.Direct.my_metrics, chatMetrics),
            archived: optional(candid.Direct.archived, identity),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiChatSummaryUpdate type received", candid);
}
function updatedSubtype(candid) {
    if ("NoChange" in candid) {
        return { kind: "no_change" };
    }
    else if ("SetToNone" in candid) {
        return { kind: "set_to_none" };
    }
    else {
        return { kind: "set_to_some", subtype: apiGroupSubtype(candid.SetToSome) };
    }
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
function mention(candid) {
    return {
        messageId: candid.message_id,
        messageIndex: candid.message_index,
        eventIndex: candid.event_index,
        mentionedBy: candid.mentioned_by.toString(),
    };
}
function chatSummary(candid) {
    if ("Group" in candid) {
        return groupChatSummary(candid.Group);
    }
    if ("Direct" in candid) {
        return directChatSummary(candid.Direct);
    }
    throw new UnsupportedValueError("Unexpected ApiChatSummary type received", candid);
}
function chatMetrics(candid) {
    return {
        audioMessages: Number(candid.audio_messages),
        cyclesMessages: Number(candid.cycles_messages),
        edits: Number(candid.edits),
        icpMessages: Number(candid.icp_messages),
        giphyMessages: Number(candid.giphy_messages),
        deletedMessages: Number(candid.deleted_messages),
        fileMessages: Number(candid.file_messages),
        pollVotes: Number(candid.poll_votes),
        textMessages: Number(candid.text_messages),
        imageMessages: Number(candid.image_messages),
        replies: Number(candid.replies),
        videoMessages: Number(candid.video_messages),
        polls: Number(candid.polls),
        reactions: Number(candid.reactions),
    };
}
function groupChatSummary(candid) {
    const ownerId = candid.owner_id.toString();
    return {
        kind: "group_chat",
        chatId: candid.chat_id.toString(),
        latestMessage: optional(candid.latest_message, (ev) => {
            return {
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event),
            };
        }),
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
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
        mentions: candid.mentions
            .filter((m) => m.thread_root_message_index.length === 0)
            .map(mention),
        ownerId,
        permissions: groupPermissions(candid.permissions),
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
        latestThreads: candid.latest_threads.map(threadSyncDetails),
        subtype: optional(candid.subtype, apiGroupSubtype),
        archived: candid.archived,
        previewed: false,
    };
}
export function apiGroupSubtype(subtype) {
    return {
        kind: "governance_proposals",
        isNns: subtype.GovernanceProposals.is_nns,
        governanceCanisterId: subtype.GovernanceProposals.governance_canister_id.toText(),
    };
}
function threadSyncDetails(candid) {
    var _a, _b;
    return {
        threadRootMessageIndex: candid.root_message_index,
        lastUpdated: candid.last_updated,
        readUpTo: optional(candid.read_up_to, identity),
        latestEventIndex: (_a = optional(candid.latest_event, identity)) !== null && _a !== void 0 ? _a : -1,
        latestMessageIndex: (_b = optional(candid.latest_message, identity)) !== null && _b !== void 0 ? _b : -1,
    };
}
function threadSyncDetailsUpdates(candid) {
    return {
        threadRootMessageIndex: candid.root_message_index,
        lastUpdated: candid.last_updated,
        readUpTo: optional(candid.read_up_to, identity),
        latestEventIndex: optional(candid.latest_event, identity),
        latestMessageIndex: optional(candid.latest_message, identity),
    };
}
function directChatSummary(candid) {
    return {
        kind: "direct_chat",
        chatId: candid.them.toString(),
        latestMessage: {
            index: candid.latest_message.index,
            timestamp: candid.latest_message.timestamp,
            event: message(candid.latest_message.event),
        },
        them: candid.them.toString(),
        latestEventIndex: candid.latest_event_index,
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        readByThemUpTo: optional(candid.read_by_them_up_to, identity),
        dateCreated: candid.date_created,
        notificationsMuted: candid.notifications_muted,
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
        archived: candid.archived,
    };
}
function failedNnsCryptoWithdrawal(candid) {
    return {
        kind: "failed",
        token: token(candid.token),
        to: "Account" in candid.to ? bytesToHexString(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo,
        errorMessage: candid.error_message,
    };
}
function failedSnsCryptoWithdrawal(candid) {
    var _a;
    return {
        kind: "failed",
        token: token(candid.token),
        to: "Account" in candid.to ? formatIcrc1Account(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: (_a = candid.memo[0]) !== null && _a !== void 0 ? _a : BigInt(0),
        errorMessage: candid.error_message,
    };
}
function completedNnsCryptoWithdrawal(candid) {
    return {
        kind: "completed",
        token: token(candid.token),
        to: "Account" in candid.to ? bytesToHexString(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo,
        blockIndex: candid.block_index,
        transactionHash: bytesToHexString(candid.transaction_hash),
    };
}
function completedSnsCryptoWithdrawal(candid) {
    var _a;
    return {
        kind: "completed",
        token: token(candid.token),
        to: "Account" in candid.to ? formatIcrc1Account(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: (_a = candid.memo[0]) !== null && _a !== void 0 ? _a : BigInt(0),
        blockIndex: candid.block_index,
        transactionHash: bytesToHexString(candid.transaction_hash),
    };
}
export function withdrawCryptoResponse(candid) {
    if ("CurrencyNotSupported" in candid) {
        return { kind: "currency_not_supported" };
    }
    if ("TransactionFailed" in candid) {
        if ("NNS" in candid.TransactionFailed) {
            return failedNnsCryptoWithdrawal(candid.TransactionFailed.NNS);
        }
        else {
            return failedSnsCryptoWithdrawal(candid.TransactionFailed.SNS);
        }
    }
    if ("Success" in candid) {
        if ("NNS" in candid.Success) {
            return completedNnsCryptoWithdrawal(candid.Success.NNS);
        }
        else {
            return completedSnsCryptoWithdrawal(candid.Success.SNS);
        }
    }
    throw new UnsupportedValueError("Unexpected ApiWithdrawCryptocurrencyResponse type received", candid);
}
export function migrateUserPrincipal(candid) {
    if ("Success" in candid)
        return "success";
    if ("MigrationNotInitialized" in candid)
        return "migration_not_initialized";
    if ("MigrationAlreadyInProgress" in candid)
        return "migration_already_in_progress";
    if ("PrincipalAlreadyInUse" in candid)
        return "principal_already_in_use";
    if ("InternalError" in candid)
        return "internal_error";
    throw new UnsupportedValueError("Unexpected ApiMigrateUserPrincipalResponse type received", candid);
}
function formatIcrc1Account(candid) {
    const owner = candid.owner.toString();
    const subaccount = optional(candid.subaccount, bytesToHexString);
    return subaccount !== undefined
        ? `${owner}:${subaccount}`
        : owner;
}
//# sourceMappingURL=mappers.js.map