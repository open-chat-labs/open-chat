import type { Principal } from "@icp-sdk/core/principal";
import type {
    AcceptP2PSwapResponse,
    AccessGate,
    AccessGateConfig,
    AudioContent,
    BlobReference,
    BotDefinition,
    BotInstallationLocationType,
    BotMessageContext,
    ChannelIdentifier,
    ChannelSummary,
    ChatEvent,
    ChatIdentifier,
    ChatMembership,
    ChatPermissions,
    ClaimPrizeResponse,
    CommandArg,
    CommandDefinition,
    CommandParam,
    CommandParamType,
    CommunityPermissionRole,
    CommunityPermissions,
    CommunitySummary,
    CompletedCryptocurrencyTransfer,
    CreateGroupSuccess,
    CryptocurrencyContent,
    CryptocurrencyTransfer,
    DeletedContent,
    DeletedGroupMessageResponse,
    DexId,
    EnableInviteCodeSuccess,
    EventWrapper,
    EventsResponse,
    ExpiredEventsRange,
    ExpiredMessagesRange,
    ExternalBotPermissions,
    FailedCryptocurrencyTransfer,
    FileContent,
    GateCheckFailedReason,
    GiphyContent,
    GiphyImage,
    GroupChatDetailsResponse,
    GroupChatDetailsUpdatesResponse,
    GroupChatIdentifier,
    GroupChatSummary,
    GroupInviteCodeChange,
    GroupSubtype,
    ImageContent,
    InstalledBotDetails,
    InviteCodeSuccess,
    JoinGroupResponse,
    LeafGate,
    Member,
    MemberRole,
    Mention,
    Message,
    // StaleMessage,
    MessageContent,
    MessageContext,
    MessageMatch,
    MessagePermissions,
    MessageReminderContent,
    MessageReminderCreatedContent,
    Metrics,
    MultiUserChatIdentifier,
    OCError,
    P2PSwapContent,
    P2PSwapContentInitial,
    P2PSwapStatus,
    PendingCryptocurrencyTransfer,
    PendingCryptocurrencyWithdrawal,
    PermissionRole,
    PinMessageResponse,
    PollConfig,
    PollContent,
    PollVotes,
    PrizeContent,
    PrizeContentInitial,
    PrizeWinnerContent,
    Proposal,
    // User,
    ProposalContent,
    Reaction,
    ReplyContext,
    ReportedMessageContent,
    SearchGroupChatResponse,
    SendMessageResponse,
    SenderContext,
    Success,
    Tally,
    TextContent,
    ThreadPreview,
    ThreadPreviewsResponse,
    ThreadSummary,
    ThreadSyncDetails,
    TipsReceived,
    TokenInfo,
    TotalPollVotes,
    UndeleteMessageResponse,
    UpdateGroupResponse,
    UpdatedEvent,
    User,
    UserGroupSummary,
    VideoCallContent,
    VideoCallInProgress,
    VideoCallParticipant,
    VideoCallParticipantsResponse,
    VideoCallPresence,
    VideoCallType,
    VideoContent,
    WebhookDetails,
} from "openchat-shared";
import {
    CommonResponses,
    ICP_SYMBOL,
    ProposalDecisionStatus,
    ProposalRewardStatus,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    UnsupportedValueError,
    botChatPermissionList,
    botCommunityPermissionList,
    chatIdentifiersEqual,
    codeToText,
    isAccountIdentifierValid,
    messagePermissionsList,
    nullMembership,
    toBigInt32,
    toBigInt64,
} from "openchat-shared";
import type {
    AcceptSwapSuccess,
    AccountICRC1,
    BotDefinition as ApiBotDefinition,
    BotInstallationLocationType as ApiBotInstallationLocationType,
    BotCommandDefinition as ApiCommandDefinition,
    BotCommandParam as ApiCommandParam,
    BotCommandParamType as ApiCommandParamType,
    BotPermissions as ApiExternalBotPermissions,
    InstalledBotDetails as ApiInstalledBotDetails,
    WebhookDetails as ApiWebhookDetails,
    BotCommandArg,
    BotDataEncoding,
    CommunityClaimPrizeResponse,
    CommunityCreateChannelSuccessResult,
    CommunityDeletedMessageSuccessResult,
    CommunityEnableInviteCodeSuccessResult,
    CommunityInviteCodeSuccessResult,
    CommunitySearchChannelResponse,
    CommunitySelectedChannelInitialSuccessResult,
    CommunitySelectedChannelUpdatesResponse,
    CommunitySendMessageSuccessResult,
    CommunityThreadPreviewsSuccessResult,
    CommunityUndeleteMessagesSuccessResult,
    CommunityUpdateChannelSuccessResult,
    GroupClaimPrizeResponse,
    GroupDeletedMessageSuccessResult,
    GroupEnableInviteCodeSuccessResult,
    GroupInviteCodeSuccessResult,
    GroupSearchMessagesResponse,
    GroupSelectedInitialSuccessResult,
    GroupSelectedUpdatesResponse,
    GroupSendMessageSuccessResult,
    GroupThreadPreviewsSuccessResult,
    GroupUndeleteMessagesSuccessResult,
    GroupUpdateGroupSuccessResult,
    LocalUserIndexJoinGroupResponse,
    PushEventResult,
    AccessGate as TAccessGate,
    AccessGateConfig as TAccessGateConfig,
    AccessGateNonComposite as TAccessGateNonComposite,
    AudioContent as TAudioContent,
    BlobReference as TBlobReference,
    BotMessageContext as TBotMessageContext,
    CallParticipant as TCallParticipant,
    Chat as TChat,
    ChatEvent as TChatEvent,
    ChatMetrics as TChatMetrics,
    CommunityCanisterChannelSummary as TCommunityCanisterChannelSummary,
    CommunityCanisterCommunitySummary as TCommunityCanisterCommunitySummary,
    CommunityPermissionRole as TCommunityPermissionRole,
    CommunityPermissions as TCommunityPermissions,
    CommunityRole as TCommunityRole,
    CompletedCryptoTransaction as TCompletedCryptoTransaction,
    CryptoContent as TCryptoContent,
    CryptoTransaction as TCryptoTransaction,
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
    GroupCanisterGroupChatSummary as TGroupCanisterGroupChatSummary,
    GroupCanisterThreadDetails as TGroupCanisterThreadDetails,
    GroupMember as TGroupMember,
    GroupMembership as TGroupMembership,
    GroupPermissionRole as TGroupPermissionRole,
    GroupPermissions as TGroupPermissions,
    GroupRole as TGroupRole,
    GroupSubtype as TGroupSubtype,
    ImageContent as TImageContent,
    HydratedMention as TMention,
    Message as TMessage,
    MessageContent as TMessageContent,
    MessageContentInitial as TMessageContentInitial,
    MessageMatch as TMessageMatch,
    MessagePermissions as TMessagePermissions,
    MessageReminderContent as TMessageReminderContent,
    MessageReminderCreatedContent as TMessageReminderCreatedContent,
    MessagesResponse as TMessagesResponse,
    MultiUserChat as TMultiUserChat,
    OCError as TOCError,
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
    SenderContext as TSenderContext,
    Tally as TTally,
    TextContent as TTextContent,
    ThreadPreview as TThreadPreview,
    ThreadSummary as TThreadSummary,
    TokenInfo as TTokenInfo,
    Tokens as TTokens,
    TotalVotes as TTotalVotes,
    User as TUser,
    UserGroupSummary as TUserGroupSummary,
    VideoCallContent as TVideoCallContent,
    VideoCallPresence as TVideoCallPresence,
    VideoCallType as TVideoCallType,
    VideoContent as TVideoContent,
    UserCreateGroupSuccessResult,
    UserDeletedMessageSuccessResult,
    UserUndeleteMessagesSuccessResult,
    UserWithdrawCryptoArgs,
    VideoCall,
    VideoCallParticipants,
} from "../../typebox";
import { toRecord2 } from "../../utils/list";
import {
    bigintToBytes,
    bytesToBigint,
    bytesToHexString,
    consolidateBytes,
    hexStringToBytes,
    identity,
    mapOptional,
    principalBytesToString,
    principalStringToBytes,
} from "../../utils/mapping";
import type { ApiPrincipal } from "../index";
import { ensureReplicaIsUpToDate } from "./replicaUpToDateChecker";
const E8S_AS_BIGINT = BigInt(100_000_000);

export async function getEventsSuccess(
    value: TEventsResponse,
    principal: Principal,
    chatId: ChatIdentifier,
    suppressError = false,
): Promise<EventsResponse<ChatEvent>> {
    const error = await ensureReplicaIsUpToDate(
        principal,
        chatId,
        value.chat_last_updated,
        suppressError,
    );

    return (
        error ?? {
            events: value.events.map(eventWrapper),
            expiredEventRanges: value.expired_event_ranges.map(expiredEventsRange),
            expiredMessageRanges: value.expired_message_ranges.map(expiredMessagesRange),
            latestEventIndex: value.latest_event_index,
        }
    );
}

export function eventWrapper(value: TEventWrapperChatEvent): EventWrapper<ChatEvent> {
    return {
        event: event(value.event),
        index: value.index,
        timestamp: value.timestamp,
        expiresAt: mapOptional(value.expires_at, Number),
    };
}

export function sendMessageSuccess(
    value: CommunitySendMessageSuccessResult | GroupSendMessageSuccessResult,
): SendMessageResponse {
    return {
        kind: "success",
        timestamp: value.timestamp,
        messageIndex: value.message_index,
        eventIndex: value.event_index,
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
        messageId: toBigInt64(value.message_id),
        messageIndex: value.message_index,
        reactions: reactions(value.reactions),
        tips: tips(value.tips),
        edited: value.edited,
        forwarded: value.forwarded,
        deleted: content.kind === "deleted_content",
        thread: mapOptional(value.thread_summary, threadSummary),
        blockLevelMarkdown: value.block_level_markdown,
        senderContext: mapOptional(value.sender_context, senderContext),
    };
}

export function senderContext(value: TSenderContext): SenderContext {
    if (value === "Webhook") {
        return {
            kind: "webhook",
        };
    } else {
        return botMessageContext(value.Bot);
    }
}

export function botMessageContext(value: TBotMessageContext): BotMessageContext {
    return {
        kind: "bot",
        finalised: value.finalised,
        command: mapOptional(value.command, (command) => ({
            name: command.name,
            args: command.args.map(botCommandArg),
            initiator: principalBytesToString(command.initiator),
        })),
    };
}

export function botCommandArg(api: BotCommandArg): CommandArg {
    const { name, value } = api;
    if ("Boolean" in value) {
        return {
            kind: "boolean",
            name,
            value: value.Boolean,
        };
    } else if ("Integer" in value) {
        return {
            kind: "integer",
            name,
            value: value.Integer,
        };
    } else if ("Decimal" in value) {
        return {
            kind: "decimal",
            name,
            value: value.Decimal,
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
    } else if ("DateTime" in value) {
        return {
            kind: "dateTime",
            name,
            value: value.DateTime,
        };
    }
    throw new Error(`Unexpected ApiBotCommandArg type received, ${api}`);
}

export function tips(value: [ApiPrincipal, [ApiPrincipal, bigint][]][]): TipsReceived {
    return value.reduce((agg, [ledger, tips]) => {
        agg[principalBytesToString(ledger)] = tips.reduce((userTips, [userId, amount]) => {
            userTips[principalBytesToString(userId)] = amount;
            return userTips;
        }, {} as Record<string, bigint>);
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
    if ("Encrypted" in value) {
        return {
            kind: "encrypted_content",
        };
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
        const json = decoder.decode(consolidateBytes(value.data));
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
        winnerCount: value.winner_count,
        userIsWinner: value.user_is_winner,
        token: value.token_symbol,
        endDate: value.end_date,
        caption: value.caption,
        requiresCaptcha: value.requires_captcha,
        minChitEarned: value.min_chit_earned,
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
        symbol: value.symbol,
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
            tally: tally(p.tally),
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
            tally: tally(p.tally),
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

export function proposalTallies(value: [number, TTally][]): [number, Tally][] {
    return value.map(([i, t]) => [i, tally(t)]);
}

export function tally(value: TTally): Tally {
    return {
        yes: Number(value.yes / E8S_AS_BIGINT),
        no: Number(value.no / E8S_AS_BIGINT),
        total: Number(value.total / E8S_AS_BIGINT),
        timestamp: value.timestamp,
    };
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
            votes: Object.entries(value.Anonymous).reduce((agg, [idx, num]) => {
                agg[Number(idx)] = num;
                return agg;
            }, {} as Record<number, number>),
        };
    }
    if ("Visible" in value) {
        return {
            kind: "visible_poll_votes",
            votes: Object.entries(value.Visible).reduce((agg, [idx, userIds]) => {
                agg[Number(idx)] = userIds.map(principalBytesToString);
                return agg;
            }, {} as Record<number, string[]>),
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
            token: trans.token_symbol,
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
            token: value.ICRC1.token_symbol,
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
                channelId: Number(toBigInt32(channelId)),
            },
            threadRootMessageIndex: mapOptional(maybeThreadRoot, identity),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiMultiUserChat type received", chatId);
}

function reactions(value: [string, ApiPrincipal[]][]): Reaction[] {
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
    if (value === "Owners") return ROLE_OWNER;
    if (value === "Admins") return ROLE_ADMIN;
    return ROLE_MEMBER;
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
        case ROLE_OWNER:
            return "Owners";
        case ROLE_ADMIN:
            return "Admins";
        case ROLE_MEMBER:
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
        video_call: mapOptional(ROLE_NONE, apiPermissionRole),
        custom:
            permissions.memeFighter !== undefined
                ? [{ subtype: "meme_fighter", role: apiPermissionRole(permissions.memeFighter) }]
                : [],
    };
}

export function apiPermissionRole(permissionRole: PermissionRole): TGroupPermissionRole {
    switch (permissionRole) {
        case ROLE_NONE:
            return "None";
        case ROLE_OWNER:
            return "Owner";
        case ROLE_ADMIN:
            return "Admins";
        case ROLE_MODERATOR:
            return "Moderators";
        default:
            return "Members";
    }
}

export function permissionRole(value: TGroupPermissionRole): PermissionRole {
    if (value === "None") return ROLE_NONE;
    if (value === "Owner") return ROLE_OWNER;
    if (value === "Admins") return ROLE_ADMIN;
    if (value === "Moderators") return ROLE_MODERATOR;
    return ROLE_MEMBER;
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
        return ROLE_ADMIN;
    }
    if (value === "Moderator") {
        return ROLE_MODERATOR;
    }
    if (value === "Participant" || value === "Member") {
        return ROLE_MEMBER;
    }
    if (value === "Owner") {
        return ROLE_OWNER;
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
                Channel: [principalStringToBytes(chatId.communityId), toBigInt32(chatId.channelId)],
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
        case "encrypted_content":
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
    if (domain.kind === "chit_earned_gate") {
        return {
            TotalChitEarned: {
                min_chit_earned: domain.minEarned,
            },
        };
    }
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
    if (domain.kind === "chit_earned_gate") {
        return {
            TotalChitEarned: {
                min_chit_earned: domain.minEarned,
            },
        };
    }
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
    if ("TotalChitEarned" in value) {
        return {
            kind: "chit_earned_gate",
            minEarned: value.TotalChitEarned.min_chit_earned,
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
        min_chit_earned: domain.minChitEarned,
        prizes_v2: domain.prizes,
        requires_captcha: domain.requiresCaptcha,
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
        symbol: domain.symbol,
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
        return {
            Pending: {
                ICRC1: {
                    ledger: principalStringToBytes(domain.ledger),
                    token_symbol: domain.token,
                    to: principalToIcrcAccount(domain.recipient),
                    amount: domain.amountE8s,
                    fee: domain.feeE8s ?? BigInt(0),
                    memo: mapOptional(domain.memo, bigintToBytes),
                    created: domain.createdAtNanos,
                },
            },
        };
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
                    token_symbol: domain.token,
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
                    token_symbol: domain.token,
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
        membership: mapGroupMembership(value.membership, latestMessage),
        localUserIndex: principalBytesToString(value.local_user_index_canister_id),
        isInvited: false, // this is only applicable when we are not a member
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
        verified: value.verified,
    };
}

function mapGroupMembership(
    value: TGroupMembership | undefined,
    latestMessage: EventWrapper<Message> | undefined,
): ChatMembership {
    if (value === undefined) {
        return nullMembership();
    }

    return {
        joined: value.joined,
        role: memberRole(value.role),
        mentions: mentions(value.mentions),
        latestThreads: value.latest_threads.map(threadSyncDetails),
        myMetrics: chatMetrics(value.my_metrics),
        notificationsMuted: value.notifications_muted,
        atEveryoneMuted: value.at_everyone_muted,
        readByMeUpTo: latestMessage?.event.messageIndex,
        archived: false,
        rulesAccepted: value.rules_accepted,
        lapsed: value.lapsed ?? false,
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
            role: mapOptional(value.membership, (m) => memberRole(m.role)) ?? ROLE_NONE,
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
        verified: value.verified,
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
        id: { kind: "channel", communityId, channelId: Number(toBigInt32(value.channel_id)) },
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
        videoCallInProgress: mapOptional(value.video_call_in_progress, videoCallInProgress),
        membership: mapGroupMembership(value.membership, latestMessage),
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
    if (value === "ChitEarnedTooLow") {
        return "chit_earned_too_low";
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

export function groupSubtype(subtype: TGroupSubtype): GroupSubtype {
    return {
        kind: "governance_proposals",
        isNns: subtype.GovernanceProposals.is_nns,
        governanceCanisterId: principalBytesToString(
            subtype.GovernanceProposals.governance_canister_id,
        ),
    };
}

export async function getMessagesSuccess(
    value: TMessagesResponse,
    principal: Principal,
    chatId: ChatIdentifier,
    suppressError = false,
): Promise<EventsResponse<Message>> {
    const error = await ensureReplicaIsUpToDate(
        principal,
        chatId,
        value.chat_last_updated,
        suppressError,
    );

    return (
        error ?? {
            events: value.messages.map(messageEvent),
            expiredEventRanges: [],
            expiredMessageRanges: [],
            latestEventIndex: value.latest_event_index,
        }
    );
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
        messageId: toBigInt64(value.message_id),
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

export function updateGroupSuccess(
    value: GroupUpdateGroupSuccessResult | CommunityUpdateChannelSuccessResult,
): UpdateGroupResponse {
    return {
        kind: "success",
        rulesVersion: value.rules_version,
    };
}

export function createGroupSuccess(
    value: UserCreateGroupSuccessResult | CommunityCreateChannelSuccessResult,
    id: MultiUserChatIdentifier,
): CreateGroupSuccess {
    if ("channel_id" in value && id.kind === "channel") {
        const canisterId: ChannelIdentifier = {
            kind: "channel",
            communityId: id.communityId,
            channelId: Number(toBigInt32(value.channel_id)),
        };
        return { kind: "success", canisterId };
    }
    if ("chat_id" in value && id.kind === "group_chat") {
        const canisterId: GroupChatIdentifier = {
            kind: "group_chat",
            groupId: principalBytesToString(value.chat_id),
        };
        return { kind: "success", canisterId };
    }
    throw new Error("Unexpected CreateGroup success response: " + value);
}

export function pushEventSuccess(value: PushEventResult): PinMessageResponse {
    return {
        kind: "success",
        eventIndex: value.index,
        timestamp: value.timestamp,
    };
}

export function groupDetailsSuccess(
    value: GroupSelectedInitialSuccessResult | CommunitySelectedChannelInitialSuccessResult,
    blobUrlPattern: string,
    canisterId: string,
    channelId?: number,
): GroupChatDetailsResponse {
    console.log("Group details: ", value);
    const members = ("participants" in value ? value.participants : value.members).map(member);

    const basicMembers = "basic_members" in value ? value.basic_members : [];
    const membersSet = new Set<string>();
    members.forEach((m) => membersSet.add(m.userId));
    for (const id of basicMembers) {
        const userId = principalBytesToString(id);
        if (membersSet.add(userId)) {
            members.push({
                role: ROLE_MEMBER,
                userId,
                displayName: undefined,
                lapsed: false,
            });
        }
    }
    const bots = "bots" in value ? value.bots : [];
    return {
        members,
        blockedUsers: new Set(value.blocked_users.map(principalBytesToString)),
        invitedUsers: new Set(value.invited_users.map(principalBytesToString)),
        pinnedMessages: new Set(value.pinned_messages),
        rules: value.chat_rules,
        timestamp: value.timestamp,
        bots: bots.map(installedBotDetails),
        webhooks: value.webhooks.map((v) =>
            webhookDetails(v, blobUrlPattern, canisterId, channelId),
        ),
    };
}

export function groupDetailsUpdatesResponse(
    value: GroupSelectedUpdatesResponse | CommunitySelectedChannelUpdatesResponse,
    blobUrlPattern: string,
    canisterId: string,
    channelId?: number,
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
                botsAddedOrUpdated: value.Success.bots_added_or_updated.map(installedBotDetails),
                botsRemoved: new Set(value.Success.bots_removed.map(principalBytesToString)),
                webhooks: mapOptional(value.Success.webhooks, (whs) =>
                    whs.map((v) => webhookDetails(v, blobUrlPattern, canisterId, channelId)),
                ),
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

export function deletedMessageSuccess(
    value:
        | GroupDeletedMessageSuccessResult
        | CommunityDeletedMessageSuccessResult
        | UserDeletedMessageSuccessResult,
): DeletedGroupMessageResponse {
    return {
        kind: "success",
        content: messageContent(value.content, "unknown"),
    };
}

export function undeleteMessageSuccess(
    value:
        | GroupUndeleteMessagesSuccessResult
        | CommunityUndeleteMessagesSuccessResult
        | UserUndeleteMessagesSuccessResult,
): UndeleteMessageResponse {
    if (value.messages.length == 0) {
        return CommonResponses.failure();
    } else {
        return {
            kind: "success",
            message: message(value.messages[0]),
        };
    }
}

export function threadPreviewsSuccess(
    value: GroupThreadPreviewsSuccessResult | CommunityThreadPreviewsSuccessResult,
    chatId: ChatIdentifier,
): ThreadPreviewsResponse {
    return {
        kind: "thread_previews_success",
        threads: value.threads.map((t) => threadPreview(chatId, t)),
    };
}

export function threadPreview(chatId: ChatIdentifier, value: TThreadPreview): ThreadPreview {
    return {
        chatId: { ...chatId },
        latestReplies: value.latest_replies.map(messageEvent).sort((e1, e2) => e1.index - e2.index),
        totalReplies: value.total_replies,
        rootMessage: messageEvent(value.root_message),
    };
}

export function apiChatIdentifier(chatId: ChatIdentifier): TChat {
    switch (chatId.kind) {
        case "group_chat":
            return { Group: principalStringToBytes(chatId.groupId) };
        case "direct_chat":
            return { Direct: principalStringToBytes(chatId.userId) };
        case "channel":
            return {
                Channel: [principalStringToBytes(chatId.communityId), toBigInt32(chatId.channelId)],
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
        } else if ("Error" in value) {
            return ocError(value.Error);
        }
    }
    console.warn("Join group failed with: ", value);
    return CommonResponses.failure();
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

export function inviteCodeSuccess(
    value: GroupInviteCodeSuccessResult | CommunityInviteCodeSuccessResult,
): InviteCodeSuccess {
    return {
        kind: "success",
        code: mapOptional(value.code, codeToText),
    };
}

export function enableOrResetInviteCodeSuccess(
    value: GroupEnableInviteCodeSuccessResult | CommunityEnableInviteCodeSuccessResult,
): EnableInviteCodeSuccess {
    return {
        kind: "success",
        code: codeToText(value.code),
    };
}

export function claimPrizeResponse(
    value: GroupClaimPrizeResponse | CommunityClaimPrizeResponse,
): ClaimPrizeResponse {
    if (typeof value === "object") {
        if ("TransferFailed" in value || "FailedAfterTransfer" in value) {
            console.warn("ClaimPrize failed with ", value);
            return CommonResponses.failure();
        }
    }
    return unitResult(value);
}

export function acceptP2PSwapSuccess(value: AcceptSwapSuccess): AcceptP2PSwapResponse {
    return { kind: "success", token1TxnIn: value.token1_txn_in };
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

export function videoCallParticipantsSuccess(
    value: VideoCallParticipants,
): VideoCallParticipantsResponse {
    return {
        kind: "success",
        participants: value.participants.map(videoCallParticipant),
        hidden: value.hidden.map(videoCallParticipant),
        lastUpdated: value.last_updated,
    };
}

export function apiDexId(dex: DexId): TExchangeId {
    switch (dex) {
        case "icpswap":
            return "ICPSwap";
        case "kongswap":
            return "KongSwap";
        case "sonic":
            throw new Error("Unsupported dex sonic");
        // return "Sonic";
    }
}

export function externalBotPermissions(value: ApiExternalBotPermissions): ExternalBotPermissions {
    return {
        communityPermissions: permissionsFromBits(value.community ?? 0, [
            ...botCommunityPermissionList,
        ]),
        chatPermissions: permissionsFromBits(value.chat ?? 0, [...botChatPermissionList]),
        messagePermissions: permissionsFromBits(value.message ?? 0, [...messagePermissionsList]),
    };
}

export function apiExternalBotPermissions(
    value: ExternalBotPermissions,
): ApiExternalBotPermissions {
    return {
        community: permissionsToBits(value.communityPermissions, [...botCommunityPermissionList]),
        chat: permissionsToBits(value.chatPermissions, [...botChatPermissionList]),
        message: permissionsToBits(value.messagePermissions, [...messagePermissionsList]),
    };
}

function permissionsFromBits<T>(bits: number, allPermissions: T[]): T[] {
    const permissions = [];
    for (let i = 0; i < allPermissions.length; i++) {
        if ((bits & (1 << i)) !== 0) {
            permissions.push(allPermissions[i]);
        }
    }
    return permissions;
}

function permissionsToBits<T>(permissions: T[], allPermissions: T[]): number {
    let bits = 0;
    for (let i = 0; i < allPermissions.length; i++) {
        if (permissions.includes(allPermissions[i])) {
            bits += 1 << i;
        }
    }
    return bits;
}

export function installedBotDetails(value: ApiInstalledBotDetails): InstalledBotDetails {
    console.log("Installed bot details: ", value);
    return {
        id: principalBytesToString(value.user_id),
        permissions: {
            command: externalBotPermissions(value.permissions),
            autonomous: mapOptional(value.autonomous_permissions, externalBotPermissions),
        },
    };
}

export function webhookDetails(
    value: ApiWebhookDetails,
    blobUrlPattern: string,
    canisterId: string,
    channelId?: number,
): WebhookDetails {
    const webhookId = principalBytesToString(value.id);

    return {
        id: webhookId,
        name: value.name,
        avatarUrl: mapOptional(
            value.avatar_id,
            (avatarId) =>
                `${blobUrlPattern
                    .replace("{canisterId}", canisterId)
                    .replace(
                        "{blobType}",
                        channelId === undefined ? "avatar" : `channel/${channelId}/avatar`,
                    )}/${webhookId}/${avatarId}`,
        ),
    };
}

export function externalBotDefinition(value: ApiBotDefinition): BotDefinition {
    return {
        kind: "bot_definition",
        description: value.description,
        commands: value.commands.map(externalBotCommand),
        autonomousConfig: mapOptional(value.autonomous_config, (c) => ({
            permissions: externalBotPermissions(c.permissions),
        })),
        defaultSubscriptions: mapOptional(value.default_subscriptions, (s) => ({
            community: s.community,
            chat: s.chat,
        })),
        dataEncoding: mapOptional(value.data_encoding, dataEncoding),
        restrictedLocations: mapOptional(value.restricted_locations, restrictedLocations),
    };
}

export function externalBotCommand(command: ApiCommandDefinition): CommandDefinition {
    return {
        name: command.name,
        description: command.description,
        placeholder: mapOptional(command.placeholder, identity),
        params: command.params.map(externalBotParam),
        permissions: externalBotPermissions(command.permissions),
        defaultRole: mapOptional(command.default_role, memberRole) ?? ROLE_MEMBER,
        directMessages: command.direct_messages ?? false,
    };
}

export function dataEncoding(data_encoding: BotDataEncoding): "json" | "candid" {
    return data_encoding === "Candid" ? "candid" : "json";
}

export function restrictedLocations(
    locations: ApiBotInstallationLocationType[],
): BotInstallationLocationType[] {
    return locations.map((location) => {
        switch (location) {
            case "Community":
                return "community";
            case "Group":
                return "group_chat";
            case "User":
                return "direct_chat";
            default:
                throw new Error(`Unknown location type: ${location}`);
        }
    });
}

export function externalBotParam(param: ApiCommandParam): CommandParam {
    return {
        ...param,
        ...customParamFields(param.param_type),
    };
}

export function customParamFields(paramType: ApiCommandParamType): CommandParamType {
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
            multi_line: paramType.StringParam.multi_line,
        };
    } else if ("IntegerParam" in paramType) {
        return {
            kind: "integer",
            minValue: paramType.IntegerParam.min_value,
            maxValue: paramType.IntegerParam.max_value,
            choices: paramType.IntegerParam.choices.map((c) => ({
                name: c.name,
                value: c.value,
            })),
        };
    } else if ("DecimalParam" in paramType) {
        return {
            kind: "decimal",
            minValue: paramType.DecimalParam.min_value,
            maxValue: paramType.DecimalParam.max_value,
            choices: paramType.DecimalParam.choices,
        };
    } else if ("DateTimeParam" in paramType) {
        return {
            kind: "dateTime",
            future_only: paramType.DateTimeParam.future_only,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiCommandParamType value", paramType);
}

export function principalToIcrcAccount(principal: string): AccountICRC1 {
    return {
        owner: principalStringToBytes(principal),
        subaccount: undefined,
    };
}

export function unitResult(
    value: "Success" | { Success: unknown } | { SuccessV2: unknown } | { Error: TOCError },
): Success | OCError {
    if (value === "Success") return CommonResponses.success();
    return mapResult(value, CommonResponses.success);
}

export function mapResult<I, O>(
    value: { Success: I } | { SuccessV2: I } | { Error: TOCError },
    mapper: (input: I) => O,
): O | OCError {
    if (typeof value === "object") {
        if ("Success" in value) {
            return mapper(value.Success);
        }
        if ("SuccessV2" in value) {
            return mapper(value.SuccessV2);
        }
        if ("Error" in value) {
            return ocError(value.Error);
        }
    }
    console.error("Unexpected response type", value);
    return {
        kind: "error",
        code: -1,
        message: JSON.stringify(value),
    };
}

export function isSuccess(
    value: "Success" | { Success: unknown } | { SuccessV2: unknown } | { Error: TOCError },
): boolean {
    if (value === "Success") return true;
    if (typeof value !== "object") return false;
    return "Success" in value || "SuccessV2" in value;
}

export function ocError(error: TOCError): OCError {
    return {
        kind: "error",
        code: error[0],
        message: error[1] ?? undefined,
    };
}

export function videoCallInProgress(value: VideoCall): VideoCallInProgress {
    return {
        started: value.started,
        startedBy: principalBytesToString(value.started_by),
        messageIndex: value.message_index,
        messageId: value.message_id,
        callType: value.call_type === "Default" ? "default" : "broadcast",
        joinedByCurrentUser: value.joined_by_current_user,
    };
}
