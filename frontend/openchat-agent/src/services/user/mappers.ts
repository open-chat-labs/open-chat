import type {
    ApiEventsResponse,
    ApiSendMessageResponse,
    ApiBlockUserResponse,
    ApiUnblockUserResponse,
    ApiMarkReadResponse,
    ApiSetAvatarResponse,
    ApiDeleteMessageResponse,
    ApiUndeleteMessageResponse,
    ApiSearchDirectChatResponse,
    ApiMessageMatch,
    ApiInitialStateResponse,
    ApiUpdatesResponse,
    ApiSetBioResponse,
    ApiWithdrawCryptoResponse,
    ApiSendMessageWithTransferToGroupResponse,
    ApiPublicProfileResponse,
    ApiPinChatResponse,
    ApiUnpinChatResponse,
    ApiDirectChatSummary,
    ApiUserCanisterGroupChatSummary,
    ApiUserCanisterGroupChatSummaryUpdates,
    ApiNnsFailedCryptoTransaction,
    ApiNnsCompletedCryptoTransaction,
    ApiIcrc1FailedCryptoTransaction,
    ApiIcrc1CompletedCryptoTransaction,
    ApiIcrc1Account,
    ApiDirectChatSummaryUpdates,
    ApiDeletedDirectMessageResponse,
    ApiSetMessageReminderResponse,
    ApiCreateCommunityResponse,
    ApiGroupChatsInitial,
    ApiDirectChatsInitial,
    ApiCommunitiesInitial,
    ApiUserCanisterCommunitySummary,
    ApiUserCanisterChannelSummary,
    ApiFavouriteChatsInitial,
    ApiChat,
    ApiCommunitiesUpdates,
    ApiUserCanisterCommunitySummaryUpdates,
    ApiUserCanisterChannelSummaryUpdates,
    ApiFavouriteChatsUpdates,
    ApiGroupChatsUpdates,
    ApiDirectChatsUpdates,
    ApiManageFavouriteChatsResponse,
    ApiPinChatV2Response,
    ApiUnpinV2ChatResponse,
    ApiLeaveCommunityResponse,
    ApiDeleteCommunityResponse,
    ApiArchiveUnarchiveChatsResponse,
    ApiSendMessageWithTransferToChannelResponse,
    ApiTipMessageResponse,
    ApiSavedCryptoAccountsResponse,
    ApiSaveCryptoAccountResponse,
    ApiSubmitProposalResponse,
    ApiSwapTokensResponse,
    ApiTokenSwapStatusResponse,
    ApiApproveTransferResponse,
    ApiPinNumberSettings,
    ApiExchangeArgs,
    ApiChitEventsResponse,
    ApiChitEarned,
    ApiChitEarnedReason,
    ApiAchievement,
    ApiClaimDailyChitResponse,
    ApiReferralStatus,
    ApiReferral,
    ApiWalletConfig,
    ApiSignedDelegation,
    ApiMessageActivitySummary,
} from "./candid/idl";
import type {
    EventsResponse,
    ChatEvent,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    MarkReadResponse,
    SetAvatarResponse,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    InitialStateResponse,
    UpdatesResponse,
    DirectChatSummary,
    UserCanisterGroupChatSummary,
    UserCanisterGroupChatSummaryUpdates,
    WithdrawCryptocurrencyResponse,
    FailedCryptocurrencyWithdrawal,
    CompletedCryptocurrencyWithdrawal,
    PublicProfile,
    ArchiveChatResponse,
    MessageMatch,
    PinChatResponse,
    SearchDirectChatResponse,
    SetBioResponse,
    UnpinChatResponse,
    DirectChatSummaryUpdates,
    DeletedDirectMessageResponse,
    UpdatedEvent,
    SetMessageReminderResponse,
    CreateCommunityResponse,
    GroupChatsInitial,
    DirectChatsInitial,
    CommunitiesInitial,
    UserCanisterCommunitySummary,
    UserCanisterChannelSummary,
    FavouriteChatsInitial,
    ChatIdentifier,
    CommunitiesUpdates,
    UserCanisterCommunitySummaryUpdates,
    UserCanisterChannelSummaryUpdates,
    FavouriteChatsUpdates,
    GroupChatsUpdates,
    DirectChatsUpdates,
    DirectChatIdentifier,
    ManageFavouritesResponse,
    LeaveCommunityResponse,
    DeleteCommunityResponse,
    TipMessageResponse,
    NamedAccount,
    SaveCryptoAccountResponse,
    CandidateProposal,
    CandidateProposalAction,
    SubmitProposalResponse,
    SwapTokensResponse,
    TokenSwapStatusResponse,
    Result,
    ApproveTransferResponse,
    ExchangeTokenSwapArgs,
    ChitEventsResponse,
    ChitEarned,
    ChitEarnedReason,
    Achievement,
    ClaimDailyChitResponse,
    ReferralStatus,
    Referral,
    WalletConfig,
    Verification,
    MessageActivitySummary,
} from "openchat-shared";
import { nullMembership, CommonResponses, UnsupportedValueError } from "openchat-shared";
import {
    bytesToBigint,
    bytesToHexString,
    hexStringToBytes,
    identity,
    optional,
    optionUpdate,
} from "../../utils/mapping";
import {
    chatMetrics,
    completedCryptoTransfer,
    message,
    messageContent,
    apiOptional,
    messageEvent,
    eventsSuccessResponse,
} from "../common/chatMappers";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import { ReplicaNotUpToDateError } from "../error";
import { Principal } from "@dfinity/principal";
import type {
    ProposalToSubmit,
    ProposalToSubmitAction,
    ReportMessageResponse,
} from "./candid/types";
import type { PinNumberSettings } from "openchat-shared";
import { pinNumberFailureResponse } from "../common/pinNumberErrorMapper";
import { signedDelegation } from "../../utils/id";

export function chitEventsResponse(candid: ApiChitEventsResponse): ChitEventsResponse {
    if ("Success" in candid) {
        return {
            events: candid.Success.events.map(chitEarned),
            total: candid.Success.total,
        };
    } else {
        console.warn("chitEventsResponse failed with: ", candid);
        return {
            events: [],
            total: 0,
        };
    }
}

export function chitEarned(candid: ApiChitEarned): ChitEarned {
    return {
        amount: candid.amount,
        timestamp: candid.timestamp,
        reason: chitEarnedReason(candid.reason),
    };
}

export function chitEarnedReason(candid: ApiChitEarnedReason): ChitEarnedReason {
    if ("DailyClaim" in candid) {
        return { kind: "daily_claim" };
    }
    if ("Achievement" in candid) {
        return { kind: "achievement_unlocked", type: achievementType(candid.Achievement) };
    }
    if ("Referral" in candid) {
        return { kind: "referral", type: referralStatus(candid.Referral) };
    }
    if ("MemeContestWinner" in candid) {
        return { kind: "meme_contest_winner" };
    }
    if ("ExternalAchievement" in candid) {
        return { kind: "external_achievement_unlocked", name: candid.ExternalAchievement };
    }
    throw new UnsupportedValueError("Unexpected ApiChitEarnedReason encountered", candid);
}

export function referralStatus(candid: ApiReferralStatus): ReferralStatus {
    if ("Registered" in candid) {
        return "registered";
    }
    if ("Diamond" in candid) {
        return "diamond";
    }
    if ("UniquePerson" in candid) {
        return "unique_person";
    }
    if ("LifetimeDiamond" in candid) {
        return "lifetime_diamond";
    }
    throw new UnsupportedValueError("Unexpected ApiReferralStatus encountered", candid);
}

export function achievementType(candid: ApiAchievement): Achievement {
    if ("AppointedGroupModerator" in candid) {
        return "appointed_group_mod";
    }
    if ("DirectChats5" in candid) {
        return "direct_chat_5";
    }
    if ("ChangedTheme" in candid) {
        return "changed_theme";
    }
    if ("ChosenAsGroupModerator" in candid) {
        return "appointed_as_group_mod";
    }
    if ("FavouritedChat" in candid) {
        return "favourited_chat";
    }
    if ("AppointedGroupAdmin" in candid) {
        return "appointed_group_admin";
    }
    if ("HadMessageReactedTo" in candid) {
        return "received_reaction";
    }
    if ("VotedOnPoll" in candid) {
        return "voted_on_poll";
    }
    if ("ChosenAsGroupAdmin" in candid) {
        return "appointed_as_group_admin";
    }
    if ("OwnGroupWithOneHundredDiamondMembers" in candid) {
        return "owned_group_with_100_diamond_members";
    }
    if ("SetCommunityDisplayName" in candid) {
        return "set_community_display_name";
    }
    if ("AppointedGroupOwner" in candid) {
        return "appointed_group_owner";
    }
    if ("OwnGroupWithTenDiamondMembers" in candid) {
        return "owned_group_with_10_diamond_members";
    }
    if ("JoinedGatedGroupOrCommunity" in candid) {
        return "joined_gated_group_or_community";
    }
    if ("StartedCall" in candid) {
        return "started_call";
    }
    if ("ChosenAsGroupOwner" in candid) {
        return "appointed_as_group_owner";
    }
    if ("TippedMessage" in candid) {
        return "tipped_message";
    }
    if ("SentGiphy" in candid) {
        return "sent_giphy";
    }
    if ("SetCommunityAccessGate" in candid) {
        return "set_community_access_gate";
    }
    if ("HadMessageTipped" in candid) {
        return "had_message_tipped";
    }
    if ("SwappedFromWallet" in candid) {
        return "swapped_from_wallet";
    }
    if ("EditedMessage" in candid) {
        return "edited_message";
    }
    if ("ReactedToMessage" in candid) {
        return "reacted_to_message";
    }
    if ("AcceptedP2PSwapOffer" in candid) {
        return "accepted_swap_offer";
    }
    if ("JoinedCall" in candid) {
        return "joined_call";
    }
    if ("SentImage" in candid) {
        return "sent_image";
    }
    if ("EnabledDisappearingMessages" in candid) {
        return "enabled_disappearing_messages";
    }
    if ("ForwardedMessage" in candid) {
        return "forwarded_message";
    }
    if ("SentPrize" in candid) {
        return "sent_prize";
    }
    if ("FollowedThread" in candid) {
        return "followed_thread";
    }
    if ("SentReminder" in candid) {
        return "sent_reminder";
    }
    if ("ProvedUniquePersonhood" in candid) {
        return "proved_unique_personhood";
    }
    if ("DeletedMessage" in candid) {
        return "deleted_message";
    }
    if ("SentText" in candid) {
        return "sent_text";
    }
    if ("OwnGroupWithOneThousandDiamondMembers" in candid) {
        return "owned_group_with_1000_diamond_members";
    }
    if ("SentP2PSwapOffer" in candid) {
        return "sent_swap_offer";
    }
    if ("QuoteReplied" in candid) {
        return "quote_replied";
    }
    if ("OwnGroupWithOneDiamondMember" in candid) {
        return "owned_group_with_1_diamond_member";
    }
    if ("SentCrypto" in candid) {
        return "sent_crypto";
    }
    if ("PinnedMessage" in candid) {
        return "pinned_message";
    }
    if ("ReceivedCrypto" in candid) {
        return "received_crypto";
    }
    if ("TranslationAccepted" in candid) {
        return "translation_accepted";
    }
    if ("RepliedInThread" in candid) {
        return "replied_in_thread";
    }
    if ("DirectChats10" in candid) {
        return "direct_chats_10";
    }
    if ("DirectChats20" in candid) {
        return "direct_chats_20";
    }
    if ("SetGroupAccessGate" in candid) {
        return "set_group_access_gate";
    }
    if ("SentFile" in candid) {
        return "sent_file";
    }
    if ("SentMeme" in candid) {
        return "sent_meme";
    }
    if ("SentPoll" in candid) {
        return "sent_poll";
    }
    if ("SentAudio" in candid) {
        return "sent_audio";
    }
    if ("SuggestedTranslation" in candid) {
        return "suggested_translation";
    }
    if ("SentVideo" in candid) {
        return "sent_video";
    }
    if ("JoinedCommunity" in candid) {
        return "joined_community";
    }
    if ("JoinedGroup" in candid) {
        return "joined_group";
    }
    if ("Streak14" in candid) {
        return "streak_14";
    }
    if ("Streak30" in candid) {
        return "streak_30";
    }
    if ("UpgradedToDiamond" in candid) {
        return "upgraded_to_diamond";
    }
    if ("ReceivedDirectMessage" in candid) {
        return "received_direct_message";
    }
    if ("SetDisplayName" in candid) {
        return "set_display_name";
    }
    if ("SetBio" in candid) {
        return "set_bio";
    }
    if ("Streak3" in candid) {
        return "streak_3";
    }
    if ("Streak7" in candid) {
        return "streak_7";
    }
    if ("Streak100" in candid) {
        return "streak_100";
    }
    if ("Streak365" in candid) {
        return "streak_365";
    }
    if ("UpgradedToGoldDiamond" in candid) {
        return "upgrade_to_gold_diamond";
    }
    if ("SentDirectMessage" in candid) {
        return "sent_direct_message";
    }
    if ("SetAvatar" in candid) {
        return "set_avatar";
    }
    if ("Referred1stUser" in candid) {
        return "referred_1st_user";
    }
    if ("Referred3rdUser" in candid) {
        return "referred_3rd_user";
    }
    if ("Referred10thUser" in candid) {
        return "referred_10th_user";
    }
    if ("Referred20thUser" in candid) {
        return "referred_20th_user";
    }
    if ("Referred50thUser" in candid) {
        return "referred_50th_user";
    }
    throw new UnsupportedValueError("Unexpected ApiAchievement received", candid);
}

export function saveCryptoAccountResponse(
    candid: ApiSaveCryptoAccountResponse,
): SaveCryptoAccountResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    } else if ("NameTaken" in candid) {
        return { kind: "name_taken" };
    } else {
        console.warn("saveCryptoAccountResponse failed with: ", candid);
        return CommonResponses.failure();
    }
}

export function savedCryptoAccountsResponse(
    candid: ApiSavedCryptoAccountsResponse,
): NamedAccount[] {
    if ("Success" in candid) {
        return candid.Success;
    }
    return [];
}

export function tipMessageResponse(candid: ApiTipMessageResponse): TipMessageResponse {
    if ("Success" in candid || "Retrying" in candid) {
        return CommonResponses.success();
    }

    if (
        "PinRequired" in candid ||
        "PinIncorrect" in candid ||
        "TooManyFailedPinAttempts" in candid
    ) {
        return pinNumberFailureResponse(candid);
    }

    console.warn("tipMessage failed with: ", candid);
    return CommonResponses.failure();
}

export function publicProfileResponse(candid: ApiPublicProfileResponse): PublicProfile {
    const profile = candid.Success;
    return {
        username: profile.username,
        displayName: optional(profile.display_name, identity),
        avatarId: optional(profile.avatar_id, identity),
        bio: profile.bio,
        isPremium: profile.is_premium,
        phoneIsVerified: profile.phone_is_verified,
        created: profile.created,
    };
}

export function setBioResponse(candid: ApiSetBioResponse): SetBioResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("TooLong" in candid) {
        return "bio_too_long";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    throw new UnsupportedValueError(`Unexpected ApiSetBioResponse type received`, candid);
}

export function searchDirectChatResponse(
    candid: ApiSearchDirectChatResponse,
    chatId: DirectChatIdentifier,
): SearchDirectChatResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map((m) => messageMatch(m, chatId)),
        };
    }
    if ("TermTooShort" in candid || "TermTooLong" in candid || "InvalidTerm" in candid) {
        return {
            kind: "term_invalid",
        };
    }
    if ("ChatNotFound" in candid) {
        return {
            kind: "chat_not_found",
        };
    }
    throw new UnsupportedValueError(
        "Unknown UserIndex.ApiSearchMessagesResponse type received",
        candid,
    );
}

export function messageMatch(candid: ApiMessageMatch, chatId: ChatIdentifier): MessageMatch {
    const sender = candid.sender.toString();
    return {
        chatId,
        messageIndex: candid.message_index,
        content: messageContent(candid.content, sender),
        sender,
        score: candid.score,
    };
}

export function deleteMessageResponse(candid: ApiDeleteMessageResponse): DeleteMessageResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("Unexpected ApiDeleteMessageResponse type received", candid);
        return "failure";
    }
}

export function undeleteMessageResponse(
    candid: ApiUndeleteMessageResponse,
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
        console.warn("Unexpected ApiUndeleteMessageResponse type received", candid);
        return CommonResponses.failure();
    }
}

export function setAvatarResponse(candid: ApiSetAvatarResponse): SetAvatarResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AvatarTooBig" in candid) {
        return "avatar_too_big";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiSetAvatarResponse type received", candid);
}

export function markReadResponse(_candid: ApiMarkReadResponse): MarkReadResponse {
    // currently only one success type which makes mapping this a bit redundant but I'll
    // leave the pattern in place in case we have other return types in the future.
    return "success";
}

export function blockResponse(_candid: ApiBlockUserResponse): BlockUserResponse {
    return "success";
}

export function unblockResponse(_candid: ApiUnblockUserResponse): UnblockUserResponse {
    return "success";
}

export function pinChatResponse(
    candid: ApiPinChatResponse | ApiPinChatV2Response,
): PinChatResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("Unexpected ApiPinChatResponse type received", candid);
        return "failure";
    }
}

export function unpinChatResponse(
    candid: ApiUnpinChatResponse | ApiUnpinV2ChatResponse,
): UnpinChatResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("Unexpected ApiUnpinChatResponse type received", candid);
        return "failure";
    }
}

export function archiveChatResponse(candid: ApiArchiveUnarchiveChatsResponse): ArchiveChatResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("Archive/Unarchive chat failed with ", candid);
        return "failure";
    }
}

export function sendMessageWithTransferToChannelResponse(
    candid: ApiSendMessageWithTransferToChannelResponse,
    sender: string,
    recipient: string | undefined,
): SendMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "transfer_success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
            expiresAt: optional(candid.Success.expires_at, Number),
            transfer: completedCryptoTransfer(candid.Success.transfer, sender, recipient ?? ""),
        };
    }

    if (
        "PinRequired" in candid ||
        "PinIncorrect" in candid ||
        "TooManyFailedPinAttempts" in candid
    ) {
        return pinNumberFailureResponse(candid);
    }

    console.warn("SendMessageWithTransferToChannel failed with", candid);
    return CommonResponses.failure();
}

export function sendMessageWithTransferToGroupResponse(
    candid: ApiSendMessageWithTransferToGroupResponse,
    sender: string,
    recipient: string | undefined,
): SendMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "transfer_success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
            expiresAt: optional(candid.Success.expires_at, Number),
            transfer: completedCryptoTransfer(candid.Success.transfer, sender, recipient ?? ""),
        };
    }

    if (
        "PinRequired" in candid ||
        "PinIncorrect" in candid ||
        "TooManyFailedPinAttempts" in candid
    ) {
        return pinNumberFailureResponse(candid);
    }

    console.warn("SendMessageWithTransferToGroup failed with", candid);
    return CommonResponses.failure();
}

export function sendMessageResponse(
    candid: ApiSendMessageResponse,
    sender: string,
    recipient: string,
): SendMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
            expiresAt: optional(candid.Success.expires_at, Number),
        };
    }
    if ("TransferSuccessV2" in candid) {
        return {
            kind: "transfer_success",
            timestamp: candid.TransferSuccessV2.timestamp,
            messageIndex: candid.TransferSuccessV2.message_index,
            eventIndex: candid.TransferSuccessV2.event_index,
            transfer: completedCryptoTransfer(candid.TransferSuccessV2.transfer, sender, recipient),
            expiresAt: optional(candid.TransferSuccessV2.expires_at, Number),
        };
    }
    if (
        "PinRequired" in candid ||
        "PinIncorrect" in candid ||
        "TooManyFailedPinAttempts" in candid
    ) {
        return pinNumberFailureResponse(candid);
    }
    if ("TransferCannotBeZero" in candid) {
        return { kind: "transfer_cannot_be_zero" };
    }
    if ("TransferCannotBeToSelf" in candid) {
        return { kind: "transfer_cannot_be_to_self" };
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
    if ("TransferFailed" in candid || "TransferCannotBeToSelf" in candid) {
        return { kind: "transfer_failed" };
    }
    if ("TransferLimitExceeded" in candid) {
        return { kind: "transfer_limit_exceeded" };
    }
    if ("InvalidPoll" in candid) {
        return { kind: "invalid_poll" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    if ("P2PSwapSetUpFailed" in candid) {
        return { kind: "p2p_swap_setup_failed", text: candid.P2PSwapSetUpFailed };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("DuplicateMessageId" in candid) {
        return { kind: "duplicate_message_id" };
    }

    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function createCommunityResponse(
    candid: ApiCreateCommunityResponse,
): CreateCommunityResponse {
    if ("Success" in candid) {
        return { kind: "success", id: candid.Success.community_id.toString() };
    } else if ("NameTaken" in candid) {
        return { kind: "name_taken" };
    } else {
        console.warn("CreateCommunit failed with", candid);
        return CommonResponses.failure();
    }
}

export async function getEventsResponse(
    principal: Principal,
    candid: ApiEventsResponse,
    chatId: DirectChatIdentifier,
    latestKnownUpdatePreRequest: bigint | undefined,
): Promise<EventsResponse<ChatEvent>> {
    if ("Success" in candid) {
        await ensureReplicaIsUpToDate(principal, chatId, candid.Success.chat_last_updated);

        return eventsSuccessResponse(candid.Success);
    }
    if ("ChatNotFound" in candid || "ThreadMessageNotFound" in candid) {
        return "events_failed";
    }
    if ("ReplicaNotUpToDateV2" in candid) {
        throw ReplicaNotUpToDateError.byTimestamp(
            candid.ReplicaNotUpToDateV2,
            latestKnownUpdatePreRequest ?? BigInt(-1),
            false,
        );
    }

    throw new UnsupportedValueError("Unexpected ApiEventsResponse type received", candid);
}

function groupChatsInitial(candid: ApiGroupChatsInitial): GroupChatsInitial {
    return {
        summaries: candid.summaries.map(userCanisterGroupSummary),
        pinned: candid.pinned.map((c) => ({ kind: "group_chat", groupId: c.toString() })),
    };
}

function directChatsInitial(candid: ApiDirectChatsInitial): DirectChatsInitial {
    return {
        summaries: candid.summaries.map(directChatSummary),
        pinned: candid.pinned.map((c) => ({ kind: "direct_chat", userId: c.toString() })),
    };
}

function userCanisterChannelSummary(
    candid: ApiUserCanisterChannelSummary,
    communityId: string,
): UserCanisterChannelSummary {
    return {
        id: {
            kind: "channel",
            communityId: communityId,
            channelId: candid.channel_id.toString(),
        },
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        dateReadPinned: optional(candid.date_read_pinned, identity),
        threadsRead: candid.threads_read.reduce(
            (curr, next) => {
                curr[next[0]] = next[1];
                return curr;
            },
            {} as Record<number, number>,
        ),
        archived: candid.archived,
    };
}

function userCanisterCommunitySummary(
    candid: ApiUserCanisterCommunitySummary,
): UserCanisterCommunitySummary {
    const communityId = candid.community_id.toString();
    return {
        id: { kind: "community", communityId },
        index: candid.index,
        channels: candid.channels.map((c) => userCanisterChannelSummary(c, communityId)),
        pinned: candid.pinned.map((p) => ({
            kind: "channel",
            communityId,
            channelId: p.toString(),
        })),
        archived: candid.archived,
        localUserIndex: candid.local_user_index_canister_id.toString(),
    };
}

function communitiesInitial(candid: ApiCommunitiesInitial): CommunitiesInitial {
    return {
        summaries: candid.summaries.map(userCanisterCommunitySummary),
    };
}

function chatIndentifier(candid: ApiChat): ChatIdentifier {
    if ("Group" in candid) {
        return { kind: "group_chat", groupId: candid.Group.toString() };
    }
    if ("Direct" in candid) {
        return { kind: "direct_chat", userId: candid.Direct.toString() };
    }
    if ("Channel" in candid) {
        return {
            kind: "channel",
            communityId: candid.Channel[0].toString(),
            channelId: candid.Channel[1].toString(),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiChat type received", candid);
}

function favouriteChatsInitial(candid: ApiFavouriteChatsInitial): FavouriteChatsInitial {
    return {
        chats: candid.chats.map(chatIndentifier),
        pinned: candid.pinned.map(chatIndentifier),
    };
}

export function initialStateResponse(candid: ApiInitialStateResponse): InitialStateResponse {
    if ("Success" in candid) {
        const result = candid.Success;
        return {
            blockedUsers: result.blocked_users.map((u) => u.toString()),
            communities: communitiesInitial(candid.Success.communities),
            groupChats: groupChatsInitial(candid.Success.group_chats),
            favouriteChats: favouriteChatsInitial(candid.Success.favourite_chats),
            avatarId: optional(result.avatar_id, identity),
            directChats: directChatsInitial(candid.Success.direct_chats),
            timestamp: result.timestamp,
            suspended: result.suspended,
            pinNumberSettings: optional(result.pin_number_settings, pinNumberSettings),
            localUserIndex: result.local_user_index_canister_id.toString(),
            achievementsLastSeen: result.achievements_last_seen,
            achievements: result.achievements.map(chitEarned),
            streakEnds: result.streak_ends,
            streak: result.streak,
            nextDailyClaim: result.next_daily_claim,
            chitBalance: result.chit_balance,
            totalChitEarned: result.total_chit_earned,
            referrals: result.referrals.map(referral),
            walletConfig: walletConfig(result.wallet_config),
            messageActivitySummary: messageActivitySummary(result.message_activity_summary),
        };
    }
    throw new Error(`Unexpected ApiUpdatesResponse type received: ${candid}`);
}

function messageActivitySummary(candid: ApiMessageActivitySummary): MessageActivitySummary {
    return {
        readUpTo: candid.read_up_to,
        latestEventTimestamp: candid.latest_event_timestamp,
        unreadCount: candid.unread_count,
    };
}

function referral(candid: ApiReferral): Referral {
    return {
        userId: candid.user_id.toString(),
        status: referralStatus(candid.status),
    };
}

export function apiWalletConfig(domain: WalletConfig): ApiWalletConfig {
    switch (domain.kind) {
        case "auto_wallet": {
            return { Auto: { min_cents_visible: Math.round(domain.minDollarValue * 100) } };
        }
        case "manual_wallet": {
            return { Manual: { tokens: [...domain.tokens].map((t) => Principal.fromText(t)) } };
        }
    }
    throw new UnsupportedValueError("Unexpected WalletConfig value received", domain);
}

function walletConfig(candid: ApiWalletConfig): WalletConfig {
    if ("Auto" in candid) {
        return {
            kind: "auto_wallet",
            minDollarValue: candid.Auto.min_cents_visible / 100,
        };
    }
    if ("Manual" in candid) {
        return {
            kind: "manual_wallet",
            tokens: new Set<string>(candid.Manual.tokens.map((p) => p.toString())),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiWalletConfig value received", candid);
}

function pinNumberSettings(candid: ApiPinNumberSettings): PinNumberSettings {
    return {
        length: candid.length,
        attemptsBlockedUntil: optional(candid.attempts_blocked_until, identity),
    };
}

export function userCanisterChannelSummaryUpdates(
    candid: ApiUserCanisterChannelSummaryUpdates,
    communityId: string,
): UserCanisterChannelSummaryUpdates {
    return {
        id: { kind: "channel", communityId, channelId: candid.channel_id.toString() },
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        dateReadPinned: optional(candid.date_read_pinned, identity),
        threadsRead: candid.threads_read.reduce(
            (curr, next) => {
                curr[next[0]] = next[1];
                return curr;
            },
            {} as Record<number, number>,
        ),
        archived: optional(candid.archived, identity),
    };
}

export function userCanisterCommunitySummaryUpdates(
    candid: ApiUserCanisterCommunitySummaryUpdates,
): UserCanisterCommunitySummaryUpdates {
    const communityId = candid.community_id.toString();
    return {
        id: { kind: "community", communityId },
        index: optional(candid.index, identity),
        channels: candid.channels.map((c) => userCanisterChannelSummaryUpdates(c, communityId)),
        pinned: optional(candid.pinned, (p) =>
            p.map((p) => ({ kind: "channel", communityId, channelId: p.toString() })),
        ),
        archived: optional(candid.archived, identity),
    };
}

export function communitiesUpdates(candid: ApiCommunitiesUpdates): CommunitiesUpdates {
    return {
        added: candid.added.map(userCanisterCommunitySummary),
        updated: candid.updated.map(userCanisterCommunitySummaryUpdates),
        removed: candid.removed.map((c) => c.toString()),
    };
}

export function favouriteChatsUpdates(candid: ApiFavouriteChatsUpdates): FavouriteChatsUpdates {
    return {
        chats: optional(candid.chats, (c) => c.map(chatIndentifier)),
        pinned: optional(candid.pinned, (c) => c.map(chatIndentifier)),
    };
}

export function groupChatsUpdates(candid: ApiGroupChatsUpdates): GroupChatsUpdates {
    return {
        added: candid.added.map(userCanisterGroupSummary),
        pinned: optional(candid.pinned, (p) =>
            p.map((p) => ({ kind: "group_chat", groupId: p.toString() })),
        ),
        updated: candid.updated.map(userCanisterGroupSummaryUpdates),
        removed: candid.removed.map((c) => c.toString()),
    };
}

export function directChatsUpdates(candid: ApiDirectChatsUpdates): DirectChatsUpdates {
    return {
        added: candid.added.map(directChatSummary),
        pinned: optional(candid.pinned, (p) =>
            p.map((p) => ({ kind: "direct_chat", userId: p.toString() })),
        ),
        updated: candid.updated.map(directChatSummaryUpdates),
    };
}

export function manageFavouritesResponse(
    candid: ApiManageFavouriteChatsResponse,
): ManageFavouritesResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("ApiManageFavouriteChatsResponse failure response", candid);
        return "failure";
    }
}

export function getUpdatesResponse(candid: ApiUpdatesResponse): UpdatesResponse {
    if ("Success" in candid) {
        const result = candid.Success;
        return {
            kind: "success",
            timestamp: result.timestamp,
            blockedUsers: optional(result.blocked_users, (b) => b.map((u) => u.toString())),
            communities: communitiesUpdates(result.communities),
            favouriteChats: favouriteChatsUpdates(result.favourite_chats),
            groupChats: groupChatsUpdates(result.group_chats),
            avatarId: optionUpdate(result.avatar_id, identity),
            directChats: directChatsUpdates(result.direct_chats),
            suspended: optional(result.suspended, identity),
            pinNumberSettings: optionUpdate(result.pin_number_settings, pinNumberSettings),
            achievementsLastSeen: optional(result.achievements_last_seen, identity),
            achievements: result.achievements.map(chitEarned),
            streakEnds: result.streak_ends,
            streak: result.streak,
            nextDailyClaim: result.next_daily_claim,
            chitBalance: result.chit_balance,
            totalChitEarned: result.total_chit_earned,
            referrals: result.referrals.map(referral),
            walletConfig: optional(result.wallet_config, walletConfig),
            messageActivitySummary: optional(
                result.message_activity_summary,
                messageActivitySummary,
            ),
        };
    }

    if ("SuccessNoUpdates" in candid) {
        return {
            kind: "success_no_updates",
        };
    }

    throw new Error(`Unexpected ApiUpdatesResponse type received: ${candid}`);
}

function userCanisterGroupSummary(
    summary: ApiUserCanisterGroupChatSummary,
): UserCanisterGroupChatSummary {
    return {
        id: { kind: "group_chat", groupId: summary.chat_id.toString() },
        readByMeUpTo: optional(summary.read_by_me_up_to, identity),
        threadsRead: summary.threads_read.reduce(
            (curr, next) => {
                curr[next[0]] = next[1];
                return curr;
            },
            {} as Record<number, number>,
        ),
        archived: summary.archived,
        dateReadPinned: optional(summary.date_read_pinned, identity),
        localUserIndex: summary.local_user_index_canister_id.toString(),
    };
}

function userCanisterGroupSummaryUpdates(
    summary: ApiUserCanisterGroupChatSummaryUpdates,
): UserCanisterGroupChatSummaryUpdates {
    return {
        id: { kind: "group_chat", groupId: summary.chat_id.toString() },
        readByMeUpTo: optional(summary.read_by_me_up_to, identity),
        threadsRead: summary.threads_read.reduce(
            (curr, next) => {
                curr[next[0]] = next[1];
                return curr;
            },
            {} as Record<number, number>,
        ),
        archived: optional(summary.archived, identity),
        dateReadPinned: optional(summary.date_read_pinned, identity),
    };
}

function directChatSummaryUpdates(candid: ApiDirectChatSummaryUpdates): DirectChatSummaryUpdates {
    return {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId: candid.chat_id.toString() },
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        readByThemUpTo: optional(candid.read_by_them_up_to, identity),
        lastUpdated: candid.last_updated,
        latestMessage: optional(candid.latest_message, messageEvent),
        latestEventIndex: optional(candid.latest_event_index, identity),
        latestMessageIndex: optional(candid.latest_message_index, identity),
        notificationsMuted: optional(candid.notifications_muted, identity),
        updatedEvents: candid.updated_events.map(updatedEvent),
        eventsTTL: optionUpdate(candid.events_ttl, identity),
        eventsTtlLastUpdated: optional(candid.events_ttl_last_updated, identity),
        metrics: optional(candid.metrics, chatMetrics),
        myMetrics: optional(candid.my_metrics, chatMetrics),
        archived: optional(candid.archived, identity),
        videoCallInProgress: optionUpdate(candid.video_call_in_progress, (v) => v.message_index),
    };
}

function updatedEvent([eventIndex, timestamp]: [number, bigint]): UpdatedEvent {
    return {
        eventIndex,
        timestamp,
    };
}

function directChatSummary(candid: ApiDirectChatSummary): DirectChatSummary {
    return {
        id: { kind: "direct_chat", userId: candid.them.toString() },
        kind: "direct_chat",
        latestMessage: messageEvent(candid.latest_message),
        them: { kind: "direct_chat", userId: candid.them.toString() },
        latestEventIndex: candid.latest_event_index,
        latestMessageIndex: candid.latest_message_index,
        lastUpdated: candid.last_updated,
        readByThemUpTo: optional(candid.read_by_them_up_to, identity),
        dateCreated: candid.date_created,
        eventsTTL: undefined,
        eventsTtlLastUpdated: BigInt(0),
        metrics: chatMetrics(candid.metrics),
        videoCallInProgress: optional(candid.video_call_in_progress, (v) => v.message_index),
        membership: {
            ...nullMembership(),
            role: "owner",
            myMetrics: chatMetrics(candid.my_metrics),
            notificationsMuted: candid.notifications_muted,
            readByMeUpTo: optional(candid.read_by_me_up_to, identity),
            archived: candid.archived,
            rulesAccepted: false,
        },
    };
}

function failedNnsCryptoWithdrawal(
    candid: ApiNnsFailedCryptoTransaction,
): FailedCryptocurrencyWithdrawal {
    return {
        kind: "failed",
        ledger: candid.ledger.toString(),
        to: "Account" in candid.to ? bytesToHexString(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo,
        errorMessage: candid.error_message,
    };
}

function failedIcrc1CryptoWithdrawal(
    candid: ApiIcrc1FailedCryptoTransaction,
): FailedCryptocurrencyWithdrawal {
    return {
        kind: "failed",
        ledger: candid.ledger.toString(),
        to: "Account" in candid.to ? formatIcrc1Account(candid.to.Account) : "",
        amountE8s: candid.amount,
        feeE8s: candid.fee,
        memo: optional(candid.memo, bytesToBigint) ?? BigInt(0),
        errorMessage: candid.error_message,
    };
}

function completedNnsCryptoWithdrawal(
    candid: ApiNnsCompletedCryptoTransaction,
): CompletedCryptocurrencyWithdrawal {
    return {
        kind: "completed",
        ledger: candid.ledger.toString(),
        to: "Account" in candid.to ? bytesToHexString(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo,
        blockIndex: candid.block_index,
    };
}

function completedIcrc1CryptoWithdrawal(
    candid: ApiIcrc1CompletedCryptoTransaction,
): CompletedCryptocurrencyWithdrawal {
    return {
        kind: "completed",
        ledger: candid.ledger.toString(),
        to: "Account" in candid.to ? formatIcrc1Account(candid.to.Account) : "",
        amountE8s: candid.amount,
        feeE8s: candid.fee,
        memo: optional(candid.memo, bytesToBigint) ?? BigInt(0),
        blockIndex: candid.block_index,
    };
}

export function withdrawCryptoResponse(
    candid: ApiWithdrawCryptoResponse,
): WithdrawCryptocurrencyResponse {
    if (
        "PinRequired" in candid ||
        "PinIncorrect" in candid ||
        "TooManyFailedPinAttempts" in candid
    ) {
        return pinNumberFailureResponse(candid);
    }
    if ("CurrencyNotSupported" in candid) {
        return { kind: "currency_not_supported" };
    }
    if ("TransactionFailed" in candid) {
        if ("NNS" in candid.TransactionFailed) {
            return failedNnsCryptoWithdrawal(candid.TransactionFailed.NNS);
        } else if ("ICRC1" in candid.TransactionFailed) {
            return failedIcrc1CryptoWithdrawal(candid.TransactionFailed.ICRC1);
        }
    }
    if ("Success" in candid) {
        if ("NNS" in candid.Success) {
            return completedNnsCryptoWithdrawal(candid.Success.NNS);
        } else if ("ICRC1" in candid.Success) {
            return completedIcrc1CryptoWithdrawal(candid.Success.ICRC1);
        }
    }

    throw new Error("Unexpected ApiWithdrawCryptocurrencyResponse type received");
}

function formatIcrc1Account(candid: ApiIcrc1Account): string {
    const owner = candid.owner.toString();
    const subaccount = optional(candid.subaccount, bytesToHexString);

    return subaccount !== undefined ? `${owner}:${subaccount}` : owner;
}

export function deletedMessageResponse(
    candid: ApiDeletedDirectMessageResponse,
): DeletedDirectMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            content: messageContent(candid.Success.content, "unknown"),
        };
    }
    if ("ChatNotFound" in candid) {
        return { kind: "chat_not_found" };
    }
    if ("NotAuthorized" in candid) {
        return { kind: "not_authorized" };
    }
    if ("MessageNotFound" in candid) {
        return { kind: "message_not_found" };
    }
    if ("MessageNotDeleted" in candid) {
        return { kind: "message_not_deleted" };
    }
    if ("MessageHardDeleted" in candid) {
        return { kind: "message_hard_deleted" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDeletedDirectMessageResponse type received",
        candid,
    );
}

export function setMessageReminderResponse(
    candid: ApiSetMessageReminderResponse,
): SetMessageReminderResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("SetMessageReminder failed with", candid);
        return "failure";
    }
}

export function leaveCommunityResponse(candid: ApiLeaveCommunityResponse): LeaveCommunityResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("LeaveCommunity failed with", candid);
        return "failure";
    }
}

export function deleteCommunityResponse(
    candid: ApiDeleteCommunityResponse,
): DeleteCommunityResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("DeleteCommunity failed with", candid);
        return "failure";
    }
}

export function proposalToSubmit(proposal: CandidateProposal): ProposalToSubmit {
    return {
        title: proposal.title,
        url: proposal.url ?? "",
        summary: proposal.summary,
        action: proposalAction(proposal.action),
    };
}

function proposalAction(action: CandidateProposalAction): ProposalToSubmitAction {
    switch (action.kind) {
        case "motion":
            return { Motion: null };
        case "transfer_sns_funds":
            return {
                TransferSnsTreasuryFunds: {
                    to: {
                        owner: Principal.fromText(action.recipient.owner),
                        subaccount: apiOptional(hexStringToBytes, action.recipient.subaccount),
                    },
                    amount: action.amount,
                    memo: [],
                    treasury: action.treasury === "ICP" ? { ICP: null } : { SNS: null },
                },
            };
        case "upgrade_sns_to_next_version":
            return { UpgradeSnsToNextVersion: null };
        case "execute_generic_nervous_system_function":
            return {
                ExecuteGenericNervousSystemFunction: {
                    function_id: action.functionId,
                    payload: action.payload,
                },
            };
    }
}

export function submitProposalResponse(candid: ApiSubmitProposalResponse): SubmitProposalResponse {
    if ("Success" in candid) {
        return { kind: "success" };
    }
    if ("Retrying" in candid) {
        return { kind: "retrying", error: candid.Retrying };
    }
    if ("TransferFailed" in candid) {
        return { kind: "transfer_failed", error: candid.TransferFailed };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error", error: candid.InternalError };
    }
    if ("GovernanceCanisterNotSupported" in candid) {
        return { kind: "governance_canister_not_supported" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("InsufficientPayment" in candid) {
        return { kind: "insufficient_payment" };
    }
    throw new UnsupportedValueError("Unexpected ApiSubmitProposalResponse type received", candid);
}

export function reportMessageResponse(candid: ReportMessageResponse): boolean {
    return "Success" in candid || "AlreadyReported" in candid;
}

export function swapTokensResponse(candid: ApiSwapTokensResponse): SwapTokensResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            amountOut: candid.Success.amount_out,
        };
    }
    if ("SwapFailed" in candid) {
        return {
            kind: "swap_failed",
        };
    }
    if ("InternalError" in candid) {
        return {
            kind: "internal_error",
            error: candid.InternalError,
        };
    }
    if (
        "PinRequired" in candid ||
        "PinIncorrect" in candid ||
        "TooManyFailedPinAttempts" in candid
    ) {
        return pinNumberFailureResponse(candid);
    }

    throw new UnsupportedValueError("Unexpected ApiSwapTokensResponse type received", candid);
}

export function tokenSwapStatusResponse(
    candid: ApiTokenSwapStatusResponse,
): TokenSwapStatusResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            started: candid.Success.started,
            depositAccount: optional(candid.Success.deposit_account, result),
            transfer: optional(candid.Success.transfer, result),
            notifyDex: optional(candid.Success.notify_dex, result),
            amountSwapped: optional(candid.Success.amount_swapped, resultOfResult),
            withdrawnFromDex: optional(candid.Success.withdraw_from_dex, result),
        };
    }
    if ("NotFound" in candid) {
        return {
            kind: "not_found",
        };
    }
    throw new UnsupportedValueError("Unexpected ApiTokenSwapStatusResponse type received", candid);
}

function result<T>(candid: { Ok: T } | { Err: string }): Result<T> {
    if ("Ok" in candid) {
        return {
            kind: "ok",
            value: candid.Ok,
        };
    }
    return {
        kind: "error",
        error: candid.Err,
    };
}

function resultOfResult<T>(
    candid: { Ok: { Ok: T } | { Err: string } } | { Err: string },
): Result<Result<T>> {
    if ("Ok" in candid) {
        return {
            kind: "ok",
            value: result(candid.Ok),
        };
    }
    return {
        kind: "error",
        error: candid.Err,
    };
}

export function approveTransferResponse(
    candid: ApiApproveTransferResponse,
): ApproveTransferResponse {
    if ("Success" in candid) {
        return { kind: "success" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error", error: candid.InternalError };
    }
    if ("ApproveError" in candid) {
        return { kind: "approve_error", error: JSON.stringify(candid.ApproveError) };
    }
    if (
        "PinRequired" in candid ||
        "PinIncorrect" in candid ||
        "TooManyFailedPinAttempts" in candid
    ) {
        return pinNumberFailureResponse(candid);
    }

    throw new UnsupportedValueError("Unexpected ApiApproveTransferResponse type received", candid);
}

export function apiExchangeArgs(
    args: ExchangeTokenSwapArgs,
): { Sonic: ApiExchangeArgs } | { ICPSwap: ApiExchangeArgs } | { KongSwap: ApiExchangeArgs } {
    const value = {
        swap_canister_id: Principal.fromText(args.swapCanisterId),
        zero_for_one: args.zeroForOne,
    };
    if (args.dex === "icpswap") {
        return {
            ICPSwap: value,
        };
    } else if (args.dex === "sonic") {
        return {
            Sonic: value,
        };
    } else if (args.dex === "kongswap") {
        return {
            KongSwap: value,
        };
    }
    throw new UnsupportedValueError("Unexpected dex", args.dex);
}

export function claimDailyChitResponse(candid: ApiClaimDailyChitResponse): ClaimDailyChitResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            streak: candid.Success.streak,
            chitBalance: candid.Success.chit_balance,
            chitEarned: candid.Success.chit_earned,
            nextDailyChitClaim: candid.Success.next_claim,
        };
    }
    if ("AlreadyClaimed" in candid) {
        return {
            kind: "already_claimed",
            nextDailyChitClaim: candid.AlreadyClaimed,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiClaimDailyChitResponse type received", candid);
}

export function apiVerification(
    domain: Verification,
): { PIN: string } | { Delegation: ApiSignedDelegation } | { None: null } {
    switch (domain.kind) {
        case "delegation_verification":
            return { Delegation: signedDelegation(domain.delegation) };
        case "no_verification":
            return { None: null };
        case "pin_verification":
            return { PIN: domain.pin };
    }
}
