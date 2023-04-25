import { Principal } from "@dfinity/principal";
import { bytesToHexString, hexStringToBytes, identity, optional } from "../../utils/mapping";
import type {
    ApiBlobReference,
    ApiFileContent,
    ApiImageContent,
    ApiAudioContent,
    ApiVideoContent,
    ApiMessageContent,
    ApiMessage,
    ApiTextContent,
    ApiReplyContext,
    ApiPrizeContent,
    ApiUpdatedMessage,
    ApiDeletedContent,
    ApiCryptoContent,
    ApiCryptoTransaction,
    ApiNnsPendingCryptoTransaction,
    ApiNnsCompletedCryptoTransaction,
    ApiNnsFailedCryptoTransaction,
    ApiSnsPendingCryptoTransaction,
    ApiSnsCompletedCryptoTransaction,
    ApiSnsFailedCryptoTransaction,
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
    ApiRole,
    ApiPrizeWinnerContent,
    ApiGroupGate,
    ApiMessageReminderCreated,
    ApiMessageReminder,
    ApiCustomMessageContent,
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
    type Cryptocurrency,
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
    type GroupPermissions,
    type PermissionRole,
    type PendingCryptocurrencyWithdrawal,
    type ChatMetrics,
    UnsupportedValueError,
    type MemberRole,
    type GroupSubtype,
    PrizeContent,
    PrizeWinnerContent,
    GroupGate,
    OpenChatGovernanceCanisterId,
    Sns1GovernanceCanisterId,
    MessageReminderCreatedContent,
    MessageReminderContent,
    CustomContent,
    MessageContext,
} from "openchat-shared";
import type { WithdrawCryptoArgs } from "../user/candid/types";

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
    throw new UnsupportedValueError("Unexpected ApiMessageContent type received", candid);
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
    const transfer = "NNS" in candid.transaction ? candid.transaction.NNS : candid.transaction.SNS;
    return {
        kind: "prize_winner_content",
        transaction: completedCryptoTransfer(transfer, senderId, candid.winner.toString()),
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

export function token(candid: ApiCryptocurrency): Cryptocurrency {
    if ("InternetComputer" in candid) return "icp";
    if ("SNS1" in candid) return "sns1";
    if ("CKBTC" in candid) return "ckbtc";
    if ("CHAT" in candid) return "chat";
    throw new UnsupportedValueError("Unexpected ApiCryptocurrency type received", candid);
}

export function apiToken(token: Cryptocurrency): ApiCryptocurrency {
    switch (token) {
        case "icp":
            return { InternetComputer: null };
        case "sns1":
            return { SNS1: null };
        case "ckbtc":
            return { CKBTC: null };
        case "chat":
            return { CHAT: null };
    }
}

function cryptoTransfer(
    candid: ApiCryptoTransaction,
    sender: string,
    recipient: string
): CryptocurrencyTransfer {
    if ("Pending" in candid) {
        const transfer = "NNS" in candid.Pending ? candid.Pending.NNS : candid.Pending.SNS;
        return pendingCryptoTransfer(transfer, recipient);
    }
    if ("Completed" in candid) {
        const transfer = "NNS" in candid.Completed ? candid.Completed.NNS : candid.Completed.SNS;
        return completedCryptoTransfer(transfer, sender, recipient);
    }
    if ("Failed" in candid) {
        const transfer = "NNS" in candid.Failed ? candid.Failed.NNS : candid.Failed.SNS;
        return failedCryptoTransfer(transfer, recipient);
    }
    throw new UnsupportedValueError("Unexpected ApiCryptoTransaction type received", candid);
}

function pendingCryptoTransfer(
    candid: ApiNnsPendingCryptoTransaction | ApiSnsPendingCryptoTransaction,
    recipient: string
): PendingCryptocurrencyTransfer {
    return {
        kind: "pending",
        token: token(candid.token),
        recipient,
        amountE8s: candid.amount.e8s,
        feeE8s: Array.isArray(candid.fee) ? optional(candid.fee, (f) => f.e8s) : candid.fee.e8s,
        memo: optional(candid.memo, identity),
    };
}

export function completedCryptoTransfer(
    candid: ApiNnsCompletedCryptoTransaction | ApiSnsCompletedCryptoTransaction,
    sender: string,
    recipient: string
): CompletedCryptocurrencyTransfer {
    return {
        kind: "completed",
        token: token(candid.token),
        recipient,
        sender,
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: Array.isArray(candid.memo) ? candid.memo[0] ?? BigInt(0) : candid.memo,
        blockIndex: candid.block_index,
        transactionHash: bytesToHexString(candid.transaction_hash),
    };
}

export function failedCryptoTransfer(
    candid: ApiNnsFailedCryptoTransaction | ApiSnsFailedCryptoTransaction,
    recipient: string
): FailedCryptocurrencyTransfer {
    return {
        kind: "failed",
        token: token(candid.token),
        recipient,
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: Array.isArray(candid.memo) ? candid.memo[0] ?? BigInt(0) : candid.memo,
        errorMessage: candid.error_message,
    };
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
        sourceContext:
            optional(candid.event_list_if_other, replySourceContext) ??
            optional(candid.chat_id_if_other, replySourceContextLegacy),
    };
}

// We still need this for data that doesn't have the new format
function replySourceContextLegacy(chatId: Principal): MessageContext {
    return {
        chatId: chatId.toString(),
    };
}

function replySourceContext([chatId, maybeThreadRoot]: [Principal, [] | [number]]): MessageContext {
    return {
        chatId: chatId.toString(),
        threadRootMessageIndex: optional(maybeThreadRoot, identity),
    };
}

function reactions(candid: [string, Principal[]][]): Reaction[] {
    return candid.map(([reaction, userIds]) => ({
        reaction,
        userIds: new Set(userIds.map((u) => u.toString())),
    }));
}

export function groupPermissions(candid: ApiGroupPermissions): GroupPermissions {
    return {
        changePermissions: permissionRole(candid.change_permissions),
        changeRoles: permissionRole(candid.change_roles),
        addMembers: permissionRole(candid.add_members),
        removeMembers: permissionRole(candid.remove_members),
        blockUsers: permissionRole(candid.block_users),
        deleteMessages: permissionRole(candid.delete_messages),
        updateGroup: permissionRole(candid.update_group),
        pinMessages: permissionRole(candid.pin_messages),
        inviteUsers: permissionRole(candid.invite_users),
        createPolls: permissionRole(candid.create_polls),
        sendMessages: permissionRole(candid.send_messages),
        reactToMessages: permissionRole(candid.react_to_messages),
        replyInThread: permissionRole(candid.reply_in_thread),
    };
}

export function apiGroupPermissions(permissions: GroupPermissions): ApiGroupPermissions {
    return {
        change_permissions: apiPermissionRole(permissions.changePermissions),
        change_roles: apiPermissionRole(permissions.changeRoles),
        add_members: apiPermissionRole(permissions.addMembers),
        remove_members: apiPermissionRole(permissions.removeMembers),
        block_users: apiPermissionRole(permissions.blockUsers),
        delete_messages: apiPermissionRole(permissions.deleteMessages),
        update_group: apiPermissionRole(permissions.updateGroup),
        pin_messages: apiPermissionRole(permissions.pinMessages),
        invite_users: apiPermissionRole(permissions.inviteUsers),
        create_polls: apiPermissionRole(permissions.createPolls),
        send_messages: apiPermissionRole(permissions.sendMessages),
        react_to_messages: apiPermissionRole(permissions.reactToMessages),
        reply_in_thread: apiPermissionRole(permissions.replyInThread),
    };
}

export function apiPermissionRole(permissionRole: PermissionRole): ApiPermissionRole {
    switch (permissionRole) {
        case "owner":
            return { Owner: null };
        case "admins":
            return { Admins: null };
        case "members":
            return { Members: null };
    }
}

export function permissionRole(candid: ApiPermissionRole): PermissionRole {
    if ("Owner" in candid) return "owner";
    if ("Admins" in candid) return "admins";
    return "members";
}

export function chatMetrics(candid: ApiChatMetrics): ChatMetrics {
    return {
        audioMessages: Number(candid.audio_messages),
        cyclesMessages: Number(candid.cycles_messages),
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

export function memberRole(candid: ApiRole): MemberRole {
    if ("Admin" in candid) {
        return "admin";
    }
    if ("Participant" in candid) {
        return "participant";
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

export function apiReplyContextArgs(chatId: string, domain: ReplyContext): ApiReplyContext {
    if (domain.sourceContext !== undefined && chatId !== domain.sourceContext.chatId) {
        return {
            chat_id_if_other: [Principal.fromText(domain.sourceContext.chatId)],
            event_list_if_other: [
                [
                    Principal.fromText(domain.sourceContext.chatId),
                    apiOptional(identity, domain.sourceContext.threadRootMessageIndex),
                ],
            ],
            event_index: domain.eventIndex,
        };
    } else {
        return {
            chat_id_if_other: [],
            event_list_if_other: [],
            event_index: domain.eventIndex,
        };
    }
}

export function apiMessageContent(domain: MessageContent): ApiMessageContent {
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

export function apiMaybeGroupGate(domain: GroupGate): [] | [ApiGroupGate] {
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
    return [];
}

export function apiGroupGate(domain: GroupGate): ApiGroupGate {
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
    throw new Error(`Received a domain level group gate that we cannot parse: ${domain}`);
}

export function groupGate(candid: ApiGroupGate): GroupGate {
    if ("SnsNeuron" in candid) {
        const canisterId = candid.SnsNeuron.governance_canister_id.toString();
        if (canisterId === OpenChatGovernanceCanisterId) {
            return {
                kind: "openchat_gate",
                minDissolveDelay: optional(candid.SnsNeuron.min_dissolve_delay, Number),
                minStakeE8s: optional(candid.SnsNeuron.min_stake_e8s, Number),
            };
        }
        if (canisterId === Sns1GovernanceCanisterId) {
            return {
                kind: "sns1_gate",
                minDissolveDelay: optional(candid.SnsNeuron.min_dissolve_delay, Number),
                minStakeE8s: optional(candid.SnsNeuron.min_stake_e8s, Number),
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
        if (domain.token === "icp") {
            return {
                Pending: {
                    NNS: {
                        token: apiToken(domain.token),
                        to: {
                            User: Principal.fromText(domain.recipient),
                        },
                        amount: apiICP(domain.amountE8s),
                        fee: [],
                        memo: apiOptional(identity, domain.memo),
                    },
                },
            };
        } else {
            return {
                Pending: {
                    SNS: {
                        token: apiToken(domain.token),
                        to: {
                            owner: Principal.fromText(domain.recipient),
                            subaccount: [],
                        },
                        amount: apiICP(domain.amountE8s),
                        fee: apiICP(domain.feeE8s ?? BigInt(0)),
                        memo: apiOptional(identity, domain.memo),
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
    if (domain.token === "icp") {
        return {
            withdrawal: {
                NNS: {
                    token: apiToken(domain.token),
                    to: { Account: hexStringToBytes(domain.to) },
                    amount: apiICP(domain.amountE8s),
                    fee: [],
                    memo: apiOptional(identity, domain.memo),
                },
            },
        };
    } else {
        return {
            withdrawal: {
                SNS: {
                    token: apiToken(domain.token),
                    to: { owner: Principal.fromText(domain.to), subaccount: [] },
                    amount: apiICP(domain.amountE8s),
                    fee: apiICP(domain.feeE8s ?? BigInt(0)),
                    memo: apiOptional(identity, domain.memo),
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
