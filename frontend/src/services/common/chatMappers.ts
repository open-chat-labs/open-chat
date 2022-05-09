import { Principal } from "@dfinity/principal";
import DRange from "drange";
import type { ApiPublicGroupSummary, ApiPublicSummaryResponse } from "../group/candid/idl";
import type {
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
    ICPTransfer,
    CyclesTransfer,
    GroupChatSummary,
    PollContent,
    PollVotes,
    TotalPollVotes,
    PollConfig,
    RegisterPollVoteResponse,
    GroupPermissions,
    PermissionRole,
    PendingICPWithdrawal,
    GiphyContent,
    GiphyImage,
} from "../../domain/chat/chat";
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
    ApiCryptocurrencyContentV2,
    ApiCryptocurrencyTransfer,
    ApiCryptocurrencyTransferV2,
    ApiICPTransfer,
    ApiCyclesTransfer,
    ApiMessageIndexRange,
    ApiUser,
    ApiICP,
    ApiPollContent,
    ApiPollVotes,
    ApiTotalPollVotes,
    ApiPollConfig,
    ApiRegisterPollVoteResponse as ApiRegisterUserPollVoteResponse,
    ApiGroupPermissions,
    ApiPermissionRole,
    ApiPendingCryptocurrencyWithdrawalV2,
    ApiGiphyContent,
    ApiGiphyImageVariant,
} from "../user/candid/idl";
import type { ApiRegisterPollVoteResponse as ApiRegisterGroupPollVoteResponse } from "../group/candid/idl";
import { emptyChatMetrics } from "../../domain/chat/chat.utils";

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
    if ("Cryptocurrency" in candid) {
        return cryptoContent(candid.Cryptocurrency);
    }
    if ("CryptocurrencyV2" in candid) {
        return cryptoContentV2(candid.CryptocurrencyV2);
    }
    if ("Poll" in candid) {
        return pollContent(candid.Poll);
    }
    if ("Giphy" in candid) {
        return giphyContent(candid.Giphy);
    }
    throw new UnsupportedValueError("Unexpected ApiMessageContent type received", candid);
}

export function apiUser(domain: User): ApiUser {
    return {
        user_id: Principal.fromText(domain.userId),
        username: domain.username,
    };
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
        user: candid.user,
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

function cryptoContentV2(candid: ApiCryptocurrencyContentV2): CryptocurrencyContent {
    return {
        kind: "crypto_content",
        caption: optional(candid.caption, identity),
        transfer: cryptoTransferV2(candid.transfer),
    };
}

function cryptoTransfer(candid: ApiCryptocurrencyTransfer): CryptocurrencyTransfer {
    if ("ICP" in candid) {
        return icpTransfer(candid.ICP);
    }
    if ("Cycles" in candid) {
        return cyclesTransfer(candid.Cycles);
    }
    throw new UnsupportedValueError("Unexpected ApiCryptocurrencyTransfer type received", candid);
}

function cryptoTransferV2(candid: ApiCryptocurrencyTransferV2): CryptocurrencyTransfer {
    if ("Pending" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "pending_icp_transfer",
            recipient: candid.Pending.recipient.toString(),
            amountE8s: candid.Pending.amount.e8s,
            feeE8s: optional(candid.Pending.fee, (f) => f.e8s),
            memo: optional(candid.Pending.memo, identity),
        };
    }
    if ("Completed" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "completed_icp_transfer",
            recipient: candid.Completed.recipient.toString(),
            sender: candid.Completed.sender.toString(),
            amountE8s: candid.Completed.amount.e8s,
            feeE8s: candid.Completed.fee.e8s,
            memo: candid.Completed.memo,
            blockIndex: candid.Completed.block_index,
            transactionHash: bytesToHexString(candid.Completed.transaction_hash),
        };
    }
    if ("Failed" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "failed_icp_transfer",
            recipient: candid.Failed.recipient.toString(),
            amountE8s: candid.Failed.amount.e8s,
            feeE8s: candid.Failed.fee.e8s,
            memo: candid.Failed.memo,
            errorMessage: candid.Failed.error_message,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiCryptocurrencyTransferV2 type received", candid);
}

function cyclesTransfer(candid: ApiCyclesTransfer): CyclesTransfer {
    if ("Pending" in candid) {
        return {
            transferKind: "cycles_transfer",
            kind: "pending_cycles_transfer",
            recipient: candid.Pending.recipient.toString(),
            cycles: candid.Pending.cycles,
        };
    }
    if ("Completed" in candid) {
        return {
            transferKind: "cycles_transfer",
            kind: "completed_cycles_transfer",
            recipient: candid.Completed.recipient.toString(),
            sender: candid.Completed.sender.toString(),
            cycles: candid.Completed.cycles,
        };
    }
    if ("Failed" in candid) {
        return {
            transferKind: "cycles_transfer",
            kind: "failed_cycles_transfer",
            recipient: candid.Failed.recipient.toString(),
            cycles: candid.Failed.cycles,
            errorMessage: candid.Failed.error_message,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiCyclesTransfer type received", candid);
}

function icpTransfer(candid: ApiICPTransfer): ICPTransfer {
    if ("Pending" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "pending_icp_transfer",
            recipient: candid.Pending.recipient.toString(),
            amountE8s: candid.Pending.amount.e8s,
            feeE8s: optional(candid.Pending.fee, (f) => f.e8s),
            memo: optional(candid.Pending.memo, identity),
        };
    }
    if ("Completed" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "completed_icp_transfer",
            recipient: candid.Completed.recipient.toString(),
            sender: candid.Completed.sender.toString(),
            amountE8s: candid.Completed.amount.e8s,
            feeE8s: candid.Completed.fee.e8s,
            memo: candid.Completed.memo,
            blockIndex: candid.Completed.block_index,
            transactionHash: bytesToHexString(candid.Completed.transaction_hash),
        };
    }
    if ("Failed" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "failed_icp_transfer",
            recipient: candid.Failed.recipient.toString(),
            amountE8s: candid.Failed.amount.e8s,
            feeE8s: candid.Failed.fee.e8s,
            memo: candid.Failed.memo,
            errorMessage: candid.Failed.error_message,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiICPTransfer type received", candid);
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
            return { CryptocurrencyV2: apiCryptoContent(domain) };

        case "deleted_content":
            return { Deleted: apiDeletedContent(domain) };

        case "poll_content":
            return { Poll: apiPollContent(domain) };

        case "giphy_content":
            return { Giphy: apiGiphyContent(domain) };

        case "placeholder_content":
            throw new Error("Incorrectly attempting to send placeholder content to the server");
    }
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
        user: [...domain.user],
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
    return domain ? [mapper(domain)] : [];
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

export function apiCryptoContent(domain: CryptocurrencyContent): ApiCryptocurrencyContentV2 {
    return {
        caption: apiOptional(identity, domain.caption),
        transfer: apiCryptoTransfer(domain.transfer),
    };
}

function apiCryptoTransfer(domain: CryptocurrencyTransfer): ApiCryptocurrencyTransferV2 {
    if (domain.transferKind === "cycles_transfer") {
        throw new Error("Sending cycles is not supported");
    }
    if (domain.transferKind === "icp_transfer") {
        return apiICPTransfer(domain);
    }
    throw new UnsupportedValueError("Unexpected transfer kind", domain);
}

export function apiPendingICPWithdrawal(
    domain: PendingICPWithdrawal
): ApiPendingCryptocurrencyWithdrawalV2 {
    return {
        token: { InternetComputer: null },
        to: hexStringToBytes(domain.to),
        amount: apiICP(domain.amountE8s),
        fee: apiOptional(apiICP, domain.feeE8s),
        memo: apiOptional(identity, domain.memo),
    };
}

function apiICPTransfer(domain: ICPTransfer): ApiCryptocurrencyTransferV2 {
    if (domain.kind === "pending_icp_transfer") {
        return {
            Pending: {
                token: { InternetComputer: null },
                recipient: Principal.fromText(domain.recipient),
                amount: apiICP(domain.amountE8s),
                fee: apiOptional(apiICP, domain.feeE8s),
                memo: apiOptional(identity, domain.memo),
            },
        };
    }
    if (domain.kind === "completed_icp_transfer") {
        return {
            Completed: {
                token: { InternetComputer: null },
                recipient: Principal.fromText(domain.recipient),
                sender: Principal.fromText(domain.sender),
                amount: apiICP(domain.amountE8s),
                fee: apiICP(domain.feeE8s),
                memo: domain.memo,
                block_index: domain.blockIndex,
                transaction_hash: hexStringToBytes(domain.transactionHash),
            },
        };
    }
    if (domain.kind === "failed_icp_transfer") {
        return {
            Failed: {
                token: { InternetComputer: null },
                recipient: Principal.fromText(domain.recipient),
                amount: apiICP(domain.amountE8s),
                fee: apiICP(domain.feeE8s),
                memo: domain.memo,
                error_message: domain.errorMessage,
            },
        };
    }
    throw new UnsupportedValueError("Unexpected cycles transfer kind", domain);
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

export function publicGroupSummary(candid: ApiPublicGroupSummary): GroupChatSummary {
    return {
        kind: "group_chat",
        chatId: candid.chat_id.toString(),
        readByMe: new DRange(),
        latestEventIndex: candid.latest_event_index,
        latestMessage: optional(candid.latest_message, (ev) => ({
            index: ev.index,
            timestamp: ev.timestamp,
            event: message(ev.event),
        })),
        notificationsMuted: true,
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        joined: BigInt(Date.now()),
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        lastUpdated: candid.last_updated,
        participantCount: candid.participant_count,
        myRole: "previewer",
        mentions: [],
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
        ownerId: candid.owner_id.toString(),
        permissions: {
            changePermissions: "owner",
            changeRoles: "owner",
            addMembers: "owner",
            removeMembers: "owner",
            blockUsers: "owner",
            deleteMessages: "owner",
            updateGroup: "owner",
            pinMessages: "owner",
            inviteUsers: "owner",
            createPolls: "owner",
            sendMessages: "owner",
            reactToMessages: "owner",
        },
        metrics: emptyChatMetrics(),
        myMetrics: emptyChatMetrics(),
    };
}

export function publicSummaryResponse(
    candid: ApiPublicSummaryResponse
): GroupChatSummary | undefined {
    if ("Success" in candid) {
        return publicGroupSummary(candid.Success.summary);
    }
}

export function registerPollVoteResponse(
    candid: ApiRegisterUserPollVoteResponse | ApiRegisterGroupPollVoteResponse
): RegisterPollVoteResponse {
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
    throw new UnsupportedValueError("Unexpected ApiRegisterPollVoteResponse type received", candid);
}
