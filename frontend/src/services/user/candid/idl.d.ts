import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    ReplyContext,
    DirectReplyContextArgs,
    ChatSummaryUpdates,
    GroupChatSummaryUpdates,
    DirectChatSummaryUpdates,
    ChatEventWrapper,
    CreateGroupArgs,
    CreateGroupResponse,
    DeleteGroupResponse,
    UpdatesArgs,
    UpdatesResponse,
    InitialStateResponse,
    ChatSummary,
    GroupChatSummary,
    DirectChatSummary,
    Message,
    ChatEvent,
    UserId,
    MessageContent,
    FileContent,
    TextContent,
    ImageContent,
    VideoContent,
    AudioContent,
    GiphyContent,
    GiphyImageVariant,
    ProposalContent,
    Proposal,
    PollContent,
    PollVotes,
    PollConfig,
    TotalPollVotes,
    CryptocurrencyContent,
    CryptoAccount,
    CryptoAccountFull,
    CryptoTransaction,
    PendingCryptoTransaction,
    CompletedCryptoTransaction,
    DeletedContent,
    TimestampMillis,
    BlobReference,
    Participant,
    UpdatedChatSummary,
    EventIndex,
    EventWrapper,
    EventsByIndexArgs,
    EventsByIndexResponse,
    EventsResponse,
    EventsSuccessResult,
    EventsArgs,
    SendMessageArgs,
    SendMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    SetAvatarResponse,
    ToggleReactionResponse,
    DeleteMessagesResponse,
    DeletedMessage,
    UpdatedMessage,
    JoinGroupResponse,
    SearchAllMessagesResponse,
    SearchMessagesResponse,
    MessageMatch,
    MuteNotificationsResponse,
    UnmuteNotificationsResponse,
    Alert,
    AlertDetails,
    CryptocurrencyDeposit,
    Role,
    Mention,
    MessageIndexRange,
    User,
    ICP,
    RecommendedGroupsResponse,
    RecommendedGroupsSuccessResult,
    SetBioResponse,
    RegisterPollVoteResponse,
    GroupPermissions,
    PermissionRole,
    WithdrawCryptoResponse,
    FailedCryptocurrencyWithdrawal,
    CompletedCryptocurrencyWithdrawal,
    CompletedCryptocurrencyTransfer,
    TransferCryptoWithinGroupResponse,
    TransferCryptoWithinGroupArgs,
    ChatMetrics,
    Cryptocurrency,
    PublicProfileResponse,
    ThreadSummary,
    PinChatResponse,
    UnpinChatResponse,
    ProposalDecisionStatus,
    ProposalRewardStatus,
    ThreadSyncDetails,
    VoteOnProposalResponse,
} from "./types";
export {
    _SERVICE as UserService,
    SendMessageArgs as ApiSendMessageArgs,
    SendMessageResponse as ApiSendMessageResponse,
    EditMessageResponse as ApiEditMessageResponse,
    Message as ApiMessage,
    ReplyContext as ApiReplyContext,
    DirectReplyContextArgs as ApiDirectReplyContextArgs,
    ChatSummaryUpdates as ApiChatSummaryUpdates,
    GroupChatSummaryUpdates as ApiGroupChatSummaryUpdates,
    DirectChatSummaryUpdates as ApiDirectChatSummaryUpdates,
    CreateGroupArgs as ApiCreateGroupArgs,
    CreateGroupResponse as ApiCreateGroupResponse,
    DeleteGroupResponse as ApiDeleteGroupResponse,
    UpdatesArgs as ApiUpdatesArgs,
    UpdatesResponse as ApiUpdatesResponse,
    InitialStateResponse as ApiInitialStateResponse,
    ChatSummary as ApiChatSummary,
    ChatEvent as ApiDirectChatEvent,
    ChatEventWrapper as ApiDirectChatEventWrapper,
    GroupChatSummary as ApiGroupChatSummary,
    DirectChatSummary as ApiDirectChatSummary,
    UserId as ApiUserId,
    MessageContent as ApiMessageContent,
    FileContent as ApiFileContent,
    TextContent as ApiTextContent,
    ImageContent as ApiImageContent,
    VideoContent as ApiVideoContent,
    AudioContent as ApiAudioContent,
    DeletedContent as ApiDeletedContent,
    CryptocurrencyContent as ApiCryptocurrencyContent,
    CryptoAccount as ApiCryptoAccount,
    CryptoAccountFull as ApiCryptoAccountFull,
    CryptoTransaction as ApiCryptoTransaction,
    PendingCryptoTransaction as ApiPendingCryptoTransaction,
    CompletedCryptoTransaction as ApiCompletedCryptoTransaction,
    TimestampMillis as ApiTimestampMillis,
    BlobReference as ApiBlobReference,
    Participant as ApiParticipant,
    UpdatedChatSummary as ApiUpdatedChatSummary,
    EventIndex as ApiEventIndex,
    EventWrapper as ApiEventWrapper,
    EventsByIndexArgs as ApiEventsByIndexArgs,
    EventsByIndexResponse as ApiEventsByIndexResponse,
    EventsResponse as ApiEventsResponse,
    EventsSuccessResult as ApiEventsSuccessResult,
    EventsArgs as ApiEventsArgs,
    BlockUserResponse as ApiBlockUserResponse,
    UnblockUserResponse as ApiUnblockUserResponse,
    LeaveGroupResponse as ApiLeaveGroupResponse,
    MarkReadResponse as ApiMarkReadResponse,
    SetAvatarResponse as ApiSetAvatarResponse,
    ToggleReactionResponse as ApiToggleReactionResponse,
    DeleteMessagesResponse as ApiDeleteMessageResponse,
    DeletedMessage as ApiDeletedMessage,
    UpdatedMessage as ApiUpdatedMessage,
    JoinGroupResponse as ApiJoinGroupResponse,
    SearchAllMessagesResponse as ApiSearchAllMessagesResponse,
    SearchMessagesResponse as ApiSearchDirectChatResponse,
    MessageMatch as ApiMessageMatch,
    MuteNotificationsResponse as ApiMuteNotificationsResponse,
    UnmuteNotificationsResponse as ApiUnmuteNotificationsResponse,
    Alert as ApiAlert,
    AlertDetails as ApiAlertDetails,
    CryptocurrencyDeposit as ApiCryptocurrencyDeposit,
    Role as ApiRole,
    Mention as ApiMention,
    MessageIndexRange as ApiMessageIndexRange,
    User as ApiUser,
    ICP as ApiICP,
    RecommendedGroupsResponse as ApiRecommendedGroupsResponse,
    RecommendedGroupsSuccessResult as ApiRecommendedGroupsSuccessResult,
    SetBioResponse as ApiSetBioResponse,
    PollContent as ApiPollContent,
    PollVotes as ApiPollVotes,
    PollConfig as ApiPollConfig,
    TotalPollVotes as ApiTotalPollVotes,
    RegisterPollVoteResponse as ApiRegisterPollVoteResponse,
    GroupPermissions as ApiGroupPermissions,
    PermissionRole as ApiPermissionRole,
    WithdrawCryptoResponse as ApiWithdrawCryptoResponse,
    FailedCryptocurrencyWithdrawal as ApiFailedCryptocurrencyWithdrawal,
    CompletedCryptocurrencyWithdrawal as ApiCompletedCryptocurrencyWithdrawal,
    CompletedCryptocurrencyTransfer as ApiCompletedCryptocurrencyTransfer,
    TransferCryptoWithinGroupResponse as ApiTransferCryptoWithinGroupResponse,
    TransferCryptoWithinGroupArgs as ApiTransferCryptoWithinGroupArgs,
    GiphyContent as ApiGiphyContent,
    GiphyImageVariant as ApiGiphyImageVariant,
    ChatMetrics as ApiChatMetrics,
    Cryptocurrency as ApiCryptocurrency,
    PublicProfileResponse as ApiPublicProfileResponse,
    ThreadSummary as ApiThreadSummary,
    ProposalContent as ApiProposalContent,
    Proposal as ApiProposal,
    PinChatResponse as ApiPinChatResponse,
    UnpinChatResponse as ApiUnpinChatResponse,
    ProposalDecisionStatus as ApiProposalDecisionStatus,
    ProposalRewardStatus as ApiProposalRewardStatus,
    ThreadSyncDetails as ApiThreadSyncDetails,
    VoteOnProposalResponse as ApiVoteOnProposalResponse,
};

export const idlFactory: IDL.InterfaceFactory;
