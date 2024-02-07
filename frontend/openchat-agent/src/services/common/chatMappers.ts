import { Principal } from "@dfinity/principal";
import {
    bigintToBytes,
    bytesToBigint,
    bytesToHexString,
    hexStringToBytes,
    identity,
    optional,
} from "../../utils/mapping";
import type {
    ApiChatEvent,
    ApiChatEventWrapper,
    ApiEventsSuccessResult,
    ApiBlobReference,
    ApiFileContent,
    ApiImageContent,
    ApiAudioContent,
    ApiVideoContent,
    ApiMessageContent,
    ApiMessageContentInitial,
    ApiMessage,
    ApiTextContent,
    ApiReplyContext,
    ApiPrizeContent,
    ApiUpdatedMessage,
    ApiDeletedContent,
    ApiCryptoContent,
    ApiCryptoTransaction,
    ApiUser,
    ApiICP,
    ApiPollContent,
    ApiPollVotes,
    ApiTotalPollVotes,
    ApiPollConfig,
    ApiGroupPermissions,
    ApiPermissionRole,
    ApiGiphyContent,
    ApiGiphyImageVariant,
    ApiCryptocurrency,
    ApiThreadSummary,
    ApiProposalContent,
    ApiProposal,
    ApiProposalDecisionStatus,
    ApiProposalRewardStatus,
    ApiChatMetrics,
    ApiGroupSubtype,
    ApiPrizeWinnerContent,
    ApiAccessGate,
    ApiMessageReminderCreated,
    ApiMessageReminder,
    ApiCustomMessageContent,
    ApiReportedMessage,
    ApiGroupRole,
    ApiCommunityPermissions,
    ApiAddReactionResponse as ApiAddDirectReactionResponse,
    ApiRemoveReactionResponse as ApiRemoveDirectReactionResponse,
    ApiMention,
    ApiCreateGroupResponse,
    ApiDeleteGroupResponse,
    ApiCompletedCryptoTransaction,
    ApiPendingCryptoTransaction,
    ApiFailedCryptoTransaction,
    ApiMultiUserChat,
    ApiEditMessageResponse as ApiEditDirectMessageResponse,
    ApiLeaveGroupResponse,
    ApiChat,
    ApiPrizeCotentInitial,
    ApiMessagePermissions,
    ApiP2PSwapContentInitial,
    ApiTokenInfo,
    ApiP2PSwapContent,
    ApiP2PSwapStatus,
    ApiCancelP2PSwapResponse as ApiUserCancelP2PSwapResponse,
    ApiAcceptP2PSwapResponse as ApiUserAcceptP2PSwapResponse,
} from "../user/candid/idl";
import type {
    Message,
    ChatEvent,
    EventsSuccessResult,
    ThreadSummary,
    StaleMessage,
    MessageContent,
    User,
    ProposalContent,
    Proposal,
    GiphyContent,
    GiphyImage,
    PollContent,
    PollConfig,
    PollVotes,
    TotalPollVotes,
    DeletedContent,
    CryptocurrencyContent,
    CryptocurrencyTransfer,
    PendingCryptocurrencyTransfer,
    CompletedCryptocurrencyTransfer,
    FailedCryptocurrencyTransfer,
    ImageContent,
    VideoContent,
    AudioContent,
    TextContent,
    FileContent,
    BlobReference,
    ReplyContext,
    Reaction,
    ChatPermissions,
    PermissionRole,
    PendingCryptocurrencyWithdrawal,
    Metrics,
    MemberRole,
    GroupSubtype,
    PrizeContent,
    PrizeWinnerContent,
    AccessGate,
    MessageReminderCreatedContent,
    MessageReminderContent,
    MessageContext,
    ReportedMessageContent,
    GroupChatSummary,
    GateCheckFailedReason,
    CommunityPermissionRole,
    CommunityPermissions,
    ChatIdentifier,
    AddRemoveReactionResponse,
    ChannelSummary,
    CommunitySummary,
    GroupCanisterThreadDetails,
    Mention,
    EventWrapper,
    UpdateGroupResponse,
    CreateGroupResponse,
    MultiUserChatIdentifier,
    ChannelIdentifier,
    GroupChatIdentifier,
    DeleteGroupResponse,
    PinMessageResponse,
    UnpinMessageResponse,
    GroupChatDetailsResponse,
    Member,
    GroupChatDetailsUpdatesResponse,
    EditMessageResponse,
    DeclineInvitationResponse,
    LeaveGroupResponse,
    DeleteMessageResponse,
    DeletedGroupMessageResponse,
    UndeleteMessageResponse,
    ThreadPreview,
    ThreadPreviewsResponse,
    ChangeRoleResponse,
    RegisterPollVoteResponse,
    JoinGroupResponse,
    SearchGroupChatResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    ThreadSyncDetails,
    RegisterProposalVoteResponse,
    UserGroupSummary,
    TipsReceived,
    PrizeContentInitial,
    ClaimPrizeResponse,
    MessagePermissions,
    ExpiredEventsRange,
    ExpiredMessagesRange,
    P2PSwapContentInitial,
    P2PSwapContent,
    P2PSwapStatus,
    TokenInfo,
    CancelP2PSwapResponse,
    GroupInviteCodeChange,
} from "openchat-shared";
import {
    ProposalDecisionStatus,
    ProposalRewardStatus,
    UnsupportedValueError,
    chatIdentifiersEqual,
    CommonResponses,
    emptyChatMetrics,
    codeToText,
    CHAT_SYMBOL,
    CKBTC_SYMBOL,
    ICP_SYMBOL,
    KINIC_SYMBOL,
    SNS1_SYMBOL,
    isAccountIdentifierValid,
} from "openchat-shared";
import type { SwapStatusError, WithdrawCryptoArgs } from "../user/candid/types";
import type {
    ApiGroupCanisterGroupChatSummary,
    ApiAddReactionResponse as ApiAddGroupReactionResponse,
    ApiRemoveReactionResponse as ApiRemoveGroupReactionResponse,
    ApiGroupCanisterThreadDetails,
    ApiMessageEventWrapper,
    ApiMessagesSuccessResult,
    ApiUpdateGroupResponse,
    ApiUnpinMessageResponse,
    ApiPinMessageResponse,
    ApiSelectedInitialResponse,
    ApiParticipant,
    ApiSelectedUpdatesResponse,
    ApiEditMessageResponse,
    ApiDeclineInvitationResponse,
    ApiDeleteMessageResponse,
    ApiDeletedGroupMessageResponse,
    ApiUndeleteMessageResponse,
    ApiThreadPreviewsResponse,
    ApiThreadPreview,
    ApiChangeRoleResponse,
    ApiRegisterPollVoteResponse,
    ApiSearchGroupChatResponse,
    ApiInviteCodeResponse,
    ApiEnableInviteCodeResponse,
    ApiDisableInviteCodeResponse,
    ApiResetInviteCodeResponse,
    ApiRegisterProposalVoteResponse as ApiGroupRegisterProposalVoteResponse,
    ApiClaimPrizeResponse as ApiClaimGroupPrizeResponse,
    ApiAcceptP2PSwapResponse as ApiGroupAcceptP2PSwapResponse,
    ApiCancelP2PSwapResponse as ApiGroupCancelP2PSwapResponse,
} from "../group/candid/idl";
import type {
    ApiGateCheckFailedReason,
    ApiCommunityCanisterCommunitySummary,
    ApiJoinGroupResponse,
    ApiUserGroup,
} from "../localUserIndex/candid/idl";
import type {
    ApiCommunityPermissionRole,
    ApiCommunityRole,
    ApiAddReactionResponse as ApiAddChannelReactionResponse,
    ApiRemoveReactionResponse as ApiRemoveChannelReactionResponse,
    ApiCommunityCanisterChannelSummary,
    ApiUpdateChannelResponse,
    ApiCreateChannelResponse,
    ApiDeleteChannelResponse,
    ApiPinChannelMessageResponse,
    ApiSelectedChannelInitialResponse,
    ApiSelectedChannelUpdatesResponse,
    ApiEditMessageResponse as ApiEditChannelMessageResponse,
    ApiDeclineInvitationResponse as ApiDeclineChannelInvitationResponse,
    ApiDeleteMessagesResponse as ApiDeleteChannelMessageResponse,
    ApiLeaveChannelResponse,
    ApiDeletedMessageResponse as ApiDeletedChannelMessageResponse,
    ApiUndeleteMessagesResponse as ApiUndeleteChannelMessageResponse,
    ApiThreadPreviewsResponse as ApiChannelThreadPreviewsResponse,
    ApiRegisterPollVoteResponse as ApiRegisterChannelPollVoteResponse,
    ApiChangeChannelRoleResponse,
    ApiSearchChannelResponse,
    ApiInviteCodeResponse as ApiCommunityInviteCodeResponse,
    ApiDisableInviteCodeResponse as ApiCommunityDisableInviteCodeResponse,
    ApiEnableInviteCodeResponse as ApiCommunityEnableInviteCodeResponse,
    ApiRegisterProposalVoteResponse as ApiCommunityRegisterProposalVoteResponse,
    ApiClaimPrizeResponse as ApiClaimChannelPrizeResponse,
    ApiAcceptP2PSwapResponse as ApiCommunityAcceptP2PSwapResponse,
    ApiCancelP2PSwapResponse as ApiCommunityCancelP2PSwapResponse,
} from "../community/candid/idl";
import { ReplicaNotUpToDateError } from "../error";
import { messageMatch } from "../user/mappers";
import type { AcceptP2PSwapResponse } from "openchat-shared";

const E8S_AS_BIGINT = BigInt(100_000_000);

export function eventsSuccessResponse(
    candid: ApiEventsSuccessResult,
): EventsSuccessResult<ChatEvent> {
    return {
        events: candid.events.map(eventWrapper),
        expiredEventRanges: candid.expired_event_ranges.map(expiredEventsRange),
        expiredMessageRanges: candid.expired_message_ranges.map(expiredMessagesRange),
        latestEventIndex: candid.latest_event_index,
    };
}

export function eventWrapper(candid: ApiChatEventWrapper): EventWrapper<ChatEvent> {
    return {
        event: event(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
        expiresAt: optional(candid.expires_at, Number),
    };
}

export function event(candid: ApiChatEvent): ChatEvent {
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
    if ("UsersInvited" in candid) {
        return {
            kind: "users_invited",
            userIds: candid.UsersInvited.user_ids.map((p) => p.toString()),
            invitedBy: candid.UsersInvited.invited_by.toString(),
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

    if ("PermissionsChanged" in candid) {
        return {
            kind: "permissions_changed",
            oldPermissions: groupPermissions(candid.PermissionsChanged.old_permissions_v2),
            newPermissions: groupPermissions(candid.PermissionsChanged.new_permissions_v2),
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
        let change: GroupInviteCodeChange = "disabled";
        if ("Enabled" in candid.GroupInviteCodeChanged.change) {
            change = "enabled";
        } else if ("Reset" in candid.GroupInviteCodeChanged.change) {
            change = "reset";
        }

        return {
            kind: "group_invite_code_changed",
            change,
            changedBy: candid.GroupInviteCodeChanged.changed_by.toString(),
        };
    }
    if ("ChatFrozen" in candid) {
        return {
            kind: "chat_frozen",
            frozenBy: candid.ChatFrozen.frozen_by.toString(),
            reason: optional(candid.ChatFrozen.reason, identity),
        };
    }
    if ("ChatUnfrozen" in candid) {
        return {
            kind: "chat_unfrozen",
            unfrozenBy: candid.ChatUnfrozen.unfrozen_by.toString(),
        };
    }
    if ("EventsTimeToLiveUpdated" in candid) {
        return {
            kind: "events_ttl_updated",
            updatedBy: candid.EventsTimeToLiveUpdated.updated_by.toString(),
            newTimeToLive: optional(candid.EventsTimeToLiveUpdated.new_ttl, identity),
        };
    }
    if ("GroupGateUpdated" in candid) {
        return {
            kind: "gate_updated",
            updatedBy: candid.GroupGateUpdated.updated_by.toString(),
        };
    }
    if ("MembersAddedToDefaultChannel" in candid) {
        return {
            kind: "members_added_to_default_channel",
            count: candid.MembersAddedToDefaultChannel.count,
        };
    }
    if ("Empty" in candid) {
        return { kind: "empty" };
    }

    throw new UnsupportedValueError("Unexpected ApiEventWrapper type received", candid);
}

export function message(candid: ApiMessage): Message {
    const sender = candid.sender.toString();
    const content = messageContent(candid.content, sender);
    return {
        kind: "message",
        content,
        sender,
        repliesTo: optional(candid.replies_to, replyContext),
        messageId: candid.message_id,
        messageIndex: candid.message_index,
        reactions: reactions(candid.reactions),
        tips: tips(candid.tips),
        edited: candid.edited,
        forwarded: candid.forwarded,
        deleted: content.kind === "deleted_content",
        lastUpdated: optional(candid.last_updated, identity),
        thread: optional(candid.thread_summary, threadSummary),
    };
}

export function tips(candid: [Principal, [Principal, bigint][]][]): TipsReceived {
    return candid.reduce((agg, [ledger, tips]) => {
        agg[ledger.toString()] = tips.reduce(
            (userTips, [userId, amount]) => {
                userTips[userId.toString()] = amount;
                return userTips;
            },
            {} as Record<string, bigint>,
        );
        return agg;
    }, {} as TipsReceived);
}

export function threadSummary(candid: ApiThreadSummary): ThreadSummary {
    return {
        participantIds: new Set(candid.participant_ids.map((p) => p.toString())),
        followedByMe: candid.followed_by_me,
        numberOfReplies: Number(candid.reply_count),
        latestEventIndex: Number(candid.latest_event_index),
        latestEventTimestamp: candid.latest_event_timestamp,
    };
}

export function updatedMessage(candid: ApiUpdatedMessage): StaleMessage {
    return {
        updatedBy: candid.updated_by.toString(),
        messageId: candid.message_id,
        eventIndex: candid.event_index,
    };
}

export function messageContent(candid: ApiMessageContent, sender: string): MessageContent {
    if ("File" in candid) {
        return fileContent(candid.File);
    }
    if ("Text" in candid) {
        return textContent(candid.Text);
    }
    if ("Image" in candid) {
        return imageContent(candid.Image);
    }
    if ("Video" in candid) {
        return videoContent(candid.Video);
    }
    if ("Audio" in candid) {
        return audioContent(candid.Audio);
    }
    if ("Deleted" in candid) {
        return deletedContent(candid.Deleted);
    }
    if ("Crypto" in candid) {
        return cryptoContent(candid.Crypto, sender);
    }
    if ("Poll" in candid) {
        return pollContent(candid.Poll);
    }
    if ("Giphy" in candid) {
        return giphyContent(candid.Giphy);
    }
    if ("GovernanceProposal" in candid) {
        return proposalContent(candid.GovernanceProposal);
    }
    if ("Prize" in candid) {
        return prizeContent(candid.Prize);
    }
    if ("PrizeWinner" in candid) {
        return prizeWinnerContent(sender, candid.PrizeWinner);
    }
    if ("MessageReminderCreated" in candid) {
        return messageReminderCreated(candid.MessageReminderCreated);
    }
    if ("MessageReminder" in candid) {
        return messageReminder(candid.MessageReminder);
    }
    if ("Custom" in candid) {
        return customContent(candid.Custom);
    }
    if ("ReportedMessage" in candid) {
        return reportedMessage(candid.ReportedMessage);
    }
    if ("P2PSwap" in candid) {
        return p2pSwapContent(candid.P2PSwap);
    }
    throw new UnsupportedValueError("Unexpected ApiMessageContent type received", candid);
}

function reportedMessage(candid: ApiReportedMessage): ReportedMessageContent {
    return {
        kind: "reported_message_content",
        total: candid.count,
        reports: candid.reports.map((r) => ({
            notes: optional(r.notes, identity),
            reasonCode: r.reason_code,
            timestamp: Number(r.timestamp),
            reportedBy: r.reported_by.toString(),
        })),
    };
}

function customContent(candid: ApiCustomMessageContent): MessageContent {
    if (candid.kind === "meme_fighter") {
        const data = candid.data as Uint8Array;
        const decoder = new TextDecoder();
        const json = decoder.decode(data);
        const decoded = JSON.parse(json) as { url: string; width: number; height: number };
        return {
            kind: "meme_fighter_content",
            ...decoded,
        };
    }
    if (candid.kind === "user_referral_card") {
        return {
            kind: "user_referral_card",
        };
    }

    throw new Error(`Unknown custom content kind received: ${candid.kind}`);
}

function messageReminderCreated(candid: ApiMessageReminderCreated): MessageReminderCreatedContent {
    return {
        kind: "message_reminder_created_content",
        notes: optional(candid.notes, identity),
        remindAt: Number(candid.remind_at),
        reminderId: candid.reminder_id,
        hidden: candid.hidden,
    };
}

function messageReminder(candid: ApiMessageReminder): MessageReminderContent {
    return {
        kind: "message_reminder_content",
        notes: optional(candid.notes, identity),
        reminderId: candid.reminder_id,
    };
}

function prizeWinnerContent(senderId: string, candid: ApiPrizeWinnerContent): PrizeWinnerContent {
    return {
        kind: "prize_winner_content",
        transaction: completedCryptoTransfer(
            candid.transaction,
            senderId,
            candid.winner.toString(),
        ),
        prizeMessageIndex: candid.prize_message,
    };
}

function prizeContent(candid: ApiPrizeContent): PrizeContent {
    return {
        kind: "prize_content",
        prizesRemaining: candid.prizes_remaining,
        prizesPending: candid.prizes_pending,
        diamondOnly: candid.diamond_only,
        winners: candid.winners.map((u) => u.toString()),
        token: token(candid.token),
        endDate: candid.end_date,
        caption: optional(candid.caption, identity),
    };
}

function p2pSwapContent(candid: ApiP2PSwapContent): P2PSwapContent {
    return {
        kind: "p2p_swap_content",
        token0: tokenInfo(candid.token0),
        token1: tokenInfo(candid.token1),
        token0Amount: candid.token0_amount,
        token1Amount: candid.token1_amount,
        caption: optional(candid.caption, identity),
        expiresAt: candid.expires_at,
        status: p2pTradeStatus(candid.status),
        swapId: candid.swap_id,
        token0TxnIn: candid.token0_txn_in,
    };
}

function tokenInfo(candid: ApiTokenInfo): TokenInfo {
    return {
        fee: candid.fee,
        decimals: candid.decimals,
        symbol: token(candid.token),
        ledger: candid.ledger.toString(),
    };
}

function p2pTradeStatus(candid: ApiP2PSwapStatus): P2PSwapStatus {
    if ("Open" in candid) {
        return { kind: "p2p_swap_open" };
    }
    if ("Reserved" in candid) {
        return {
            kind: "p2p_swap_reserved",
            reservedBy: candid.Reserved.reserved_by.toString(),
        };
    }
    if ("Accepted" in candid) {
        return {
            kind: "p2p_swap_accepted",
            acceptedBy: candid.Accepted.accepted_by.toString(),
            token1TxnIn: candid.Accepted.token1_txn_in,
        };
    }
    if ("Cancelled" in candid) {
        return {
            kind: "p2p_swap_cancelled",
            token0TxnOut: optional(candid.Cancelled.token0_txn_out, identity),
        };
    }
    if ("Expired" in candid) {
        return {
            kind: "p2p_swap_expired",
            token0TxnOut: optional(candid.Expired.token0_txn_out, identity),
        };
    }
    if ("Completed" in candid) {
        const { accepted_by, token1_txn_in, token0_txn_out, token1_txn_out } = candid.Completed;
        return {
            kind: "p2p_swap_completed",
            acceptedBy: accepted_by.toString(),
            token1TxnIn: token1_txn_in,
            token0TxnOut: token0_txn_out,
            token1TxnOut: token1_txn_out,
        };
    }

    throw new UnsupportedValueError("Unexpected ApiP2PSwapStatus type received", candid);
}

export function apiUser(domain: User): ApiUser {
    return {
        user_id: Principal.fromText(domain.userId),
        username: domain.username,
    };
}

function proposalContent(candid: ApiProposalContent): ProposalContent {
    return {
        kind: "proposal_content",
        governanceCanisterId: candid.governance_canister_id.toString(),
        proposal: proposal(candid.proposal),
        myVote: optional(candid.my_vote, identity),
    };
}

function proposal(candid: ApiProposal): Proposal {
    if ("NNS" in candid) {
        const p = candid.NNS;
        return {
            kind: "nns",
            id: p.id,
            topic: p.topic,
            proposer: p.proposer.toString(),
            title: p.title,
            summary: p.summary,
            url: p.url,
            status: proposalDecisionStatus(p.status),
            rewardStatus: proposalRewardStatus(p.reward_status),
            tally: {
                yes: Number(p.tally.yes / E8S_AS_BIGINT),
                no: Number(p.tally.no / E8S_AS_BIGINT),
                total: Number(p.tally.total / E8S_AS_BIGINT),
                timestamp: p.tally.timestamp,
            },
            lastUpdated: Number(p.last_updated),
            created: Number(p.created),
            deadline: Number(p.deadline),
            payloadTextRendering: optional(p.payload_text_rendering, identity),
        };
    } else if ("SNS" in candid) {
        const p = candid.SNS;
        return {
            kind: "sns",
            id: p.id,
            action: Number(p.action),
            proposer: bytesToHexString(p.proposer),
            title: p.title,
            summary: p.summary,
            url: p.url,
            status: proposalDecisionStatus(p.status),
            rewardStatus: proposalRewardStatus(p.reward_status),
            tally: {
                yes: Number(p.tally.yes / E8S_AS_BIGINT),
                no: Number(p.tally.no / E8S_AS_BIGINT),
                total: Number(p.tally.total / E8S_AS_BIGINT),
                timestamp: p.tally.timestamp,
            },
            lastUpdated: Number(p.last_updated),
            created: Number(p.created),
            deadline: Number(p.deadline),
            payloadTextRendering: optional(p.payload_text_rendering, identity),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiProposal type received", candid);
}

function proposalDecisionStatus(candid: ApiProposalDecisionStatus): ProposalDecisionStatus {
    if ("Failed" in candid) return ProposalDecisionStatus.Failed;
    if ("Open" in candid) return ProposalDecisionStatus.Open;
    if ("Rejected" in candid) return ProposalDecisionStatus.Rejected;
    if ("Executed" in candid) return ProposalDecisionStatus.Executed;
    if ("Adopted" in candid) return ProposalDecisionStatus.Adopted;
    return ProposalDecisionStatus.Unspecified;
}

function proposalRewardStatus(candid: ApiProposalRewardStatus): ProposalRewardStatus {
    if ("AcceptVotes" in candid) return ProposalRewardStatus.AcceptVotes;
    if ("ReadyToSettle" in candid) return ProposalRewardStatus.ReadyToSettle;
    if ("Settled" in candid) return ProposalRewardStatus.Settled;
    return ProposalRewardStatus.Unspecified;
}

function giphyContent(candid: ApiGiphyContent): GiphyContent {
    return {
        kind: "giphy_content",
        title: candid.title,
        caption: optional(candid.caption, identity),
        desktop: giphyImageVariant(candid.desktop),
        mobile: giphyImageVariant(candid.mobile),
    };
}

function giphyImageVariant(candid: ApiGiphyImageVariant): GiphyImage {
    return {
        width: candid.width,
        height: candid.height,
        url: candid.url,
        mimeType: candid.mime_type,
    };
}

function pollContent(candid: ApiPollContent): PollContent {
    return {
        kind: "poll_content",
        votes: pollVotes(candid.votes),
        config: pollConfig(candid.config),
        ended: candid.ended,
    };
}

function pollConfig(candid: ApiPollConfig): PollConfig {
    return {
        allowMultipleVotesPerUser: candid.allow_multiple_votes_per_user,
        allowUserToChangeVote: candid.allow_user_to_change_vote,
        text: optional(candid.text, identity),
        showVotesBeforeEndDate: candid.show_votes_before_end_date,
        endDate: optional(candid.end_date, identity),
        anonymous: candid.anonymous,
        options: candid.options,
    };
}

function pollVotes(candid: ApiPollVotes): PollVotes {
    return {
        total: totalPollVotes(candid.total),
        user: [...candid.user],
    };
}

function totalPollVotes(candid: ApiTotalPollVotes): TotalPollVotes {
    if ("Anonymous" in candid) {
        return {
            kind: "anonymous_poll_votes",
            votes: candid.Anonymous.reduce(
                (agg, [idx, num]) => {
                    agg[idx] = num;
                    return agg;
                },
                {} as Record<number, number>,
            ),
        };
    }
    if ("Visible" in candid) {
        return {
            kind: "visible_poll_votes",
            votes: candid.Visible.reduce(
                (agg, [idx, userIds]) => {
                    agg[idx] = userIds.map((p) => p.toString());
                    return agg;
                },
                {} as Record<number, string[]>,
            ),
        };
    }
    if ("Hidden" in candid) {
        return {
            kind: "hidden_poll_votes",
            votes: candid.Hidden,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiTotalPollVotes type received", candid);
}

function deletedContent(candid: ApiDeletedContent): DeletedContent {
    return {
        kind: "deleted_content",
        deletedBy: candid.deleted_by.toString(),
        timestamp: candid.timestamp,
    };
}

function cryptoContent(candid: ApiCryptoContent, sender: string): CryptocurrencyContent {
    return {
        kind: "crypto_content",
        caption: optional(candid.caption, identity),
        transfer: cryptoTransfer(candid.transfer, sender, candid.recipient.toString()),
    };
}

export function token(candid: ApiCryptocurrency): string {
    if ("InternetComputer" in candid) return ICP_SYMBOL;
    if ("SNS1" in candid) return SNS1_SYMBOL;
    if ("CKBTC" in candid) return CKBTC_SYMBOL;
    if ("CHAT" in candid) return CHAT_SYMBOL;
    if ("KINIC" in candid) return KINIC_SYMBOL;
    if ("Other" in candid) return candid.Other;
    throw new UnsupportedValueError("Unexpected ApiCryptocurrency type received", candid);
}

export function apiToken(token: string): ApiCryptocurrency {
    switch (token) {
        case ICP_SYMBOL:
            return { InternetComputer: null };
        case SNS1_SYMBOL:
            return { SNS1: null };
        case CKBTC_SYMBOL:
            return { CKBTC: null };
        case CHAT_SYMBOL:
            return { CHAT: null };
        case KINIC_SYMBOL:
            return { KINIC: null };
        default:
            return { Other: token };
    }
}

function cryptoTransfer(
    candid: ApiCryptoTransaction,
    sender: string,
    recipient: string,
): CryptocurrencyTransfer {
    if ("Pending" in candid) {
        return pendingCryptoTransfer(candid.Pending, recipient);
    }
    if ("Completed" in candid) {
        return completedCryptoTransfer(candid.Completed, sender, recipient);
    }
    if ("Failed" in candid) {
        return failedCryptoTransfer(candid.Failed, recipient);
    }
    throw new UnsupportedValueError("Unexpected ApiCryptoTransaction type received", candid);
}

function pendingCryptoTransfer(
    candid: ApiPendingCryptoTransaction,
    recipient: string,
): PendingCryptocurrencyTransfer {
    if ("NNS" in candid) {
        const trans = candid.NNS;
        return {
            kind: "pending",
            ledger: trans.ledger.toString(),
            token: token(trans.token),
            recipient,
            amountE8s: trans.amount.e8s,
            feeE8s: optional(trans.fee, (f) => f.e8s),
            memo: optional(trans.memo, identity),
            createdAtNanos: trans.created,
        };
    }
    if ("ICRC1" in candid) {
        return {
            kind: "pending",
            ledger: candid.ICRC1.ledger.toString(),
            token: token(candid.ICRC1.token),
            recipient,
            amountE8s: candid.ICRC1.amount,
            feeE8s: candid.ICRC1.fee,
            memo: optional(candid.ICRC1.memo, bytesToBigint),
            createdAtNanos: candid.ICRC1.created,
        };
    }

    throw new UnsupportedValueError("Unexpected ApiPendingCryptoTransaction type received", candid);
}

export function completedCryptoTransfer(
    candid: ApiCompletedCryptoTransaction,
    sender: string,
    recipient: string,
): CompletedCryptocurrencyTransfer {
    if ("NNS" in candid) {
        const trans = candid.NNS;
        return {
            kind: "completed",
            ledger: trans.ledger.toString(),
            recipient,
            sender,
            amountE8s: trans.amount.e8s,
            feeE8s: trans.fee.e8s,
            memo: trans.memo,
            blockIndex: trans.block_index,
            transactionHash: bytesToHexString(trans.transaction_hash),
        };
    }
    if ("ICRC1" in candid) {
        return {
            kind: "completed",
            ledger: candid.ICRC1.ledger.toString(),
            recipient,
            sender,
            amountE8s: candid.ICRC1.amount,
            feeE8s: candid.ICRC1.fee,
            memo: optional(candid.ICRC1.memo, bytesToBigint) ?? BigInt(0),
            blockIndex: candid.ICRC1.block_index,
            transactionHash: undefined,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiCompletedCryptoTransaction type received",
        candid,
    );
}

export function failedCryptoTransfer(
    candid: ApiFailedCryptoTransaction,
    recipient: string,
): FailedCryptocurrencyTransfer {
    if ("NNS" in candid) {
        const trans = candid.NNS;
        return {
            kind: "failed",
            ledger: trans.ledger.toString(),
            recipient,
            amountE8s: trans.amount.e8s,
            feeE8s: trans.fee.e8s,
            memo: trans.memo,
            errorMessage: trans.error_message,
        };
    }
    if ("ICRC1" in candid) {
        return {
            kind: "failed",
            ledger: candid.ICRC1.ledger.toString(),
            recipient,
            amountE8s: candid.ICRC1.amount,
            feeE8s: candid.ICRC1.fee,
            memo: optional(candid.ICRC1.memo, bytesToBigint) ?? BigInt(0),
            errorMessage: candid.ICRC1.error_message,
        };
    }

    throw new UnsupportedValueError("Unexpected ApiFailedCryptoTransaction type received", candid);
}

function imageContent(candid: ApiImageContent): ImageContent {
    return {
        kind: "image_content",
        height: candid.height,
        mimeType: candid.mime_type,
        blobReference: optional(candid.blob_reference, blobReference),
        thumbnailData: candid.thumbnail_data,
        caption: optional(candid.caption, identity),
        width: candid.width,
    };
}

function videoContent(candid: ApiVideoContent): VideoContent {
    return {
        kind: "video_content",
        height: candid.height,
        mimeType: candid.mime_type,
        videoData: {
            blobReference: optional(candid.video_blob_reference, blobReference),
        },
        imageData: {
            blobReference: optional(candid.image_blob_reference, blobReference),
        },
        thumbnailData: candid.thumbnail_data,
        caption: optional(candid.caption, identity),
        width: candid.width,
    };
}

function audioContent(candid: ApiAudioContent): AudioContent {
    return {
        kind: "audio_content",
        mimeType: candid.mime_type,
        blobReference: optional(candid.blob_reference, blobReference),
        caption: optional(candid.caption, identity),
    };
}

function textContent(candid: ApiTextContent): TextContent {
    return {
        kind: "text_content",
        text: candid.text,
    };
}

function fileContent(candid: ApiFileContent): FileContent {
    return {
        kind: "file_content",
        name: candid.name,
        mimeType: candid.mime_type,
        blobReference: optional(candid.blob_reference, blobReference),
        caption: optional(candid.caption, identity),
        fileSize: candid.file_size,
    };
}

function blobReference(candid: ApiBlobReference): BlobReference {
    return {
        blobId: candid.blob_id,
        canisterId: candid.canister_id.toString(),
    };
}

function replyContext(candid: ApiReplyContext): ReplyContext {
    return {
        kind: "raw_reply_context",
        eventIndex: candid.event_index,
        sourceContext: optional(candid.chat_if_other, replySourceContext),
    };
}

function replySourceContext([chatId, maybeThreadRoot]: [ApiChat, [] | [number]]): MessageContext {
    if ("Direct" in chatId) {
        return {
            chatId: { kind: "direct_chat", userId: chatId.Direct.toString() },
            threadRootMessageIndex: undefined,
        };
    }
    if ("Group" in chatId) {
        return {
            chatId: { kind: "group_chat", groupId: chatId.Group.toString() },
            threadRootMessageIndex: optional(maybeThreadRoot, identity),
        };
    }
    if ("Channel" in chatId) {
        const [communityId, channelId] = chatId.Channel;
        return {
            chatId: {
                kind: "channel",
                communityId: communityId.toString(),
                channelId: channelId.toString(),
            },
            threadRootMessageIndex: optional(maybeThreadRoot, identity),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiMultiUserChat type received", chatId);
}

function reactions(candid: [string, Principal[]][]): Reaction[] {
    return candid.map(([reaction, userIds]) => ({
        reaction,
        userIds: new Set(userIds.map((u) => u.toString())),
    }));
}

export function groupPermissions(candid: ApiGroupPermissions): ChatPermissions {
    return {
        changeRoles: permissionRole(candid.change_roles),
        updateGroup: permissionRole(candid.update_group),
        inviteUsers: permissionRole(candid.invite_users),
        removeMembers: permissionRole(candid.remove_members),
        deleteMessages: permissionRole(candid.delete_messages),
        pinMessages: permissionRole(candid.pin_messages),
        reactToMessages: permissionRole(candid.react_to_messages),
        mentionAllMembers: permissionRole(candid.mention_all_members),
        messagePermissions: messagePermissions(candid.message_permissions),
        threadPermissions: optional(candid.thread_permissions, messagePermissions),
    };
}

function messagePermissions(candid: ApiMessagePermissions): MessagePermissions {
    const mf = candid.custom.find((cp) => cp.subtype === "meme_fighter")?.role;
    return {
        default: permissionRole(candid.default),
        text: optional(candid.text, permissionRole),
        image: optional(candid.image, permissionRole),
        video: optional(candid.video, permissionRole),
        audio: optional(candid.audio, permissionRole),
        file: optional(candid.file, permissionRole),
        poll: optional(candid.poll, permissionRole),
        crypto: optional(candid.crypto, permissionRole),
        giphy: optional(candid.giphy, permissionRole),
        prize: optional(candid.prize, permissionRole),
        p2pSwap: optional(candid.p2p_swap, permissionRole),
        memeFighter: mf !== undefined ? permissionRole(mf) : undefined,
    };
}

export function communityPermissions(candid: ApiCommunityPermissions): CommunityPermissions {
    return {
        changeRoles: communityPermissionRole(candid.change_roles),
        updateDetails: communityPermissionRole(candid.update_details),
        inviteUsers: communityPermissionRole(candid.invite_users),
        removeMembers: communityPermissionRole(candid.remove_members),
        createPublicChannel: communityPermissionRole(candid.create_public_channel),
        createPrivateChannel: communityPermissionRole(candid.create_private_channel),
        manageUserGroups: communityPermissionRole(candid.manage_user_groups),
    };
}

export function communityPermissionRole(
    candid: ApiCommunityPermissionRole | ApiCommunityRole,
): CommunityPermissionRole {
    if ("Owners" in candid) return "owner";
    if ("Admins" in candid) return "admin";
    return "member";
}

export function apiCommunityPermissions(
    permissions: CommunityPermissions,
): ApiCommunityPermissions {
    return {
        create_public_channel: apiCommunityPermissionRole(permissions.createPublicChannel),
        update_details: apiCommunityPermissionRole(permissions.updateDetails),
        invite_users: apiCommunityPermissionRole(permissions.inviteUsers),
        remove_members: apiCommunityPermissionRole(permissions.removeMembers),
        change_roles: apiCommunityPermissionRole(permissions.changeRoles),
        create_private_channel: apiCommunityPermissionRole(permissions.createPrivateChannel),
        // TODO
        manage_user_groups: apiCommunityPermissionRole("admin"),
    };
}

export function apiCommunityPermissionRole(
    permissionRole: CommunityPermissionRole,
): ApiCommunityPermissionRole {
    switch (permissionRole) {
        case "owner":
            return { Owners: null };
        case "admin":
            return { Admins: null };
        case "member":
            return { Members: null };
    }
}

export function apiGroupPermissions(permissions: ChatPermissions): ApiGroupPermissions {
    return {
        change_roles: apiPermissionRole(permissions.changeRoles),
        update_group: apiPermissionRole(permissions.updateGroup),
        invite_users: apiPermissionRole(permissions.inviteUsers),
        remove_members: apiPermissionRole(permissions.removeMembers),
        delete_messages: apiPermissionRole(permissions.deleteMessages),
        pin_messages: apiPermissionRole(permissions.pinMessages),
        react_to_messages: apiPermissionRole(permissions.reactToMessages),
        add_members: apiPermissionRole("owner"),
        mention_all_members: apiPermissionRole(permissions.mentionAllMembers),
        message_permissions: apiMessagePermissions(permissions.messagePermissions),
        thread_permissions: apiOptional(apiMessagePermissions, permissions.threadPermissions),
    };
}

function apiMessagePermissions(permissions: MessagePermissions): ApiMessagePermissions {
    return {
        default: apiPermissionRole(permissions.default),
        text: apiOptional(apiPermissionRole, permissions.text),
        image: apiOptional(apiPermissionRole, permissions.image),
        video: apiOptional(apiPermissionRole, permissions.video),
        audio: apiOptional(apiPermissionRole, permissions.audio),
        file: apiOptional(apiPermissionRole, permissions.file),
        poll: apiOptional(apiPermissionRole, permissions.poll),
        crypto: apiOptional(apiPermissionRole, permissions.crypto),
        giphy: apiOptional(apiPermissionRole, permissions.giphy),
        prize: apiOptional(apiPermissionRole, permissions.prize),
        p2p_swap: apiOptional(apiPermissionRole, permissions.p2pSwap),
        custom:
            permissions.memeFighter !== undefined
                ? [{ subtype: "meme_fighter", role: apiPermissionRole(permissions.memeFighter) }]
                : [],
    };
}

export function apiPermissionRole(permissionRole: PermissionRole): ApiPermissionRole {
    switch (permissionRole) {
        case "none":
            return { None: null };
        case "owner":
            return { Owner: null };
        case "admin":
            return { Admins: null };
        case "moderator":
            return { Moderators: null };
        case "member":
            return { Members: null };

        default:
            return { Members: null };
    }
}

export function permissionRole(candid: ApiPermissionRole): PermissionRole {
    if ("None" in candid) return "none";
    if ("Owner" in candid) return "owner";
    if ("Admins" in candid) return "admin";
    if ("Moderators" in candid) return "moderator";
    return "member";
}

export function chatMetrics(candid: ApiChatMetrics): Metrics {
    return {
        audioMessages: Number(candid.audio_messages),
        edits: Number(candid.edits),
        icpMessages: Number(candid.icp_messages),
        sns1Messages: Number(candid.sns1_messages),
        ckbtcMessages: Number(candid.ckbtc_messages),
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
        reportedMessages: Number(candid.reported_messages),
    };
}

export function memberRole(candid: ApiGroupRole | ApiCommunityRole): MemberRole {
    if ("Admin" in candid) {
        return "admin";
    }
    if ("Moderator" in candid) {
        return "moderator";
    }
    if ("Participant" in candid || "Member" in candid) {
        return "member";
    }
    if ("Owner" in candid) {
        return "owner";
    }
    throw new UnsupportedValueError("Unexpected ApiRole type received", candid);
}

export function apiGroupSubtype(subtype: ApiGroupSubtype): GroupSubtype {
    return {
        kind: "governance_proposals",
        isNns: subtype.GovernanceProposals.is_nns,
        governanceCanisterId: subtype.GovernanceProposals.governance_canister_id.toText(),
    };
}

export function apiMultiUserChat(chatId: ChatIdentifier): ApiMultiUserChat {
    switch (chatId.kind) {
        case "group_chat":
            return {
                Group: Principal.fromText(chatId.groupId),
            };
        case "channel":
            return {
                Channel: [Principal.fromText(chatId.communityId), BigInt(chatId.channelId)],
            };
        default:
            throw new Error("Cannot convert a DirectChatIdentifier into an ApiMultiUserChat");
    }
}

export function apiReplyContextArgs(chatId: ChatIdentifier, domain: ReplyContext): ApiReplyContext {
    if (
        domain.sourceContext !== undefined &&
        !chatIdentifiersEqual(chatId, domain.sourceContext.chatId)
    ) {
        return {
            chat_if_other: [
                [
                    apiMultiUserChat(domain.sourceContext.chatId),
                    apiOptional(identity, domain.sourceContext.threadRootMessageIndex),
                ],
            ],
            event_index: domain.eventIndex,
        };
    } else {
        return {
            chat_if_other: [],
            event_index: domain.eventIndex,
        };
    }
}

export function apiMessageContent(domain: MessageContent): ApiMessageContentInitial {
    switch (domain.kind) {
        case "text_content":
            return { Text: apiTextContent(domain) };

        case "image_content":
            return { Image: apiImageContent(domain) };

        case "video_content":
            return { Video: apiVideoContent(domain) };

        case "audio_content":
            return { Audio: apiAudioContent(domain) };

        case "file_content":
            return { File: apiFileContent(domain) };

        case "crypto_content":
            return { Crypto: apiPendingCryptoContent(domain) };

        case "poll_content":
            return { Poll: apiPollContent(domain) };

        case "giphy_content":
            return { Giphy: apiGiphyContent(domain) };

        case "proposal_content":
            return { GovernanceProposal: apiProposalContent(domain) };

        case "prize_content_initial":
            return { Prize: apiPrizeContentInitial(domain) };

        case "p2p_swap_content_initial":
            return { P2PSwap: apiP2PSwapContentInitial(domain) };

        case "meme_fighter_content":
            // eslint-disable-next-line no-case-declarations
            const encoder = new TextEncoder();
            return {
                Custom: {
                    kind: "meme_fighter",
                    data: encoder.encode(
                        JSON.stringify({
                            url: domain.url,
                            width: domain.width,
                            height: domain.height,
                        }),
                    ),
                },
            };

        case "user_referral_card":
            return {
                Custom: {
                    kind: "user_referral_card",
                    data: [],
                },
            };

        case "deleted_content":
        case "blocked_content":
        case "prize_content":
        case "prize_winner_content":
        case "placeholder_content":
        case "message_reminder_content":
        case "message_reminder_created_content":
        case "reported_message_content":
        case "p2p_swap_content":
            throw new Error(`Incorrectly attempting to send {domain.kind} content to the server`);
    }
}

function apiProposalContent(_: ProposalContent): ApiProposalContent {
    throw new Error("Sending messages of type 'GovernanceProposal' is not currently supported");
}

function apiGiphyContent(domain: GiphyContent): ApiGiphyContent {
    return {
        title: domain.title,
        caption: apiOptional(identity, domain.caption),
        desktop: apiGiphyImageVariant(domain.desktop),
        mobile: apiGiphyImageVariant(domain.mobile),
    };
}

function apiGiphyImageVariant(domain: GiphyImage): ApiGiphyImageVariant {
    return {
        height: domain.height,
        width: domain.width,
        url: domain.url,
        mime_type: domain.mimeType,
    };
}

function apiPollContent(domain: PollContent): ApiPollContent {
    return {
        votes: apiPollVotes(domain.votes),
        config: apiPollConfig(domain.config),
        ended: domain.ended,
    };
}

function apiPollConfig(domain: PollConfig): ApiPollConfig {
    return {
        allow_multiple_votes_per_user: domain.allowMultipleVotesPerUser,
        allow_user_to_change_vote: domain.allowUserToChangeVote,
        text: apiOptional(identity, domain.text),
        show_votes_before_end_date: domain.showVotesBeforeEndDate,
        end_date: apiOptional(identity, domain.endDate),
        anonymous: domain.anonymous,
        options: domain.options,
    };
}

function apiPollVotes(domain: PollVotes): ApiPollVotes {
    return {
        total: apiTotalPollVotes(domain.total),
        user: new Uint32Array(domain.user),
    };
}

function apiTotalPollVotes(domain: TotalPollVotes): ApiTotalPollVotes {
    if (domain.kind === "anonymous_poll_votes") {
        return {
            Anonymous: Object.entries(domain.votes).map(([idx, votes]) => [Number(idx), votes]),
        };
    }

    if (domain.kind === "hidden_poll_votes") {
        return {
            Hidden: domain.votes,
        };
    }

    if (domain.kind === "visible_poll_votes") {
        return {
            Visible: Object.entries(domain.votes).map(([idx, userIds]) => [
                Number(idx),
                [...userIds].map((u) => Principal.fromText(u)),
            ]),
        };
    }
    throw new UnsupportedValueError("Unexpected TotalPollVotes type received", domain);
}

function apiImageContent(domain: ImageContent): ApiImageContent {
    return {
        height: domain.height,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        thumbnail_data: domain.thumbnailData,
        caption: apiOptional(identity, domain.caption),
        width: domain.width,
    };
}

function apiVideoContent(domain: VideoContent): ApiVideoContent {
    return {
        height: domain.height,
        mime_type: domain.mimeType,
        video_blob_reference: apiBlobReference(domain.videoData.blobReference),
        image_blob_reference: apiBlobReference(domain.imageData.blobReference),
        thumbnail_data: domain.thumbnailData,
        caption: apiOptional(identity, domain.caption),
        width: domain.width,
    };
}

function apiAudioContent(domain: AudioContent): ApiAudioContent {
    return {
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        caption: apiOptional(identity, domain.caption),
    };
}

export function apiOptional<D, A>(mapper: (d: D) => A, domain: D | undefined): [] | [A] {
    return domain !== undefined ? [mapper(domain)] : [];
}

export function apiMaybeAccessGate(domain: AccessGate): [] | [ApiAccessGate] {
    if (domain.kind === "no_gate") return [];
    if (domain.kind === "nft_gate") return []; // TODO
    if (domain.kind === "diamond_gate") return [{ DiamondMember: null }];
    if (domain.kind === "credential_gate")
        return [
            {
                VerifiedCredential: {
                    issuer_origin: domain.credential.issuerOrigin,
                    credential_type: domain.credential.credentialType,
                    credential_arguments: apiOptional((args: Record<string, string | number>) => {
                        const encoder = new TextEncoder();
                        return encoder.encode(JSON.stringify(args));
                    }, domain.credential.credentialArguments),
                },
            },
        ];
    if (domain.kind === "neuron_gate") {
        return [
            {
                SnsNeuron: {
                    governance_canister_id: Principal.fromText(domain.governanceCanister),
                    min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                    min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
                },
            },
        ];
    }
    if (domain.kind === "payment_gate") {
        return [
            {
                Payment: {
                    ledger_canister_id: Principal.fromText(domain.ledgerCanister),
                    amount: domain.amount,
                    fee: domain.fee,
                },
            },
        ];
    }
    return [];
}

export function apiAccessGate(domain: AccessGate): ApiAccessGate {
    if (domain.kind === "diamond_gate") return { DiamondMember: null };
    if (domain.kind === "credential_gate")
        return {
            VerifiedCredential: {
                issuer_origin: domain.credential.issuerOrigin,
                credential_type: domain.credential.credentialType,
                credential_arguments: apiOptional((args: Record<string, string | number>) => {
                    const encoder = new TextEncoder();
                    return encoder.encode(JSON.stringify(args));
                }, domain.credential.credentialArguments),
            },
        };
    if (domain.kind === "neuron_gate") {
        return {
            SnsNeuron: {
                governance_canister_id: Principal.fromText(domain.governanceCanister),
                min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
            },
        };
    }
    if (domain.kind === "payment_gate") {
        return {
            Payment: {
                ledger_canister_id: Principal.fromText(domain.ledgerCanister),
                amount: domain.amount,
                fee: domain.fee,
            },
        };
    }
    throw new Error(`Received a domain level group gate that we cannot parse: ${domain}`);
}

export function credentialArguments(
    candid: number[] | Uint8Array,
): Record<string, string | number> {
    const data = new Uint8Array(candid);
    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    return JSON.parse(json) as Record<string, string | number>;
}

export function accessGate(candid: ApiAccessGate): AccessGate {
    if ("SnsNeuron" in candid) {
        return {
            kind: "neuron_gate",
            minDissolveDelay: optional(candid.SnsNeuron.min_dissolve_delay, Number),
            minStakeE8s: optional(candid.SnsNeuron.min_stake_e8s, Number),
            governanceCanister: candid.SnsNeuron.governance_canister_id.toString(),
        };
    }
    if ("DiamondMember" in candid) {
        return {
            kind: "diamond_gate",
        };
    }
    if ("VerifiedCredential" in candid) {
        return {
            kind: "credential_gate",
            credential: {
                issuerOrigin: candid.VerifiedCredential.issuer_origin,
                credentialType: candid.VerifiedCredential.credential_type,
                credentialArguments: optional(
                    candid.VerifiedCredential.credential_arguments,
                    credentialArguments,
                ),
            },
        };
    }
    if ("Payment" in candid) {
        return {
            kind: "payment_gate",
            ledgerCanister: candid.Payment.ledger_canister_id.toString(),
            amount: candid.Payment.amount,
            fee: candid.Payment.fee,
        };
    }
    if ("TokenBalance" in candid) {
        return {
            kind: "token_balance_gate",
            ledgerCanister: candid.TokenBalance.ledger_canister_id.toString(),
            minBalance: candid.TokenBalance.min_balance,
        };
    }

    throw new UnsupportedValueError("Unexpected ApiGroupGate type received", candid);
}

function apiBlobReference(domain?: BlobReference): [] | [ApiBlobReference] {
    return apiOptional(
        (b) => ({
            blob_id: b.blobId,
            canister_id: Principal.fromText(b.canisterId),
        }),
        domain,
    );
}

export function apiPrizeContentInitial(domain: PrizeContentInitial): ApiPrizeCotentInitial {
    return {
        caption: apiOptional(identity, domain.caption),
        transfer: apiPendingCryptoTransaction(domain.transfer),
        end_date: domain.endDate,
        diamond_only: domain.diamondOnly,
        prizes: domain.prizes.map((p) => ({ e8s: p })),
    };
}

export function apiP2PSwapContentInitial(domain: P2PSwapContentInitial): ApiP2PSwapContentInitial {
    return {
        token0: apiTokenInfo(domain.token0),
        token1: apiTokenInfo(domain.token1),
        token0_amount: domain.token0Amount,
        token1_amount: domain.token1Amount,
        caption: apiOptional(identity, domain.caption),
        expires_in: domain.expiresIn,
    };
}

function apiTokenInfo(domain: TokenInfo): ApiTokenInfo {
    return {
        fee: domain.fee,
        decimals: domain.decimals,
        token: apiToken(domain.symbol),
        ledger: Principal.fromText(domain.ledger),
    };
}

export function apiPendingCryptoContent(domain: CryptocurrencyContent): ApiCryptoContent {
    return {
        recipient: Principal.fromText(domain.transfer.recipient),
        caption: apiOptional(identity, domain.caption),
        transfer: apiPendingCryptoTransaction(domain.transfer),
    };
}

export function apiPendingCryptoTransaction(domain: CryptocurrencyTransfer): ApiCryptoTransaction {
    if (domain.kind === "pending") {
        if (domain.token === "ICP") {
            return {
                Pending: {
                    NNS: {
                        ledger: Principal.fromText(domain.ledger),
                        token: apiToken(domain.token),
                        to: {
                            User: Principal.fromText(domain.recipient),
                        },
                        amount: apiICP(domain.amountE8s),
                        fee: [],
                        memo: apiOptional(identity, domain.memo),
                        created: domain.createdAtNanos,
                    },
                },
            };
        } else {
            return {
                Pending: {
                    ICRC1: {
                        ledger: Principal.fromText(domain.ledger),
                        token: apiToken(domain.token),
                        to: {
                            owner: Principal.fromText(domain.recipient),
                            subaccount: [],
                        },
                        amount: domain.amountE8s,
                        fee: domain.feeE8s ?? BigInt(0),
                        memo: apiOptional(bigintToBytes, domain.memo),
                        created: domain.createdAtNanos,
                    },
                },
            };
        }
    }
    throw new Error("Transaction is not of type 'Pending': " + JSON.stringify(domain));
}

export function apiPendingCryptocurrencyWithdrawal(
    domain: PendingCryptocurrencyWithdrawal,
): WithdrawCryptoArgs {
    if (domain.token === ICP_SYMBOL && isAccountIdentifierValid(domain.to)) {
        return {
            withdrawal: {
                NNS: {
                    ledger: Principal.fromText(domain.ledger),
                    token: apiToken(domain.token),
                    to: { Account: hexStringToBytes(domain.to) },
                    amount: apiICP(domain.amountE8s),
                    fee: [],
                    memo: apiOptional(identity, domain.memo),
                    created: domain.createdAtNanos,
                },
            },
        };
    } else {
        return {
            withdrawal: {
                ICRC1: {
                    ledger: Principal.fromText(domain.ledger),
                    token: apiToken(domain.token),
                    to: { owner: Principal.fromText(domain.to), subaccount: [] },
                    amount: domain.amountE8s,
                    fee: domain.feeE8s ?? BigInt(0),
                    memo: apiOptional(bigintToBytes, domain.memo),
                    created: domain.createdAtNanos,
                },
            },
        };
    }
}

export function proposalVote(vote: number): boolean | undefined {
    if (vote === 1) return true;
    if (vote === 2) return false;
    return undefined;
}

export function apiProposalVote(vote: boolean): number {
    return vote ? 1 : 2;
}

function apiTextContent(domain: TextContent): ApiTextContent {
    return {
        text: domain.text,
    };
}

function apiFileContent(domain: FileContent): ApiFileContent {
    return {
        name: domain.name,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        caption: apiOptional(identity, domain.caption),
        file_size: domain.fileSize,
    };
}

function apiICP(amountE8s: bigint): ApiICP {
    return {
        e8s: amountE8s,
    };
}

export function groupChatSummary(candid: ApiGroupCanisterGroupChatSummary): GroupChatSummary {
    const latestMessage = optional(candid.latest_message, messageEvent);
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId: candid.chat_id.toString() },
        latestMessage,
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        historyVisible: candid.history_visible_to_new_joiners,
        minVisibleEventIndex: candid.min_visible_event_index,
        minVisibleMessageIndex: candid.min_visible_message_index,
        latestEventIndex: candid.latest_event_index,
        latestMessageIndex: optional(candid.latest_message_index, identity),
        lastUpdated: candid.last_updated,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
        memberCount: candid.participant_count,
        permissions: groupPermissions(candid.permissions_v2),
        metrics: chatMetrics(candid.metrics),
        subtype: optional(candid.subtype, apiGroupSubtype),
        previewed: false,
        frozen: candid.frozen.length > 0,
        dateLastPinned: optional(candid.date_last_pinned, identity),
        dateReadPinned: undefined,
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "group",
        eventsTTL: optional(candid.events_ttl, identity),
        eventsTtlLastUpdated: candid.events_ttl_last_updated,
        membership: {
            joined: candid.joined,
            role: memberRole(candid.role),
            mentions: [],
            latestThreads: [],
            myMetrics: chatMetrics(candid.my_metrics),
            notificationsMuted: candid.notifications_muted,
            readByMeUpTo: latestMessage?.event.messageIndex,
            archived: false,
            rulesAccepted: candid.rules_accepted,
        },
        localUserIndex: candid.local_user_index_canister_id.toString(),
    };
}

export function communitySummary(candid: ApiCommunityCanisterCommunitySummary): CommunitySummary {
    const communityId = candid.community_id.toString();
    return {
        kind: "community",
        id: { kind: "community", communityId },
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        historyVisible: false,
        latestEventIndex: candid.latest_event_index,
        lastUpdated: candid.last_updated,
        metrics: chatMetrics(candid.metrics),
        avatar: {
            blobReference: optional(candid.avatar_id, (blobId) => ({
                blobId,
                canisterId: candid.community_id.toString(),
            })),
        },
        banner: {
            blobReference: optional(candid.banner_id, (blobId) => ({
                blobId,
                canisterId: candid.community_id.toString(),
            })),
        },
        memberCount: candid.member_count,
        frozen: candid.frozen.length > 0,
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "community",
        permissions: communityPermissions(candid.permissions),
        membership: {
            joined: optional(candid.membership, (m) => m.joined) ?? BigInt(0),
            role: optional(candid.membership, (m) => memberRole(m.role)) ?? "none",
            archived: false,
            pinned: [],
            index: 0,
            displayName: optional(candid.membership, (m) => optional(m.display_name, identity)),
            rulesAccepted: optional(candid.membership, (m) => m.rules_accepted) ?? false,
        },
        channels: candid.channels.map((c) => communityChannelSummary(c, communityId)),
        primaryLanguage: candid.primary_language,
        userGroups: new Map(candid.user_groups.map(userGroup)),
        localUserIndex: candid.local_user_index_canister_id.toString(),
    };
}

export function userGroup(candid: ApiUserGroup): [number, UserGroupSummary] {
    return [
        candid.user_group_id,
        {
            kind: "user_group",
            id: candid.user_group_id,
            name: candid.name,
            memberCount: candid.members,
        },
    ];
}

export function communityChannelSummary(
    candid: ApiCommunityCanisterChannelSummary,
    communityId: string,
): ChannelSummary {
    const latestMessage = optional(candid.latest_message, messageEvent);
    return {
        kind: "channel",
        id: { kind: "channel", communityId, channelId: candid.channel_id.toString() },
        latestMessage,
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        historyVisible: candid.history_visible_to_new_joiners,
        minVisibleEventIndex: candid.min_visible_event_index,
        minVisibleMessageIndex: candid.min_visible_message_index,
        latestEventIndex: candid.latest_event_index,
        latestMessageIndex: optional(candid.latest_message_index, identity),
        lastUpdated: candid.last_updated,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: communityId,
        })),
        memberCount: candid.member_count,
        permissions: groupPermissions(candid.permissions_v2),
        metrics: chatMetrics(candid.metrics),
        subtype: optional(candid.subtype, apiGroupSubtype),
        frozen: false, // TODO - doesn't exist
        dateLastPinned: optional(candid.date_last_pinned, identity),
        dateReadPinned: undefined,
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "channel",
        eventsTTL: optional(candid.events_ttl, identity),
        eventsTtlLastUpdated: candid.events_ttl_last_updated,
        membership: {
            joined: optional(candid.membership, (m) => m.joined) ?? BigInt(0),
            notificationsMuted: optional(candid.membership, (m) => m.notifications_muted) ?? false,
            role: optional(candid.membership, (m) => memberRole(m.role)) ?? "none",
            myMetrics:
                optional(candid.membership, (m) => chatMetrics(m.my_metrics)) ?? emptyChatMetrics(),
            readByMeUpTo: latestMessage?.event.messageIndex,
            latestThreads:
                optional(candid.membership, (m) => m.latest_threads.map(threadSyncDetails)) ?? [],
            mentions: [],
            archived: false,
            rulesAccepted: optional(candid.membership, (m) => m.rules_accepted) ?? false,
        },
    };
}

export function threadSyncDetails(candid: ApiGroupCanisterThreadDetails): ThreadSyncDetails {
    return {
        threadRootMessageIndex: candid.root_message_index,
        lastUpdated: candid.last_updated,
        latestEventIndex: candid.latest_event,
        latestMessageIndex: candid.latest_message,
    };
}

export function gateCheckFailedReason(candid: ApiGateCheckFailedReason): GateCheckFailedReason {
    if ("NotDiamondMember" in candid) {
        return "not_diamond";
    }
    if ("NoSnsNeuronsFound" in candid) {
        return "no_sns_neuron_found";
    }
    if ("NoSnsNeuronsWithRequiredDissolveDelayFound" in candid) {
        return "dissolve_delay_not_met";
    }
    if ("NoSnsNeuronsWithRequiredStakeFound" in candid) {
        return "min_stake_not_met";
    }
    if ("PaymentFailed" in candid) {
        console.warn("PaymentFailed: ", candid);
        return "payment_failed";
    }
    if ("InsufficientBalance" in candid) {
        return "insufficient_balance";
    }
    throw new UnsupportedValueError("Unexpected ApiGateCheckFailedReason type received", candid);
}

export function addRemoveReactionResponse(
    candid:
        | ApiAddDirectReactionResponse
        | ApiRemoveDirectReactionResponse
        | ApiAddGroupReactionResponse
        | ApiRemoveGroupReactionResponse
        | ApiAddChannelReactionResponse
        | ApiRemoveChannelReactionResponse,
): AddRemoveReactionResponse {
    if ("Success" in candid || "SuccessV2" in candid) {
        return CommonResponses.success();
    } else if ("NoChange" in candid) {
        return CommonResponses.success();
    } else {
        console.warn("AddRemoveReaction failed with: ", candid);
        return CommonResponses.failure();
    }
}

export function groupSubtype(subtype: ApiGroupSubtype): GroupSubtype {
    return {
        kind: "governance_proposals",
        isNns: subtype.GovernanceProposals.is_nns,
        governanceCanisterId: subtype.GovernanceProposals.governance_canister_id.toString(),
    };
}

export function messagesSuccessResponse(
    candid: ApiMessagesSuccessResult,
): EventsSuccessResult<Message> {
    return {
        events: candid.messages.map(messageEvent),
        expiredEventRanges: [],
        expiredMessageRanges: [],
        latestEventIndex: candid.latest_event_index,
    };
}

export function messageEvent(candid: ApiMessageEventWrapper): EventWrapper<Message> {
    return {
        event: message(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
        expiresAt: optional(candid.expires_at, Number),
    };
}

export function threadDetails(candid: ApiGroupCanisterThreadDetails): GroupCanisterThreadDetails {
    return {
        threadRootMessageIndex: candid.root_message_index,
        lastUpdated: candid.last_updated,
        latestEventIndex: candid.latest_event,
        latestMessageIndex: candid.latest_message,
    };
}

export function mention(candid: ApiMention): Mention {
    return {
        messageId: candid.message_id,
        messageIndex: candid.message_index,
        eventIndex: candid.event_index,
        mentionedBy: candid.mentioned_by.toString(),
    };
}

export function expiredEventsRange([start, end]: [number, number]): ExpiredEventsRange {
    return {
        kind: "expired_events_range",
        start,
        end,
    };
}

export function expiredMessagesRange([start, end]: [number, number]): ExpiredMessagesRange {
    return {
        kind: "expired_messages_range",
        start,
        end,
    };
}

export function updateGroupResponse(
    candid: ApiUpdateGroupResponse | ApiUpdateChannelResponse,
): UpdateGroupResponse {
    if ("Success" in candid) {
        return { kind: "success", rulesVersion: undefined };
    }
    if ("SuccessV2" in candid) {
        return {
            kind: "success",
            rulesVersion: optional(candid.SuccessV2.rules_version, identity),
        };
    }
    if ("DescriptionTooLong" in candid) {
        return { kind: "desc_too_long" };
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
    if ("Unchanged" in candid) {
        return { kind: "unchanged" };
    }
    if ("NotAuthorized" in candid) {
        return { kind: "not_authorized" };
    }
    if ("NameTaken" in candid) {
        return { kind: "name_taken" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("CallerNotInGroup" in candid) {
        return { kind: "not_in_group" };
    }
    if ("AvatarTooBig" in candid) {
        return { kind: "avatar_too_big" };
    }
    if ("RulesTooLong" in candid) {
        return { kind: "rules_too_long" };
    }
    if ("RulesTooShort" in candid) {
        return { kind: "rules_too_short" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    if (
        "UserNotInChannel" in candid ||
        "ChannelNotFound" in candid ||
        "UserNotInCommunity" in candid ||
        "CommunityFrozen" in candid ||
        "CannotMakeChannelPublic" in candid ||
        "CannotMakeGroupPublic" in candid ||
        "CannotMakeDefaultChannelPrivate" in candid
    ) {
        console.warn("UpdateGroupResponse failed with: ", candid);
        return { kind: "failure" };
    }
    throw new UnsupportedValueError("Unexpected ApiUpdateGroupResponse type received", candid);
}

export function createGroupResponse(
    candid: ApiCreateGroupResponse | ApiCreateChannelResponse,
    id: MultiUserChatIdentifier,
): CreateGroupResponse {
    if ("Success" in candid) {
        if ("channel_id" in candid.Success && id.kind === "channel") {
            const canisterId: ChannelIdentifier = {
                kind: "channel",
                communityId: id.communityId,
                channelId: candid.Success.channel_id.toString(),
            };
            return { kind: "success", canisterId };
        }
        if ("chat_id" in candid.Success && id.kind === "group_chat") {
            const canisterId: GroupChatIdentifier = {
                kind: "group_chat",
                groupId: candid.Success.chat_id.toString(),
            };
            return { kind: "success", canisterId };
        }
        throw new Error("Unexpected CreateGroup success response: " + candid.Success);
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

    if ("MaxGroupsCreated" in candid || "MaxChannelsCreated" in candid) {
        // todo - make sure we handle this in the UI
        return { kind: "max_groups_created" };
    }

    if ("RulesTooLong" in candid) {
        return { kind: "rules_too_long" };
    }

    if ("RulesTooShort" in candid) {
        return { kind: "rules_too_short" };
    }

    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }

    if ("UnauthorizedToCreatePublicGroup" in candid) {
        return { kind: "unauthorized_to_create_public_group" };
    }

    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized();
    }

    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen();
    }

    if ("DefaultMustBePublic" in candid) {
        return { kind: "default_must_be_public" };
    }

    throw new UnsupportedValueError("Unexpected ApiCreateGroupResponse type received", candid);
}

export function deleteGroupResponse(
    candid: ApiDeleteGroupResponse | ApiDeleteChannelResponse,
): DeleteGroupResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("DeleteGroupResponse failed with: ", candid);
        return "failure";
    }
}

export function pinMessageResponse(
    candid: ApiPinMessageResponse | ApiPinChannelMessageResponse,
): PinMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            eventIndex: candid.Success.index,
            timestamp: candid.Success.timestamp,
        };
    } else if ("NoChange" in candid) {
        return CommonResponses.noChange();
    } else {
        console.warn("PinMessageResponse failed with: ", candid);
        return CommonResponses.failure();
    }
}

export function unpinMessageResponse(
    candid: ApiUnpinMessageResponse | ApiPinChannelMessageResponse,
): UnpinMessageResponse {
    if ("Success" in candid || "SuccessV2" in candid || "NoChange" in candid) {
        return "success";
    } else {
        console.warn("UnpinMessageResponse failed with: ", candid);
        return "failure";
    }
}

export function groupDetailsResponse(
    candid: ApiSelectedInitialResponse | ApiSelectedChannelInitialResponse,
): GroupChatDetailsResponse {
    if (
        "CallerNotInGroup" in candid ||
        "UserNotInChannel" in candid ||
        "UserNotInCommunity" in candid ||
        "PrivateCommunity" in candid ||
        "PrivateChannel" in candid ||
        "ChannelNotFound" in candid
    ) {
        console.warn("GetGroupDetails failed with ", candid);
        return "failure";
    }
    if ("Success" in candid) {
        const members =
            "participants" in candid.Success ? candid.Success.participants : candid.Success.members;
        return {
            members: members.map(member),
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            invitedUsers: new Set(candid.Success.invited_users.map((u) => u.toString())),
            pinnedMessages: new Set(candid.Success.pinned_messages),
            rules: candid.Success.chat_rules,
            timestamp: candid.Success.timestamp,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function groupDetailsUpdatesResponse(
    candid: ApiSelectedUpdatesResponse | ApiSelectedChannelUpdatesResponse,
): GroupChatDetailsUpdatesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            membersAddedOrUpdated: candid.Success.members_added_or_updated.map(member),
            membersRemoved: new Set(candid.Success.members_removed.map((u) => u.toString())),
            blockedUsersAdded: new Set(candid.Success.blocked_users_added.map((u) => u.toString())),
            blockedUsersRemoved: new Set(
                candid.Success.blocked_users_removed.map((u) => u.toString()),
            ),
            pinnedMessagesAdded: new Set(candid.Success.pinned_messages_added),
            pinnedMessagesRemoved: new Set(candid.Success.pinned_messages_removed),
            rules: optional(candid.Success.chat_rules, identity),
            invitedUsers: optional(
                candid.Success.invited_users,
                (invited_users) => new Set(invited_users.map((u) => u.toString())),
            ),
            timestamp: candid.Success.timestamp,
        };
    } else if ("SuccessNoUpdates" in candid) {
        return {
            kind: "success_no_updates",
            timestamp: candid.SuccessNoUpdates,
        };
    } else {
        console.warn("Unexpected ApiSelectedUpdatesResponse type received", candid);
        return CommonResponses.failure();
    }
}

export function member(candid: ApiParticipant): Member {
    return {
        role: memberRole(candid.role),
        userId: candid.user_id.toString(),
        displayName: undefined,
    };
}

export function editMessageResponse(
    candid: ApiEditMessageResponse | ApiEditChannelMessageResponse | ApiEditDirectMessageResponse,
): EditMessageResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("EditMessageResponse failed with: ", candid);
        return "failure";
    }
}

export function declineInvitationResponse(
    candid: ApiDeclineInvitationResponse | ApiDeclineChannelInvitationResponse,
): DeclineInvitationResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("DeclineInvitationResponse failed with: ", candid);
        return "failure";
    }
}

export function leaveGroupResponse(
    candid: ApiLeaveGroupResponse | ApiLeaveChannelResponse,
): LeaveGroupResponse {
    if (
        "Success" in candid ||
        "GroupNotFound" in candid ||
        "CallerNotInGroup" in candid ||
        "UserNotInChannel" in candid ||
        "ChannelNotFound" in candid
    ) {
        return "success";
    }
    if ("OwnerCannotLeave" in candid || "LastOwnerCannotLeave" in candid) {
        return "owner_cannot_leave";
    }
    return "failure";
}

export function deleteMessageResponse(
    candid: ApiDeleteMessageResponse | ApiDeleteChannelMessageResponse,
): DeleteMessageResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("DeleteMessageResponse failed with: ", candid);
        return "failure";
    }
}

export function deletedMessageResponse(
    candid: ApiDeletedGroupMessageResponse | ApiDeletedChannelMessageResponse,
): DeletedGroupMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            content: messageContent(candid.Success.content, "unknown"),
        };
    } else {
        console.warn("DeletedMessageResponse failed with: ", candid);
        return CommonResponses.failure();
    }
}

export function undeleteMessageResponse(
    candid: ApiUndeleteMessageResponse | ApiUndeleteChannelMessageResponse,
): UndeleteMessageResponse {
    if ("Success" in candid) {
        if (candid.Success.messages.length == 0) {
            return CommonResponses.failure();
        } else {
            return {
                kind: "success",
                message: message(candid.Success.messages[0]),
            };
        }
    } else {
        console.warn("UndeleteMessageResponse failed with: ", candid);
        return CommonResponses.failure();
    }
}

export function threadPreviewsResponse(
    candid: ApiThreadPreviewsResponse | ApiChannelThreadPreviewsResponse,
    chatId: ChatIdentifier,
    latestClientThreadUpdate: bigint | undefined,
): ThreadPreviewsResponse {
    if ("Success" in candid) {
        return {
            kind: "thread_previews_success",
            threads: candid.Success.threads.map((t) => threadPreview(chatId, t)),
        };
    }
    if ("ReplicaNotUpToDate" in candid) {
        throw ReplicaNotUpToDateError.byTimestamp(
            candid.ReplicaNotUpToDate,
            latestClientThreadUpdate ?? BigInt(-1),
            false,
        );
    }
    console.warn("ThreadPreviewsResponse failed with: ", candid);
    return CommonResponses.failure();
}

export function threadPreview(chatId: ChatIdentifier, candid: ApiThreadPreview): ThreadPreview {
    return {
        chatId: { ...chatId },
        latestReplies: candid.latest_replies
            .map(messageEvent)
            .sort((e1, e2) => e1.index - e2.index),
        totalReplies: candid.total_replies,
        rootMessage: messageEvent(candid.root_message),
    };
}

export function changeRoleResponse(
    candid: ApiChangeRoleResponse | ApiChangeChannelRoleResponse,
): ChangeRoleResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("ChangeRoleResponse failed with: ", candid);
        return "failure";
    }
}

export function registerPollVoteResponse(
    candid: ApiRegisterPollVoteResponse | ApiRegisterChannelPollVoteResponse,
): RegisterPollVoteResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("RegisterPollVoteResponse failed with: ", candid);
        return "failure";
    }
}

export function apiChatIdentifier(chatId: ChatIdentifier): ApiChat {
    switch (chatId.kind) {
        case "group_chat":
            return { Group: Principal.fromText(chatId.groupId) };
        case "direct_chat":
            return { Direct: Principal.fromText(chatId.userId) };
        case "channel":
            return { Channel: [Principal.fromText(chatId.communityId), BigInt(chatId.channelId)] };
    }
}

export function joinGroupResponse(candid: ApiJoinGroupResponse): JoinGroupResponse {
    if ("Success" in candid) {
        return { kind: "success", group: groupChatSummary(candid.Success) };
    } else if ("AlreadyInGroupV2" in candid) {
        return { kind: "success", group: groupChatSummary(candid.AlreadyInGroupV2) };
    } else if ("Blocked" in candid) {
        return CommonResponses.userBlocked();
    } else if ("GateCheckFailed" in candid) {
        return { kind: "gate_check_failed", reason: gateCheckFailedReason(candid.GateCheckFailed) };
    } else {
        console.warn("Join group failed with: ", candid);
        return CommonResponses.failure();
    }
}

export function searchGroupChatResponse(
    candid: ApiSearchGroupChatResponse | ApiSearchChannelResponse,
    chatId: MultiUserChatIdentifier,
): SearchGroupChatResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map((m) => messageMatch(m, chatId)),
        };
    } else {
        console.warn("SearchChat failed with ", candid);
        return CommonResponses.failure();
    }
}

export function inviteCodeResponse(
    candid: ApiInviteCodeResponse | ApiCommunityInviteCodeResponse,
): InviteCodeResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            code: optional(candid.Success.code, codeToText),
        };
    } else if ("NotAuthorized" in candid) {
        return {
            kind: "not_authorized",
        };
    } else {
        console.warn("InviteCode failed with ", candid);
        return CommonResponses.failure();
    }
}

export function enableInviteCodeResponse(
    candid: ApiEnableInviteCodeResponse | ApiCommunityEnableInviteCodeResponse,
): EnableInviteCodeResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            code: codeToText(candid.Success.code),
        };
    } else if ("NotAuthorized" in candid) {
        return {
            kind: "not_authorized",
        };
    } else {
        console.warn("EnableInviteCode failed with");
        return CommonResponses.failure();
    }
}

export function disableInviteCodeResponse(
    candid: ApiDisableInviteCodeResponse | ApiCommunityDisableInviteCodeResponse,
): DisableInviteCodeResponse {
    if ("Success" in candid) {
        return "success";
    } else if ("NotAuthorized" in candid) {
        return "not_authorized";
    } else {
        console.warn("DisableInviteCode failed with ", candid);
        return "failure";
    }
}

export function resetInviteCodeResponse(
    candid: ApiResetInviteCodeResponse | ApiCommunityEnableInviteCodeResponse,
): ResetInviteCodeResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            code: codeToText(candid.Success.code),
        };
    } else if ("NotAuthorized" in candid) {
        return {
            kind: "not_authorized",
        };
    } else {
        console.warn("ResetInviteCode failed with ", candid);
        return CommonResponses.failure();
    }
}

export function registerProposalVoteResponse(
    candid: ApiGroupRegisterProposalVoteResponse | ApiCommunityRegisterProposalVoteResponse,
): RegisterProposalVoteResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AlreadyVoted" in candid) {
        return "already_voted";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("UserNotInChannel" in candid) {
        return "user_not_in_channel";
    }
    if ("ChannelNotFound" in candid) {
        return "channel_not_found";
    }
    if ("UserNotInCommunity" in candid) {
        return "user_not_in_community";
    }
    if ("CommunityFrozen" in candid) {
        return "community_frozen";
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
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiRegisterProposalVoteResponse type received",
        candid,
    );
}

export function claimPrizeResponse(
    candid: ApiClaimGroupPrizeResponse | ApiClaimChannelPrizeResponse,
): ClaimPrizeResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    } else {
        console.warn("ClaimPrize failed with ", candid);
        return CommonResponses.failure();
    }
}

export function statusError(
    candid: SwapStatusError,
): AcceptP2PSwapResponse & CancelP2PSwapResponse {
    if ("Reserved" in candid) {
        return {
            kind: "already_reserved",
            reservedBy: candid.Reserved.reserved_by.toString(),
        };
    }
    if ("Accepted" in candid) {
        return {
            kind: "already_accepted",
            acceptedBy: candid.Accepted.accepted_by.toString(),
            token1TxnIn: candid.Accepted.token1_txn_in,
        };
    }
    if ("Completed" in candid) {
        const { accepted_by, token1_txn_in, token0_txn_out, token1_txn_out } = candid.Completed;
        return {
            kind: "already_completed",
            acceptedBy: accepted_by.toString(),
            token1TxnIn: token1_txn_in,
            token0TxnOut: token0_txn_out,
            token1TxnOut: token1_txn_out,
        };
    }
    if ("Cancelled" in candid) {
        return {
            kind: "swap_cancelled",
            token0TxnOut: optional(candid.Cancelled.token0_txn_out, identity),
        };
    }
    if ("Expired" in candid) {
        return {
            kind: "swap_expired",
            token0TxnOut: optional(candid.Expired.token0_txn_out, identity),
        };
    }

    throw new UnsupportedValueError("Unexpected SwapStatusError type received", candid);
}

export function acceptP2PSwapResponse(
    candid:
        | ApiCommunityAcceptP2PSwapResponse
        | ApiGroupAcceptP2PSwapResponse
        | ApiUserAcceptP2PSwapResponse,
): AcceptP2PSwapResponse {
    if ("Success" in candid) {
        return { kind: "success", token1TxnIn: candid.Success.token1_txn_in };
    }
    if ("StatusError" in candid) {
        return statusError(candid.StatusError);
    }
    if ("ChatNotFound" in candid) return { kind: "chat_not_found" };
    if ("UserNotInGroup" in candid) return { kind: "user_not_in_group" };
    if ("UserNotInCommunity" in candid) return { kind: "user_not_in_community" };
    if ("UserNotInChannel" in candid) return { kind: "user_not_in_channel" };
    if ("ChannelNotFound" in candid) return { kind: "channel_not_found" };
    if ("SwapNotFound" in candid) return { kind: "swap_not_found" };
    if ("ChatFrozen" in candid) return { kind: "chat_frozen" };
    if ("UserSuspended" in candid) return { kind: "user_suspended" };
    if ("InternalError" in candid) return { kind: "internal_error", text: candid.InternalError };
    if ("InsufficientFunds" in candid) return { kind: "insufficient_funds" };

    throw new UnsupportedValueError("Unexpected ApiAcceptP2PSwapResponse type received", candid);
}

export function cancelP2PSwapResponse(
    candid:
        | ApiCommunityCancelP2PSwapResponse
        | ApiGroupCancelP2PSwapResponse
        | ApiUserCancelP2PSwapResponse,
): CancelP2PSwapResponse {
    if ("Success" in candid) {
        return { kind: "success" };
    }
    if ("StatusError" in candid) {
        return statusError(candid.StatusError);
    }
    if ("ChatNotFound" in candid) return { kind: "chat_not_found" };
    if ("UserNotInGroup" in candid) return { kind: "user_not_in_group" };
    if ("UserNotInCommunity" in candid) return { kind: "user_not_in_community" };
    if ("UserNotInChannel" in candid) return { kind: "user_not_in_channel" };
    if ("ChannelNotFound" in candid) return { kind: "channel_not_found" };
    if ("ChatFrozen" in candid) return { kind: "chat_frozen" };
    if ("SwapNotFound" in candid) return { kind: "swap_not_found" };
    if ("UserSuspended" in candid) return { kind: "user_suspended" };

    throw new UnsupportedValueError("Unexpected ApiCancelP2PSwapResponse type received", candid);
}
