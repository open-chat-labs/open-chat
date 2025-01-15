import {
    bigintToBytes,
    bytesToBigint,
    bytesToHexString,
    hexStringToBytes,
    identity,
    mapOptional,
    principalBytesToString,
    principalStringToBytes,
} from "../../utils/mapping";
import type {
    Message,
    ChatEvent,
    EventsSuccessResult,
    ThreadSummary,
    // StaleMessage,
    MessageContent,
    // User,
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
    // GroupCanisterThreadDetails,
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
    VideoCallContent,
    JoinVideoCallResponse,
    VideoCallType,
    VideoCallPresence,
    SetVideoCallPresenceResponse,
    VideoCallParticipantsResponse,
    VideoCallParticipant,
    LeafGate,
    UpdatedEvent,
    User,
    DexId,
    MessageMatch,
    AcceptP2PSwapResponse,
    AccessGateConfig,
    SetPinNumberResponse,
    MessagePermission,
    SlashCommandPermissions,
    BotGroupDetails,
    BotDefinition,
    SlashCommandSchema,
    SlashCommandParamType,
    SlashCommandParam,
    BotMessageContext,
    SlashCommandParamInstance,
} from "openchat-shared";
import {
    ProposalDecisionStatus,
    ProposalRewardStatus,
    UnsupportedValueError,
    CommonResponses,
    chatIdentifiersEqual,
    codeToText,
    emptyChatMetrics,
    isAccountIdentifierValid,
    CHAT_SYMBOL,
    CKBTC_SYMBOL,
    ICP_SYMBOL,
    KINIC_SYMBOL,
    SNS1_SYMBOL,
} from "openchat-shared";
import { pinNumberFailureResponseV2 } from "./pinNumberErrorMapper";
import { toRecord2 } from "../../utils/list";
import { ReplicaNotUpToDateError } from "../error";
import type {
    AccessGate as TAccessGate,
    AccessGateConfig as TAccessGateConfig,
    AccessGateNonComposite as TAccessGateNonComposite,
    AccountICRC1,
    AudioContent as TAudioContent,
    BlobReference as TBlobReference,
    CallParticipant as TCallParticipant,
    Chat as TChat,
    ChatEvent as TChatEvent,
    ChatMetrics as TChatMetrics,
    CommunityAcceptP2pSwapResponse,
    CommunityAddReactionResponse,
    CommunityCancelP2pSwapResponse,
    CommunityCanisterChannelSummary as TCommunityCanisterChannelSummary,
    CommunityCanisterCommunitySummary as TCommunityCanisterCommunitySummary,
    CommunityChangeChannelRoleResponse,
    CommunityClaimPrizeResponse,
    CommunityCreateChannelResponse,
    CommunityDeclineInvitationResponse,
    CommunityDeleteChannelResponse,
    CommunityDeleteMessagesResponse,
    CommunityDeletedMessageResponse,
    CommunityDisableInviteCodeResponse,
    CommunityEditMessageResponse,
    CommunityEnableInviteCodeResponse,
    CommunityInviteCodeResponse,
    CommunityLeaveChannelResponse,
    CommunityPermissionRole as TCommunityPermissionRole,
    CommunityPermissions as TCommunityPermissions,
    CommunityPinMessageResponse,
    CommunityRegisterPollVoteResponse,
    CommunityRegisterProposalVoteResponse,
    CommunityRemoveReactionResponse,
    CommunityRole as TCommunityRole,
    CommunitySearchChannelResponse,
    CommunitySelectedChannelInitialResponse,
    CommunitySelectedChannelUpdatesResponse,
    CommunitySetVideoCallPresenceResponse,
    CommunityThreadPreviewsResponse,
    CommunityUndeleteMessagesResponse,
    CommunityUpdateChannelResponse,
    CommunityVideoCallParticipantsResponse,
    CompletedCryptoTransaction as TCompletedCryptoTransaction,
    CryptoContent as TCryptoContent,
    CryptoTransaction as TCryptoTransaction,
    Cryptocurrency as TCryptocurrency,
    CustomContent as TCustomContent,
    DeletedBy as TDeletedBy,
    EventWrapperChatEvent as TEventWrapperChatEvent,
    EventWrapperMessage as TEventWrapperMessage,
    EventsResponse as TEventsResponse,
    ExchangeId as TExchangeId,
    FailedCryptoTransaction as TFailedCryptoTransaction,
    FileContent as TFileContent,
    GateCheckFailedReason as TGateCheckFailedReason,
    GiphyContent as TGiphyContent,
    GiphyImageVariant as TGiphyImageVariant,
    GroupAcceptP2pSwapResponse,
    GroupAddReactionResponse,
    GroupCancelP2pSwapResponse,
    GroupCanisterGroupChatSummary as TGroupCanisterGroupChatSummary,
    GroupCanisterThreadDetails as TGroupCanisterThreadDetails,
    GroupChangeRoleResponse,
    GroupClaimPrizeResponse,
    GroupDeclineInvitiationResponse,
    GroupDeleteMessagesResponse,
    GroupDeletedMessageResponse,
    GroupDisableInviteCodeResponse,
    GroupEditMessageResponse,
    GroupEnableInviteCodeResponse,
    GroupInviteCodeResponse,
    GroupMember as TGroupMember,
    GroupPermissionRole as TGroupPermissionRole,
    GroupPermissions as TGroupPermissions,
    GroupPinMessageResponse,
    GroupRegisterPollVoteResponse,
    GroupRegisterProposalVoteResponse,
    GroupRemoveReactionResponse,
    GroupRole as TGroupRole,
    GroupSearchMessagesResponse,
    GroupSelectedInitialResponse,
    GroupSelectedUpdatesResponse,
    GroupSetVideoCallPresenceResponse,
    GroupSubtype as TGroupSubtype,
    GroupThreadPreviewsResponse,
    GroupUndeleteMessagesResponse,
    GroupUnpinMessageResponse,
    GroupUpdateGroupResponse,
    GroupVideoCallParticipantsResponse,
    HydratedMention as TMention,
    ImageContent as TImageContent,
    LocalUserIndexJoinGroupResponse,
    Message as TMessage,
    BotMessageContext as TBotMessageContext,
    MessageContent as TMessageContent,
    MessageContentInitial as TMessageContentInitial,
    MessageMatch as TMessageMatch,
    MessagePermissions as TMessagePermissions,
    MessageReminderContent as TMessageReminderContent,
    MessageReminderCreatedContent as TMessageReminderCreatedContent,
    MessagesResponse as TMessagesResponse,
    MultiUserChat as TMultiUserChat,
    P2PSwapContent as TP2PSwapContent,
    P2PSwapContentInitial as TP2PSwapContentInitial,
    P2PSwapStatus as TP2PSwapStatus,
    PendingCryptoTransaction as TPendingCryptoTransaction,
    PollConfig as TPollConfig,
    PollContent as TPollContent,
    PollVotes as TPollVotes,
    PrizeContent as TPrizeContent,
    PrizeContentInitial as TPrizeContentInitial,
    PrizeWinnerContent as TPrizeWinnerContent,
    Proposal as TProposal,
    ProposalContent as TProposalContent,
    ProposalDecisionStatus as TProposalDecisionStatus,
    ProposalRewardStatus as TProposalRewardStatus,
    ReplyContext as TReplyContext,
    ReportedMessage as TReportedMessage,
    SwapStatusError as TSwapStatusError,
    TextContent as TTextContent,
    ThreadPreview as TThreadPreview,
    ThreadSummary as TThreadSummary,
    TokenInfo as TTokenInfo,
    Tokens as TTokens,
    TotalVotes as TTotalVotes,
    User as TUser,
    UserAcceptP2pSwapResponse,
    UserAddReactionResponse,
    UserCancelP2pSwapResponse,
    UserCreateGroupResponse,
    UserDeleteGroupResponse,
    UserEditMessageResponse,
    UserGroupSummary as TUserGroupSummary,
    UserJoinVideoCallResponse,
    UserLeaveGroupResponse,
    UserRemoveReactionResponse,
    UserSetPinNumberResponse,
    UserWithdrawCryptoArgs,
    VideoCallContent as TVideoCallContent,
    VideoCallPresence as TVideoCallPresence,
    VideoCallType as TVideoCallType,
    VideoContent as TVideoContent,
    GroupPermission,
    CommunityPermission,
    MessagePermission as ApiMessagePermission,
    SlashCommandPermissions as ApiSlashCommandPermissions,
    CommunityRemoveBotResponse,
    CommunityAddBotResponse,
    CommunityUpdateBotResponse,
    GroupRemoveBotResponse,
    GroupAddBotResponse,
    GroupUpdateBotResponse,
    BotGroupDetails as ApiBotGroupDetails,
    SlashCommandSchema as ApiSlashCommandSchema,
    SlashCommandParamType as ApiSlashCommandParamType,
    SlashCommandParam as ApiSlashCommandParam,
    BotCommandArg,
} from "../../typebox";

const E8S_AS_BIGINT = BigInt(100_000_000);

export function eventsSuccessResponse(value: TEventsResponse): EventsSuccessResult<ChatEvent> {
    return {
        events: value.events.map(eventWrapper),
        expiredEventRanges: value.expired_event_ranges.map(expiredEventsRange),
        expiredMessageRanges: value.expired_message_ranges.map(expiredMessagesRange),
        latestEventIndex: value.latest_event_index,
    };
}

export function eventWrapper(value: TEventWrapperChatEvent): EventWrapper<ChatEvent> {
    return {
        event: event(value.event),
        index: value.index,
        timestamp: value.timestamp,
        expiresAt: mapOptional(value.expires_at, Number),
    };
}

export function event(value: TChatEvent): ChatEvent {
    if (value === "Empty" || value === "FailedToDeserialize") {
        return { kind: "empty" };
    }
    if ("Message" in value) {
        return message(value.Message);
    }
    if ("GroupChatCreated" in value) {
        return {
            kind: "group_chat_created",
            name: value.GroupChatCreated.name,
            description: value.GroupChatCreated.description,
            created_by: principalBytesToString(value.GroupChatCreated.created_by),
        };
    }
    if ("DirectChatCreated" in value) {
        return {
            kind: "direct_chat_created",
        };
    }
    if ("ParticipantsAdded" in value) {
        return {
            kind: "members_added",
            userIds: value.ParticipantsAdded.user_ids.map(principalBytesToString),
            addedBy: principalBytesToString(value.ParticipantsAdded.added_by),
        };
    }
    if ("UsersInvited" in value) {
        return {
            kind: "users_invited",
            userIds: value.UsersInvited.user_ids.map(principalBytesToString),
            invitedBy: principalBytesToString(value.UsersInvited.invited_by),
        };
    }
    if ("ParticipantJoined" in value) {
        return {
            kind: "member_joined",
            userId: principalBytesToString(value.ParticipantJoined.user_id),
        };
    }
    if ("ParticipantsRemoved" in value) {
        return {
            kind: "members_removed",
            userIds: value.ParticipantsRemoved.user_ids.map(principalBytesToString),
            removedBy: principalBytesToString(value.ParticipantsRemoved.removed_by),
        };
    }
    if ("ParticipantLeft" in value) {
        return {
            kind: "member_left",
            userId: principalBytesToString(value.ParticipantLeft.user_id),
        };
    }
    if ("GroupNameChanged" in value) {
        return {
            kind: "name_changed",
            changedBy: principalBytesToString(value.GroupNameChanged.changed_by),
        };
    }
    if ("GroupDescriptionChanged" in value) {
        return {
            kind: "desc_changed",
            changedBy: principalBytesToString(value.GroupDescriptionChanged.changed_by),
        };
    }
    if ("GroupRulesChanged" in value) {
        return {
            kind: "rules_changed",
            enabled: value.GroupRulesChanged.enabled,
            enabledPrev: value.GroupRulesChanged.prev_enabled,
            changedBy: principalBytesToString(value.GroupRulesChanged.changed_by),
        };
    }
    if ("AvatarChanged" in value) {
        return {
            kind: "avatar_changed",
            changedBy: principalBytesToString(value.AvatarChanged.changed_by),
        };
    }
    if ("UsersBlocked" in value) {
        return {
            kind: "users_blocked",
            userIds: value.UsersBlocked.user_ids.map(principalBytesToString),
            blockedBy: principalBytesToString(value.UsersBlocked.blocked_by),
        };
    }
    if ("UsersUnblocked" in value) {
        return {
            kind: "users_unblocked",
            userIds: value.UsersUnblocked.user_ids.map(principalBytesToString),
            unblockedBy: principalBytesToString(value.UsersUnblocked.unblocked_by),
        };
    }
    if ("RoleChanged" in value) {
        return {
            kind: "role_changed",
            userIds: value.RoleChanged.user_ids.map(principalBytesToString),
            changedBy: principalBytesToString(value.RoleChanged.changed_by),
            oldRole: memberRole(value.RoleChanged.old_role),
            newRole: memberRole(value.RoleChanged.new_role),
        };
    }
    if ("MessagePinned" in value) {
        return {
            kind: "message_pinned",
            pinnedBy: principalBytesToString(value.MessagePinned.pinned_by),
            messageIndex: value.MessagePinned.message_index,
        };
    }
    if ("MessageUnpinned" in value) {
        return {
            kind: "message_unpinned",
            unpinnedBy: principalBytesToString(value.MessageUnpinned.unpinned_by),
            messageIndex: value.MessageUnpinned.message_index,
        };
    }

    if ("PermissionsChanged" in value) {
        return {
            kind: "permissions_changed",
            oldPermissions: groupPermissions(value.PermissionsChanged.old_permissions_v2),
            newPermissions: groupPermissions(value.PermissionsChanged.new_permissions_v2),
            changedBy: principalBytesToString(value.PermissionsChanged.changed_by),
        };
    }
    if ("GroupVisibilityChanged" in value) {
        return {
            kind: "group_visibility_changed",
            public: mapOptional(value.GroupVisibilityChanged.public, identity),
            messagesVisibleToNonMembers: mapOptional(
                value.GroupVisibilityChanged.messages_visible_to_non_members,
                identity,
            ),
            changedBy: principalBytesToString(value.GroupVisibilityChanged.changed_by),
        };
    }
    if ("GroupInviteCodeChanged" in value) {
        let change: GroupInviteCodeChange = "disabled";
        if (value.GroupInviteCodeChanged.change === "Enabled") {
            change = "enabled";
        } else if (value.GroupInviteCodeChanged.change === "Reset") {
            change = "reset";
        }

        return {
            kind: "group_invite_code_changed",
            change,
            changedBy: principalBytesToString(value.GroupInviteCodeChanged.changed_by),
        };
    }
    if ("ChatFrozen" in value) {
        return {
            kind: "chat_frozen",
            frozenBy: principalBytesToString(value.ChatFrozen.frozen_by),
            reason: mapOptional(value.ChatFrozen.reason, identity),
        };
    }
    if ("ChatUnfrozen" in value) {
        return {
            kind: "chat_unfrozen",
            unfrozenBy: principalBytesToString(value.ChatUnfrozen.unfrozen_by),
        };
    }
    if ("EventsTimeToLiveUpdated" in value) {
        return {
            kind: "events_ttl_updated",
            updatedBy: principalBytesToString(value.EventsTimeToLiveUpdated.updated_by),
            newTimeToLive: mapOptional(value.EventsTimeToLiveUpdated.new_ttl, identity),
        };
    }
    if ("GroupGateUpdated" in value) {
        return {
            kind: "gate_updated",
            updatedBy: principalBytesToString(value.GroupGateUpdated.updated_by),
        };
    }
    if ("MembersAddedToDefaultChannel" in value) {
        return {
            kind: "members_added_to_default_channel",
            count: value.MembersAddedToDefaultChannel.count,
        };
    }

    if ("ExternalUrlUpdated" in value) {
        return {
            kind: "external_url_updated",
            newUrl: mapOptional(value.ExternalUrlUpdated.new_url, identity),
            updatedBy: principalBytesToString(value.ExternalUrlUpdated.updated_by),
        };
    }

    if ("BotAdded" in value) {
        return {
            kind: "bot_added",
            userId: principalBytesToString(value.BotAdded.user_id),
            addedBy: principalBytesToString(value.BotAdded.added_by),
        };
    }

    if ("BotRemoved" in value) {
        return {
            kind: "bot_removed",
            userId: principalBytesToString(value.BotRemoved.user_id),
            removedBy: principalBytesToString(value.BotRemoved.removed_by),
        };
    }

    if ("BotUpdated" in value) {
        return {
            kind: "bot_updated",
            userId: principalBytesToString(value.BotUpdated.user_id),
            updatedBy: principalBytesToString(value.BotUpdated.updated_by),
        };
    }

    throw new UnsupportedValueError("Unexpected ApiEventWrapper type received", value);
}

export function message(value: TMessage): Message {
    const sender = principalBytesToString(value.sender);
    const content = messageContent(value.content, sender);
    return {
        kind: "message",
        content,
        sender,
        repliesTo: mapOptional(value.replies_to, replyContext),
        messageId: value.message_id,
        messageIndex: value.message_index,
        reactions: reactions(value.reactions),
        tips: tips(value.tips),
        edited: value.edited,
        forwarded: value.forwarded,
        deleted: content.kind === "deleted_content",
        thread: mapOptional(value.thread_summary, threadSummary),
        blockLevelMarkdown: value.block_level_markdown,
        botContext: mapOptional(value.bot_context, botMessageContext),
    };
}

export function botMessageContext(value: TBotMessageContext): BotMessageContext {
    return {
        initiator: principalBytesToString(value.initiator),
        finalised: value.finalised,
        command: {
            name: value.command.name,
            args: value.command.args.map(botCommandArg),
        },
    };
}

export function botCommandArg(api: BotCommandArg): SlashCommandParamInstance {
    const { name, value } = api;
    if ("Boolean" in value) {
        return {
            kind: "boolean",
            name,
            value: value.Boolean,
        };
    } else if ("Number" in value) {
        return {
            kind: "number",
            name,
            value: value.Number,
        };
    } else if ("String" in value) {
        return {
            kind: "string",
            name,
            value: value.String,
        };
    } else if ("User" in value) {
        return {
            kind: "user",
            name,
            userId: principalBytesToString(value.User),
        };
    }
    throw new Error(`Unexpected ApiBotCommandArg type received, ${api}`);
}

export function tips(value: [Uint8Array, [Uint8Array, bigint][]][]): TipsReceived {
    return value.reduce((agg, [ledger, tips]) => {
        agg[principalBytesToString(ledger)] = tips.reduce(
            (userTips, [userId, amount]) => {
                userTips[principalBytesToString(userId)] = amount;
                return userTips;
            },
            {} as Record<string, bigint>,
        );
        return agg;
    }, {} as TipsReceived);
}

export function threadSummary(value: TThreadSummary): ThreadSummary {
    return {
        participantIds: new Set(value.participant_ids.map(principalBytesToString)),
        followedByMe: value.followed_by_me,
        numberOfReplies: Number(value.reply_count),
        latestEventIndex: Number(value.latest_event_index),
        latestEventTimestamp: value.latest_event_timestamp,
    };
}

// export function updatedMessage(value: TUpdatedMessage): StaleMessage {
//     return {
//         updatedBy: principalBytesToString(value.updated_by),
//         messageId: value.message_id,
//         eventIndex: value.event_index,
//     };
// }

export function messageContent(value: TMessageContent, sender: string): MessageContent {
    if ("File" in value) {
        return fileContent(value.File);
    }
    if ("Text" in value) {
        return textContent(value.Text);
    }
    if ("Image" in value) {
        return imageContent(value.Image);
    }
    if ("Video" in value) {
        return videoContent(value.Video);
    }
    if ("Audio" in value) {
        return audioContent(value.Audio);
    }
    if ("Deleted" in value) {
        return deletedContent(value.Deleted);
    }
    if ("Crypto" in value) {
        return cryptoContent(value.Crypto, sender);
    }
    if ("Poll" in value) {
        return pollContent(value.Poll);
    }
    if ("Giphy" in value) {
        return giphyContent(value.Giphy);
    }
    if ("GovernanceProposal" in value) {
        return proposalContent(value.GovernanceProposal);
    }
    if ("Prize" in value) {
        return prizeContent(value.Prize);
    }
    if ("PrizeWinner" in value) {
        return prizeWinnerContent(sender, value.PrizeWinner);
    }
    if ("MessageReminderCreated" in value) {
        return messageReminderCreated(value.MessageReminderCreated);
    }
    if ("MessageReminder" in value) {
        return messageReminder(value.MessageReminder);
    }
    if ("Custom" in value) {
        return customContent(value.Custom);
    }
    if ("ReportedMessage" in value) {
        return reportedMessage(value.ReportedMessage);
    }
    if ("P2PSwap" in value) {
        return p2pSwapContent(value.P2PSwap);
    }
    if ("VideoCall" in value) {
        return videoCallContent(value.VideoCall);
    }
    throw new UnsupportedValueError("Unexpected ApiMessageContent type received", value);
}

function reportedMessage(value: TReportedMessage): ReportedMessageContent {
    return {
        kind: "reported_message_content",
        total: value.count,
        reports: value.reports.map((r) => ({
            notes: r.notes,
            reasonCode: r.reason_code,
            timestamp: Number(r.timestamp),
            reportedBy: principalBytesToString(r.reported_by),
        })),
    };
}

function customContent(value: TCustomContent): MessageContent {
    if (value.kind === "meme_fighter") {
        const decoder = new TextDecoder();
        const json = decoder.decode(value.data);
        const decoded = JSON.parse(json) as { url: string; width: number; height: number };
        return {
            kind: "meme_fighter_content",
            ...decoded,
        };
    }
    if (value.kind === "user_referral_card") {
        return {
            kind: "user_referral_card",
        };
    }

    throw new Error(`Unknown custom content kind received: ${value.kind}`);
}

function messageReminderCreated(
    value: TMessageReminderCreatedContent,
): MessageReminderCreatedContent {
    return {
        kind: "message_reminder_created_content",
        notes: value.notes,
        remindAt: Number(value.remind_at),
        reminderId: value.reminder_id,
        hidden: value.hidden,
    };
}

function messageReminder(value: TMessageReminderContent): MessageReminderContent {
    return {
        kind: "message_reminder_content",
        notes: value.notes,
        reminderId: value.reminder_id,
    };
}

function prizeWinnerContent(senderId: string, value: TPrizeWinnerContent): PrizeWinnerContent {
    return {
        kind: "prize_winner_content",
        transaction: completedCryptoTransfer(
            value.transaction,
            senderId,
            principalBytesToString(value.winner),
        ),
        prizeMessageIndex: value.prize_message,
    };
}

function prizeContent(value: TPrizeContent): PrizeContent {
    return {
        kind: "prize_content",
        prizesRemaining: value.prizes_remaining,
        prizesPending: value.prizes_pending,
        diamondOnly: value.diamond_only,
        lifetimeDiamondOnly: value.lifetime_diamond_only,
        uniquePersonOnly: value.unique_person_only,
        streakOnly: value.streak_only,
        winners: value.winners.map(principalBytesToString),
        token: token(value.token),
        endDate: value.end_date,
        caption: value.caption,
    };
}

function videoCallContent(value: TVideoCallContent): VideoCallContent {
    return {
        kind: "video_call_content",
        ended: value.ended,
        participants: value.participants.map(videoCallParticipant),
        callType: videoCallType(value.call_type),
    };
}

function videoCallParticipant(value: TCallParticipant): VideoCallParticipant {
    return {
        userId: principalBytesToString(value.user_id),
        joined: value.joined,
    };
}

function videoCallType(value: TVideoCallType): VideoCallType {
    if (value === "Default") {
        return "default";
    }
    if (value === "Broadcast") {
        return "broadcast";
    }
    throw new UnsupportedValueError("Unexpected ApiVideoCallTypye type received", value);
}

function p2pSwapContent(value: TP2PSwapContent): P2PSwapContent {
    return {
        kind: "p2p_swap_content",
        token0: tokenInfo(value.token0),
        token1: tokenInfo(value.token1),
        token0Amount: value.token0_amount,
        token1Amount: value.token1_amount,
        caption: value.caption,
        expiresAt: value.expires_at,
        status: p2pTradeStatus(value.status),
        swapId: value.swap_id,
        token0TxnIn: value.token0_txn_in,
    };
}

function tokenInfo(value: TTokenInfo): TokenInfo {
    return {
        fee: value.fee,
        decimals: value.decimals,
        symbol: token(value.token),
        ledger: principalBytesToString(value.ledger),
    };
}

function p2pTradeStatus(value: TP2PSwapStatus): P2PSwapStatus {
    if (value === "Open") {
        return { kind: "p2p_swap_open" };
    }
    if ("Reserved" in value) {
        return {
            kind: "p2p_swap_reserved",
            reservedBy: principalBytesToString(value.Reserved.reserved_by),
        };
    }
    if ("Accepted" in value) {
        return {
            kind: "p2p_swap_accepted",
            acceptedBy: principalBytesToString(value.Accepted.accepted_by),
            token1TxnIn: value.Accepted.token1_txn_in,
        };
    }
    if ("Cancelled" in value) {
        return {
            kind: "p2p_swap_cancelled",
            token0TxnOut: value.Cancelled.token0_txn_out,
        };
    }
    if ("Expired" in value) {
        return {
            kind: "p2p_swap_expired",
            token0TxnOut: value.Expired.token0_txn_out,
        };
    }
    if ("Completed" in value) {
        const { accepted_by, token1_txn_in, token0_txn_out, token1_txn_out } = value.Completed;
        return {
            kind: "p2p_swap_completed",
            acceptedBy: principalBytesToString(accepted_by),
            token1TxnIn: token1_txn_in,
            token0TxnOut: token0_txn_out,
            token1TxnOut: token1_txn_out,
        };
    }

    throw new UnsupportedValueError("Unexpected ApiP2PSwapStatus type received", value);
}

export function apiUser(domain: User): TUser {
    return {
        user_id: principalStringToBytes(domain.userId),
        username: domain.username,
    };
}

function proposalContent(value: TProposalContent): ProposalContent {
    return {
        kind: "proposal_content",
        governanceCanisterId: principalBytesToString(value.governance_canister_id),
        proposal: proposal(value.proposal),
        myVote: value.my_vote,
    };
}

function proposal(value: TProposal): Proposal {
    if ("NNS" in value) {
        const p = value.NNS;
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
            payloadTextRendering: p.payload_text_rendering,
            minYesPercentageOfTotal: 3,
            minYesPercentageOfExercised: 50,
        };
    } else if ("SNS" in value) {
        const p = value.SNS;
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
            payloadTextRendering: p.payload_text_rendering,
            minYesPercentageOfTotal: p.minimum_yes_proportion_of_total / 100,
            minYesPercentageOfExercised: p.minimum_yes_proportion_of_exercised / 100,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiProposal type received", value);
}

function proposalDecisionStatus(value: TProposalDecisionStatus): ProposalDecisionStatus {
    if (value === "Failed") return ProposalDecisionStatus.Failed;
    if (value === "Open") return ProposalDecisionStatus.Open;
    if (value === "Rejected") return ProposalDecisionStatus.Rejected;
    if (value === "Executed") return ProposalDecisionStatus.Executed;
    if (value === "Adopted") return ProposalDecisionStatus.Adopted;
    return ProposalDecisionStatus.Unspecified;
}

function proposalRewardStatus(value: TProposalRewardStatus): ProposalRewardStatus {
    if (value === "AcceptVotes") return ProposalRewardStatus.AcceptVotes;
    if (value === "ReadyToSettle") return ProposalRewardStatus.ReadyToSettle;
    if (value === "Settled") return ProposalRewardStatus.Settled;
    return ProposalRewardStatus.Unspecified;
}

function giphyContent(value: TGiphyContent): GiphyContent {
    return {
        kind: "giphy_content",
        title: value.title,
        caption: value.caption,
        desktop: giphyImageVariant(value.desktop),
        mobile: giphyImageVariant(value.mobile),
    };
}

function giphyImageVariant(value: TGiphyImageVariant): GiphyImage {
    return {
        width: value.width,
        height: value.height,
        url: value.url,
        mimeType: value.mime_type,
    };
}

function pollContent(value: TPollContent): PollContent {
    return {
        kind: "poll_content",
        votes: pollVotes(value.votes),
        config: pollConfig(value.config),
        ended: value.ended,
    };
}

function pollConfig(value: TPollConfig): PollConfig {
    return {
        allowMultipleVotesPerUser: value.allow_multiple_votes_per_user,
        allowUserToChangeVote: value.allow_user_to_change_vote,
        text: value.text,
        showVotesBeforeEndDate: value.show_votes_before_end_date,
        endDate: value.end_date,
        anonymous: value.anonymous,
        options: value.options,
    };
}

function pollVotes(value: TPollVotes): PollVotes {
    return {
        total: totalPollVotes(value.total),
        user: value.user,
    };
}

function totalPollVotes(value: TTotalVotes): TotalPollVotes {
    if ("Anonymous" in value) {
        return {
            kind: "anonymous_poll_votes",
            votes: Object.entries(value.Anonymous).reduce(
                (agg, [idx, num]) => {
                    agg[Number(idx)] = num;
                    return agg;
                },
                {} as Record<number, number>,
            ),
        };
    }
    if ("Visible" in value) {
        return {
            kind: "visible_poll_votes",
            votes: Object.entries(value.Visible).reduce(
                (agg, [idx, userIds]) => {
                    agg[Number(idx)] = userIds.map(principalBytesToString);
                    return agg;
                },
                {} as Record<number, string[]>,
            ),
        };
    }
    if ("Hidden" in value) {
        return {
            kind: "hidden_poll_votes",
            votes: value.Hidden,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiTotalPollVotes type received", value);
}

function deletedContent(value: TDeletedBy): DeletedContent {
    return {
        kind: "deleted_content",
        deletedBy: principalBytesToString(value.deleted_by),
        timestamp: value.timestamp,
    };
}

function cryptoContent(value: TCryptoContent, sender: string): CryptocurrencyContent {
    return {
        kind: "crypto_content",
        caption: mapOptional(value.caption, identity),
        transfer: cryptoTransfer(value.transfer, sender, principalBytesToString(value.recipient)),
    };
}

export function token(value: TCryptocurrency): string {
    if (value === "InternetComputer") return ICP_SYMBOL;
    if (value === "SNS1") return SNS1_SYMBOL;
    if (value === "CKBTC") return CKBTC_SYMBOL;
    if (value === "CHAT") return CHAT_SYMBOL;
    if (value === "KINIC") return KINIC_SYMBOL;
    if ("Other" in value) return value.Other;
    throw new UnsupportedValueError("Unexpected Cryptocurrency type received", value);
}

export function apiToken(token: string): TCryptocurrency {
    switch (token) {
        case ICP_SYMBOL:
            return "InternetComputer";
        case SNS1_SYMBOL:
            return "SNS1";
        case CKBTC_SYMBOL:
            return "CKBTC";
        case CHAT_SYMBOL:
            return "CHAT";
        case KINIC_SYMBOL:
            return "KINIC";
        default:
            return { Other: token };
    }
}

function cryptoTransfer(
    value: TCryptoTransaction,
    sender: string,
    recipient: string,
): CryptocurrencyTransfer {
    if ("Pending" in value) {
        return pendingCryptoTransfer(value.Pending, recipient);
    }
    if ("Completed" in value) {
        return completedCryptoTransfer(value.Completed, sender, recipient);
    }
    if ("Failed" in value) {
        return failedCryptoTransfer(value.Failed, recipient);
    }
    throw new UnsupportedValueError("Unexpected ApiCryptoTransaction type received", value);
}

function pendingCryptoTransfer(
    value: TPendingCryptoTransaction,
    recipient: string,
): PendingCryptocurrencyTransfer {
    if ("NNS" in value) {
        const trans = value.NNS;
        return {
            kind: "pending",
            ledger: principalBytesToString(trans.ledger),
            token: token(trans.token),
            recipient,
            amountE8s: trans.amount.e8s,
            feeE8s: mapOptional(trans.fee, (f) => f.e8s),
            memo: trans.memo,
            createdAtNanos: trans.created,
        };
    }
    if ("ICRC1" in value) {
        return {
            kind: "pending",
            ledger: principalBytesToString(value.ICRC1.ledger),
            token: token(value.ICRC1.token),
            recipient,
            amountE8s: value.ICRC1.amount,
            feeE8s: value.ICRC1.fee,
            memo: mapOptional(value.ICRC1.memo, bytesToBigint),
            createdAtNanos: value.ICRC1.created,
        };
    }
    if ("ICRC2" in value) {
        throw new Error("ICRC2 is not supported yet");
    }

    throw new UnsupportedValueError("Unexpected ApiPendingCryptoTransaction type received", value);
}

export function completedCryptoTransfer(
    value: TCompletedCryptoTransaction,
    sender: string,
    recipient: string,
): CompletedCryptocurrencyTransfer {
    if ("NNS" in value) {
        const trans = value.NNS;
        return {
            kind: "completed",
            ledger: principalBytesToString(trans.ledger),
            recipient,
            sender,
            amountE8s: trans.amount.e8s,
            feeE8s: trans.fee.e8s,
            memo: trans.memo,
            blockIndex: trans.block_index,
        };
    }

    const trans = "ICRC1" in value ? value.ICRC1 : value.ICRC2;
    return {
        kind: "completed",
        ledger: principalBytesToString(trans.ledger),
        recipient,
        sender,
        amountE8s: trans.amount,
        feeE8s: trans.fee,
        memo: mapOptional(trans.memo, bytesToBigint) ?? BigInt(0),
        blockIndex: trans.block_index,
    };
}

export function failedCryptoTransfer(
    value: TFailedCryptoTransaction,
    recipient: string,
): FailedCryptocurrencyTransfer {
    if ("NNS" in value) {
        const trans = value.NNS;
        return {
            kind: "failed",
            ledger: principalBytesToString(trans.ledger),
            recipient,
            amountE8s: trans.amount.e8s,
            feeE8s: trans.fee.e8s,
            memo: trans.memo,
            errorMessage: trans.error_message,
        };
    }

    const trans = "ICRC1" in value ? value.ICRC1 : value.ICRC2;
    return {
        kind: "failed",
        ledger: principalBytesToString(trans.ledger),
        recipient,
        amountE8s: trans.amount,
        feeE8s: trans.fee,
        memo: mapOptional(trans.memo, bytesToBigint) ?? BigInt(0),
        errorMessage: trans.error_message,
    };
}

function imageContent(value: TImageContent): ImageContent {
    return {
        kind: "image_content",
        height: value.height,
        mimeType: value.mime_type,
        blobReference: mapOptional(value.blob_reference, blobReference),
        thumbnailData: value.thumbnail_data,
        caption: mapOptional(value.caption, identity),
        width: value.width,
    };
}

function videoContent(value: TVideoContent): VideoContent {
    return {
        kind: "video_content",
        height: value.height,
        mimeType: value.mime_type,
        videoData: {
            blobReference: mapOptional(value.video_blob_reference, blobReference),
        },
        imageData: {
            blobReference: mapOptional(value.image_blob_reference, blobReference),
        },
        thumbnailData: value.thumbnail_data,
        caption: mapOptional(value.caption, identity),
        width: value.width,
    };
}

function audioContent(value: TAudioContent): AudioContent {
    return {
        kind: "audio_content",
        mimeType: value.mime_type,
        blobReference: mapOptional(value.blob_reference, blobReference),
        caption: mapOptional(value.caption, identity),
    };
}

function textContent(value: TTextContent): TextContent {
    return {
        kind: "text_content",
        text: value.text,
    };
}

function fileContent(value: TFileContent): FileContent {
    return {
        kind: "file_content",
        name: value.name,
        mimeType: value.mime_type,
        blobReference: mapOptional(value.blob_reference, blobReference),
        caption: mapOptional(value.caption, identity),
        fileSize: value.file_size,
    };
}

function blobReference(value: TBlobReference): BlobReference {
    return {
        blobId: value.blob_id,
        canisterId: principalBytesToString(value.canister_id),
    };
}

function replyContext(value: TReplyContext): ReplyContext {
    return {
        kind: "raw_reply_context",
        eventIndex: value.event_index,
        sourceContext: mapOptional(value.chat_if_other, replySourceContext),
    };
}

function replySourceContext([chatId, maybeThreadRoot]: [TChat, number | null]): MessageContext {
    if ("Direct" in chatId) {
        return {
            chatId: { kind: "direct_chat", userId: principalBytesToString(chatId.Direct) },
            threadRootMessageIndex: undefined,
        };
    }
    if ("Group" in chatId) {
        return {
            chatId: { kind: "group_chat", groupId: principalBytesToString(chatId.Group) },
            threadRootMessageIndex: mapOptional(maybeThreadRoot, identity),
        };
    }
    if ("Channel" in chatId) {
        const [communityId, channelId] = chatId.Channel;
        return {
            chatId: {
                kind: "channel",
                communityId: principalBytesToString(communityId),
                channelId: channelId.toString(),
            },
            threadRootMessageIndex: mapOptional(maybeThreadRoot, identity),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiMultiUserChat type received", chatId);
}

function reactions(value: [string, Uint8Array[]][]): Reaction[] {
    return value.map(([reaction, userIds]) => ({
        reaction,
        userIds: new Set(userIds.map(principalBytesToString)),
    }));
}

export function groupPermissions(value: TGroupPermissions): ChatPermissions {
    return {
        changeRoles: permissionRole(value.change_roles),
        updateGroup: permissionRole(value.update_group),
        inviteUsers: permissionRole(value.invite_users),
        addMembers: permissionRole(value.add_members),
        removeMembers: permissionRole(value.remove_members),
        deleteMessages: permissionRole(value.delete_messages),
        pinMessages: permissionRole(value.pin_messages),
        reactToMessages: permissionRole(value.react_to_messages),
        mentionAllMembers: permissionRole(value.mention_all_members),
        startVideoCall: permissionRole(value.start_video_call),
        messagePermissions: messagePermissions(value.message_permissions),
        threadPermissions: mapOptional(value.thread_permissions, messagePermissions),
    };
}

function messagePermissions(value: TMessagePermissions): MessagePermissions {
    const mf = value.custom.find((cp) => cp.subtype === "meme_fighter")?.role;
    return {
        default: permissionRole(value.default),
        text: mapOptional(value.text, permissionRole),
        image: mapOptional(value.image, permissionRole),
        video: mapOptional(value.video, permissionRole),
        audio: mapOptional(value.audio, permissionRole),
        file: mapOptional(value.file, permissionRole),
        poll: mapOptional(value.poll, permissionRole),
        crypto: mapOptional(value.crypto, permissionRole),
        giphy: mapOptional(value.giphy, permissionRole),
        prize: mapOptional(value.prize, permissionRole),
        p2pSwap: mapOptional(value.p2p_swap, permissionRole),
        memeFighter: mf !== undefined ? permissionRole(mf) : undefined,
    };
}

export function communityPermissions(value: TCommunityPermissions): CommunityPermissions {
    return {
        changeRoles: communityPermissionRole(value.change_roles),
        updateDetails: communityPermissionRole(value.update_details),
        inviteUsers: communityPermissionRole(value.invite_users),
        removeMembers: communityPermissionRole(value.remove_members),
        createPublicChannel: communityPermissionRole(value.create_public_channel),
        createPrivateChannel: communityPermissionRole(value.create_private_channel),
        manageUserGroups: communityPermissionRole(value.manage_user_groups),
    };
}

export function communityPermissionRole(
    value: TCommunityPermissionRole | TCommunityRole,
): CommunityPermissionRole {
    if (value === "Owners") return "owner";
    if (value === "Admins") return "admin";
    return "member";
}

export function apiCommunityPermissions(permissions: CommunityPermissions): TCommunityPermissions {
    return {
        create_public_channel: apiCommunityPermissionRole(permissions.createPublicChannel),
        update_details: apiCommunityPermissionRole(permissions.updateDetails),
        invite_users: apiCommunityPermissionRole(permissions.inviteUsers),
        remove_members: apiCommunityPermissionRole(permissions.removeMembers),
        change_roles: apiCommunityPermissionRole(permissions.changeRoles),
        create_private_channel: apiCommunityPermissionRole(permissions.createPrivateChannel),
        manage_user_groups: apiCommunityPermissionRole(permissions.manageUserGroups),
    };
}

export function apiCommunityPermissionRole(
    permissionRole: CommunityPermissionRole,
): TCommunityPermissionRole {
    switch (permissionRole) {
        case "owner":
            return "Owners";
        case "admin":
            return "Admins";
        case "member":
            return "Members";
    }
}

export function apiGroupPermissions(permissions: ChatPermissions): TGroupPermissions {
    return {
        change_roles: apiPermissionRole(permissions.changeRoles),
        update_group: apiPermissionRole(permissions.updateGroup),
        invite_users: apiPermissionRole(permissions.inviteUsers),
        add_members: apiPermissionRole(permissions.addMembers),
        remove_members: apiPermissionRole(permissions.removeMembers),
        delete_messages: apiPermissionRole(permissions.deleteMessages),
        pin_messages: apiPermissionRole(permissions.pinMessages),
        react_to_messages: apiPermissionRole(permissions.reactToMessages),
        mention_all_members: apiPermissionRole(permissions.mentionAllMembers),
        start_video_call: apiPermissionRole(permissions.startVideoCall),
        message_permissions: apiMessagePermissions(permissions.messagePermissions),
        thread_permissions: mapOptional(permissions.threadPermissions, apiMessagePermissions),
    };
}

function apiMessagePermissions(permissions: MessagePermissions): TMessagePermissions {
    return {
        default: apiPermissionRole(permissions.default),
        text: mapOptional(permissions.text, apiPermissionRole),
        image: mapOptional(permissions.image, apiPermissionRole),
        video: mapOptional(permissions.video, apiPermissionRole),
        audio: mapOptional(permissions.audio, apiPermissionRole),
        file: mapOptional(permissions.file, apiPermissionRole),
        poll: mapOptional(permissions.poll, apiPermissionRole),
        crypto: mapOptional(permissions.crypto, apiPermissionRole),
        giphy: mapOptional(permissions.giphy, apiPermissionRole),
        prize: mapOptional(permissions.prize, apiPermissionRole),
        p2p_swap: mapOptional(permissions.p2pSwap, apiPermissionRole),
        video_call: mapOptional("none", apiPermissionRole),
        custom:
            permissions.memeFighter !== undefined
                ? [{ subtype: "meme_fighter", role: apiPermissionRole(permissions.memeFighter) }]
                : [],
    };
}

export function apiPermissionRole(permissionRole: PermissionRole): TGroupPermissionRole {
    switch (permissionRole) {
        case "none":
            return "None";
        case "owner":
            return "Owner";
        case "admin":
            return "Admins";
        case "moderator":
            return "Moderators";
        default:
            return "Members";
    }
}

export function permissionRole(value: TGroupPermissionRole): PermissionRole {
    if (value === "None") return "none";
    if (value === "Owner") return "owner";
    if (value === "Admins") return "admin";
    if (value === "Moderators") return "moderator";
    return "member";
}

export function chatMetrics(value: TChatMetrics): Metrics {
    return {
        audioMessages: Number(value.audio_messages),
        edits: Number(value.edits),
        icpMessages: Number(value.icp_messages),
        sns1Messages: Number(value.sns1_messages),
        ckbtcMessages: Number(value.ckbtc_messages),
        giphyMessages: Number(value.giphy_messages),
        deletedMessages: Number(value.deleted_messages),
        fileMessages: Number(value.file_messages),
        pollVotes: Number(value.poll_votes),
        textMessages: Number(value.text_messages),
        imageMessages: Number(value.image_messages),
        replies: Number(value.replies),
        videoMessages: Number(value.video_messages),
        polls: Number(value.polls),
        reactions: Number(value.reactions),
        reportedMessages: Number(value.reported_messages),
    };
}

export function memberRole(value: TGroupRole | TCommunityRole): MemberRole {
    if (value === "Admin") {
        return "admin";
    }
    if (value === "Moderator") {
        return "moderator";
    }
    if (value === "Participant" || value === "Member") {
        return "member";
    }
    if (value === "Owner") {
        return "owner";
    }
    throw new UnsupportedValueError("Unexpected ApiRole type received", value);
}

export function apiMultiUserChat(chatId: ChatIdentifier): TMultiUserChat {
    switch (chatId.kind) {
        case "group_chat":
            return {
                Group: principalStringToBytes(chatId.groupId),
            };
        case "channel":
            return {
                Channel: [principalStringToBytes(chatId.communityId), bigintTo32bit(chatId.channelId)],
            };
        default:
            throw new Error("Cannot convert a DirectChatIdentifier into an ApiMultiUserChat");
    }
}

export function apiReplyContextArgs(chatId: ChatIdentifier, domain: ReplyContext): TReplyContext {
    if (
        domain.sourceContext !== undefined &&
        !chatIdentifiersEqual(chatId, domain.sourceContext.chatId)
    ) {
        return {
            chat_if_other: [
                apiMultiUserChat(domain.sourceContext.chatId),
                domain.sourceContext.threadRootMessageIndex ?? null,
            ],
            event_index: domain.eventIndex,
        };
    } else {
        return {
            chat_if_other: undefined,
            event_index: domain.eventIndex,
        };
    }
}

export function apiMessageContent(domain: MessageContent): TMessageContentInitial {
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
                    data: new Uint8Array(),
                },
            };

        case "video_call_content":
        case "deleted_content":
        case "blocked_content":
        case "prize_content":
        case "prize_winner_content":
        case "placeholder_content":
        case "bot_placeholder_content":
        case "proposal_content":
        case "message_reminder_content":
        case "message_reminder_created_content":
        case "reported_message_content":
        case "p2p_swap_content":
            throw new Error(`Incorrectly attempting to send {domain.kind} content to the server`);
    }
}

function apiGiphyContent(domain: GiphyContent): TGiphyContent {
    return {
        title: domain.title,
        caption: domain.caption,
        desktop: apiGiphyImageVariant(domain.desktop),
        mobile: apiGiphyImageVariant(domain.mobile),
    };
}

function apiGiphyImageVariant(domain: GiphyImage): TGiphyImageVariant {
    return {
        height: domain.height,
        width: domain.width,
        url: domain.url,
        mime_type: domain.mimeType,
    };
}

function apiPollContent(domain: PollContent): TPollContent {
    return {
        votes: apiPollVotes(domain.votes),
        config: apiPollConfig(domain.config),
        ended: domain.ended,
    };
}

function apiPollConfig(domain: PollConfig): TPollConfig {
    return {
        allow_multiple_votes_per_user: domain.allowMultipleVotesPerUser,
        allow_user_to_change_vote: domain.allowUserToChangeVote,
        text: domain.text,
        show_votes_before_end_date: domain.showVotesBeforeEndDate,
        end_date: domain.endDate,
        anonymous: domain.anonymous,
        options: domain.options,
    };
}

function apiPollVotes(domain: PollVotes): TPollVotes {
    return {
        total: apiTotalPollVotes(domain.total),
        user: domain.user,
    };
}

function apiTotalPollVotes(domain: TotalPollVotes): TTotalVotes {
    if (domain.kind === "anonymous_poll_votes") {
        return {
            Anonymous: domain.votes,
        };
    }

    if (domain.kind === "hidden_poll_votes") {
        return {
            Hidden: domain.votes,
        };
    }

    if (domain.kind === "visible_poll_votes") {
        return {
            Visible: toRecord2(
                Object.entries(domain.votes),
                ([idx, _]) => Number(idx),
                ([_, userIds]) => userIds.map(principalStringToBytes),
            ),
        };
    }
    throw new UnsupportedValueError("Unexpected TotalPollVotes type received", domain);
}

function apiImageContent(domain: ImageContent): TImageContent {
    return {
        height: domain.height,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        thumbnail_data: domain.thumbnailData,
        caption: domain.caption,
        width: domain.width,
    };
}

function apiVideoContent(domain: VideoContent): TVideoContent {
    return {
        height: domain.height,
        mime_type: domain.mimeType,
        video_blob_reference: apiBlobReference(domain.videoData.blobReference),
        image_blob_reference: apiBlobReference(domain.imageData.blobReference),
        thumbnail_data: domain.thumbnailData,
        caption: domain.caption,
        width: domain.width,
    };
}

function apiAudioContent(domain: AudioContent): TAudioContent {
    return {
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        caption: domain.caption,
    };
}

export function apiMaybeAccessGateConfig(domain: AccessGateConfig): TAccessGateConfig | undefined {
    const gate = apiMaybeAccessGate(domain.gate);
    if (gate === undefined) {
        return undefined;
    }
    return {
        gate,
        expiry: domain.expiry,
    };
}

export function apiMaybeAccessGate(domain: AccessGate): TAccessGate | undefined {
    if (domain.kind === "composite_gate") {
        return {
            Composite: {
                inner: domain.gates.map(apiLeafAccessGate),
                and: domain.operator === "and",
            },
        };
    }
    if (domain.kind === "no_gate") return undefined;
    if (domain.kind === "nft_gate") return undefined; // TODO
    if (domain.kind === "unique_person_gate") return "UniquePerson";
    if (domain.kind === "diamond_gate") return "DiamondMember";
    if (domain.kind === "locked_gate") return "Locked";
    if (domain.kind === "credential_gate") {
        return {
            VerifiedCredential: {
                credential_name: domain.credential.credentialName,
                issuer_canister_id: principalStringToBytes(domain.credential.issuerCanisterId),
                issuer_origin: domain.credential.issuerOrigin,
                credential_type: domain.credential.credentialType,
                credential_arguments: apiCredentialArguments(domain.credential.credentialArguments),
            },
        };
    }
    if (domain.kind === "neuron_gate") {
        return {
            SnsNeuron: {
                governance_canister_id: principalStringToBytes(domain.governanceCanister),
                min_dissolve_delay: mapOptional(domain.minDissolveDelay, BigInt),
                min_stake_e8s: mapOptional(domain.minStakeE8s, BigInt),
            },
        };
    }
    if (domain.kind === "payment_gate") {
        return {
            Payment: {
                ledger_canister_id: principalStringToBytes(domain.ledgerCanister),
                amount: domain.amount,
                fee: domain.fee,
            },
        };
    }
    if (domain.kind === "token_balance_gate") {
        return {
            TokenBalance: {
                ledger_canister_id: principalStringToBytes(domain.ledgerCanister),
                min_balance: domain.minBalance,
            },
        };
    }
    return undefined;
}

export function apiAccessGateConfig(domain: AccessGateConfig): TAccessGateConfig {
    return {
        gate: apiAccessGate(domain.gate),
        expiry: domain.expiry,
    };
}

export function apiAccessGate(domain: AccessGate): TAccessGate {
    if (domain.kind === "composite_gate") {
        return {
            Composite: {
                and: domain.operator === "and",
                inner: domain.gates.map(apiLeafAccessGate),
            },
        };
    }
    return apiLeafAccessGate(domain);
}

function apiLeafAccessGate(domain: AccessGate): TAccessGateNonComposite {
    if (domain.kind === "locked_gate") return "Locked";
    if (domain.kind === "diamond_gate") return "DiamondMember";
    if (domain.kind === "lifetime_diamond_gate") return "LifetimeDiamondMember";
    if (domain.kind === "unique_person_gate") return "UniquePerson";
    if (domain.kind === "credential_gate")
        return {
            VerifiedCredential: {
                credential_name: domain.credential.credentialName,
                issuer_canister_id: principalStringToBytes(domain.credential.issuerCanisterId),
                issuer_origin: domain.credential.issuerOrigin,
                credential_type: domain.credential.credentialType,
                credential_arguments: apiCredentialArguments(domain.credential.credentialArguments),
            },
        };
    if (domain.kind === "neuron_gate") {
        return {
            SnsNeuron: {
                governance_canister_id: principalStringToBytes(domain.governanceCanister),
                min_dissolve_delay: mapOptional(domain.minDissolveDelay, BigInt),
                min_stake_e8s: mapOptional(domain.minStakeE8s, BigInt),
            },
        };
    }
    if (domain.kind === "payment_gate") {
        return {
            Payment: {
                ledger_canister_id: principalStringToBytes(domain.ledgerCanister),
                amount: domain.amount,
                fee: domain.fee,
            },
        };
    }
    if (domain.kind === "token_balance_gate") {
        return {
            TokenBalance: {
                ledger_canister_id: principalStringToBytes(domain.ledgerCanister),
                min_balance: domain.minBalance,
            },
        };
    }

    throw new Error(`Received a domain level group gate that we cannot parse: ${domain}`);
}

export function credentialArguments(
    value: [string, { String: string } | { Int: number }][],
): Record<string, string | number> {
    return toRecord2(
        value,
        ([k, _]) => k,
        ([_, v]) => {
            if ("String" in v) {
                return v.String;
            } else {
                return v.Int;
            }
        },
    );
}

function apiCredentialArguments(
    domain?: Record<string, string | number>,
): Record<string, { String: string } | { Int: number }> {
    return toRecord2(
        Object.entries(domain ?? {}),
        ([k, _]) => k,
        ([_, v]) => {
            if (typeof v === "number") {
                return { Int: v };
            } else {
                return { String: v };
            }
        },
    );
}

export function accessGateConfig(value: TAccessGateConfig): AccessGateConfig {
    return {
        gate: accessGate(value.gate),
        expiry: value.expiry,
    };
}

export function accessGate(value: TAccessGate): AccessGate {
    if (value === "DiamondMember") {
        return {
            kind: "diamond_gate",
        };
    }
    if (value === "LifetimeDiamondMember") {
        return {
            kind: "lifetime_diamond_gate",
        };
    }
    if (value === "UniquePerson") {
        return {
            kind: "unique_person_gate",
        };
    }
    if (value === "Locked") {
        return {
            kind: "locked_gate",
        };
    }
    if (value === "ReferredByMember") {
        return {
            kind: "referred_by_member_gate",
        };
    }
    if ("Composite" in value) {
        return {
            kind: "composite_gate",
            operator: value.Composite.and ? "and" : "or",
            gates: value.Composite.inner.map(accessGate) as LeafGate[],
        };
    }
    if ("SnsNeuron" in value) {
        return {
            kind: "neuron_gate",
            minDissolveDelay: mapOptional(value.SnsNeuron.min_dissolve_delay, Number),
            minStakeE8s: mapOptional(value.SnsNeuron.min_stake_e8s, Number),
            governanceCanister: principalBytesToString(value.SnsNeuron.governance_canister_id),
        };
    }
    if ("VerifiedCredential" in value) {
        const credentialArgs = Object.entries(value.VerifiedCredential.credential_arguments);
        return {
            kind: "credential_gate",
            credential: {
                issuerCanisterId: principalBytesToString(
                    value.VerifiedCredential.issuer_canister_id,
                ),
                issuerOrigin: value.VerifiedCredential.issuer_origin,
                credentialType: value.VerifiedCredential.credential_type,
                credentialName: value.VerifiedCredential.credential_name,
                credentialArguments:
                    credentialArgs.length === 0 ? undefined : credentialArguments(credentialArgs),
            },
        };
    }
    if ("Payment" in value) {
        return {
            kind: "payment_gate",
            ledgerCanister: principalBytesToString(value.Payment.ledger_canister_id),
            amount: value.Payment.amount,
            fee: value.Payment.fee,
        };
    }
    if ("TokenBalance" in value) {
        return {
            kind: "token_balance_gate",
            ledgerCanister: principalBytesToString(value.TokenBalance.ledger_canister_id),
            minBalance: value.TokenBalance.min_balance,
        };
    }

    throw new UnsupportedValueError("Unexpected ApiGroupGate type received", value);
}

function apiBlobReference(domain?: BlobReference): TBlobReference | undefined {
    return mapOptional(domain, (b) => ({
        blob_id: b.blobId,
        canister_id: principalStringToBytes(b.canisterId),
    }));
}

export function apiPrizeContentInitial(domain: PrizeContentInitial): TPrizeContentInitial {
    return {
        caption: domain.caption,
        transfer: apiPendingCryptoTransaction(domain.transfer),
        end_date: domain.endDate,
        diamond_only: domain.diamondOnly,
        lifetime_diamond_only: domain.lifetimeDiamondOnly,
        unique_person_only: domain.uniquePersonOnly,
        streak_only: domain.streakOnly,
        prizes_v2: domain.prizes,
    };
}

export function apiP2PSwapContentInitial(domain: P2PSwapContentInitial): TP2PSwapContentInitial {
    return {
        token0: apiTokenInfo(domain.token0),
        token1: apiTokenInfo(domain.token1),
        token0_amount: domain.token0Amount,
        token1_amount: domain.token1Amount,
        caption: domain.caption,
        expires_in: domain.expiresIn,
    };
}

function apiTokenInfo(domain: TokenInfo): TTokenInfo {
    return {
        fee: domain.fee,
        decimals: domain.decimals,
        token: apiToken(domain.symbol),
        ledger: principalStringToBytes(domain.ledger),
    };
}

export function apiPendingCryptoContent(domain: CryptocurrencyContent): TCryptoContent {
    return {
        recipient: principalStringToBytes(domain.transfer.recipient),
        caption: domain.caption,
        transfer: apiPendingCryptoTransaction(domain.transfer),
    };
}

export function apiPendingCryptoTransaction(domain: CryptocurrencyTransfer): TCryptoTransaction {
    if (domain.kind === "pending") {
        if (domain.token === "ICP") {
            return {
                Pending: {
                    NNS: {
                        ledger: principalStringToBytes(domain.ledger),
                        token: apiToken(domain.token),
                        to: {
                            User: principalStringToBytes(domain.recipient),
                        },
                        amount: apiICP(domain.amountE8s),
                        fee: undefined,
                        memo: domain.memo,
                        created: domain.createdAtNanos,
                    },
                },
            };
        } else {
            return {
                Pending: {
                    ICRC1: {
                        ledger: principalStringToBytes(domain.ledger),
                        token: apiToken(domain.token),
                        to: principalToIcrcAccount(domain.recipient),
                        amount: domain.amountE8s,
                        fee: domain.feeE8s ?? BigInt(0),
                        memo: mapOptional(domain.memo, bigintToBytes),
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
    pin: string | undefined,
): UserWithdrawCryptoArgs {
    if (domain.token === ICP_SYMBOL && isAccountIdentifierValid(domain.to)) {
        return {
            withdrawal: {
                NNS: {
                    ledger: principalStringToBytes(domain.ledger),
                    token: apiToken(domain.token),
                    to: {
                        Account: [...hexStringToBytes(domain.to)] as [
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                            number,
                        ],
                    },
                    amount: apiICP(domain.amountE8s),
                    fee: undefined,
                    memo: domain.memo,
                    created: domain.createdAtNanos,
                },
            },
            pin,
        };
    } else {
        return {
            withdrawal: {
                ICRC1: {
                    ledger: principalStringToBytes(domain.ledger),
                    token: apiToken(domain.token),
                    to: principalToIcrcAccount(domain.to),
                    amount: domain.amountE8s,
                    fee: domain.feeE8s ?? BigInt(0),
                    memo: mapOptional(domain.memo, bigintToBytes),
                    created: domain.createdAtNanos,
                },
            },
            pin,
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

function apiTextContent(domain: TextContent): TTextContent {
    return {
        text: domain.text,
    };
}

function apiFileContent(domain: FileContent): TFileContent {
    return {
        name: domain.name,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        caption: domain.caption,
        file_size: domain.fileSize,
    };
}

function apiICP(amountE8s: bigint): TTokens {
    return {
        e8s: amountE8s,
    };
}

export function groupChatSummary(value: TGroupCanisterGroupChatSummary): GroupChatSummary {
    const groupId = principalBytesToString(value.chat_id);
    const latestMessage = mapOptional(value.latest_message, messageEvent);
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        latestMessage,
        name: value.name,
        description: value.description,
        public: value.is_public,
        historyVisible: value.history_visible_to_new_joiners,
        minVisibleEventIndex: value.min_visible_event_index,
        minVisibleMessageIndex: value.min_visible_message_index,
        latestEventIndex: value.latest_event_index,
        latestMessageIndex: value.latest_message_index,
        lastUpdated: value.last_updated,
        blobReference: mapOptional(value.avatar_id, (blobId) => ({
            blobId,
            canisterId: groupId,
        })),
        memberCount: value.participant_count,
        permissions: groupPermissions(value.permissions_v2),
        metrics: chatMetrics(value.metrics),
        subtype: mapOptional(value.subtype, groupSubtype),
        previewed: false,
        frozen: value.frozen !== undefined,
        dateLastPinned: value.date_last_pinned,
        dateReadPinned: undefined,
        gateConfig: mapOptional(value.gate_config, accessGateConfig) ?? {
            gate: { kind: "no_gate" },
            expiry: undefined,
        },
        level: "group",
        eventsTTL: value.events_ttl,
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        membership: {
            joined: value.joined,
            role: memberRole(value.role),
            mentions: [],
            latestThreads: [],
            myMetrics: chatMetrics(value.my_metrics),
            notificationsMuted: value.notifications_muted,
            readByMeUpTo: latestMessage?.event.messageIndex,
            archived: false,
            rulesAccepted: value.rules_accepted,
            lapsed: value.membership?.lapsed ?? false,
        },
        localUserIndex: principalBytesToString(value.local_user_index_canister_id),
        isInvited: false, // this is only applicable when we are not a member
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
    };
}

export function communitySummary(value: TCommunityCanisterCommunitySummary): CommunitySummary {
    const communityId = principalBytesToString(value.community_id);
    const localUserIndex = principalBytesToString(value.local_user_index_canister_id);
    return {
        kind: "community",
        id: { kind: "community", communityId },
        name: value.name,
        description: value.description,
        public: value.is_public,
        historyVisible: false,
        latestEventIndex: value.latest_event_index,
        lastUpdated: value.last_updated,
        metrics: chatMetrics(value.metrics),
        avatar: {
            blobReference: mapOptional(value.avatar_id, (blobId) => ({
                blobId,
                canisterId: communityId,
            })),
        },
        banner: {
            blobReference: mapOptional(value.banner_id, (blobId) => ({
                blobId,
                canisterId: communityId,
            })),
        },
        memberCount: value.member_count,
        frozen: value.frozen !== undefined,
        gateConfig: mapOptional(value.gate_config, accessGateConfig) ?? {
            gate: { kind: "no_gate" },
            expiry: undefined,
        },
        level: "community",
        permissions: communityPermissions(value.permissions),
        membership: {
            joined: mapOptional(value.membership, (m) => m.joined) ?? BigInt(0),
            role: mapOptional(value.membership, (m) => memberRole(m.role)) ?? "none",
            archived: false,
            pinned: [],
            index: 0,
            displayName: mapOptional(value.membership, (m) => m.display_name),
            rulesAccepted: mapOptional(value.membership, (m) => m.rules_accepted) ?? false,
            lapsed: mapOptional(value.membership, (m) => m.lapsed) ?? false,
        },
        channels: value.channels.map((c) => communityChannelSummary(c, communityId)),
        primaryLanguage: value.primary_language,
        userGroups: new Map(value.user_groups.map(userGroup)),
        localUserIndex,
        isInvited: value.is_invited ?? false,
    };
}

export function userGroup(value: TUserGroupSummary): [number, UserGroupSummary] {
    return [
        value.user_group_id,
        {
            kind: "user_group",
            id: value.user_group_id,
            name: value.name,
            memberCount: value.members,
        },
    ];
}

export function communityChannelSummary(
    value: TCommunityCanisterChannelSummary,
    communityId: string,
): ChannelSummary {
    const latestMessage = mapOptional(value.latest_message, messageEvent);
    return {
        kind: "channel",
        id: { kind: "channel", communityId, channelId: value.channel_id.toString() },
        latestMessage,
        name: value.name,
        description: value.description,
        public: value.is_public,
        historyVisible: value.history_visible_to_new_joiners,
        minVisibleEventIndex: value.min_visible_event_index,
        minVisibleMessageIndex: value.min_visible_message_index,
        latestEventIndex: value.latest_event_index,
        latestMessageIndex: value.latest_message_index,
        lastUpdated: value.last_updated,
        blobReference: mapOptional(value.avatar_id, (blobId) => ({
            blobId,
            canisterId: communityId,
        })),
        memberCount: value.member_count,
        permissions: groupPermissions(value.permissions_v2),
        metrics: chatMetrics(value.metrics),
        subtype: mapOptional(value.subtype, groupSubtype),
        frozen: false, // TODO - doesn't exist
        dateLastPinned: value.date_last_pinned,
        dateReadPinned: undefined,
        gateConfig: mapOptional(value.gate_config, accessGateConfig) ?? {
            gate: { kind: "no_gate" },
            expiry: undefined,
        },
        level: "channel",
        eventsTTL: value.events_ttl,
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        videoCallInProgress: mapOptional(value.video_call_in_progress, (v) => v.message_index),
        membership: {
            joined: mapOptional(value.membership, (m) => m.joined) ?? BigInt(0),
            notificationsMuted:
                mapOptional(value.membership, (m) => m.notifications_muted) ?? false,
            role: mapOptional(value.membership, (m) => memberRole(m.role)) ?? "none",
            myMetrics:
                mapOptional(value.membership, (m) => chatMetrics(m.my_metrics)) ??
                emptyChatMetrics(),
            readByMeUpTo: latestMessage?.event.messageIndex,
            latestThreads:
                mapOptional(value.membership, (m) => m.latest_threads.map(threadSyncDetails)) ?? [],
            mentions: mapOptional(value.membership, (m) => mentions(m.mentions)) ?? [],
            archived: false,
            rulesAccepted: mapOptional(value.membership, (m) => m.rules_accepted) ?? false,
            lapsed: mapOptional(value.membership, (m) => m.lapsed) ?? false,
        },
        isInvited: value.is_invited ?? false,
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
        externalUrl: value.external_url,
    };
}

export function threadSyncDetails(value: TGroupCanisterThreadDetails): ThreadSyncDetails {
    return {
        threadRootMessageIndex: value.root_message_index,
        lastUpdated: value.last_updated,
        latestEventIndex: value.latest_event,
        latestMessageIndex: value.latest_message,
    };
}

export function updatedEvent([threadRootMessageIndex, eventIndex, timestamp]: [
    number | null,
    number,
    bigint,
]): UpdatedEvent {
    return {
        eventIndex,
        threadRootMessageIndex: mapOptional(threadRootMessageIndex, identity),
        timestamp,
    };
}

export function gateCheckFailedReason(value: TGateCheckFailedReason): GateCheckFailedReason {
    if (value === "NoUniquePersonProof") {
        return "no_unique_person_proof";
    }
    if (value === "NotLifetimeDiamondMember") {
        return "not_lifetime_diamond";
    }
    if (value === "NotDiamondMember") {
        return "not_diamond";
    }
    if (value === "NoSnsNeuronsFound") {
        return "no_sns_neuron_found";
    }
    if (value === "NoSnsNeuronsWithRequiredDissolveDelayFound") {
        return "dissolve_delay_not_met";
    }
    if (value === "NoSnsNeuronsWithRequiredStakeFound") {
        return "min_stake_not_met";
    }
    if (value === "NotReferredByMember") {
        return "not_referred_by_member";
    }
    if (value === "Locked") {
        return "locked";
    }
    if (typeof value !== "string") {
        if ("PaymentFailed" in value) {
            console.warn("PaymentFailed: ", value);
            return "payment_failed";
        }
        if ("InsufficientBalance" in value) {
            return "insufficient_balance";
        }
        if ("FailedVerifiedCredentialCheck" in value) {
            console.warn("FailedVerifiedCredentialCheck: ", value);
            return "failed_verified_credential_check";
        }
    }
    throw new UnsupportedValueError("Unexpected ApiGateCheckFailedReason type received", value);
}

export function addRemoveReactionResponse(
    value:
        | UserAddReactionResponse
        | UserRemoveReactionResponse
        | GroupAddReactionResponse
        | GroupRemoveReactionResponse
        | CommunityAddReactionResponse
        | CommunityRemoveReactionResponse,
): AddRemoveReactionResponse {
    if (
        value === "Success" ||
        value === "NoChange" ||
        (typeof value === "object" && "SuccessV2" in value)
    ) {
        return CommonResponses.success();
    } else {
        console.warn("AddRemoveReaction failed with: ", value);
        return CommonResponses.failure();
    }
}

export function groupSubtype(subtype: TGroupSubtype): GroupSubtype {
    return {
        kind: "governance_proposals",
        isNns: subtype.GovernanceProposals.is_nns,
        governanceCanisterId: principalBytesToString(
            subtype.GovernanceProposals.governance_canister_id,
        ),
    };
}

export function messagesSuccessResponse(value: TMessagesResponse): EventsSuccessResult<Message> {
    return {
        events: value.messages.map(messageEvent),
        expiredEventRanges: [],
        expiredMessageRanges: [],
        latestEventIndex: value.latest_event_index,
    };
}

export function messageEvent(value: TEventWrapperMessage): EventWrapper<Message> {
    return {
        event: message(value.event),
        index: value.index,
        timestamp: value.timestamp,
        expiresAt: mapOptional(value.expires_at, Number),
    };
}

export function mention(value: TMention): Mention {
    return {
        messageId: value.message_id,
        messageIndex: value.message_index,
        eventIndex: value.event_index,
    };
}

export function mentions(value: TMention[]): Mention[] {
    return value.filter((m) => m.thread_root_message_index === undefined).map(mention);
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
    value: GroupUpdateGroupResponse | CommunityUpdateChannelResponse,
): UpdateGroupResponse {
    if (typeof value === "object") {
        if ("SuccessV2" in value) {
            return {
                kind: "success",
                rulesVersion: value.SuccessV2.rules_version,
            };
        }
        if ("DescriptionTooLong" in value) {
            return { kind: "desc_too_long" };
        }
        if ("NameTooLong" in value) {
            return { kind: "name_too_long" };
        }
        if ("NameTooShort" in value) {
            return { kind: "name_too_short" };
        }
        if ("AvatarTooBig" in value) {
            return { kind: "avatar_too_big" };
        }
        if ("RulesTooLong" in value) {
            return { kind: "rules_too_long" };
        }
        if ("RulesTooShort" in value) {
            return { kind: "rules_too_short" };
        }
    }

    console.log("Failed to update group: ", value);

    if (value === "NameReserved") {
        return { kind: "name_reserved" };
    }
    if (value === "NotAuthorized") {
        return { kind: "not_authorized" };
    }
    if (value === "NameTaken") {
        return { kind: "name_taken" };
    }
    if (value === "CallerNotInGroup") {
        return { kind: "not_in_group" };
    }
    if (value === "UserSuspended") {
        return { kind: "user_suspended" };
    }
    if (value === "UserLapsed") {
        return { kind: "user_lapsed" };
    }
    if (value === "ChatFrozen") {
        return { kind: "chat_frozen" };
    }
    if (value === "AccessGateInvalid") {
        return { kind: "access_gate_invalid" };
    }
    if (
        value === "UserNotInChannel" ||
        value === "ChannelNotFound" ||
        value === "UserNotInCommunity" ||
        value === "CommunityFrozen" ||
        value === "ExternalUrlInvalid"
    ) {
        console.warn("UpdateGroupResponse failed with: ", value);
        return { kind: "failure" };
    }
    if (value === "InternalError") {
        return { kind: "internal_error" };
    }
    throw new UnsupportedValueError("Unexpected ApiUpdateGroupResponse type received", value);
}

export function createGroupResponse(
    value: UserCreateGroupResponse | CommunityCreateChannelResponse,
    id: MultiUserChatIdentifier,
): CreateGroupResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            if ("channel_id" in value.Success && id.kind === "channel") {
                const canisterId: ChannelIdentifier = {
                    kind: "channel",
                    communityId: id.communityId,
                    channelId: value.Success.channel_id.toString(),
                };
                return { kind: "success", canisterId };
            }
            if ("chat_id" in value.Success && id.kind === "group_chat") {
                const canisterId: GroupChatIdentifier = {
                    kind: "group_chat",
                    groupId: principalBytesToString(value.Success.chat_id),
                };
                return { kind: "success", canisterId };
            }
            throw new Error("Unexpected CreateGroup success response: " + value.Success);
        }
        if ("NameTooLong" in value) {
            return { kind: "name_too_long" };
        }
        if ("NameTooShort" in value) {
            return { kind: "name_too_short" };
        }
        if ("DescriptionTooLong" in value) {
            return { kind: "description_too_long" };
        }
        if ("InternalError" in value) {
            return { kind: "internal_error" };
        }
        if ("RulesTooLong" in value) {
            return { kind: "rules_too_long" };
        }
        if ("RulesTooShort" in value) {
            return { kind: "rules_too_short" };
        }
        if ("AvatarTooBig" in value) {
            return { kind: "avatar_too_big" };
        }
        if ("MaxGroupsCreated" in value || "MaxChannelsCreated" in value) {
            // todo - make sure we handle this in the UI
            return { kind: "max_groups_created" };
        }
    }

    if (value === "NameTaken") {
        return { kind: "group_name_taken" };
    }
    if (value === "NameReserved") {
        return { kind: "name_reserved" };
    }
    if (value === "Throttled") {
        return { kind: "throttled" };
    }
    if (value === "UserSuspended") {
        return { kind: "user_suspended" };
    }
    if (value === "UserLapsed") {
        return { kind: "user_lapsed" };
    }
    if (value === "UnauthorizedToCreatePublicGroup") {
        return { kind: "unauthorized_to_create_public_group" };
    }
    if (value === "NotAuthorized") {
        return CommonResponses.notAuthorized();
    }
    if (value === "CommunityFrozen") {
        return CommonResponses.communityFrozen();
    }
    if (value === "AccessGateInvalid") {
        return { kind: "access_gate_invalid" };
    }
    if (value === "ExternalUrlInvalid") {
        return { kind: "external_url_invalid" };
    }
    if (value === "InternalError") {
        return { kind: "internal_error" };
    }

    throw new UnsupportedValueError("Unexpected ApiCreateGroupResponse type received", value);
}

export function deleteGroupResponse(
    value: UserDeleteGroupResponse | CommunityDeleteChannelResponse,
): DeleteGroupResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("DeleteGroupResponse failed with: ", value);
        return "failure";
    }
}

export function pinMessageResponse(
    value: GroupPinMessageResponse | CommunityPinMessageResponse,
): PinMessageResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            eventIndex: value.Success.index,
            timestamp: value.Success.timestamp,
        };
    } else if (value === "NoChange") {
        return CommonResponses.noChange();
    } else {
        console.warn("PinMessageResponse failed with: ", value);
        return CommonResponses.failure();
    }
}

export function unpinMessageResponse(
    value: GroupUnpinMessageResponse | CommunityPinMessageResponse,
): UnpinMessageResponse {
    if (typeof value === "object") {
        if ("Success" in value || "SuccessV2" in value) {
            return "success";
        }
    }
    if (value === "NoChange") {
        return "success";
    } else {
        console.warn("UnpinMessageResponse failed with: ", value);
        return "failure";
    }
}

export function groupDetailsResponse(
    value: GroupSelectedInitialResponse | CommunitySelectedChannelInitialResponse,
): GroupChatDetailsResponse {
    if (
        value === "CallerNotInGroup" ||
        value === "PrivateCommunity" ||
        value === "PrivateChannel" ||
        value === "ChannelNotFound" ||
        "UserNotInChannel" in value ||
        "UserNotInCommunity" in value
    ) {
        console.warn("GetGroupDetails failed with ", value);
        return "failure";
    }
    if ("Success" in value) {
        const members = (
            "participants" in value.Success ? value.Success.participants : value.Success.members
        ).map(member);

        const basicMembers = "basic_members" in value.Success ? value.Success.basic_members : [];
        const membersSet = new Set<string>();
        members.forEach((m) => membersSet.add(m.userId));
        for (const id of basicMembers) {
            const userId = principalBytesToString(id);
            if (membersSet.add(userId)) {
                members.push({
                    role: "member",
                    userId,
                    displayName: undefined,
                    lapsed: false,
                });
            }
        }
        const bots = "bots" in value.Success ? value.Success.bots : [];
        return {
            members,
            blockedUsers: new Set(value.Success.blocked_users.map(principalBytesToString)),
            invitedUsers: new Set(value.Success.invited_users.map(principalBytesToString)),
            pinnedMessages: new Set(value.Success.pinned_messages),
            rules: value.Success.chat_rules,
            timestamp: value.Success.timestamp,
            bots: bots.map(botGroupDetails),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", value);
}

export function groupDetailsUpdatesResponse(
    value: GroupSelectedUpdatesResponse | CommunitySelectedChannelUpdatesResponse,
): GroupChatDetailsUpdatesResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                membersAddedOrUpdated: value.Success.members_added_or_updated.map(member),
                membersRemoved: new Set(value.Success.members_removed.map(principalBytesToString)),
                blockedUsersAdded: new Set(
                    value.Success.blocked_users_added.map(principalBytesToString),
                ),
                blockedUsersRemoved: new Set(
                    value.Success.blocked_users_removed.map(principalBytesToString),
                ),
                pinnedMessagesAdded: new Set(value.Success.pinned_messages_added),
                pinnedMessagesRemoved: new Set(value.Success.pinned_messages_removed),
                rules: value.Success.chat_rules,
                invitedUsers: mapOptional(
                    value.Success.invited_users,
                    (invited_users) => new Set(invited_users.map(principalBytesToString)),
                ),
                timestamp: value.Success.timestamp,
                botsAddedOrUpdated: value.Success.bots_added_or_updated.map(botGroupDetails),
                botsRemoved: new Set(value.Success.bots_removed.map(principalBytesToString)),
            };
        } else if ("SuccessNoUpdates" in value) {
            return {
                kind: "success_no_updates",
                timestamp: value.SuccessNoUpdates,
            };
        }
    }
    console.warn("Unexpected ApiSelectedUpdatesResponse type received", value);
    return CommonResponses.failure();
}

export function member(value: TGroupMember): Member {
    return {
        role: memberRole(value.role),
        userId: principalBytesToString(value.user_id),
        displayName: undefined,
        lapsed: value.lapsed,
    };
}

export function editMessageResponse(
    value: UserEditMessageResponse | GroupEditMessageResponse | CommunityEditMessageResponse,
): EditMessageResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("EditMessageResponse failed with: ", value);
        return "failure";
    }
}

export function declineInvitationResponse(
    value: GroupDeclineInvitiationResponse | CommunityDeclineInvitationResponse,
): DeclineInvitationResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("DeclineInvitationResponse failed with: ", value);
        return "failure";
    }
}

export function leaveGroupResponse(
    value: UserLeaveGroupResponse | CommunityLeaveChannelResponse,
): LeaveGroupResponse {
    if (
        value === "Success" ||
        value === "GroupNotFound" ||
        value === "CallerNotInGroup" ||
        value === "UserNotInChannel" ||
        value === "ChannelNotFound"
    ) {
        return "success";
    }
    if (value === "LastOwnerCannotLeave") {
        return "owner_cannot_leave";
    }
    return "failure";
}

export function deleteMessageResponse(
    value: GroupDeleteMessagesResponse | CommunityDeleteMessagesResponse,
): DeleteMessageResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("DeleteMessageResponse failed with: ", value);
        return "failure";
    }
}

export function deletedMessageResponse(
    value: GroupDeletedMessageResponse | CommunityDeletedMessageResponse,
): DeletedGroupMessageResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            content: messageContent(value.Success.content, "unknown"),
        };
    } else {
        console.warn("DeletedMessageResponse failed with: ", value);
        return CommonResponses.failure();
    }
}

export function undeleteMessageResponse(
    value: GroupUndeleteMessagesResponse | CommunityUndeleteMessagesResponse,
): UndeleteMessageResponse {
    if (typeof value === "object" && "Success" in value) {
        if (value.Success.messages.length == 0) {
            return CommonResponses.failure();
        } else {
            return {
                kind: "success",
                message: message(value.Success.messages[0]),
            };
        }
    } else {
        console.warn("UndeleteMessageResponse failed with: ", value);
        return CommonResponses.failure();
    }
}

export function threadPreviewsResponse(
    value: GroupThreadPreviewsResponse | CommunityThreadPreviewsResponse,
    chatId: ChatIdentifier,
    latestClientThreadUpdate: bigint | undefined,
): ThreadPreviewsResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "thread_previews_success",
                threads: value.Success.threads.map((t) => threadPreview(chatId, t)),
            };
        }
        if ("ReplicaNotUpToDate" in value) {
            throw ReplicaNotUpToDateError.byTimestamp(
                value.ReplicaNotUpToDate,
                latestClientThreadUpdate ?? BigInt(-1),
                false,
            );
        }
    }
    console.warn("ThreadPreviewsResponse failed with: ", value);
    return CommonResponses.failure();
}

export function threadPreview(chatId: ChatIdentifier, value: TThreadPreview): ThreadPreview {
    return {
        chatId: { ...chatId },
        latestReplies: value.latest_replies.map(messageEvent).sort((e1, e2) => e1.index - e2.index),
        totalReplies: value.total_replies,
        rootMessage: messageEvent(value.root_message),
    };
}

export function changeRoleResponse(
    value: GroupChangeRoleResponse | CommunityChangeChannelRoleResponse,
): ChangeRoleResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("ChangeRoleResponse failed with: ", value);
        return "failure";
    }
}

export function registerPollVoteResponse(
    value: GroupRegisterPollVoteResponse | CommunityRegisterPollVoteResponse,
): RegisterPollVoteResponse {
    if (typeof value === "object" && "Success" in value) {
        return "success";
    } else {
        console.warn("RegisterPollVoteResponse failed with: ", value);
        return "failure";
    }
}

export function apiChatIdentifier(chatId: ChatIdentifier): TChat {
    switch (chatId.kind) {
        case "group_chat":
            return { Group: principalStringToBytes(chatId.groupId) };
        case "direct_chat":
            return { Direct: principalStringToBytes(chatId.userId) };
        case "channel":
            return {
                Channel: [principalStringToBytes(chatId.communityId), bigintTo32bit(chatId.channelId)],
            };
    }
}

export function joinGroupResponse(value: LocalUserIndexJoinGroupResponse): JoinGroupResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return { kind: "success", group: groupChatSummary(value.Success) };
        } else if ("AlreadyInGroupV2" in value) {
            return { kind: "success", group: groupChatSummary(value.AlreadyInGroupV2) };
        } else if ("GateCheckFailed" in value) {
            return {
                kind: "gate_check_failed",
                reason: gateCheckFailedReason(value.GateCheckFailed),
            };
        }
    }
    if (value === "Blocked") {
        return CommonResponses.userBlocked();
    } else {
        console.warn("Join group failed with: ", value);
        return CommonResponses.failure();
    }
}

export function searchGroupChatResponse(
    value: GroupSearchMessagesResponse | CommunitySearchChannelResponse,
    chatId: MultiUserChatIdentifier,
): SearchGroupChatResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            matches: value.Success.matches.map((m) => messageMatch(m, chatId)),
        };
    } else {
        console.warn("SearchChat failed with ", value);
        return CommonResponses.failure();
    }
}

export function messageMatch(value: TMessageMatch, chatId: ChatIdentifier): MessageMatch {
    return {
        chatId,
        messageIndex: value.message_index,
        score: value.score,
    };
}

export function inviteCodeResponse(
    value: GroupInviteCodeResponse | CommunityInviteCodeResponse,
): InviteCodeResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                code: mapOptional(value.Success.code, codeToText),
            };
        }
    }
    if (value === "NotAuthorized") {
        return {
            kind: "not_authorized",
        };
    } else {
        console.warn("InviteCode failed with ", value);
        return CommonResponses.failure();
    }
}

export function enableOrResetInviteCodeResponse(
    value: GroupEnableInviteCodeResponse | CommunityEnableInviteCodeResponse,
): EnableInviteCodeResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                code: codeToText(value.Success.code),
            };
        } else if ("NotAuthorized" in value) {
            return {
                kind: "not_authorized",
            };
        }
    }
    console.warn("ResetInviteCode failed with ", value);
    return CommonResponses.failure();
}

export function disableInviteCodeResponse(
    value: GroupDisableInviteCodeResponse | CommunityDisableInviteCodeResponse,
): DisableInviteCodeResponse {
    if (value === "Success") {
        return "success";
    } else if (value === "NotAuthorized") {
        return "not_authorized";
    }
    console.warn("DisableInviteCode failed with ", value);
    return "failure";
}

export function registerProposalVoteResponse(
    value: GroupRegisterProposalVoteResponse | CommunityRegisterProposalVoteResponse,
): RegisterProposalVoteResponse {
    if (typeof value === "object") {
        if ("AlreadyVoted" in value) {
            return "already_voted";
        }
        if ("InternalError" in value) {
            return "internal_error";
        }
    }
    if (value === "Success") {
        return "success";
    }
    if (value === "CallerNotInGroup") {
        return "caller_not_in_group";
    }
    if (value === "UserNotInChannel") {
        return "user_not_in_channel";
    }
    if (value === "ChannelNotFound") {
        return "channel_not_found";
    }
    if (value === "UserNotInCommunity") {
        return "user_not_in_community";
    }
    if (value === "CommunityFrozen") {
        return "community_frozen";
    }
    if (value === "NoEligibleNeurons") {
        return "no_eligible_neurons";
    }
    if (value === "ProposalNotAcceptingVotes") {
        return "proposal_not_accepting_votes";
    }
    if (value === "ProposalNotFound") {
        return "proposal_not_found";
    }
    if (value === "ProposalMessageNotFound") {
        return "proposal_message_not_found";
    }
    if (value === "UserSuspended") {
        return "user_suspended";
    }
    if (value === "UserLapsed") {
        return "user_lapsed";
    }
    if (value === "ChatFrozen") {
        return "chat_frozen";
    }

    throw new UnsupportedValueError(
        "Unexpected ApiRegisterProposalVoteResponse type received",
        value,
    );
}

export function claimPrizeResponse(
    value: GroupClaimPrizeResponse | CommunityClaimPrizeResponse,
): ClaimPrizeResponse {
    if (value === "Success") {
        return CommonResponses.success();
    } else {
        console.warn("ClaimPrize failed with ", value);
        return CommonResponses.failure();
    }
}

export function statusError(
    value: TSwapStatusError,
): AcceptP2PSwapResponse & CancelP2PSwapResponse {
    if ("Reserved" in value) {
        return {
            kind: "already_reserved",
            reservedBy: principalBytesToString(value.Reserved.reserved_by),
        };
    }
    if ("Accepted" in value) {
        return {
            kind: "already_accepted",
            acceptedBy: principalBytesToString(value.Accepted.accepted_by),
            token1TxnIn: value.Accepted.token1_txn_in,
        };
    }
    if ("Completed" in value) {
        const { accepted_by, token1_txn_in, token0_txn_out, token1_txn_out } = value.Completed;
        return {
            kind: "already_completed",
            acceptedBy: principalBytesToString(accepted_by),
            token1TxnIn: token1_txn_in,
            token0TxnOut: token0_txn_out,
            token1TxnOut: token1_txn_out,
        };
    }
    if ("Cancelled" in value) {
        return {
            kind: "swap_cancelled",
            token0TxnOut: value.Cancelled.token0_txn_out,
        };
    }
    if ("Expired" in value) {
        return {
            kind: "swap_expired",
            token0TxnOut: value.Expired.token0_txn_out,
        };
    }

    throw new UnsupportedValueError("Unexpected SwapStatusError type received", value);
}

export function acceptP2PSwapResponse(
    value: UserAcceptP2pSwapResponse | GroupAcceptP2pSwapResponse | CommunityAcceptP2pSwapResponse,
): AcceptP2PSwapResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return { kind: "success", token1TxnIn: value.Success.token1_txn_in };
        }
        if ("StatusError" in value) {
            return statusError(value.StatusError);
        }
        if ("InternalError" in value) {
            return { kind: "internal_error", text: value.InternalError };
        }
        if ("PinIncorrect" in value || "TooManyFailedPinAttempts" in value) {
            return pinNumberFailureResponseV2(value);
        }
    }
    if (value === "ChatNotFound") return { kind: "chat_not_found" };
    if (value === "UserNotInGroup") return { kind: "user_not_in_group" };
    if (value === "UserNotInCommunity") return { kind: "user_not_in_community" };
    if (value === "UserNotInChannel") return { kind: "user_not_in_channel" };
    if (value === "ChannelNotFound") return { kind: "channel_not_found" };
    if (value === "SwapNotFound") return { kind: "swap_not_found" };
    if (value === "ChatFrozen") return { kind: "chat_frozen" };
    if (value === "UserSuspended") return { kind: "user_suspended" };
    if (value === "UserLapsed") return { kind: "user_lapsed" };
    if (value === "InsufficientFunds") return { kind: "insufficient_funds" };
    if (value === "PinRequired") return { kind: "pin_required" };

    throw new UnsupportedValueError("Unexpected ApiAcceptP2PSwapResponse type received", value);
}

export function cancelP2PSwapResponse(
    value: UserCancelP2pSwapResponse | GroupCancelP2pSwapResponse | CommunityCancelP2pSwapResponse,
): CancelP2PSwapResponse {
    if (value === "Success") {
        return { kind: "success" };
    }
    if (typeof value === "object" && "StatusError" in value) {
        return statusError(value.StatusError);
    }
    if (value === "ChatNotFound") return { kind: "chat_not_found" };
    if (value === "UserNotInGroup") return { kind: "user_not_in_group" };
    if (value === "UserNotInCommunity") return { kind: "user_not_in_community" };
    if (value === "UserNotInChannel") return { kind: "user_not_in_channel" };
    if (value === "ChannelNotFound") return { kind: "channel_not_found" };
    if (value === "ChatFrozen") return { kind: "chat_frozen" };
    if (value === "SwapNotFound") return { kind: "swap_not_found" };
    if (value === "UserSuspended") return { kind: "user_suspended" };

    throw new UnsupportedValueError("Unexpected ApiCancelP2PSwapResponse type received", value);
}

export function joinVideoCallResponse(
    value:
        | UserJoinVideoCallResponse
        | GroupSetVideoCallPresenceResponse
        | CommunitySetVideoCallPresenceResponse,
): JoinVideoCallResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "AlreadyEnded") {
        return "ended";
    }
    console.warn("JoinVideoCall failed with ", value);
    return "failure";
}

export function apiVideoCallPresence(domain: VideoCallPresence): TVideoCallPresence {
    switch (domain) {
        case "default":
            return "Default";
        case "hidden":
            return "Hidden";
        case "owner":
            return "Owner";
    }
}

export function setVideoCallPresence(
    value: GroupSetVideoCallPresenceResponse | CommunitySetVideoCallPresenceResponse,
): SetVideoCallPresenceResponse {
    if (typeof value === "object" && "Success" in value) return "success";
    console.warn("SetVideoCallPresence failed with: ", value);
    return "failure";
}

export function videoCallParticipantsResponse(
    value: GroupVideoCallParticipantsResponse | CommunityVideoCallParticipantsResponse,
): VideoCallParticipantsResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            participants: value.Success.participants.map(videoCallParticipant),
            hidden: value.Success.hidden.map(videoCallParticipant),
            lastUpdated: value.Success.last_updated,
        };
    }
    console.warn("VideoCallParticipants failed with: ", value);
    return CommonResponses.failure();
}

export function setPinNumberResponse(value: UserSetPinNumberResponse): SetPinNumberResponse {
    if (value === "Success") {
        return CommonResponses.success();
    }
    if (typeof value === "object") {
        if ("PinIncorrect" in value || "TooManyFailedPinAttempts" in value) {
            return pinNumberFailureResponseV2(value);
        }
        if ("TooShort" in value) {
            return { kind: "too_short", minLength: value.TooShort.min_length };
        }
        if ("TooLong" in value) {
            return { kind: "too_long", maxLength: value.TooLong.max_length };
        }

        if ("MalformedSignature" in value) {
            return { kind: "malformed_signature" };
        }
    }
    if (value === "PinRequired") {
        return { kind: "pin_required" };
    }
    if (value === "DelegationTooOld") {
        return { kind: "delegation_too_old" };
    }

    throw new UnsupportedValueError("Unexpected ApiSetPinNumberResponse type received", value);
}

export function apiDexId(dex: DexId): TExchangeId {
    switch (dex) {
        case "icpswap":
            return "ICPSwap";
        case "kongswap":
            return "KongSwap";
        case "sonic":
            return "Sonic";
    }
}

export function apiChatPermission(perm: keyof ChatPermissions): GroupPermission {
    switch (perm) {
        case "addMembers":
            return "AddMembers";
        case "changeRoles":
            return "ChangeRoles";
        case "deleteMessages":
            return "DeleteMessages";
        case "inviteUsers":
            return "InviteUsers";
        case "mentionAllMembers":
            return "MentionAllMembers";
        case "pinMessages":
            return "PinMessages";
        case "reactToMessages":
            return "ReactToMessages";
        case "removeMembers":
            return "RemoveMembers";
        case "startVideoCall":
            return "StartVideoCall";
        case "updateGroup":
            return "UpdateGroup";
        default:
            throw new Error(`Unexpected ChatPermission (${perm}) received`);
    }
}

export function apiCommunityPermission(perm: keyof CommunityPermissions): CommunityPermission {
    switch (perm) {
        case "changeRoles":
            return "ChangeRoles";
        case "createPrivateChannel":
            return "CreatePrivateChannel";
        case "createPublicChannel":
            return "CreatePublicChannel";
        case "inviteUsers":
            return "InviteUsers";
        case "manageUserGroups":
            return "ManageUserGroups";
        case "removeMembers":
            return "RemoveMembers";
        case "updateDetails":
            return "UpdateDetails";
    }
}

export function apiMessagePermission(perm: MessagePermission): ApiMessagePermission {
    switch (perm) {
        case "audio":
            return "Audio";
        case "crypto":
            return "Crypto";
        case "file":
            return "File";
        case "giphy":
            return "Giphy";
        case "image":
            return "Image";
        case "p2pSwap":
            return "P2pSwap";
        case "poll":
            return "Poll";
        case "prize":
            return "Prize";
        case "text":
            return "Text";
        case "video":
            return "Video";
        default:
            throw new Error(`Unexpect MessagePermission (${perm})`);
    }
}

export function chatPermission(perm: GroupPermission): keyof ChatPermissions {
    switch (perm) {
        case "AddMembers":
            return "addMembers";
        case "ChangeRoles":
            return "changeRoles";
        case "DeleteMessages":
            return "deleteMessages";
        case "InviteUsers":
            return "inviteUsers";
        case "MentionAllMembers":
            return "mentionAllMembers";
        case "PinMessages":
            return "pinMessages";
        case "ReactToMessages":
            return "reactToMessages";
        case "RemoveMembers":
            return "removeMembers";
        case "StartVideoCall":
            return "startVideoCall";
        case "UpdateGroup":
            return "updateGroup";
    }
}

export function communityPermission(perm: CommunityPermission): keyof CommunityPermissions {
    switch (perm) {
        case "ChangeRoles":
            return "changeRoles";
        case "CreatePrivateChannel":
            return "createPrivateChannel";
        case "CreatePublicChannel":
            return "createPublicChannel";
        case "InviteUsers":
            return "inviteUsers";
        case "ManageUserGroups":
            return "manageUserGroups";
        case "RemoveMembers":
            return "removeMembers";
        case "UpdateDetails":
            return "updateDetails";
    }
}

export function messagePermission(perm: ApiMessagePermission): MessagePermission {
    switch (perm) {
        case "Audio":
            return "audio";
        case "Crypto":
            return "crypto";
        case "File":
            return "file";
        case "Giphy":
            return "giphy";
        case "Image":
            return "image";
        case "P2pSwap":
            return "p2pSwap";
        case "Poll":
            return "poll";
        case "Prize":
            return "prize";
        case "Text":
            return "text";
        case "Video":
            return "video";
        case "VideoCall":
            return "text";
    }
}

export function slashCommandPermissions(
    value: ApiSlashCommandPermissions,
): SlashCommandPermissions {
    return {
        chatPermissions: value.chat.map(chatPermission),
        communityPermissions: value.community.map(communityPermission),
        messagePermissions: value.message.map(messagePermission),
    };
}

export function removeBotResponse(
    value: CommunityRemoveBotResponse | GroupRemoveBotResponse,
): boolean {
    if (value === "Success") {
        return true;
    }
    console.warn("Community|GroupRemoveBotResponse failed with ", value);
    return false;
}

export function addBotResponse(value: CommunityAddBotResponse | GroupAddBotResponse): boolean {
    if (value === "Success" || value === "AlreadyAdded") {
        return true;
    }
    console.warn("Community|GroupAddBotResponse failed with ", value);
    return false;
}

export function updateBotResponse(
    value: CommunityUpdateBotResponse | GroupUpdateBotResponse,
): boolean {
    if (value === "Success") {
        return true;
    }
    console.warn("Community|GroupUpdateBotResponse failed with ", value);
    return false;
}

export function botGroupDetails(value: ApiBotGroupDetails): BotGroupDetails {
    return {
        id: principalBytesToString(value.user_id),
        permissions: slashCommandPermissions(value.permissions),
    };
}

export function externalBotDefinition(value: {
    description: string;
    commands: ApiSlashCommandSchema[];
}): BotDefinition {
    return {
        kind: "bot_definition",
        description: value.description,
        commands: value.commands.map(externalBotCommand),
    };
}

export function externalBotCommand(command: ApiSlashCommandSchema): SlashCommandSchema {
    return {
        name: command.name,
        description: command.description,
        placeholder: mapOptional(command.placeholder, identity),
        params: command.params.map(externalBotParam),
        permissions: slashCommandPermissions(command.permissions),
    };
}

export function externalBotParam(param: ApiSlashCommandParam): SlashCommandParam {
    return {
        ...param,
        ...customParamFields(param.param_type),
    };
}

export function customParamFields(paramType: ApiSlashCommandParamType): SlashCommandParamType {
    if (paramType === "UserParam") {
        return {
            kind: "user",
        };
    } else if (paramType === "BooleanParam") {
        return { kind: "boolean" };
    } else if ("StringParam" in paramType) {
        return {
            kind: "string",
            minLength: paramType.StringParam.min_length,
            maxLength: paramType.StringParam.max_length,
            choices: paramType.StringParam.choices,
        };
    } else if ("NumberParam" in paramType) {
        return {
            kind: "number",
            minValue: paramType.NumberParam.min_value,
            maxValue: paramType.NumberParam.max_value,
            choices: paramType.NumberParam.choices,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiSlashCommandParamType value", paramType);
}

export function principalToIcrcAccount(principal: string): AccountICRC1 {
    return {
        owner: principalStringToBytes(principal),
        subaccount: undefined,
    };
}

export function bigintTo32bit(value: string | bigint): number {
    // Convert the number to 32bit
    return Number(BigInt(value) % BigInt(4294967296));
}