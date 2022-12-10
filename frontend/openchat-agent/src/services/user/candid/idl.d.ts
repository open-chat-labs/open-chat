import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    ReplyContext,
    ChatSummaryUpdates,
    GroupChatSummaryUpdates,
    DirectChatSummaryUpdates,
    ChatEventWrapper,
    CreateGroupArgs,
    CreateGroupResponse,
    DeleteGroupResponse,
    InitialStateResponse,
    UpdatesArgs,
    UpdatesResponse,
    InitialStateV2Response,
    UpdatesV2Response,
    ChatSummary,
    GroupChatSummary,
    DirectChatSummary,
    UserCanisterGroupChatSummary,
    UserCanisterGroupChatSummaryUpdates,
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
    CryptoContent,
    CryptoTransaction,
    NnsPendingCryptoTransaction,
    NnsCompletedCryptoTransaction,
    NnsFailedCryptoTransaction,
    SnsPendingCryptoTransaction,
    SnsCompletedCryptoTransaction,
    SnsFailedCryptoTransaction,
    DeletedContent,
    TimestampMillis,
    BlobReference,
    Participant,
    EventIndex,
    EventsByIndexArgs,
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
    AddReactionResponse,
    RemoveReactionResponse,
    DeleteMessagesResponse,
    UndeleteMessagesResponse,
    UpdatedMessage,
    JoinGroupResponse,
    SearchMessagesResponse,
    MessageMatch,
    MuteNotificationsResponse,
    UnmuteNotificationsResponse,
    Role,
    Mention,
    User,
    ICP,
    RecommendedGroupsResponse,
    RecommendedGroupsSuccessResult,
    SetBioResponse,
    GroupPermissions,
    PermissionRole,
    WithdrawCryptoResponse,
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
    MigrateUserPrincipalResponse,
    GroupSubtype,
    GovernanceProposalsSubtype,
    GroupSubtypeUpdate,
    ArchiveChatResponse,
    Icrc1Account,
} from "./types";
export {
    _SERVICE as UserService,
    SendMessageArgs as ApiSendMessageArgs,
    SendMessageResponse as ApiSendMessageResponse,
    EditMessageResponse as ApiEditMessageResponse,
    Message as ApiMessage,
    ReplyContext as ApiReplyContext,
    ChatSummaryUpdates as ApiChatSummaryUpdates,
    GroupChatSummaryUpdates as ApiGroupChatSummaryUpdates,
    DirectChatSummaryUpdates as ApiDirectChatSummaryUpdates,
    CreateGroupArgs as ApiCreateGroupArgs,
    CreateGroupResponse as ApiCreateGroupResponse,
    DeleteGroupResponse as ApiDeleteGroupResponse,
    InitialStateResponse as ApiInitialStateResponse,
    UpdatesArgs as ApiUpdatesArgs,
    UpdatesResponse as ApiUpdatesResponse,
    InitialStateV2Response as ApiInitialStateV2Response,
    UpdatesV2Response as ApiUpdatesV2Response,
    ChatSummary as ApiChatSummary,
    ChatEvent as ApiDirectChatEvent,
    ChatEventWrapper as ApiDirectChatEventWrapper,
    GroupChatSummary as ApiGroupChatSummary,
    DirectChatSummary as ApiDirectChatSummary,
    UserCanisterGroupChatSummary as ApiUserCanisterGroupChatSummary,
    UserCanisterGroupChatSummaryUpdates as ApiUserCanisterGroupChatSummaryUpdates,
    UserId as ApiUserId,
    MessageContent as ApiMessageContent,
    FileContent as ApiFileContent,
    TextContent as ApiTextContent,
    ImageContent as ApiImageContent,
    VideoContent as ApiVideoContent,
    AudioContent as ApiAudioContent,
    DeletedContent as ApiDeletedContent,
    CryptoContent as ApiCryptoContent,
    CryptoTransaction as ApiCryptoTransaction,
    NnsPendingCryptoTransaction as ApiNnsPendingCryptoTransaction,
    NnsCompletedCryptoTransaction as ApiNnsCompletedCryptoTransaction,
    NnsFailedCryptoTransaction as ApiNnsFailedCryptoTransaction,
    SnsPendingCryptoTransaction as ApiSnsPendingCryptoTransaction,
    SnsCompletedCryptoTransaction as ApiSnsCompletedCryptoTransaction,
    SnsFailedCryptoTransaction as ApiSnsFailedCryptoTransaction,
    TimestampMillis as ApiTimestampMillis,
    BlobReference as ApiBlobReference,
    Participant as ApiParticipant,
    EventIndex as ApiEventIndex,
    EventsByIndexArgs as ApiEventsByIndexArgs,
    EventsResponse as ApiEventsResponse,
    EventsSuccessResult as ApiEventsSuccessResult,
    EventsArgs as ApiEventsArgs,
    BlockUserResponse as ApiBlockUserResponse,
    UnblockUserResponse as ApiUnblockUserResponse,
    LeaveGroupResponse as ApiLeaveGroupResponse,
    MarkReadResponse as ApiMarkReadResponse,
    SetAvatarResponse as ApiSetAvatarResponse,
    AddReactionResponse as ApiAddReactionResponse,
    RemoveReactionResponse as ApiRemoveReactionResponse,
    DeleteMessagesResponse as ApiDeleteMessageResponse,
    UndeleteMessagesResponse as ApiUndeleteMessageResponse,
    UpdatedMessage as ApiUpdatedMessage,
    JoinGroupResponse as ApiJoinGroupResponse,
    SearchMessagesResponse as ApiSearchDirectChatResponse,
    MessageMatch as ApiMessageMatch,
    MuteNotificationsResponse as ApiMuteNotificationsResponse,
    UnmuteNotificationsResponse as ApiUnmuteNotificationsResponse,
    Role as ApiRole,
    Mention as ApiMention,
    User as ApiUser,
    ICP as ApiICP,
    RecommendedGroupsResponse as ApiRecommendedGroupsResponse,
    RecommendedGroupsSuccessResult as ApiRecommendedGroupsSuccessResult,
    SetBioResponse as ApiSetBioResponse,
    PollContent as ApiPollContent,
    PollVotes as ApiPollVotes,
    PollConfig as ApiPollConfig,
    TotalPollVotes as ApiTotalPollVotes,
    GroupPermissions as ApiGroupPermissions,
    PermissionRole as ApiPermissionRole,
    WithdrawCryptoResponse as ApiWithdrawCryptoResponse,
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
    MigrateUserPrincipalResponse as ApiMigrateUserPrincipalResponse,
    GroupSubtype as ApiGroupSubtype,
    GovernanceProposalsSubtype as ApiGovernanceProposalsSubtype,
    GroupSubtypeUpdate as ApiGroupSubtypeUpdate,
    ArchiveChatResponse as ApiArchiveChatResponse,
    Icrc1Account as ApiIcrc1Account,
};

export const idlFactory: IDL.InterfaceFactory;
