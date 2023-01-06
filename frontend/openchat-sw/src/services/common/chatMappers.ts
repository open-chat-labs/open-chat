import { Principal } from "@dfinity/principal";
import {
    AudioContent,
    CompletedCryptocurrencyTransfer,
    CryptocurrencyContent,
    CryptocurrencyTransfer,
    DeletedContent,
    FileContent,
    GiphyContent,
    GiphyImage,
    ImageContent,
    Message,
    MessageContent,
    PollConfig,
    PollContent,
    PollVotes,
    Proposal,
    ProposalContent,
    ProposalDecisionStatus,
    ProposalRewardStatus,
    Reaction,
    ReplyContext,
    TextContent,
    ThreadSummary,
    TotalPollVotes,
    VideoContent,
} from "../../domain/chat";
import { Cryptocurrency } from "../../domain/crypto";
import { BlobReference } from "../../domain/data/data";
import { UnsupportedValueError } from "../../utils/error";
import { bytesToHexString, identity, optional } from "../../utils/mapping";
import {
    ApiAudioContent,
    ApiBlobReference,
    ApiCryptoContent,
    ApiCryptocurrency,
    ApiCryptoTransaction,
    ApiDeletedContent,
    ApiFileContent,
    ApiGiphyContent,
    ApiGiphyImageVariant,
    ApiImageContent,
    ApiMessage,
    ApiMessageContent,
    ApiNnsCompletedCryptoTransaction,
    ApiPollConfig,
    ApiPollContent,
    ApiPollVotes,
    ApiProposal,
    ApiProposalContent,
    ApiProposalDecisionStatus,
    ApiProposalRewardStatus,
    ApiReplyContext,
    ApiTextContent,
    ApiThreadSummary,
    ApiTotalPollVotes,
    ApiVideoContent,
} from "../notifications/candid/idl";

const E8S_AS_BIGINT = BigInt(100_000_000);

export function message(candid: ApiMessage): Message {
    const sender = candid.sender.toString();
    return {
        kind: "message",
        content: messageContent(candid.content, sender),
        sender,
        repliesTo: optional(candid.replies_to, replyContext),
        messageId: candid.message_id,
        messageIndex: candid.message_index,
        reactions: reactions(candid.reactions),
        edited: candid.edited,
        forwarded: candid.forwarded,
        thread: optional(candid.thread_summary, threadSummary),
    };
}

function replyContext(candid: ApiReplyContext): ReplyContext {
    return {
        kind: "raw_reply_context",
        eventIndex: candid.event_index,
        chatIdIfOther: optional(candid.chat_id_if_other, (id) => id.toString()),
    };
}

function reactions(candid: [string, Principal[]][]): Reaction[] {
    return candid.map(([reaction, userIds]) => ({
        reaction,
        userIds: new Set(userIds.map((u) => u.toString())),
    }));
}

export function threadSummary(candid: ApiThreadSummary): ThreadSummary {
    return {
        participantIds: new Set(candid.participant_ids.map((p) => p.toString())),
        numberOfReplies: Number(candid.reply_count),
        latestEventIndex: Number(candid.latest_event_index),
        latestEventTimestamp: candid.latest_event_timestamp,
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
    throw new UnsupportedValueError("Unexpected ApiMessageContent type received", candid);
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
            proposer: Buffer.from(p.proposer).toString("hex"),
            title: p.title,
            summary: p.summary,
            url: p.url,
            status: proposalDecisionStatus(p.status),
            rewardStatus: proposalRewardStatus(p.reward_status),
            tally: {
                yes: Number(p.tally.yes / E8S_AS_BIGINT),
                no: Number(p.tally.no / E8S_AS_BIGINT),
                total: Number(p.tally.total / E8S_AS_BIGINT),
            },
            lastUpdated: Number(p.last_updated),
            created: Number(p.created),
            deadline: Number(p.deadline),
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

function cryptoContent(candid: ApiCryptoContent, sender: string): CryptocurrencyContent {
    return {
        kind: "crypto_content",
        caption: optional(candid.caption, identity),
        transfer: cryptoTransfer(candid.transfer, sender, candid.recipient.toString()),
    };
}

function cryptoTransfer(
    candid: ApiCryptoTransaction,
    sender: string,
    recipient: string
): CryptocurrencyTransfer {
    if ("Pending" in candid) {
        return {
            kind: "pending",
            token: token(candid.Pending.NNS.token),
            recipient,
            amountE8s: candid.Pending.NNS.amount.e8s,
            feeE8s: optional(candid.Pending.NNS.fee, (f) => f.e8s),
            memo: optional(candid.Pending.NNS.memo, identity),
        };
    }
    if ("Completed" in candid) {
        return completedCryptoTransfer(candid.Completed.NNS, sender, recipient);
    }
    if ("Failed" in candid) {
        return {
            kind: "failed",
            token: token(candid.Failed.NNS.token),
            recipient,
            amountE8s: candid.Failed.NNS.amount.e8s,
            feeE8s: candid.Failed.NNS.fee.e8s,
            memo: candid.Failed.NNS.memo,
            errorMessage: candid.Failed.NNS.error_message,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiCryptoTransaction type received", candid);
}

export function token(_candid: ApiCryptocurrency): Cryptocurrency {
    return "icp";
}

export function completedCryptoTransfer(
    candid: ApiNnsCompletedCryptoTransaction,
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
        memo: candid.memo,
        blockIndex: candid.block_index,
        transactionHash: bytesToHexString(candid.transaction_hash),
    };
}

function deletedContent(candid: ApiDeletedContent): DeletedContent {
    return {
        kind: "deleted_content",
        deletedBy: candid.deleted_by.toString(),
        timestamp: candid.timestamp,
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
