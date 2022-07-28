import { Principal } from "@dfinity/principal";
import DRange from "drange";
import type { ApiUpdatePermissionsArgs } from "../group/candid/idl";
import {
    FileContent,
    ImageContent,
    AudioContent,
    VideoContent,
    MessageContent,
    DeletedContent,
    TextContent,
    Message,
    ReplyContext,
    Reaction,
    StaleMessage,
    CryptocurrencyContent,
    CryptocurrencyTransfer,
    CompletedCryptocurrencyTransfer,
    PollContent,
    PollVotes,
    TotalPollVotes,
    PollConfig,
    GroupPermissions,
    PermissionRole,
    PendingCryptocurrencyWithdrawal,
    GiphyContent,
    GiphyImage,
    ThreadSummary,
    ProposalContent,
    Proposal,
    NnsProposalTopic,
} from "../../domain/chat/chat";
import { ProposalDecisionStatus, ProposalRewardStatus } from "../../domain/chat/chat";
import type { BlobReference } from "../../domain/data/data";
import type { User } from "../../domain/user/user";
import { UnsupportedValueError } from "../../utils/error";
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
    ApiUpdatedMessage,
    ApiDeletedContent,
    ApiCryptocurrencyContent,
    ApiCryptoTransaction,
    ApiPendingCryptoTransaction,
    ApiCompletedCryptoTransaction,
    ApiMessageIndexRange,
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
} from "../user/candid/idl";
import type { Cryptocurrency } from "../../domain/crypto";

const E8S_AS_BIGINT = BigInt(100_000_000);

export function message(candid: ApiMessage): Message {
    return {
        kind: "message",
        content: messageContent(candid.content),
        sender: candid.sender.toString(),
        repliesTo: optional(candid.replies_to, replyContext),
        messageId: candid.message_id,
        messageIndex: candid.message_index,
        reactions: reactions(candid.reactions),
        edited: candid.edited,
        forwarded: candid.forwarded,
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

export function apiMessageIndexRanges(ranges: ApiMessageIndexRange[]): DRange {
    const drange = new DRange();
    ranges.forEach((r) => drange.add(r.from, r.to));
    return drange;
}

export function messageContent(candid: ApiMessageContent): MessageContent {
    if ("File" in candid) {
        return fileContent(candid.File);
    }
    if ("Text" in candid) {
        if (process.env.ENABLE_PROPOSAL_TESTING) {
            return fakeProposalContentForTesting(candid.Text);
        } else {
            return textContent(candid.Text);
        }
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
    if ("Cryptocurrency" in candid) {
        return cryptoContent(candid.Cryptocurrency);
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
            proposer: p.proposer,
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
            proposer: p.proposer,
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

function deletedContent(candid: ApiDeletedContent): DeletedContent {
    return {
        kind: "deleted_content",
        deletedBy: candid.deleted_by.toString(),
        timestamp: candid.timestamp,
    };
}

function cryptoContent(candid: ApiCryptocurrencyContent): CryptocurrencyContent {
    return {
        kind: "crypto_content",
        caption: optional(candid.caption, identity),
        transfer: cryptoTransfer(candid.transfer),
    };
}

export function token(_candid: ApiCryptocurrency): Cryptocurrency {
    return "icp";
}

export function apiToken(_token: Cryptocurrency): ApiCryptocurrency {
    return { InternetComputer: null };
}

function cryptoTransfer(candid: ApiCryptoTransaction): CryptocurrencyTransfer {
    if ("Pending" in candid) {
        return {
            kind: "pending",
            token: token(candid.Pending.token),
            recipient: "User" in candid.Pending.to ? candid.Pending.to.User.toString() : "",
            amountE8s: candid.Pending.amount.e8s,
            feeE8s: optional(candid.Pending.fee, (f) => f.e8s),
            memo: optional(candid.Pending.memo, identity),
        };
    }
    if ("Completed" in candid) {
        return completedCryptoTransfer(candid.Completed);
    }
    if ("Failed" in candid) {
        return {
            kind: "failed",
            token: token(candid.Failed.token),
            recipient: "User" in candid.Failed.to ? candid.Failed.to.User.toString() : "",
            amountE8s: candid.Failed.amount.e8s,
            feeE8s: candid.Failed.fee.e8s,
            memo: candid.Failed.memo,
            errorMessage: candid.Failed.error_message,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiCryptocurrencyTransfer type received", candid);
}

export function completedCryptoTransfer(
    candid: ApiCompletedCryptoTransaction
): CompletedCryptocurrencyTransfer {
    return {
        kind: "completed",
        token: token(candid.token),
        recipient: "User" in candid.to ? candid.to.User[0].toString() : "",
        sender: "User" in candid.from ? candid.from.User[0].toString() : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo,
        blockIndex: candid.block_index,
        transactionHash: bytesToHexString(candid.transaction_hash),
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

function fakeProposalContentForTesting(candid: ApiTextContent): MessageContent {
    if (candid.text === "Hi") {
        return {
            kind: "proposal_content",
            governanceCanisterId: "123-456",
            proposal: {
                kind: "nns",
                topic: NnsProposalTopic.Governance,
                id: BigInt(70015),
                url: "https://forum.dfinity.org/t/way-forward-on-spam-proposal-for-tactical-fix/14275",
                status: ProposalDecisionStatus.Executed,
                tally: {
                    no: 43,
                    yes: 87,
                    total: 200,
                },
                title: "Tactical fix for spam",
                proposer: BigInt(54),
                summary: `
## Background

Over the last few weeks there were growing concerns within the community and the DFINITY team regarding the current spam situation.
In particular, with respect to introducing new developers and users to the Internet Computer, spam is considered quite confusing.

## Proposal

As a temporary fix, DFINITY suggests to reconsider the (earlier rejected) proposal to temporarily revert voting rewards weights for governance proposals back to 1.
Given the current situation and engineering capacity, we believe that temporarily reverting voting rewards weights for governance proposals back to 1 is the most pragmatic solution for a short-term reduction of the incentives for spam.
Once the SNS functionality has been delivered, DFINITY will take on the task of proposing a more long-term and permanent solution to the problem.

## Analysis

The proposed tactical fix reduces but does not completely remove the incentive to submit spam proposals.
This is because approximately half of the total voting power is not voting on governance proposals after the reset of default following of all neurons in Q1’22.
For further details please see the [forum post](https://forum.dfinity.org/t/way-forward-on-spam-proposal-for-tactical-fix/14275).
                    `,
                rewardStatus: ProposalRewardStatus.Settled,
                lastUpdated: 1658394134000,
                created: 1658094134000,
                deadline: 1658384134000,
            },
        };
    } else if (candid.text.startsWith("Wordle")) {
        return {
            kind: "proposal_content",
            governanceCanisterId: "123-456",
            proposal: {
                kind: "nns",
                topic: NnsProposalTopic.SubnetManagement,
                id: BigInt(71106),
                url: "",
                status: ProposalDecisionStatus.Open,
                tally: {
                    no: 406443015,
                    yes: 2435,
                    total: 500000000,
                },
                title: "Update configuration of subnet: fuqsr",
                proposer: BigInt(50),
                summary: `Resume syncing Bitcoin mainnet on subnet fuqsr. The syncing was paused on June 3rd due to degraded performance due to a high volume of writes to disk. Since then, improvements have been introduced to make the subnet cope with higher volume of writes, and we've tested a full Butcoin mainnet sync on a testnet.`,
                rewardStatus: ProposalRewardStatus.AcceptVotes,
                lastUpdated: 1658394134000,
                created: 1658094134000,
                deadline: 1658894134000,
            },
        };
    } else if (candid.text.startsWith("Hello")) {
        return {
            kind: "proposal_content",
            governanceCanisterId: "123-456",
            proposal: {
                kind: "nns",
                topic: NnsProposalTopic.SubnetManagement,
                id: BigInt(71108),
                url: "",
                status: ProposalDecisionStatus.Open,
                tally: {
                    no: 406443015,
                    yes: 2435,
                    total: 500000000,
                },
                title: "Update configuration of subnet: fuqsr",
                proposer: BigInt(50),
                summary: `
# Modest

[Modest](https://github.com/markdowncss/modest) is the fourth of many stylesheets to make HTML generated from markdown look beautiful. A list of all available stylesheets can be found [here](https://github.com/markdowncss).

#### A markdown theme that is rather modest.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce vehicula pharetra ultricies. Cras magna turpis, vestibulum ut arcu et, rutrum porta velit. Curabitur luctus erat a velit tincidunt, vel malesuada nibh tempor.
Mauris condimentum quam lorem, in finibus eros faucibus id. Nunc erat metus, fringilla dignissim faucibus id, malesuada quis justo.

  > Vestibulum erat augue, feugiat vitae porttitor vel, condimentum quis ipsum. Etiam sagittis eros et dolor semper congue.

Curabitur ac euismod turpis. Maecenas gravida viverra augue quis scelerisque. Vivamus quis massa elementum odio pharetra efficitur at eget nibh. Donec varius purus quis nisi gravida tristique. Quisque dictum justo nec nulla hendrerit aliquet.

<div>
  <img src="https://cloud.githubusercontent.com/assets/1424573/4785631/dc5ddcd2-5d82-11e4-88a2-06fdabbe4fb8.png">
</div>

Duis ac ultrices nunc. Proin elit augue, fringilla at varius at, interdum ut justo. Sed sed eros a leo molestie bibendum. Nullam ac justo malesuada, euismod dui at, finibus purus. Sed mi risus, porta ac sem ac, commodo semper risus.

#### Some example code:

\`\`\`js
gulp.task('watch', function() {
  gulp.watch('*.md', function() {
    gulp.start('md', 'html');
  });

  gulp.watch('*.css', function() {
    gulp.start('css');
  });
});
\`\`\`

#### Lists

  * Apples
  * Citrus
    * Oranges
    * Grapefruit
  * Potatoes
  * Milk

  1. Mow the lawn
  2. Feed the dog
  3. Dance

Crafted with <3 by [John Otander](http://johnotander.com) ([@4lpine](https://twitter.com/4lpine)).                
                `,
                rewardStatus: ProposalRewardStatus.AcceptVotes,
                lastUpdated: 1658394134000,
                created: 1658094134000,
                deadline: 1658894134000,
            },
        };
    }

    return textContent(candid);
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
        chatIdIfOther: optional(candid.chat_id_if_other, (id) => id.toString()),
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

export function apiUpdatePermissions(
    permissions: Partial<GroupPermissions>
): ApiUpdatePermissionsArgs {
    return {
        change_permissions: apiOptional(apiPermissionRole, permissions.changePermissions),
        change_roles: apiOptional(apiPermissionRole, permissions.changeRoles),
        add_members: apiOptional(apiPermissionRole, permissions.addMembers),
        remove_members: apiOptional(apiPermissionRole, permissions.removeMembers),
        block_users: apiOptional(apiPermissionRole, permissions.blockUsers),
        delete_messages: apiOptional(apiPermissionRole, permissions.deleteMessages),
        update_group: apiOptional(apiPermissionRole, permissions.updateGroup),
        pin_messages: apiOptional(apiPermissionRole, permissions.pinMessages),
        invite_users: apiOptional(apiPermissionRole, permissions.inviteUsers),
        create_polls: apiOptional(apiPermissionRole, permissions.createPolls),
        send_messages: apiOptional(apiPermissionRole, permissions.sendMessages),
        react_to_messages: apiOptional(apiPermissionRole, permissions.reactToMessages),
        reply_in_thread: apiOptional(apiPermissionRole, permissions.replyInThread),
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

export function apiReplyContextArgs(
    domain: ReplyContext,
    replyingToChatId?: string
): ApiReplyContext {
    return {
        chat_id_if_other: apiOptional((chatId) => Principal.fromText(chatId), replyingToChatId),
        event_index: domain.eventIndex,
    };
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
            return { Cryptocurrency: apiPendingCryptoContent(domain) };

        case "deleted_content":
            return { Deleted: apiDeletedContent(domain) };

        case "poll_content":
            return { Poll: apiPollContent(domain) };

        case "giphy_content":
            return { Giphy: apiGiphyContent(domain) };

        case "proposal_content":
            return { GovernanceProposal: apiProposalContent(domain) };

        case "placeholder_content":
            throw new Error("Incorrectly attempting to send placeholder content to the server");
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

export function apiPendingCryptoContent(domain: CryptocurrencyContent): ApiCryptocurrencyContent {
    return {
        caption: apiOptional(identity, domain.caption),
        transfer: apiPendingCryptoTransaction(domain.transfer),
    };
}

function apiPendingCryptoTransaction(domain: CryptocurrencyTransfer): ApiCryptoTransaction {
    if (domain.kind === "pending") {
        return {
            Pending: {
                token: apiToken(domain.token),
                to: {
                    User: Principal.fromText(domain.recipient),
                },
                amount: apiICP(domain.amountE8s),
                fee: apiOptional(apiICP, domain.feeE8s),
                memo: apiOptional(identity, domain.memo),
            },
        };
    }
    throw new Error("Transaction is not of type 'Pending': " + JSON.stringify(domain));
}

export function apiPendingCryptocurrencyWithdrawal(
    domain: PendingCryptocurrencyWithdrawal
): ApiPendingCryptoTransaction {
    return {
        token: apiToken(domain.token),
        to: { Account: hexStringToBytes(domain.to) },
        amount: apiICP(domain.amountE8s),
        fee: apiOptional(apiICP, domain.feeE8s),
        memo: apiOptional(identity, domain.memo),
    };
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
