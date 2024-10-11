import type {
    AccountICRC1,
    Achievement as TAchievement,
    Chat as TChat,
    ChitEarned as TChitEarned,
    ChitEarnedReason as TChitEarnedReason,
    CompletedCryptoTransactionICRC1,
    CompletedCryptoTransactionNNS,
    DirectChatSummary as TDirectChatSummary,
    DirectChatSummaryUpdates as TDirectChatSummaryUpdates,
    FailedCryptoTransactionICRC1,
    FailedCryptoTransactionNNS,
    PinNumberSettings as TPinNumberSettings,
    ProposalsBotProposalToSubmit,
    ProposalsBotProposalToSubmitAction,
    ReferralStatus as TReferralStatus,
    UserApproveTransferResponse,
    UserArchiveUnarchiveChatsResponse,
    UserChannelSummary,
    UserChannelSummaryUpdates,
    UserChitEventsResponse,
    UserClaimDailyChitResponse,
    UserCommunitySummary,
    UserCommunitySummaryUpdates,
    UserCreateCommunityResponse,
    UserDeleteCommunityResponse,
    UserDeletedMessageResponse,
    UserDeleteMessagesResponse,
    UserEventsResponse,
    UserGroupChatSummary,
    UserGroupChatSummaryUpdates,
    UserInitialStateCommunitiesInitial,
    UserInitialStateDirectChatsInitial,
    UserInitialStateFavouriteChatsInitial,
    UserInitialStateGroupChatsInitial,
    UserInitialStateResponse,
    UserLeaveCommunityResponse,
    UserManageFavouriteChatsResponse,
    UserPinChatResponse,
    UserPublicProfileResponse,
    UserReferral,
    UserReportMessageResponse,
    UserSaveCryptoAccountResponse,
    UserSavedCryptoAccountsResponse,
    UserSearchMessagesResponse,
    UserSendMessageResponse,
    UserSendMessageWithTransferToChannelResponse,
    UserSendMessageWithTransferToGroupResponse,
    UserSetAvatarResponse,
    UserSetBioResponse,
    UserSetMessageReminderResponse,
    UserSetPinNumberPinNumberVerification,
    UserSubmitProposalResponse,
    UserSwapTokensExchangeArgs,
    UserSwapTokensResponse,
    UserTipMessageResponse,
    UserTokenSwapStatusResponse,
    UserUndeleteMessagesResponse,
    UserUnpinChatResponse,
    UserUpdatesCommunitiesUpdates,
    UserUpdatesDirectChatsUpdates,
    UserUpdatesFavouriteChatsUpdates,
    UserUpdatesGroupChatsUpdates,
    UserUpdatesResponse,
    UserWalletConfig,
    UserWithdrawCryptoResponse,
} from "../../typebox";
import type {
    EventsResponse,
    ChatEvent,
    SendMessageResponse,
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
    PinChatResponse,
    SearchDirectChatResponse,
    SetBioResponse,
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
} from "openchat-shared";
import { nullMembership, CommonResponses, UnsupportedValueError } from "openchat-shared";
import {
    bytesToBigint,
    bytesToHexString,
    hexStringToBytes,
    identity,
    mapOptional,
    optionUpdateV2,
    principalBytesToString,
    principalStringToBytes,
} from "../../utils/mapping";
import {
    chatMetrics,
    completedCryptoTransfer,
    message,
    messageContent,
    messageMatch,
    messageEvent,
    eventsSuccessResponse,
} from "../common/chatMappersV2";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import { ReplicaNotUpToDateError } from "../error";
import { Principal } from "@dfinity/principal";
import type { PinNumberSettings } from "openchat-shared";
import { pinNumberFailureResponseV2 } from "../common/pinNumberErrorMapper";
import { signedDelegation } from "../../utils/id";

export function chitEventsResponse(value: UserChitEventsResponse): ChitEventsResponse {
    if ("Success" in value) {
        return {
            events: value.Success.events.map(chitEarned),
            total: value.Success.total,
        };
    } else {
        console.warn("chitEventsResponse failed with: ", value);
        return {
            events: [],
            total: 0,
        };
    }
}

export function chitEarned(value: TChitEarned): ChitEarned {
    return {
        amount: value.amount,
        timestamp: value.timestamp,
        reason: chitEarnedReason(value.reason),
    };
}

export function chitEarnedReason(value: TChitEarnedReason): ChitEarnedReason {
    if (value === "DailyClaim") {
        return { kind: "daily_claim" };
    }
    if (value === "MemeContestWinner") {
        return { kind: "meme_contest_winner" };
    }
    if (typeof value === "object") {
        if ("Achievement" in value) {
            return { kind: "achievement_unlocked", type: achievementType(value.Achievement) };
        }
        if ("Referral" in value) {
            return { kind: "referral", type: referralStatus(value.Referral) };
        }
        if ("ExternalAchievement" in value) {
            return { kind: "external_achievement_unlocked", name: value.ExternalAchievement };
        }
    }

    throw new UnsupportedValueError("Unexpected ApiChitEarnedReason encountered", value);
}

export function referralStatus(value: TReferralStatus): ReferralStatus {
    if (value === "Registered") {
        return "registered";
    }
    if (value === "Diamond") {
        return "diamond";
    }
    if (value === "UniquePerson") {
        return "unique_person";
    }
    if (value === "LifetimeDiamond") {
        return "lifetime_diamond";
    }
    throw new UnsupportedValueError("Unexpected ApiReferralStatus encountered", value);
}

export function achievementType(value: TAchievement): Achievement {
    switch (value) {
        case "AppointedGroupModerator":
            return "appointed_group_mod";
        case "DirectChats5":
            return "direct_chat_5";
        case "ChangedTheme":
            return "changed_theme";
        case "ChosenAsGroupModerator":
            return "appointed_as_group_mod";
        case "FavouritedChat":
            return "favourited_chat";
        case "AppointedGroupAdmin":
            return "appointed_group_admin";
        case "HadMessageReactedTo":
            return "received_reaction";
        case "VotedOnPoll":
            return "voted_on_poll";
        case "ChosenAsGroupAdmin":
            return "appointed_as_group_admin";
        case "OwnGroupWithOneHundredDiamondMembers":
            return "owned_group_with_100_diamond_members";
        case "SetCommunityDisplayName":
            return "set_community_display_name";
        case "AppointedGroupOwner":
            return "appointed_group_owner";
        case "OwnGroupWithTenDiamondMembers":
            return "owned_group_with_10_diamond_members";
        case "JoinedGatedGroupOrCommunity":
            return "joined_gated_group_or_community";
        case "StartedCall":
            return "started_call";
        case "ChosenAsGroupOwner":
            return "appointed_as_group_owner";
        case "TippedMessage":
            return "tipped_message";
        case "SentGiphy":
            return "sent_giphy";
        case "SetCommunityAccessGate":
            return "set_community_access_gate";
        case "HadMessageTipped":
            return "had_message_tipped";
        case "SwappedFromWallet":
            return "swapped_from_wallet";
        case "EditedMessage":
            return "edited_message";
        case "ReactedToMessage":
            return "reacted_to_message";
        case "AcceptedP2PSwapOffer":
            return "accepted_swap_offer";
        case "JoinedCall":
            return "joined_call";
        case "SentImage":
            return "sent_image";
        case "EnabledDisappearingMessages":
            return "enabled_disappearing_messages";
        case "ForwardedMessage":
            return "forwarded_message";
        case "SentPrize":
            return "sent_prize";
        case "FollowedThread":
            return "followed_thread";
        case "SentReminder":
            return "sent_reminder";
        case "ProvedUniquePersonhood":
            return "proved_unique_personhood";
        case "DeletedMessage":
            return "deleted_message";
        case "SentText":
            return "sent_text";
        case "OwnGroupWithOneThousandDiamondMembers":
            return "owned_group_with_1000_diamond_members";
        case "SentP2PSwapOffer":
            return "sent_swap_offer";
        case "QuoteReplied":
            return "quote_replied";
        case "OwnGroupWithOneDiamondMember":
            return "owned_group_with_1_diamond_member";
        case "SentCrypto":
            return "sent_crypto";
        case "PinnedMessage":
            return "pinned_message";
        case "ReceivedCrypto":
            return "received_crypto";
        case "TranslationAccepted":
            return "translation_accepted";
        case "RepliedInThread":
            return "replied_in_thread";
        case "DirectChats10":
            return "direct_chats_10";
        case "DirectChats20":
            return "direct_chats_20";
        case "SetGroupAccessGate":
            return "set_group_access_gate";
        case "SentFile":
            return "sent_file";
        case "SentMeme":
            return "sent_meme";
        case "SentPoll":
            return "sent_poll";
        case "SentAudio":
            return "sent_audio";
        case "SuggestedTranslation":
            return "suggested_translation";
        case "SentVideo":
            return "sent_video";
        case "JoinedCommunity":
            return "joined_community";
        case "JoinedGroup":
            return "joined_group";
        case "Streak14":
            return "streak_14";
        case "Streak30":
            return "streak_30";
        case "UpgradedToDiamond":
            return "upgraded_to_diamond";
        case "ReceivedDirectMessage":
            return "received_direct_message";
        case "SetDisplayName":
            return "set_display_name";
        case "SetBio":
            return "set_bio";
        case "Streak3":
            return "streak_3";
        case "Streak7":
            return "streak_7";
        case "Streak100":
            return "streak_100";
        case "Streak365":
            return "streak_365";
        case "UpgradedToGoldDiamond":
            return "upgrade_to_gold_diamond";
        case "SentDirectMessage":
            return "sent_direct_message";
        case "SetAvatar":
            return "set_avatar";
        case "Referred1stUser":
            return "referred_1st_user";
        case "Referred3rdUser":
            return "referred_3rd_user";
        case "Referred10thUser":
            return "referred_10th_user";
        case "Referred20thUser":
            return "referred_20th_user";
        case "Referred50thUser":
            return "referred_50th_user";
        case "SetPin":
            return "set_pin";
        default:
            throw new UnsupportedValueError("Unexpected ApiAchievement received", value);
    }
}

export function saveCryptoAccountResponse(
    value: UserSaveCryptoAccountResponse,
): SaveCryptoAccountResponse {
    if (value === "Success") {
        return CommonResponses.success();
    } else if (value === "NameTaken") {
        return { kind: "name_taken" };
    } else {
        console.warn("saveCryptoAccountResponse failed with: ", value);
        return CommonResponses.failure();
    }
}

export function savedCryptoAccountsResponse(
    value: UserSavedCryptoAccountsResponse,
): NamedAccount[] {
    if ("Success" in value) {
        return value.Success;
    }
    return [];
}

export function tipMessageResponse(value: UserTipMessageResponse): TipMessageResponse {
    if (value === "Success") {
        return CommonResponses.success();
    }
    if (value === "PinRequired") {
        return pinNumberFailureResponseV2(value);
    }

    if (typeof value === "object") {
        if ("PinIncorrect" in value || "TooManyFailedPinAttempts" in value) {
            return pinNumberFailureResponseV2(value);
        }
    }

    console.warn("tipMessage failed with: ", value);
    return CommonResponses.failure();
}

export function publicProfileResponse(value: UserPublicProfileResponse): PublicProfile {
    const profile = value.Success;
    return {
        username: profile.username,
        displayName: profile.display_name,
        avatarId: profile.avatar_id,
        bio: profile.bio,
        isPremium: profile.is_premium,
        phoneIsVerified: profile.phone_is_verified,
        created: profile.created,
    };
}

export function setBioResponse(value: UserSetBioResponse): SetBioResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "UserSuspended") {
        return "user_suspended";
    }
    if (typeof value === "object" && "TooLong" in value) {
        return "bio_too_long";
    }
    throw new UnsupportedValueError(`Unexpected ApiSetBioResponse type received`, value);
}

export function searchDirectChatResponse(
    value: UserSearchMessagesResponse,
    chatId: DirectChatIdentifier,
): SearchDirectChatResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                matches: value.Success.matches.map((m) => messageMatch(m, chatId)),
            };
        }
        if ("TermTooShort" in value || "TermTooLong" in value) {
            return {
                kind: "term_invalid",
            };
        }
    }
    if (value === "ChatNotFound") {
        return {
            kind: "chat_not_found",
        };
    }
    if (value === "InvalidTerm") {
        return {
            kind: "term_invalid",
        };
    }
    throw new UnsupportedValueError(
        "Unknown UserIndex.ApiSearchMessagesResponse type received",
        value,
    );
}

export function deleteMessageResponse(value: UserDeleteMessagesResponse): DeleteMessageResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("Unexpected ApiDeleteMessageResponse type received", value);
        return "failure";
    }
}

export function undeleteMessageResponse(
    value: UserUndeleteMessagesResponse,
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
        console.warn("Unexpected ApiUndeleteMessageResponse type received", value);
        return CommonResponses.failure();
    }
}

export function setAvatarResponse(value: UserSetAvatarResponse): SetAvatarResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "UserSuspended") {
        return "user_suspended";
    }
    if (typeof value === "object" && "AvatarTooBig" in value) {
        return "avatar_too_big";
    }
    throw new UnsupportedValueError("Unexpected ApiSetAvatarResponse type received", value);
}

export function pinChatResponse(
    value: UserPinChatResponse | UserUnpinChatResponse,
): PinChatResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("Unexpected ApiPinChatResponse type received", value);
        return "failure";
    }
}

export function archiveChatResponse(value: UserArchiveUnarchiveChatsResponse): ArchiveChatResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("Archive/Unarchive chat failed with ", value);
        return "failure";
    }
}

export function sendMessageWithTransferToChannelResponse(
    value: UserSendMessageWithTransferToChannelResponse,
    sender: string,
    recipient: string | undefined,
): SendMessageResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "transfer_success",
                timestamp: value.Success.timestamp,
                messageIndex: value.Success.message_index,
                eventIndex: value.Success.event_index,
                expiresAt: mapOptional(value.Success.expires_at, Number),
                transfer: completedCryptoTransfer(value.Success.transfer, sender, recipient ?? ""),
            };
        }

        if ("PinIncorrect" in value || "TooManyFailedPinAttempts" in value) {
            return pinNumberFailureResponseV2(value);
        }
    }
    if (value === "PinRequired") {
        return pinNumberFailureResponseV2(value);
    }

    console.warn("SendMessageWithTransferToChannel failed with", value);
    return CommonResponses.failure();
}

export function sendMessageWithTransferToGroupResponse(
    value: UserSendMessageWithTransferToGroupResponse,
    sender: string,
    recipient: string | undefined,
): SendMessageResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "transfer_success",
                timestamp: value.Success.timestamp,
                messageIndex: value.Success.message_index,
                eventIndex: value.Success.event_index,
                expiresAt: mapOptional(value.Success.expires_at, Number),
                transfer: completedCryptoTransfer(value.Success.transfer, sender, recipient ?? ""),
            };
        }

        if ("PinIncorrect" in value || "TooManyFailedPinAttempts" in value) {
            return pinNumberFailureResponseV2(value);
        }
    }
    if (value === "PinRequired") {
        return pinNumberFailureResponseV2(value);
    }

    console.warn("SendMessageWithTransferToGroup failed with", value);
    return CommonResponses.failure();
}

export function sendMessageResponse(
    value: UserSendMessageResponse,
    sender: string,
    recipient: string,
): SendMessageResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                timestamp: value.Success.timestamp,
                messageIndex: value.Success.message_index,
                eventIndex: value.Success.event_index,
                expiresAt: mapOptional(value.Success.expires_at, Number),
            };
        }
        if ("TransferSuccessV2" in value) {
            return {
                kind: "transfer_success",
                timestamp: value.TransferSuccessV2.timestamp,
                messageIndex: value.TransferSuccessV2.message_index,
                eventIndex: value.TransferSuccessV2.event_index,
                transfer: completedCryptoTransfer(
                    value.TransferSuccessV2.transfer,
                    sender,
                    recipient,
                ),
                expiresAt: mapOptional(value.TransferSuccessV2.expires_at, Number),
            };
        }
        if ("InvalidRequest" in value) {
            return { kind: "invalid_request", reason: value.InvalidRequest };
        }
        if ("TextTooLong" in value) {
            return { kind: "text_too_long" };
        }
        if ("InternalError" in value) {
            return { kind: "internal_error" };
        }
        if ("TransferFailed" in value) {
            return { kind: "transfer_failed" };
        }
        if ("InvalidPoll" in value) {
            return { kind: "invalid_poll" };
        }
        if ("P2PSwapSetUpFailed" in value) {
            return { kind: "p2p_swap_setup_failed", text: value.P2PSwapSetUpFailed };
        }
    }
    if (value === "TransferCannotBeZero") {
        return { kind: "transfer_cannot_be_zero" };
    }
    if (value === "TransferCannotBeToSelf") {
        return { kind: "transfer_cannot_be_to_self" };
    }
    if (value === "RecipientBlocked") {
        return { kind: "recipient_blocked" };
    }
    if (value === "MessageEmpty") {
        return { kind: "message_empty" };
    }
    if (value === "RecipientNotFound") {
        return { kind: "recipient_not_found" };
    }
    if (value === "UserSuspended") {
        return { kind: "user_suspended" };
    }
    if (value === "DuplicateMessageId") {
        return { kind: "duplicate_message_id" };
    }
    if (value === "PinRequired" || "PinIncorrect" in value || "TooManyFailedPinAttempts" in value) {
        return pinNumberFailureResponseV2(value);
    }

    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", value);
}

export function createCommunityResponse(
    value: UserCreateCommunityResponse,
): CreateCommunityResponse {
    if (typeof value === "object" && "Success" in value) {
        return { kind: "success", id: principalBytesToString(value.Success.community_id) };
    } else if (value === "NameTaken") {
        return { kind: "name_taken" };
    } else {
        console.warn("CreateCommunity failed with", value);
        return CommonResponses.failure();
    }
}

export async function getEventsResponse(
    principal: Principal,
    value: UserEventsResponse,
    chatId: DirectChatIdentifier,
    latestKnownUpdatePreRequest: bigint | undefined,
): Promise<EventsResponse<ChatEvent>> {
    if (typeof value === "object") {
        if ("Success" in value) {
            await ensureReplicaIsUpToDate(principal, chatId, value.Success.chat_last_updated);

            return eventsSuccessResponse(value.Success);
        }
        if ("ReplicaNotUpToDateV2" in value) {
            throw ReplicaNotUpToDateError.byTimestamp(
                value.ReplicaNotUpToDateV2,
                latestKnownUpdatePreRequest ?? BigInt(-1),
                false,
            );
        }
    }
    if (value === "ChatNotFound" || value === "ThreadMessageNotFound") {
        return "events_failed";
    }

    throw new UnsupportedValueError("Unexpected ApiEventsResponse type received", value);
}

function groupChatsInitial(value: UserInitialStateGroupChatsInitial): GroupChatsInitial {
    return {
        summaries: value.summaries.map(userCanisterGroupSummary),
        pinned: value.pinned.map((c) => ({
            kind: "group_chat",
            groupId: principalBytesToString(c),
        })),
    };
}

function directChatsInitial(value: UserInitialStateDirectChatsInitial): DirectChatsInitial {
    return {
        summaries: value.summaries.map(directChatSummary),
        pinned: value.pinned.map((c) => ({
            kind: "direct_chat",
            userId: principalBytesToString(c),
        })),
    };
}

function userCanisterChannelSummary(
    value: UserChannelSummary,
    communityId: string,
): UserCanisterChannelSummary {
    return {
        id: {
            kind: "channel",
            communityId: communityId,
            channelId: value.channel_id.toString(),
        },
        readByMeUpTo: value.read_by_me_up_to,
        dateReadPinned: value.date_read_pinned,
        threadsRead: Object.entries(value.threads_read).reduce(
            (curr, next) => {
                curr[Number(next[0])] = next[1];
                return curr;
            },
            {} as Record<number, number>,
        ),
        archived: value.archived,
    };
}

function userCanisterCommunitySummary(value: UserCommunitySummary): UserCanisterCommunitySummary {
    const communityId = principalBytesToString(value.community_id);
    return {
        id: { kind: "community", communityId },
        index: value.index,
        channels: value.channels.map((c) => userCanisterChannelSummary(c, communityId)),
        pinned: value.pinned.map((p) => ({
            kind: "channel",
            communityId,
            channelId: p.toString(),
        })),
        archived: value.archived,
        localUserIndex: principalBytesToString(value.local_user_index_canister_id),
    };
}

function communitiesInitial(value: UserInitialStateCommunitiesInitial): CommunitiesInitial {
    return {
        summaries: value.summaries.map(userCanisterCommunitySummary),
    };
}

function chatIndentifier(value: TChat): ChatIdentifier {
    if ("Group" in value) {
        return { kind: "group_chat", groupId: principalBytesToString(value.Group) };
    }
    if ("Direct" in value) {
        return { kind: "direct_chat", userId: principalBytesToString(value.Direct) };
    }
    if ("Channel" in value) {
        return {
            kind: "channel",
            communityId: principalBytesToString(value.Channel[0]),
            channelId: value.Channel[1].toString(),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiChat type received", value);
}

function favouriteChatsInitial(
    value: UserInitialStateFavouriteChatsInitial,
): FavouriteChatsInitial {
    return {
        chats: value.chats.map(chatIndentifier),
        pinned: value.pinned.map(chatIndentifier),
    };
}

export function initialStateResponse(value: UserInitialStateResponse): InitialStateResponse {
    if ("Success" in value) {
        const result = value.Success;
        return {
            blockedUsers: result.blocked_users.map(principalBytesToString),
            communities: communitiesInitial(value.Success.communities),
            groupChats: groupChatsInitial(value.Success.group_chats),
            favouriteChats: favouriteChatsInitial(value.Success.favourite_chats),
            avatarId: result.avatar_id,
            directChats: directChatsInitial(value.Success.direct_chats),
            timestamp: result.timestamp,
            suspended: result.suspended,
            pinNumberSettings: mapOptional(result.pin_number_settings, pinNumberSettings),
            localUserIndex: principalBytesToString(result.local_user_index_canister_id),
            achievementsLastSeen: result.achievements_last_seen,
            achievements: result.achievements.map(chitEarned),
            streakEnds: result.streak_ends,
            streak: result.streak,
            nextDailyClaim: result.next_daily_claim,
            chitBalance: result.chit_balance,
            totalChitEarned: result.total_chit_earned,
            referrals: result.referrals.map(referral),
            walletConfig: walletConfig(result.wallet_config),
        };
    }
    throw new Error(`Unexpected ApiUpdatesResponse type received: ${value}`);
}

function referral(value: UserReferral): Referral {
    return {
        userId: principalBytesToString(value.user_id),
        status: referralStatus(value.status),
    };
}

export function apiWalletConfig(domain: WalletConfig): UserWalletConfig {
    switch (domain.kind) {
        case "auto_wallet": {
            return { Auto: { min_cents_visible: Math.round(domain.minDollarValue * 100) } };
        }
        case "manual_wallet": {
            return { Manual: { tokens: [...domain.tokens].map(principalStringToBytes) } };
        }
    }
    throw new UnsupportedValueError("Unexpected WalletConfig value received", domain);
}

function walletConfig(value: UserWalletConfig): WalletConfig {
    if ("Auto" in value) {
        return {
            kind: "auto_wallet",
            minDollarValue: value.Auto.min_cents_visible / 100,
        };
    }
    if ("Manual" in value) {
        return {
            kind: "manual_wallet",
            tokens: new Set<string>(value.Manual.tokens.map(principalBytesToString)),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiWalletConfig value received", value);
}

function pinNumberSettings(value: TPinNumberSettings): PinNumberSettings {
    return {
        length: value.length,
        attemptsBlockedUntil: value.attempts_blocked_until,
    };
}

export function userCanisterChannelSummaryUpdates(
    value: UserChannelSummaryUpdates,
    communityId: string,
): UserCanisterChannelSummaryUpdates {
    return {
        id: { kind: "channel", communityId, channelId: value.channel_id.toString() },
        readByMeUpTo: value.read_by_me_up_to,
        dateReadPinned: value.date_read_pinned,
        threadsRead: Object.entries(value.threads_read).reduce(
            (curr, next) => {
                curr[Number(next[0])] = next[1];
                return curr;
            },
            {} as Record<number, number>,
        ),
        archived: value.archived,
    };
}

export function userCanisterCommunitySummaryUpdates(
    value: UserCommunitySummaryUpdates,
): UserCanisterCommunitySummaryUpdates {
    const communityId = principalBytesToString(value.community_id);
    return {
        id: { kind: "community", communityId },
        index: value.index,
        channels: value.channels.map((c) => userCanisterChannelSummaryUpdates(c, communityId)),
        pinned: mapOptional(value.pinned, (p) =>
            p.map((p) => ({ kind: "channel", communityId, channelId: p.toString() })),
        ),
        archived: value.archived,
    };
}

export function communitiesUpdates(value: UserUpdatesCommunitiesUpdates): CommunitiesUpdates {
    return {
        added: value.added.map(userCanisterCommunitySummary),
        updated: value.updated.map(userCanisterCommunitySummaryUpdates),
        removed: value.removed.map(principalBytesToString),
    };
}

export function favouriteChatsUpdates(
    value: UserUpdatesFavouriteChatsUpdates,
): FavouriteChatsUpdates {
    return {
        chats: mapOptional(value.chats, (c) => c.map(chatIndentifier)),
        pinned: mapOptional(value.pinned, (c) => c.map(chatIndentifier)),
    };
}

export function groupChatsUpdates(value: UserUpdatesGroupChatsUpdates): GroupChatsUpdates {
    return {
        added: value.added.map(userCanisterGroupSummary),
        pinned: mapOptional(value.pinned, (p) =>
            p.map((p) => ({ kind: "group_chat", groupId: principalBytesToString(p) })),
        ),
        updated: value.updated.map(userCanisterGroupSummaryUpdates),
        removed: value.removed.map((c) => c.toString()),
    };
}

export function directChatsUpdates(value: UserUpdatesDirectChatsUpdates): DirectChatsUpdates {
    return {
        added: value.added.map(directChatSummary),
        pinned: mapOptional(value.pinned, (p) =>
            p.map((p) => ({ kind: "direct_chat", userId: principalBytesToString(p) })),
        ),
        updated: value.updated.map(directChatSummaryUpdates),
    };
}

export function manageFavouritesResponse(
    value: UserManageFavouriteChatsResponse,
): ManageFavouritesResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("ApiManageFavouriteChatsResponse failure response", value);
        return "failure";
    }
}

export function getUpdatesResponse(value: UserUpdatesResponse): UpdatesResponse {
    if (value === "SuccessNoUpdates") {
        return {
            kind: "success_no_updates",
        };
    }
    if ("Success" in value) {
        const result = value.Success;
        return {
            kind: "success",
            timestamp: result.timestamp,
            blockedUsers: mapOptional(result.blocked_users, (b) => b.map(principalBytesToString)),
            communities: communitiesUpdates(result.communities),
            favouriteChats: favouriteChatsUpdates(result.favourite_chats),
            groupChats: groupChatsUpdates(result.group_chats),
            avatarId: optionUpdateV2(result.avatar_id, identity),
            directChats: directChatsUpdates(result.direct_chats),
            suspended: result.suspended,
            pinNumberSettings: optionUpdateV2(result.pin_number_settings, pinNumberSettings),
            achievementsLastSeen: result.achievements_last_seen,
            achievements: result.achievements.map(chitEarned),
            streakEnds: result.streak_ends,
            streak: result.streak,
            nextDailyClaim: result.next_daily_claim,
            chitBalance: result.chit_balance,
            totalChitEarned: result.total_chit_earned,
            referrals: result.referrals.map(referral),
            walletConfig: mapOptional(result.wallet_config, walletConfig),
        };
    }

    throw new Error(`Unexpected ApiUpdatesResponse type received: ${value}`);
}

function userCanisterGroupSummary(summary: UserGroupChatSummary): UserCanisterGroupChatSummary {
    return {
        id: { kind: "group_chat", groupId: principalBytesToString(summary.chat_id) },
        readByMeUpTo: summary.read_by_me_up_to,
        threadsRead: Object.entries(summary.threads_read).reduce(
            (curr, next) => {
                curr[Number(next[0])] = next[1];
                return curr;
            },
            {} as Record<number, number>,
        ),
        archived: summary.archived,
        dateReadPinned: summary.date_read_pinned,
        localUserIndex: principalBytesToString(summary.local_user_index_canister_id),
    };
}

function userCanisterGroupSummaryUpdates(
    summary: UserGroupChatSummaryUpdates,
): UserCanisterGroupChatSummaryUpdates {
    return {
        id: { kind: "group_chat", groupId: principalBytesToString(summary.chat_id) },
        readByMeUpTo: summary.read_by_me_up_to,
        threadsRead: Object.entries(summary.threads_read).reduce(
            (curr, next) => {
                curr[Number(next[0])] = next[1];
                return curr;
            },
            {} as Record<number, number>,
        ),
        archived: summary.archived,
        dateReadPinned: summary.date_read_pinned,
    };
}

function directChatSummaryUpdates(value: TDirectChatSummaryUpdates): DirectChatSummaryUpdates {
    return {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId: principalBytesToString(value.chat_id) },
        readByMeUpTo: value.read_by_me_up_to,
        readByThemUpTo: value.read_by_them_up_to,
        lastUpdated: value.last_updated,
        latestMessage: mapOptional(value.latest_message, messageEvent),
        latestEventIndex: value.latest_event_index,
        latestMessageIndex: value.latest_message_index,
        notificationsMuted: value.notifications_muted,
        updatedEvents: value.updated_events.map(updatedEvent),
        eventsTTL: optionUpdateV2(value.events_ttl, identity),
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        metrics: mapOptional(value.metrics, chatMetrics),
        myMetrics: mapOptional(value.my_metrics, chatMetrics),
        archived: value.archived,
        videoCallInProgress: optionUpdateV2(value.video_call_in_progress, (v) => v.message_index),
    };
}

function updatedEvent([eventIndex, timestamp]: [number, bigint]): UpdatedEvent {
    return {
        eventIndex,
        timestamp,
    };
}

function directChatSummary(value: TDirectChatSummary): DirectChatSummary {
    return {
        id: { kind: "direct_chat", userId: principalBytesToString(value.them) },
        kind: "direct_chat",
        latestMessage: messageEvent(value.latest_message),
        them: { kind: "direct_chat", userId: principalBytesToString(value.them) },
        latestEventIndex: value.latest_event_index,
        latestMessageIndex: value.latest_message_index,
        lastUpdated: value.last_updated,
        readByThemUpTo: value.read_by_them_up_to,
        dateCreated: value.date_created,
        eventsTTL: undefined,
        eventsTtlLastUpdated: BigInt(0),
        metrics: chatMetrics(value.metrics),
        videoCallInProgress: mapOptional(value.video_call_in_progress, (v) => v.message_index),
        membership: {
            ...nullMembership(),
            role: "owner",
            myMetrics: chatMetrics(value.my_metrics),
            notificationsMuted: value.notifications_muted,
            readByMeUpTo: value.read_by_me_up_to,
            archived: value.archived,
            rulesAccepted: false,
        },
    };
}

function failedNnsCryptoWithdrawal(
    value: FailedCryptoTransactionNNS,
): FailedCryptocurrencyWithdrawal {
    return {
        kind: "failed",
        ledger: principalBytesToString(value.ledger),
        to: value.to !== "Mint" ? bytesToHexString(value.to.Account) : "",
        amountE8s: value.amount.e8s,
        feeE8s: value.fee.e8s,
        memo: value.memo,
        errorMessage: value.error_message,
    };
}

function failedIcrc1CryptoWithdrawal(
    value: FailedCryptoTransactionICRC1,
): FailedCryptocurrencyWithdrawal {
    return {
        kind: "failed",
        ledger: principalBytesToString(value.ledger),
        to: value.to !== "Mint" ? formatIcrc1Account(value.to.Account) : "",
        amountE8s: value.amount,
        feeE8s: value.fee,
        memo: mapOptional(value.memo, bytesToBigint) ?? BigInt(0),
        errorMessage: value.error_message,
    };
}

function completedNnsCryptoWithdrawal(
    value: CompletedCryptoTransactionNNS,
): CompletedCryptocurrencyWithdrawal {
    return {
        kind: "completed",
        ledger: principalBytesToString(value.ledger),
        to: value.to !== "Mint" ? bytesToHexString(value.to.Account) : "",
        amountE8s: value.amount.e8s,
        feeE8s: value.fee.e8s,
        memo: value.memo,
        blockIndex: value.block_index,
    };
}

function completedIcrc1CryptoWithdrawal(
    value: CompletedCryptoTransactionICRC1,
): CompletedCryptocurrencyWithdrawal {
    return {
        kind: "completed",
        ledger: principalBytesToString(value.ledger),
        to: value.to !== "Mint" ? formatIcrc1Account(value.to.Account) : "",
        amountE8s: value.amount,
        feeE8s: value.fee,
        memo: mapOptional(value.memo, bytesToBigint) ?? BigInt(0),
        blockIndex: value.block_index,
    };
}

export function withdrawCryptoResponse(
    value: UserWithdrawCryptoResponse,
): WithdrawCryptocurrencyResponse {
    if (typeof value === "object") {
        if ("PinIncorrect" in value || "TooManyFailedPinAttempts" in value) {
            return pinNumberFailureResponseV2(value);
        }
        if ("TransactionFailed" in value) {
            if ("NNS" in value.TransactionFailed) {
                return failedNnsCryptoWithdrawal(value.TransactionFailed.NNS);
            } else if ("ICRC1" in value.TransactionFailed) {
                return failedIcrc1CryptoWithdrawal(value.TransactionFailed.ICRC1);
            }
        }
        if ("Success" in value) {
            if ("NNS" in value.Success) {
                return completedNnsCryptoWithdrawal(value.Success.NNS);
            } else if ("ICRC1" in value.Success) {
                return completedIcrc1CryptoWithdrawal(value.Success.ICRC1);
            }
        }
    }
    if (value === "PinRequired") {
        return pinNumberFailureResponseV2(value);
    }
    if (value === "CurrencyNotSupported") {
        return { kind: "currency_not_supported" };
    }

    throw new Error("Unexpected ApiWithdrawCryptocurrencyResponse type received");
}

function formatIcrc1Account(value: AccountICRC1): string {
    const owner = principalBytesToString(value.owner);
    const subaccount = mapOptional(value.subaccount, bytesToHexString);

    return subaccount !== undefined ? `${owner}:${subaccount}` : owner;
}

export function deletedMessageResponse(
    value: UserDeletedMessageResponse,
): DeletedDirectMessageResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                content: messageContent(value.Success.content, "unknown"),
            };
        }
    }
    if (value === "ChatNotFound") {
        return { kind: "chat_not_found" };
    }
    if (value === "NotAuthorized") {
        return { kind: "not_authorized" };
    }
    if (value === "MessageNotFound") {
        return { kind: "message_not_found" };
    }
    if (value === "MessageHardDeleted") {
        return { kind: "message_hard_deleted" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDeletedDirectMessageResponse type received",
        value,
    );
}

export function setMessageReminderResponse(
    value: UserSetMessageReminderResponse,
): SetMessageReminderResponse {
    if (typeof value === "object" && "Success" in value) {
        return "success";
    } else {
        console.warn("SetMessageReminder failed with", value);
        return "failure";
    }
}

export function leaveCommunityResponse(value: UserLeaveCommunityResponse): LeaveCommunityResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("LeaveCommunity failed with", value);
        return "failure";
    }
}

export function deleteCommunityResponse(
    value: UserDeleteCommunityResponse,
): DeleteCommunityResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("DeleteCommunity failed with", value);
        return "failure";
    }
}

export function proposalToSubmit(proposal: CandidateProposal): ProposalsBotProposalToSubmit {
    return {
        title: proposal.title,
        url: proposal.url ?? "",
        summary: proposal.summary,
        action: proposalAction(proposal.action),
    };
}

function proposalAction(action: CandidateProposalAction): ProposalsBotProposalToSubmitAction {
    switch (action.kind) {
        case "motion":
            return "Motion";
        case "transfer_sns_funds":
            return {
                TransferSnsTreasuryFunds: {
                    to: {
                        owner: principalStringToBytes(action.recipient.owner),
                        subaccount: mapOptional(
                            action.recipient.subaccount,
                            (s) =>
                                [...hexStringToBytes(s)] as [
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
                        ),
                    },
                    amount: action.amount,
                    memo: undefined,
                    treasury: action.treasury,
                },
            };
        case "upgrade_sns_to_next_version":
            return "UpgradeSnsToNextVersion";
        case "execute_generic_nervous_system_function":
            return {
                ExecuteGenericNervousSystemFunction: {
                    function_id: action.functionId,
                    payload: action.payload,
                },
            };
    }
}

export function submitProposalResponse(value: UserSubmitProposalResponse): SubmitProposalResponse {
    if (value === "Success") {
        return { kind: "success" };
    }
    if (value === "GovernanceCanisterNotSupported") {
        return { kind: "governance_canister_not_supported" };
    }
    if (value === "UserSuspended") {
        return { kind: "user_suspended" };
    }
    if (typeof value === "object") {
        if ("Retrying" in value) {
            return { kind: "retrying", error: value.Retrying };
        }
        if ("InsufficientPayment" in value) {
            return { kind: "insufficient_payment" };
        }
        if ("TransferFailed" in value) {
            return { kind: "transfer_failed", error: value.TransferFailed };
        }
        if ("InternalError" in value) {
            return { kind: "internal_error", error: value.InternalError };
        }
    }
    throw new UnsupportedValueError("Unexpected ApiSubmitProposalResponse type received", value);
}

export function reportMessageResponse(value: UserReportMessageResponse): boolean {
    return value === "Success" || value === "AlreadyReported";
}

export function swapTokensResponse(value: UserSwapTokensResponse): SwapTokensResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                amountOut: value.Success.amount_out,
            };
        }
        if ("InternalError" in value) {
            return {
                kind: "internal_error",
                error: value.InternalError,
            };
        }
        if ("PinIncorrect" in value || "TooManyFailedPinAttempts" in value) {
            return pinNumberFailureResponseV2(value);
        }
    }
    if (value === "SwapFailed") {
        return {
            kind: "swap_failed",
        };
    }
    if (value === "PinRequired") {
        return pinNumberFailureResponseV2(value);
    }
    throw new UnsupportedValueError("Unexpected ApiSwapTokensResponse type received", value);
}

export function tokenSwapStatusResponse(
    value: UserTokenSwapStatusResponse,
): TokenSwapStatusResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            started: value.Success.started,
            depositAccount: mapOptional(value.Success.deposit_account, result),
            transfer: mapOptional(value.Success.transfer, result),
            notifyDex: mapOptional(value.Success.notify_dex, result),
            amountSwapped: mapOptional(value.Success.amount_swapped, resultOfResult),
            withdrawnFromDex: mapOptional(value.Success.withdraw_from_dex, result),
        };
    }
    if (value === "NotFound") {
        return {
            kind: "not_found",
        };
    }
    throw new UnsupportedValueError("Unexpected ApiTokenSwapStatusResponse type received", value);
}

function result<T>(value: { Ok: T } | { Err: string }): Result<T> {
    if ("Ok" in value) {
        return {
            kind: "ok",
            value: value.Ok,
        };
    }
    return {
        kind: "error",
        error: value.Err,
    };
}

function resultOfResult<T>(
    value: { Ok: { Ok: T } | { Err: string } } | { Err: string },
): Result<Result<T>> {
    if ("Ok" in value) {
        return {
            kind: "ok",
            value: result(value.Ok),
        };
    }
    return {
        kind: "error",
        error: value.Err,
    };
}

export function approveTransferResponse(
    value: UserApproveTransferResponse,
): ApproveTransferResponse {
    if (value === "Success") {
        return { kind: "success" };
    }
    if (typeof value === "object") {
        if ("InternalError" in value) {
            return { kind: "internal_error", error: value.InternalError };
        }
        if ("ApproveError" in value) {
            return { kind: "approve_error", error: JSON.stringify(value.ApproveError) };
        }
        if ("PinIncorrect" in value || "TooManyFailedPinAttempts" in value) {
            return pinNumberFailureResponseV2(value);
        }
    }
    if (value === "PinRequired") {
        return pinNumberFailureResponseV2(value);
    }

    throw new UnsupportedValueError("Unexpected ApiApproveTransferResponse type received", value);
}

export function apiExchangeArgs(args: ExchangeTokenSwapArgs): UserSwapTokensExchangeArgs {
    const value = {
        swap_canister_id: principalStringToBytes(args.swapCanisterId),
        zero_for_one: args.zeroForOne,
    };
    if (args.dex === "icpswap") {
        return {
            ICPSwap: value,
        };
    } else if (args.dex === "kongswap") {
        return {
            KongSwap: value,
        };
    } else if (args.dex === "sonic") {
        return {
            Sonic: value,
        };
    }
    throw new UnsupportedValueError("Unexpected dex", args.dex);
}

export function claimDailyChitResponse(value: UserClaimDailyChitResponse): ClaimDailyChitResponse {
    if ("Success" in value) {
        return {
            kind: "success",
            streak: value.Success.streak,
            chitBalance: value.Success.chit_balance,
            chitEarned: value.Success.chit_earned,
            nextDailyChitClaim: value.Success.next_claim,
        };
    }
    if ("AlreadyClaimed" in value) {
        return {
            kind: "already_claimed",
            nextDailyChitClaim: value.AlreadyClaimed,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiClaimDailyChitResponse type received", value);
}

export function apiVerification(domain: Verification): UserSetPinNumberPinNumberVerification {
    switch (domain.kind) {
        case "delegation_verification":
            return { Delegation: signedDelegation(domain.delegation) };
        case "no_verification":
            return "None";
        case "pin_verification":
            return { PIN: domain.pin };
    }
}
