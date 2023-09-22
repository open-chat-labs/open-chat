import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    Message,
    ReplyContext,
    UserId,
    MessageContent,
    FileContent,
    TextContent,
    ImageContent,
    AudioContent,
    VideoContent,
    TimestampMillis,
    BlobReference,
    EventIndex,
    ChatEventWrapper,
    EventsByIndexArgs,
    EventsResponse,
    EventsSuccessResult,
    EventsArgs,
    ChatEvent,
    SendMessageV2Args,
    SendMessageResponse,
    EditMessageResponse,
    ChangeRoleResponse,
    RemoveParticipantResponse,
    UpdateGroupV2Response as UpdateGroupResponse,
    AddReactionResponse,
    RemoveReactionResponse,
    DeleteMessagesResponse,
    UndeleteMessagesResponse,
    BlockUserResponse,
    UnblockUserResponse,
    SelectedInitialResponse,
    SelectedUpdatesV2Response,
    Participant,
    GroupRole,
    PublicGroupSummary,
    PublicSummaryResponse,
    MessagesByMessageIndexResponse,
    MessageEventWrapper,
    PinMessageV2Response,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    SearchMessagesResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    ThreadPreviewsResponse,
    ThreadPreview,
    RegisterProposalVoteResponse,
    Rules,
    UpdatedRules,
    RulesResponse,
    GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates,
    SummaryResponse,
    SummaryUpdatesResponse,
    GroupCanisterThreadDetails,
    GroupSubtype,
    Mention,
    DeletedMessageResponse,
    ClaimPrizeResponse,
    AccessGateUpdate,
    DeclineInvitationResponse,
    ConvertIntoCommunityResponse,
    GroupPermissions,
} from "./types";
export {
    _SERVICE as GroupService,
    SendMessageV2Args as ApiSendMessageArgs,
    SendMessageResponse as ApiSendMessageResponse,
    EditMessageResponse as ApiEditMessageResponse,
    Message as ApiMessage,
    UserId as ApiUserId,
    ReplyContext as ApiReplyContext,
    MessageContent as ApiMessageContent,
    FileContent as ApiFileContent,
    TextContent as ApiTextContent,
    ImageContent as ApiImageContent,
    VideoContent as ApiVideoContent,
    AudioContent as ApiAudioContent,
    TimestampMillis as ApiTimestampMillis,
    BlobReference as ApiBlobReference,
    EventIndex as ApiEventIndex,
    ChatEventWrapper as ApiEventWrapper,
    EventsByIndexArgs as ApiEventsByIndexArgs,
    EventsResponse as ApiEventsResponse,
    EventsSuccessResult as ApiEventsSuccessResult,
    EventsArgs as ApiEventsArgs,
    ChatEvent as ApiGroupChatEvent,
    ChangeRoleResponse as ApiChangeRoleResponse,
    RemoveParticipantResponse as ApiRemoveParticipantResponse,
    UpdateGroupResponse as ApiUpdateGroupResponse,
    AddReactionResponse as ApiAddReactionResponse,
    RemoveReactionResponse as ApiRemoveReactionResponse,
    DeleteMessagesResponse as ApiDeleteMessageResponse,
    UndeleteMessagesResponse as ApiUndeleteMessageResponse,
    BlockUserResponse as ApiBlockUserResponse,
    UnblockUserResponse as ApiUnblockUserResponse,
    SelectedInitialResponse as ApiSelectedInitialResponse,
    SelectedUpdatesV2Response as ApiSelectedUpdatesResponse,
    Participant as ApiParticipant,
    GroupRole as ApiRole,
    PublicGroupSummary as ApiPublicGroupSummary,
    PublicSummaryResponse as ApiPublicSummaryResponse,
    MessagesByMessageIndexResponse as ApiMessagesByMessageIndexResponse,
    MessageEventWrapper as ApiMessageEventWrapper,
    PinMessageV2Response as ApiPinMessageResponse,
    UnpinMessageResponse as ApiUnpinMessageResponse,
    RegisterPollVoteResponse as ApiRegisterPollVoteResponse,
    SearchMessagesResponse as ApiSearchGroupChatResponse,
    InviteCodeResponse as ApiInviteCodeResponse,
    EnableInviteCodeResponse as ApiEnableInviteCodeResponse,
    DisableInviteCodeResponse as ApiDisableInviteCodeResponse,
    ResetInviteCodeResponse as ApiResetInviteCodeResponse,
    ThreadPreviewsResponse as ApiThreadPreviewsResponse,
    ThreadPreview as ApiThreadPreview,
    RegisterProposalVoteResponse as ApiRegisterProposalVoteResponse,
    Rules as ApiRules,
    UpdatedRules as ApiUpdatedRules,
    RulesResponse as ApiRulesResponse,
    GroupCanisterGroupChatSummary as ApiGroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates as ApiGroupCanisterGroupChatSummaryUpdates,
    SummaryResponse as ApiGroupCanisterSummaryResponse,
    SummaryUpdatesResponse as ApiGroupCanisterSummaryUpdatesResponse,
    GroupCanisterThreadDetails as ApiGroupCanisterThreadDetails,
    GroupSubtype as ApiGroupSubtype,
    Mention as ApiMention,
    DeletedMessageResponse as ApiDeletedGroupMessageResponse,
    ClaimPrizeResponse as ApiClaimPrizeResponse,
    AccessGateUpdate as ApiGroupGateUpdate,
    DeclineInvitationResponse as ApiDeclineInvitationResponse,
    ConvertIntoCommunityResponse as ApiConvertIntoCommunityResponse,
    GroupPermissions as ApiGroupPermissions,
};

export const idlFactory: IDL.InterfaceFactory;
