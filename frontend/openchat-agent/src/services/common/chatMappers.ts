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
} from "../user/candid/idl";
import {
    type Message,
    type ThreadSummary,
    type StaleMessage,
    type MessageContent,
    type User,
    type ProposalContent,
    type Proposal,
    ProposalDecisionStatus,
    ProposalRewardStatus,
    type GiphyContent,
    type GiphyImage,
    type PollContent,
    type PollConfig,
    type PollVotes,
    type TotalPollVotes,
    type DeletedContent,
    type CryptocurrencyContent,
    type CryptocurrencyTransfer,
    type PendingCryptocurrencyTransfer,
    type CompletedCryptocurrencyTransfer,
    type FailedCryptocurrencyTransfer,
    type ImageContent,
    type VideoContent,
    type AudioContent,
    type TextContent,
    type FileContent,
    type BlobReference,
    type ReplyContext,
    type Reaction,
    type ChatPermissions,
    type PermissionRole,
    type PendingCryptocurrencyWithdrawal,
    type Metrics,
    UnsupportedValueError,
    type MemberRole,
    type GroupSubtype,
    PrizeContent,
    PrizeWinnerContent,
    AccessGate,
    OpenChatGovernanceCanisterId,
    Sns1GovernanceCanisterId,
    MessageReminderCreatedContent,
    MessageReminderContent,
    CustomContent,
    MessageContext,
    ReportedMessageContent,
    GroupChatSummary,
    GateCheckFailedReason,
    CommunityPermissionRole,
    CommunityPermissions,
    ChatIdentifier,
    chatIdentifiersEqual,
    AddRemoveReactionResponse,
    CommonResponses,
    emptyChatMetrics,
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
    AccessRules,
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
    codeToText,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    KinicGovernanceCanisterId,
    HotOrNotGovernanceCanisterId,
    ThreadSyncDetails,
    CHAT_SYMBOL,
    CKBTC_SYMBOL,
    ICP_SYMBOL,
    KINIC_SYMBOL,
    SNS1_SYMBOL,
} from "openchat-shared";
import type { WithdrawCryptoArgs } from "../user/candid/types";
import type {
    ApiGroupCanisterGroupChatSummary,
    ApiAddReactionResponse as ApiAddGroupReactionResponse,
    ApiRemoveReactionResponse as ApiRemoveGroupReactionResponse,
    ApiGroupCanisterThreadDetails,
    ApiMessageEventWrapper,
    ApiUpdateGroupResponse,
    ApiUnpinMessageResponse,
    ApiPinMessageResponse,
    ApiSelectedInitialResponse,
    ApiParticipant,
    ApiGroupRules,
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
} from "../group/candid/idl";
import type {
    ApiGateCheckFailedReason,
    ApiCommunityCanisterCommunitySummary,
    ApiJoinGroupResponse,
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
} from "../community/candid/idl";
import { ReplicaNotUpToDateError } from "../error";
import { messageMatch } from "../user/mappers";

const E8S_AS_BIGINT = BigInt(100_000_000);

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
        edited: candid.edited,
        forwarded: candid.forwarded,
        deleted: content.kind === "deleted_content",
        thread: optional(candid.thread_summary, threadSummary),
    };
}

export function threadSummary(candid: ApiThreadSummary): ThreadSummary {
    return {
        participantIds: new Set(candid.participant_ids.map((p) => p.toString())),
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

function customContent(candid: ApiCustomMessageContent): CustomContent {
    return {
        kind: "custom_content",
        subtype: candid.kind,
        data: candid.data,
    };
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
            candid.winner.toString()
        ),
        prizeMessageIndex: candid.prize_message,
    };
}

function prizeContent(candid: ApiPrizeContent): PrizeContent {
    return {
        kind: "prize_content",
        prizesRemaining: candid.prizes_remaining,
        prizesPending: candid.prizes_pending,
        winners: candid.winners.map((u) => u.toString()),
        token: token(candid.token),
        endDate: candid.end_date,
        caption: optional(candid.caption, identity),
    };
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
            votes: candid.Anonymous.reduce((agg, [idx, num]) => {
                agg[idx] = num;
                return agg;
            }, {} as Record<number, number>),
        };
    }
    if ("Visible" in candid) {
        return {
            kind: "visible_poll_votes",
            votes: candid.Visible.reduce((agg, [idx, userIds]) => {
                agg[idx] = userIds.map((p) => p.toString());
                return agg;
            }, {} as Record<number, string[]>),
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
        case ICP_SYMBOL: return { InternetComputer: null };
        case SNS1_SYMBOL: return { SNS1: null };
        case CKBTC_SYMBOL: return { CKBTC: null };
        case CHAT_SYMBOL: return { CHAT: null };
        case KINIC_SYMBOL: return { KINIC: null };
        default: return { Other: token };
    }
}

function cryptoTransfer(
    candid: ApiCryptoTransaction,
    sender: string,
    recipient: string
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
    recipient: string
): PendingCryptocurrencyTransfer {
    if ("NNS" in candid || "SNS" in candid) {
        const trans = "NNS" in candid ? candid.NNS : candid.SNS;
        return {
            kind: "pending",
            ledger: trans.ledger.toString(),
            token: token(trans.token),
            recipient,
            amountE8s: trans.amount.e8s,
            feeE8s: Array.isArray(trans.fee) ? optional(trans.fee, (f) => f.e8s) : trans.fee.e8s,
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
    recipient: string
): CompletedCryptocurrencyTransfer {
    if ("NNS" in candid || "SNS" in candid) {
        const isNns = "NNS" in candid;
        const trans = isNns ? candid.NNS : candid.SNS;
        return {
            kind: "completed",
            token: token(trans.token),
            recipient,
            sender,
            amountE8s: trans.amount.e8s,
            feeE8s: trans.fee.e8s,
            memo: Array.isArray(trans.memo)
                ? optional(trans.memo, identity) ?? BigInt(0)
                : trans.memo,
            blockIndex: trans.block_index,
            transactionHash: isNns ? bytesToHexString(trans.transaction_hash) : undefined,
        };
    }
    if ("ICRC1" in candid) {
        return {
            kind: "completed",
            token: token(candid.ICRC1.token),
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
        candid
    );
}

export function failedCryptoTransfer(
    candid: ApiFailedCryptoTransaction,
    recipient: string
): FailedCryptocurrencyTransfer {
    if ("NNS" in candid || "SNS" in candid) {
        const trans = "NNS" in candid ? candid.NNS : candid.SNS;
        return {
            kind: "failed",
            token: token(trans.token),
            recipient,
            amountE8s: trans.amount.e8s,
            feeE8s: trans.fee.e8s,
            memo: Array.isArray(trans.memo)
                ? optional(trans.memo, identity) ?? BigInt(0)
                : trans.memo,
            errorMessage: trans.error_message,
        };
    }
    if ("ICRC1" in candid) {
        return {
            kind: "failed",
            token: token(candid.ICRC1.token),
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
        createPolls: permissionRole(candid.create_polls),
        sendMessages: permissionRole(candid.send_messages),
        reactToMessages: permissionRole(candid.react_to_messages),
        replyInThread: permissionRole(candid.reply_in_thread),
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
    };
}

export function communityPermissionRole(
    candid: ApiCommunityPermissionRole | ApiCommunityRole
): CommunityPermissionRole {
    if ("Owners" in candid) return "owner";
    if ("Admins" in candid) return "admin";
    return "member";
}

export function apiCommunityPermissions(
    permissions: CommunityPermissions
): ApiCommunityPermissions {
    return {
        create_public_channel: apiCommunityPermissionRole(permissions.createPublicChannel),
        update_details: apiCommunityPermissionRole(permissions.updateDetails),
        invite_users: apiCommunityPermissionRole(permissions.inviteUsers),
        remove_members: apiCommunityPermissionRole(permissions.removeMembers),
        change_roles: apiCommunityPermissionRole(permissions.changeRoles),
        create_private_channel: apiCommunityPermissionRole(permissions.createPrivateChannel),
    };
}

export function apiCommunityPermissionRole(
    permissionRole: CommunityPermissionRole
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
        change_permissions: apiPermissionRole("owner"), // TODO remove this
        change_roles: apiPermissionRole(permissions.changeRoles),
        update_group: apiPermissionRole(permissions.updateGroup),
        invite_users: apiPermissionRole(permissions.inviteUsers),
        remove_members: apiPermissionRole(permissions.removeMembers),
        block_users: apiPermissionRole("owner"), // TODO remove this
        delete_messages: apiPermissionRole(permissions.deleteMessages),
        pin_messages: apiPermissionRole(permissions.pinMessages),
        create_polls: apiPermissionRole(permissions.createPolls),
        send_messages: apiPermissionRole(permissions.sendMessages),
        react_to_messages: apiPermissionRole(permissions.reactToMessages),
        reply_in_thread: apiPermissionRole(permissions.replyInThread),
        add_members: apiPermissionRole("owner"), // TODO remove this
    };
}

export function apiPermissionRole(permissionRole: PermissionRole): ApiPermissionRole {
    switch (permissionRole) {
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

        case "deleted_content":
            return { Deleted: apiDeletedContent(domain) };

        case "poll_content":
            return { Poll: apiPollContent(domain) };

        case "giphy_content":
            return { Giphy: apiGiphyContent(domain) };

        case "proposal_content":
            return { GovernanceProposal: apiProposalContent(domain) };

        case "prize_content":
            throw new Error("Incorrectly attempting to send prize content to the server");

        case "prize_winner_content":
            throw new Error("Incorrectly attempting to send prize winner content to the server");

        case "placeholder_content":
            throw new Error("Incorrectly attempting to send placeholder content to the server");

        case "message_reminder_content":
            throw new Error(
                "Incorrectly attempting to send message reminder content to the server"
            );

        case "message_reminder_created_content":
            throw new Error(
                "Incorrectly attempting to send message reminder created content to the server"
            );

        case "reported_message_content":
            throw new Error(
                "Incorrectly attempting to send reported message content to the server"
            );

        case "custom_content":
            return { Custom: apiCustomContent(domain) };
    }
}

function apiCustomContent(domain: CustomContent): ApiCustomMessageContent {
    return {
        kind: domain.subtype,
        data: [], // TODO - we'll come back to this a bit later
    };
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
    if (domain.kind === "nns_gate") return []; // TODO
    if (domain.kind === "diamond_gate") return [{ DiamondMember: null }];
    if (domain.kind === "openchat_gate")
        return [
            {
                SnsNeuron: {
                    governance_canister_id: Principal.fromText(OpenChatGovernanceCanisterId),
                    min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                    min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
                },
            },
        ];
    if (domain.kind === "sns1_gate")
        return [
            {
                SnsNeuron: {
                    governance_canister_id: Principal.fromText(Sns1GovernanceCanisterId),
                    min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                    min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
                },
            },
        ];
    if (domain.kind === "kinic_gate")
        return [
            {
                SnsNeuron: {
                    governance_canister_id: Principal.fromText(KinicGovernanceCanisterId),
                    min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                    min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
                },
            },
        ];
    if (domain.kind === "hotornot_gate")
        return [
            {
                SnsNeuron: {
                    governance_canister_id: Principal.fromText(HotOrNotGovernanceCanisterId),
                    min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                    min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
                },
            },
        ];
    return [];
}

export function apiAccessGate(domain: AccessGate): ApiAccessGate {
    if (domain.kind === "diamond_gate") return { DiamondMember: null };
    if (domain.kind === "openchat_gate")
        return {
            SnsNeuron: {
                governance_canister_id: Principal.fromText(OpenChatGovernanceCanisterId),
                min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
            },
        };
    if (domain.kind === "sns1_gate")
        return {
            SnsNeuron: {
                governance_canister_id: Principal.fromText(Sns1GovernanceCanisterId),
                min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
            },
        };
    if (domain.kind === "kinic_gate")
        return {
            SnsNeuron: {
                governance_canister_id: Principal.fromText(KinicGovernanceCanisterId),
                min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
            },
        };
    if (domain.kind === "hotornot_gate")
        return {
            SnsNeuron: {
                governance_canister_id: Principal.fromText(HotOrNotGovernanceCanisterId),
                min_dissolve_delay: apiOptional(BigInt, domain.minDissolveDelay),
                min_stake_e8s: apiOptional(BigInt, domain.minStakeE8s),
            },
        };
    throw new Error(`Received a domain level group gate that we cannot parse: ${domain}`);
}

export function accessGate(candid: ApiAccessGate): AccessGate {
    if ("SnsNeuron" in candid) {
        const criteria = {
            minDissolveDelay: optional(candid.SnsNeuron.min_dissolve_delay, Number),
            minStakeE8s: optional(candid.SnsNeuron.min_stake_e8s, Number),
        };
        const canisterId = candid.SnsNeuron.governance_canister_id.toString();
        if (canisterId === OpenChatGovernanceCanisterId) {
            return {
                kind: "openchat_gate",
                ...criteria,
            };
        }
        if (canisterId === Sns1GovernanceCanisterId) {
            return {
                kind: "sns1_gate",
                ...criteria,
            };
        }
        if (canisterId === KinicGovernanceCanisterId) {
            return {
                kind: "kinic_gate",
                ...criteria,
            };
        }
        if (canisterId === HotOrNotGovernanceCanisterId) {
            return {
                kind: "hotornot_gate",
                ...criteria,
            };
        }
        throw new Error(
            `An SnsNeuron gate was received with an unexpected governance canister id: ${candid.SnsNeuron.governance_canister_id}`
        );
    }
    if ("DiamondMember" in candid) {
        return {
            kind: "diamond_gate",
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
        domain
    );
}

function apiDeletedContent(domain: DeletedContent): ApiDeletedContent {
    return {
        deleted_by: Principal.fromText(domain.deletedBy),
        timestamp: domain.timestamp,
    };
}

export function apiPendingCryptoContent(domain: CryptocurrencyContent): ApiCryptoContent {
    return {
        recipient: Principal.fromText(domain.transfer.recipient),
        caption: apiOptional(identity, domain.caption),
        transfer: apiPendingCryptoTransaction(domain.transfer),
    };
}

function apiPendingCryptoTransaction(domain: CryptocurrencyTransfer): ApiCryptoTransaction {
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
    domain: PendingCryptocurrencyWithdrawal
): WithdrawCryptoArgs {
    if (domain.token === ICP_SYMBOL) {
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
    const latestMessage = optional(candid.latest_message, (ev) => ({
        index: ev.index,
        timestamp: ev.timestamp,
        event: message(ev.event),
    }));
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
        lastUpdated: candid.last_updated,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
        memberCount: candid.participant_count,
        permissions: groupPermissions(candid.permissions),
        metrics: chatMetrics(candid.metrics),
        subtype: optional(candid.subtype, apiGroupSubtype),
        previewed: false,
        frozen: candid.frozen.length > 0,
        dateLastPinned: optional(candid.date_last_pinned, identity),
        dateReadPinned: undefined,
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "group",
        membership: {
            joined: candid.joined,
            role: memberRole(candid.role),
            mentions: [],
            latestThreads: [],
            myMetrics: chatMetrics(candid.my_metrics),
            notificationsMuted: candid.notifications_muted,
            readByMeUpTo: latestMessage?.event.messageIndex,
            archived: false,
        },
        isDefault: false,
    };
}

export function communitySummary(candid: ApiCommunityCanisterCommunitySummary): CommunitySummary {
    const communityId = candid.community_id.toString();
    return {
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
        },
        channels: candid.channels.map((c) => communityChannelSummary(c, communityId)),
        primaryLanguage: candid.primary_language,
    };
}

export function communityChannelSummary(
    candid: ApiCommunityCanisterChannelSummary,
    communityId: string
): ChannelSummary {
    const latestMessage = optional(candid.latest_message, (ev) => ({
        index: ev.index,
        timestamp: ev.timestamp,
        event: message(ev.event),
    }));
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
        lastUpdated: candid.last_updated,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: communityId,
        })),
        memberCount: candid.member_count,
        permissions: groupPermissions(candid.permissions),
        metrics: chatMetrics(candid.metrics),
        subtype: optional(candid.subtype, apiGroupSubtype),
        frozen: false, // TODO - doesn't exist
        dateLastPinned: optional(candid.date_last_pinned, identity),
        dateReadPinned: undefined,
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "channel",
        membership: {
            joined: optional(candid.membership, (m) => m.joined) ?? BigInt(0),
            notificationsMuted: false,
            role: optional(candid.membership, (m) => memberRole(m.role)) ?? "none",
            myMetrics:
                optional(candid.membership, (m) => chatMetrics(m.my_metrics)) ?? emptyChatMetrics(),
            readByMeUpTo: latestMessage?.event.messageIndex,
            latestThreads:
                optional(candid.membership, (m) => m.latest_threads.map(threadSyncDetails)) ?? [],
            mentions: [],
            archived: false,
        },
        isDefault: candid.is_default,
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
    throw new UnsupportedValueError("Unexpected ApiGateCheckFailedReason type received", candid);
}

export function addRemoveReactionResponse(
    candid:
        | ApiAddDirectReactionResponse
        | ApiRemoveDirectReactionResponse
        | ApiAddGroupReactionResponse
        | ApiRemoveGroupReactionResponse
        | ApiAddChannelReactionResponse
        | ApiRemoveChannelReactionResponse
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

export function messageEvent(candid: ApiMessageEventWrapper): EventWrapper<Message> {
    return {
        event: message(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
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

export function updateGroupResponse(
    candid: ApiUpdateGroupResponse | ApiUpdateChannelResponse
): UpdateGroupResponse {
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
        return "not_authorized";
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
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
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
        return "failure";
    }
    throw new UnsupportedValueError("Unexpected ApiUpdateGroupResponse type received", candid);
}

export function createGroupResponse(
    candid: ApiCreateGroupResponse | ApiCreateChannelResponse,
    id: MultiUserChatIdentifier
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
    candid: ApiDeleteGroupResponse | ApiDeleteChannelResponse
): DeleteGroupResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("DeleteGroupResponse failed with: ", candid);
        return "failure";
    }
}

export function pinMessageResponse(
    candid: ApiPinMessageResponse | ApiPinChannelMessageResponse
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
    candid: ApiUnpinMessageResponse | ApiPinChannelMessageResponse
): UnpinMessageResponse {
    if ("Success" in candid || "SuccessV2" in candid || "NoChange" in candid) {
        return "success";
    } else {
        console.warn("UnpinMessageResponse failed with: ", candid);
        return "failure";
    }
}

export function groupDetailsResponse(
    candid: ApiSelectedInitialResponse | ApiSelectedChannelInitialResponse
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
            rules: groupRules(candid.Success.rules),
            timestamp: candid.Success.timestamp,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function groupDetailsUpdatesResponse(
    candid: ApiSelectedUpdatesResponse | ApiSelectedChannelUpdatesResponse
): GroupChatDetailsUpdatesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            membersAddedOrUpdated: candid.Success.members_added_or_updated.map(member),
            membersRemoved: new Set(candid.Success.members_removed.map((u) => u.toString())),
            blockedUsersAdded: new Set(candid.Success.blocked_users_added.map((u) => u.toString())),
            blockedUsersRemoved: new Set(
                candid.Success.blocked_users_removed.map((u) => u.toString())
            ),
            pinnedMessagesAdded: new Set(candid.Success.pinned_messages_added),
            pinnedMessagesRemoved: new Set(candid.Success.pinned_messages_removed),
            rules: optional(candid.Success.rules, groupRules),
            invitedUsers: optional(
                candid.Success.invited_users,
                (invited_users) => new Set(invited_users.map((u) => u.toString()))
            ),
            timestamp: candid.Success.timestamp,
        };
    } else if ("SuccessNoUpdates" in candid) {
        return {
            kind: "success_no_updates",
            timestamp: candid.SuccessNoUpdates || BigInt(Date.now()),
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
    };
}

export function groupRules(candid: ApiGroupRules): AccessRules {
    return {
        text: candid.text,
        enabled: candid.enabled,
    };
}

export function editMessageResponse(
    candid: ApiEditMessageResponse | ApiEditChannelMessageResponse | ApiEditDirectMessageResponse
): EditMessageResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("EditMessageResponse failed with: ", candid);
        return "failure";
    }
}

export function declineInvitationResponse(
    candid: ApiDeclineInvitationResponse | ApiDeclineChannelInvitationResponse
): DeclineInvitationResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("DeclineInvitationResponse failed with: ", candid);
        return "failure";
    }
}

export function leaveGroupResponse(
    candid: ApiLeaveGroupResponse | ApiLeaveChannelResponse
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
    candid: ApiDeleteMessageResponse | ApiDeleteChannelMessageResponse
): DeleteMessageResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("DeleteMessageResponse failed with: ", candid);
        return "failure";
    }
}

export function deletedMessageResponse(
    candid: ApiDeletedGroupMessageResponse | ApiDeletedChannelMessageResponse
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
    candid: ApiUndeleteMessageResponse | ApiUndeleteChannelMessageResponse
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
    latestClientThreadUpdate: bigint | undefined
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
            latestClientThreadUpdate ?? BigInt(-1)
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
    candid: ApiChangeRoleResponse | ApiChangeChannelRoleResponse
): ChangeRoleResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("ChangeRoleResponse failed with: ", candid);
        return "failure";
    }
}

export function registerPollVoteResponse(
    candid: ApiRegisterPollVoteResponse | ApiRegisterChannelPollVoteResponse
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
    chatId: MultiUserChatIdentifier
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
    candid: ApiInviteCodeResponse | ApiCommunityInviteCodeResponse
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
    candid: ApiEnableInviteCodeResponse | ApiCommunityEnableInviteCodeResponse
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
    candid: ApiDisableInviteCodeResponse | ApiCommunityDisableInviteCodeResponse
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
    candid: ApiResetInviteCodeResponse | ApiCommunityEnableInviteCodeResponse
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
