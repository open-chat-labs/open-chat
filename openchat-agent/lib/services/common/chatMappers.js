import { Principal } from "@dfinity/principal";
import DRange from "drange";
import { ProposalDecisionStatus, ProposalRewardStatus } from "../../domain/chat/chat";
import { UnsupportedValueError } from "../../utils/error";
import { bytesToHexString, hexStringToBytes, identity, optional } from "../../utils/mapping";
const E8S_AS_BIGINT = BigInt(100000000);
export function message(candid) {
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
export function threadSummary(candid) {
    return {
        participantIds: new Set(candid.participant_ids.map((p) => p.toString())),
        numberOfReplies: Number(candid.reply_count),
        latestEventIndex: Number(candid.latest_event_index),
        latestEventTimestamp: candid.latest_event_timestamp,
    };
}
export function updatedMessage(candid) {
    return {
        updatedBy: candid.updated_by.toString(),
        messageId: candid.message_id,
        eventIndex: candid.event_index,
    };
}
export function apiMessageIndexRanges(ranges) {
    const drange = new DRange();
    ranges.forEach((r) => drange.add(r.from, r.to));
    return drange;
}
export function messageContent(candid, sender) {
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
export function apiUser(domain) {
    return {
        user_id: Principal.fromText(domain.userId),
        username: domain.username,
    };
}
function proposalContent(candid) {
    return {
        kind: "proposal_content",
        governanceCanisterId: candid.governance_canister_id.toString(),
        proposal: proposal(candid.proposal),
        myVote: optional(candid.my_vote, identity),
    };
}
function proposal(candid) {
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
    }
    else if ("SNS" in candid) {
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
function proposalDecisionStatus(candid) {
    if ("Failed" in candid)
        return ProposalDecisionStatus.Failed;
    if ("Open" in candid)
        return ProposalDecisionStatus.Open;
    if ("Rejected" in candid)
        return ProposalDecisionStatus.Rejected;
    if ("Executed" in candid)
        return ProposalDecisionStatus.Executed;
    if ("Adopted" in candid)
        return ProposalDecisionStatus.Adopted;
    return ProposalDecisionStatus.Unspecified;
}
function proposalRewardStatus(candid) {
    if ("AcceptVotes" in candid)
        return ProposalRewardStatus.AcceptVotes;
    if ("ReadyToSettle" in candid)
        return ProposalRewardStatus.ReadyToSettle;
    if ("Settled" in candid)
        return ProposalRewardStatus.Settled;
    return ProposalRewardStatus.Unspecified;
}
function giphyContent(candid) {
    return {
        kind: "giphy_content",
        title: candid.title,
        caption: optional(candid.caption, identity),
        desktop: giphyImageVariant(candid.desktop),
        mobile: giphyImageVariant(candid.mobile),
    };
}
function giphyImageVariant(candid) {
    return {
        width: candid.width,
        height: candid.height,
        url: candid.url,
        mimeType: candid.mime_type,
    };
}
function pollContent(candid) {
    return {
        kind: "poll_content",
        votes: pollVotes(candid.votes),
        config: pollConfig(candid.config),
        ended: candid.ended,
    };
}
function pollConfig(candid) {
    return {
        allowMultipleVotesPerUser: candid.allow_multiple_votes_per_user,
        text: optional(candid.text, identity),
        showVotesBeforeEndDate: candid.show_votes_before_end_date,
        endDate: optional(candid.end_date, identity),
        anonymous: candid.anonymous,
        options: candid.options,
    };
}
function pollVotes(candid) {
    return {
        total: totalPollVotes(candid.total),
        user: [...candid.user],
    };
}
function totalPollVotes(candid) {
    if ("Anonymous" in candid) {
        return {
            kind: "anonymous_poll_votes",
            votes: candid.Anonymous.reduce((agg, [idx, num]) => {
                agg[idx] = num;
                return agg;
            }, {}),
        };
    }
    if ("Visible" in candid) {
        return {
            kind: "visible_poll_votes",
            votes: candid.Visible.reduce((agg, [idx, userIds]) => {
                agg[idx] = userIds.map((p) => p.toString());
                return agg;
            }, {}),
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
function deletedContent(candid) {
    return {
        kind: "deleted_content",
        deletedBy: candid.deleted_by.toString(),
        timestamp: candid.timestamp,
    };
}
function cryptoContent(candid, sender) {
    return {
        kind: "crypto_content",
        caption: optional(candid.caption, identity),
        transfer: cryptoTransfer(candid.transfer, sender, candid.recipient.toString()),
    };
}
export function token(_candid) {
    return "icp";
}
export function apiToken(_token) {
    return { InternetComputer: null };
}
function cryptoTransfer(candid, sender, recipient) {
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
function pendingCryptoTransfer(candid, recipient) {
    return {
        kind: "pending",
        token: token(candid.token),
        recipient,
        amountE8s: candid.amount.e8s,
        feeE8s: Array.isArray(candid.fee) ? optional(candid.fee, (f) => f.e8s) : candid.fee.e8s,
        memo: optional(candid.memo, identity),
    };
}
export function completedCryptoTransfer(candid, sender, recipient) {
    var _a;
    return {
        kind: "completed",
        token: token(candid.token),
        recipient,
        sender,
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: Array.isArray(candid.memo) ? ((_a = candid.memo[0]) !== null && _a !== void 0 ? _a : BigInt(0)) : candid.memo,
        blockIndex: candid.block_index,
        transactionHash: bytesToHexString(candid.transaction_hash),
    };
}
export function failedCryptoTransfer(candid, recipient) {
    var _a;
    return {
        kind: "failed",
        token: token(candid.token),
        recipient,
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: Array.isArray(candid.memo) ? ((_a = candid.memo[0]) !== null && _a !== void 0 ? _a : BigInt(0)) : candid.memo,
        errorMessage: candid.error_message,
    };
}
function imageContent(candid) {
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
function videoContent(candid) {
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
function audioContent(candid) {
    return {
        kind: "audio_content",
        mimeType: candid.mime_type,
        blobReference: optional(candid.blob_reference, blobReference),
        caption: optional(candid.caption, identity),
    };
}
function textContent(candid) {
    return {
        kind: "text_content",
        text: candid.text,
    };
}
function fileContent(candid) {
    return {
        kind: "file_content",
        name: candid.name,
        mimeType: candid.mime_type,
        blobReference: optional(candid.blob_reference, blobReference),
        caption: optional(candid.caption, identity),
        fileSize: candid.file_size,
    };
}
function blobReference(candid) {
    return {
        blobId: candid.blob_id,
        canisterId: candid.canister_id.toString(),
    };
}
function replyContext(candid) {
    return {
        kind: "raw_reply_context",
        eventIndex: candid.event_index,
        chatIdIfOther: optional(candid.chat_id_if_other, (id) => id.toString()),
    };
}
function reactions(candid) {
    return candid.map(([reaction, userIds]) => ({
        reaction,
        userIds: new Set(userIds.map((u) => u.toString())),
    }));
}
export function groupPermissions(candid) {
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
export function apiGroupPermissions(permissions) {
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
export function apiPermissionRole(permissionRole) {
    switch (permissionRole) {
        case "owner":
            return { Owner: null };
        case "admins":
            return { Admins: null };
        case "members":
            return { Members: null };
    }
}
export function permissionRole(candid) {
    if ("Owner" in candid)
        return "owner";
    if ("Admins" in candid)
        return "admins";
    return "members";
}
export function apiReplyContextArgs(domain, replyingToChatId) {
    return {
        chat_id_if_other: apiOptional((chatId) => Principal.fromText(chatId), replyingToChatId),
        event_index: domain.eventIndex,
    };
}
export function apiMessageContent(domain) {
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
        case "placeholder_content":
            throw new Error("Incorrectly attempting to send placeholder content to the server");
    }
}
function apiProposalContent(_) {
    throw new Error("Sending messages of type 'GovernanceProposal' is not currently supported");
}
function apiGiphyContent(domain) {
    return {
        title: domain.title,
        caption: apiOptional(identity, domain.caption),
        desktop: apiGiphyImageVariant(domain.desktop),
        mobile: apiGiphyImageVariant(domain.mobile),
    };
}
function apiGiphyImageVariant(domain) {
    return {
        height: domain.height,
        width: domain.width,
        url: domain.url,
        mime_type: domain.mimeType,
    };
}
function apiPollContent(domain) {
    return {
        votes: apiPollVotes(domain.votes),
        config: apiPollConfig(domain.config),
        ended: domain.ended,
    };
}
function apiPollConfig(domain) {
    return {
        allow_multiple_votes_per_user: domain.allowMultipleVotesPerUser,
        text: apiOptional(identity, domain.text),
        show_votes_before_end_date: domain.showVotesBeforeEndDate,
        end_date: apiOptional(identity, domain.endDate),
        anonymous: domain.anonymous,
        options: domain.options,
    };
}
function apiPollVotes(domain) {
    return {
        total: apiTotalPollVotes(domain.total),
        user: new Uint32Array(domain.user),
    };
}
function apiTotalPollVotes(domain) {
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
function apiImageContent(domain) {
    return {
        height: domain.height,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        thumbnail_data: domain.thumbnailData,
        caption: apiOptional(identity, domain.caption),
        width: domain.width,
    };
}
function apiVideoContent(domain) {
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
function apiAudioContent(domain) {
    return {
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        caption: apiOptional(identity, domain.caption),
    };
}
export function apiOptional(mapper, domain) {
    return domain !== undefined ? [mapper(domain)] : [];
}
function apiBlobReference(domain) {
    return apiOptional((b) => ({
        blob_id: b.blobId,
        canister_id: Principal.fromText(b.canisterId),
    }), domain);
}
function apiDeletedContent(domain) {
    return {
        deleted_by: Principal.fromText(domain.deletedBy),
        timestamp: domain.timestamp,
    };
}
export function apiPendingCryptoContent(domain) {
    return {
        recipient: Principal.fromText(domain.transfer.recipient),
        caption: apiOptional(identity, domain.caption),
        transfer: apiPendingCryptoTransaction(domain.transfer),
    };
}
function apiPendingCryptoTransaction(domain) {
    if (domain.kind === "pending") {
        return {
            Pending: {
                NNS: {
                    token: apiToken(domain.token),
                    to: {
                        User: Principal.fromText(domain.recipient),
                    },
                    amount: apiICP(domain.amountE8s),
                    fee: apiOptional(apiICP, domain.feeE8s),
                    memo: apiOptional(identity, domain.memo),
                },
            },
        };
    }
    throw new Error("Transaction is not of type 'Pending': " + JSON.stringify(domain));
}
export function apiPendingCryptocurrencyWithdrawal(domain) {
    return {
        token: apiToken(domain.token),
        to: { Account: hexStringToBytes(domain.to) },
        amount: apiICP(domain.amountE8s),
        fee: apiOptional(apiICP, domain.feeE8s),
        memo: apiOptional(identity, domain.memo),
    };
}
function apiTextContent(domain) {
    return {
        text: domain.text,
    };
}
function apiFileContent(domain) {
    return {
        name: domain.name,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        caption: apiOptional(identity, domain.caption),
        file_size: domain.fileSize,
    };
}
function apiICP(amountE8s) {
    return {
        e8s: amountE8s,
    };
}
export function nervousSystemFunctions(candid) {
    return {
        reservedIds: [...candid.reserved_ids],
        functions: candid.functions.map(nervousSystemFunction),
    };
}
function nervousSystemFunction(candid) {
    var _a;
    return {
        id: Number(candid.id),
        name: candid.name,
        description: (_a = optional(candid.description, identity)) !== null && _a !== void 0 ? _a : "",
        functionType: optional(candid.function_type, snsFunctionType),
    };
}
function snsFunctionType(candid) {
    if ("NativeNervousSystemFunction" in candid) {
        return { kind: "native_nervous_system_function" };
    }
    else {
        return { kind: "generic_nervous_system_function" };
    }
}
//# sourceMappingURL=chatMappers.js.map