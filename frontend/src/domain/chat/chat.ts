import type DRange from "drange";
import type { BlobReference, DataContent } from "../data/data";
import type { PartialUserSummary, UserSummary } from "../user/user";
import type { OptionUpdate } from "../optionUpdate";
import type { Cryptocurrency } from "../crypto";

export type InternalError = { kind: "internal_error" };

export type CallerNotInGroup = { kind: "caller_not_in_group" };

export type MessageContent =
    | FileContent
    | TextContent
    | ImageContent
    | VideoContent
    | AudioContent
    | DeletedContent
    | PlaceholderContent
    | PollContent
    | CryptocurrencyContent
    | GiphyContent
    | ProposalContent;

export type IndexRange = [number, number];

export interface PlaceholderContent {
    kind: "placeholder_content";
}

export type CryptocurrencyDeposit = {
    token: Cryptocurrency;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    blockIndex: bigint;
    fromAddress: string;
};

export type PendingCryptocurrencyWithdrawal = {
    kind: "pending";
    token: Cryptocurrency;
    to: string;
    amountE8s: bigint;
    feeE8s?: bigint;
    memo?: bigint;
};

export type CompletedCryptocurrencyWithdrawal = {
    kind: "completed";
    token: Cryptocurrency;
    to: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    blockIndex: bigint;
    transactionHash: string;
};

export type FailedCryptocurrencyWithdrawal = {
    kind: "failed";
    token: Cryptocurrency;
    to: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    errorMessage: string;
};

export type WithdrawCryptocurrencyResponse =
    | { kind: "currency_not_supported" }
    | FailedCryptocurrencyWithdrawal
    | CompletedCryptocurrencyWithdrawal;

export type CryptocurrencyWithdrawal =
    | PendingCryptocurrencyWithdrawal
    | CompletedCryptocurrencyWithdrawal
    | FailedCryptocurrencyWithdrawal;

export type CompletedCryptocurrencyTransfer = {
    kind: "completed";
    token: Cryptocurrency;
    recipient: string;
    sender: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    blockIndex: bigint;
    transactionHash: string;
};

export type PendingCryptocurrencyTransfer = {
    kind: "pending";
    token: Cryptocurrency;
    recipient: string;
    amountE8s: bigint;
    feeE8s?: bigint;
    memo?: bigint;
};

export type FailedCryptocurrencyTransfer = {
    kind: "failed";
    token: Cryptocurrency;
    recipient: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    errorMessage: string;
};

export type CryptocurrencyTransfer =
    | CompletedCryptocurrencyTransfer
    | PendingCryptocurrencyTransfer
    | FailedCryptocurrencyTransfer;

export type CryptocurrencyTransaction =
    | CryptocurrencyTransfer
    | CryptocurrencyWithdrawal
    | CryptocurrencyDeposit;

export interface CryptocurrencyContent {
    kind: "crypto_content";
    caption?: string;
    transfer: CryptocurrencyTransfer;
}

export type GiphyImage = {
    height: number;
    width: number;
    url: string;
    mimeType: string;
};

export interface GiphyContent {
    kind: "giphy_content";
    caption?: string;
    title: string;
    desktop: GiphyImage; //will be "original" from the giphy api
    mobile: GiphyImage; //will be "downsized_large" from the giphy api
}

export interface ProposalContent {
    kind: "proposal_content";
    governanceCanisterId: string;
    proposal: Proposal;
    myVote?: boolean;
}

export type Proposal = NnsProposal | SnsProposal;

export interface ProposalCommon {
    id: bigint;
    url: string;
    status: ProposalDecisionStatus;
    tally: Tally;
    title: string;
    created: number;
    deadline: number;
    lastUpdated: number;
    rewardStatus: ProposalRewardStatus;
    summary: string;
    proposer: string;
}

export interface Tally {
    yes: number;
    no: number;
    total: number;
}

export interface NnsProposal extends ProposalCommon {
    kind: "nns";
    topic: NnsProposalTopic;
}

export enum ProposalDecisionStatus {
    Unspecified,
    Failed,
    Open,
    Rejected,
    Executed,
    Adopted,
}

export enum ProposalRewardStatus {
    Unspecified,
    AcceptVotes,
    ReadyToSettle,
    Settled,
}

export enum NnsProposalTopic {
    Unspecified,
    NeuronManagement,
    ExchangeRate,
    NetworkEconomics,
    Governance,
    NodeAdmin,
    ParticipantManagement,
    SubnetManagement,
    NetworkCanisterManagement,
    KYC,
    NodeProviderRewards,
    SnsDecentralizationSale,
}

export interface SnsProposal extends ProposalCommon {
    kind: "sns";
    action: number;
}

export interface ImageContent extends DataContent {
    kind: "image_content";
    height: number;
    width: number;
    thumbnailData: string;
    caption?: string;
    mimeType: string;
}

export interface VideoContent {
    kind: "video_content";
    height: number;
    width: number;
    thumbnailData: string;
    caption?: string;
    mimeType: string;
    imageData: DataContent;
    videoData: DataContent;
}

export interface AudioContent extends DataContent {
    kind: "audio_content";
    caption?: string;
    mimeType: string;
}

export type DeletedContent = {
    kind: "deleted_content";
    deletedBy: string;
    timestamp: bigint;
};

export type PollContent = {
    kind: "poll_content";
    votes: PollVotes;
    config: PollConfig;
    ended: boolean;
};

export type PollVotes = {
    total: TotalPollVotes;
    user: number[];
};

export type PollConfig = {
    allowMultipleVotesPerUser: boolean;
    text?: string;
    showVotesBeforeEndDate: boolean;
    endDate?: bigint;
    anonymous: boolean;
    options: string[];
};

export type TotalPollVotes = AnonymousPollVotes | VisiblePollVotes | HiddenPollVotes;

export type AnonymousPollVotes = {
    kind: "anonymous_poll_votes";
    votes: Record<number, number>;
};

export type VisiblePollVotes = {
    kind: "visible_poll_votes";
    votes: Record<number, string[]>;
};

export type HiddenPollVotes = {
    kind: "hidden_poll_votes";
    votes: number;
};

export interface TextContent {
    kind: "text_content";
    text: string;
}

export type StoredMediaContent = FileContent | VideoContent | AudioContent | ImageContent;

export interface FileContent extends DataContent {
    kind: "file_content";
    name: string;
    caption?: string;
    mimeType: string;
    fileSize: number;
}

export type ReplyContext = RawReplyContext | RehydratedReplyContext;

export type RawReplyContext = {
    kind: "raw_reply_context";
    eventIndex: number;
    chatIdIfOther?: string;
};

export type RehydratedReplyContext = {
    kind: "rehydrated_reply_context";
    content: MessageContent;
    senderId: string;
    messageId: bigint;
    messageIndex: number;
    eventIndex: number;
    chatId: string;
    edited: boolean;
};

export type EnhancedReplyContext = RehydratedReplyContext & {
    sender?: PartialUserSummary;
    content: MessageContent;
};

export type Message = {
    kind: "message";
    messageId: bigint;
    messageIndex: number;
    sender: string;
    content: MessageContent;
    repliesTo?: ReplyContext;
    reactions: Reaction[];
    edited: boolean;
    forwarded: boolean;
    thread?: ThreadSummary;
};

export type ThreadSummary = {
    participantIds: Set<string>;
    numberOfReplies: number;
    latestEventIndex: number;
    latestEventTimestamp: bigint;
};

export type LocalReaction = {
    reaction: string;
    kind: "add" | "remove";
    userId: string; // this can actually be a remote user via rtc
};

export type Reaction = {
    reaction: string;
    userIds: Set<string>;
};

export type LocalPollVote = {
    answerIndex: number;
    type: "register" | "delete";
    userId: string;
};

export type LocalMessageUpdates = {
    deleted?: {
        deletedBy: string,
        timestamp: bigint,
    };
    editedContent?: MessageContent,
    reactions?: LocalReaction[];
    pollVotes?: LocalPollVote[];
    lastUpdated: number;
};

export type EventsResponse<T extends ChatEvent> = "events_failed" | EventsSuccessResult<T>;

export type DirectChatEvent =
    | Message
    | MessageDeleted
    | MessageEdited
    | ReactionAdded
    | ReactionRemoved
    | PollVoteDeleted
    | PollVoteRegistered
    | PollEnded
    | DirectChatCreated
    | ThreadUpdated;

export type GroupChatEvent =
    | Message
    | GroupChatCreated
    | MembersAdded
    | MemberJoined
    | AggregateMembersJoinedOrLeft
    | MembersRemoved
    | MemberLeft
    | GroupNameChanged
    | AvatarChanged
    | MessageDeleted
    | MessageEdited
    | ReactionAdded
    | ReactionRemoved
    | GroupDescChanged
    | UsersBlocked
    | UsersUnblocked
    | MemberAssumesSuperAdmin
    | MemberRelinquishesSuperAdmin
    | MemberDismissedAsSuperAdmin
    | RoleChanged
    | OwnershipTransferred
    | MessagePinned
    | MessageUnpinned
    | PollVoteRegistered
    | PollVoteDeleted
    | PollEnded
    | PermissionsChanged
    | GroupVisibilityChanged
    | GroupInviteCodeChanged
    | DirectChatCreated
    | ThreadUpdated
    | ProposalsUpdated;

export type ChatEvent = GroupChatEvent | DirectChatEvent;

export type MembersAdded = {
    kind: "members_added";
    userIds: string[];
    addedBy: string;
};

export type AggregateMembersJoinedOrLeft = {
    kind: "aggregate_members_joined_left";
    users_joined: Set<string>;
    users_left: Set<string>;
};

export type MemberJoined = {
    kind: "member_joined";
    userId: string;
};

export type MemberLeft = {
    kind: "member_left";
    userId: string;
};

export type GroupNameChanged = {
    kind: "name_changed";
    changedBy: string;
};

export type GroupDescChanged = {
    kind: "desc_changed";
    changedBy: string;
};

export type AvatarChanged = {
    kind: "avatar_changed";
    changedBy: string;
};

export type MessageDeleted = {
    kind: "message_deleted";
    message: StaleMessage;
};

export type MessageEdited = {
    kind: "message_edited";
    message: StaleMessage;
};

export type ReactionAdded = {
    kind: "reaction_added";
    message: StaleMessage;
};

export type ReactionRemoved = {
    kind: "reaction_removed";
    message: StaleMessage;
};

export type StaleMessage = {
    updatedBy: string;
    eventIndex: number;
    messageId: bigint;
};

export type UsersBlocked = {
    kind: "users_blocked";
    userIds: string[];
    blockedBy: string;
};

export type UsersUnblocked = {
    kind: "users_unblocked";
    userIds: string[];
    unblockedBy: string;
};

export type MembersRemoved = {
    kind: "members_removed";
    userIds: string[];
    removedBy: string;
};

export type OwnershipTransferred = {
    kind: "ownership_transferred";
    oldOwner: string;
    newOwner: string;
};

export type MemberAssumesSuperAdmin = {
    kind: "member_assumes_super_admin";
    userId: string;
};

export type MemberRelinquishesSuperAdmin = {
    kind: "member_relinquishes_super_admin";
    userId: string;
};

export type MemberDismissedAsSuperAdmin = {
    kind: "member_dismissed_as_super_admin";
    userId: string;
};

export type PollVoteRegistered = {
    kind: "poll_vote_registered";
    message: StaleMessage;
};

export type PollVoteDeleted = {
    kind: "poll_vote_deleted";
    message: StaleMessage;
};

export type PollEnded = {
    kind: "poll_ended";
    messageIndex: number;
    eventIndex: number;
};

export type ThreadUpdated = {
    kind: "thread_updated";
    messageIndex: number;
    eventIndex: number;
};

export type ProposalsUpdated = {
    kind: "proposals_updated";
    proposals: {
        messageIndex: number;
        eventIndex: number;
    }[];
};

export type PermissionsChanged = {
    kind: "permissions_changed";
    oldPermissions: GroupPermissions;
    newPermissions: GroupPermissions;
    changedBy: string;
};

export type GroupVisibilityChanged = {
    kind: "group_visibility_changed";
    nowPublic: boolean;
    changedBy: string;
};

export type GroupInviteCodeChanged = {
    kind: "group_invite_code_changed";
    change: GroupInviteCodeChange;
    changedBy: string;
};

export type GroupInviteCodeChange = "enabled" | "disabled" | "reset";

export type MessagePinned = {
    kind: "message_pinned";
    pinnedBy: string;
    messageIndex: number;
};

export type MessageUnpinned = {
    kind: "message_unpinned";
    unpinnedBy: string;
    messageIndex: number;
};

export type RoleChanged = {
    kind: "role_changed";
    userIds: string[];
    changedBy: string;
    oldRole: MemberRole;
    newRole: MemberRole;
};

export type PinnedMessageUpdated = {
    kind: "pinned_message_updated";
    newValue: number | undefined; // MessageIndex
    updatedBy: string;
};

export type GroupChatCreated = {
    kind: "group_chat_created";
    name: string;
    description: string;
    created_by: string;
};

export type DirectChatCreated = {
    kind: "direct_chat_created";
};

export type EventWrapper<T extends ChatEvent> = {
    event: T;
    timestamp: bigint;
    index: number;
};

export type EventsSuccessResult<T extends ChatEvent> = {
    events: EventWrapper<T>[];
    affectedEvents: EventWrapper<T>[];
    latestEventIndex: number | undefined;
};

export type GroupChatUpdatesSince = {
    updatesSince: bigint;
    chatId: string;
};

export type UpdatesSince = {
    groupChats: { lastUpdated: bigint; chatId: string }[];
    timestamp: bigint;
};

export type UpdateArgs = {
    updatesSince: UpdatesSince;
};

export type MergedUpdatesResponse = {
    wasUpdated: boolean;
    chatSummaries: ChatSummary[];
    blockedUsers: Set<string>;
    pinnedChats: string[];
    avatarIdUpdate: OptionUpdate<bigint>;
    affectedEvents: Record<string, number[]>;
    timestamp: bigint;
};

export type CurrentChatState = {
    chatSummaries: ChatSummary[];
    blockedUsers: Set<string>;
    pinnedChats: string[];
};

export type UpdatesResponse = {
    blockedUsers: Set<string> | undefined;
    pinnedChats: string[] | undefined;
    chatsUpdated: ChatSummaryUpdates[];
    chatsAdded: ChatSummary[];
    chatsRemoved: Set<string>;
    avatarIdUpdate: OptionUpdate<bigint>;
    timestamp: bigint;
    cyclesBalance?: bigint;
    transactions: CryptocurrencyTransfer[];
};

export type InitialStateResponse = {
    blockedUsers: Set<string>;
    pinnedChats: string[];
    chats: ChatSummary[];
    timestamp: bigint;
    cyclesBalance: bigint;
};

export type ChatSummaryUpdates = DirectChatSummaryUpdates | GroupChatSummaryUpdates;

type ChatSummaryUpdatesCommon = {
    chatId: string;
    readByMe?: DRange;
    latestEventIndex?: number;
    latestMessage?: EventWrapper<Message>;
    notificationsMuted?: boolean;
    affectedEvents: number[];
    metrics?: ChatMetrics;
    myMetrics?: ChatMetrics;
    archived?: boolean;
};

export type DirectChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    kind: "direct_chat";
    readByThem?: DRange;
};

export type GroupChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    kind: "group_chat";
    lastUpdated: bigint;
    name?: string;
    description?: string;
    avatarBlobReferenceUpdate?: OptionUpdate<BlobReference>;
    memberCount?: number;
    myRole?: MemberRole;
    mentions: Mention[];
    ownerId?: string;
    permissions?: GroupPermissions;
    public?: boolean;
    latestThreads?: ThreadSyncDetailsUpdates[];
    subtype: GroupSubtypeUpdate;
};

export type GroupSubtypeUpdate =
    | { kind: "no_change" }
    | { kind: "set_to_none" }
    | { kind: "set_to_some"; subtype: GroupSubtype };

export type ThreadSyncDetailsUpdates = {
    threadRootMessageIndex: number;
    lastUpdated: bigint;
    readUpTo?: number;
    latestEventIndex?: number;
    latestMessageIndex?: number;
};

export type ThreadSyncDetails = {
    threadRootMessageIndex: number;
    lastUpdated: bigint;
    readUpTo?: number;
    latestEventIndex: number;
    latestMessageIndex: number;
};

export type MemberRole = "admin" | "participant" | "owner" | "super_admin" | "previewer";

export type Member = {
    role: MemberRole;
    userId: string;
};

export type FullMember = Member & PartialUserSummary & { memberKind: "full_member" };
export type BlockedMember = Member & PartialUserSummary & { memberKind: "blocked_member" };

export type PermissionRole = "owner" | "admins" | "members";

export type GroupPermissions = {
    changePermissions: PermissionRole;
    changeRoles: PermissionRole;
    addMembers: PermissionRole;
    removeMembers: PermissionRole;
    blockUsers: PermissionRole;
    deleteMessages: PermissionRole;
    updateGroup: PermissionRole;
    pinMessages: PermissionRole;
    inviteUsers: PermissionRole;
    createPolls: PermissionRole;
    sendMessages: PermissionRole;
    reactToMessages: PermissionRole;
    replyInThread: PermissionRole;
};

export type GroupChatDetailsResponse = "caller_not_in_group" | GroupChatDetails;

export type GroupChatDetailsUpdatesResponse =
    | ({ kind: "success" } & GroupChatDetailsUpdates)
    | { kind: "success_no_updates"; latestEventIndex: number }
    | "caller_not_in_group";

export type GroupChatDetails = {
    members: Member[];
    blockedUsers: Set<string>;
    pinnedMessages: Set<number>;
    latestEventIndex: number;
};

export type GroupChatDetailsUpdates = {
    membersAddedOrUpdated: Member[];
    membersRemoved: Set<string>;
    blockedUsersAdded: Set<string>;
    blockedUsersRemoved: Set<string>;
    pinnedMessagesRemoved: Set<number>;
    pinnedMessagesAdded: Set<number>;
    latestEventIndex: number;
};

export type ChatSummary = DirectChatSummary | GroupChatSummary;

type ChatSummaryCommon = {
    chatId: string; // this represents a Principal
    readByMe: DRange;
    latestEventIndex: number;
    latestMessage?: EventWrapper<Message>;
    notificationsMuted: boolean;
    metrics: ChatMetrics;
    myMetrics: ChatMetrics;
    archived: boolean;
};

export type DirectChatSummary = ChatSummaryCommon & {
    kind: "direct_chat";
    them: string;
    readByThem: DRange;
    dateCreated: bigint;
};

export type GroupChatSummary = DataContent &
    ChatSummaryCommon & {
        kind: "group_chat";
        name: string;
        description: string;
        joined: bigint;
        minVisibleEventIndex: number;
        minVisibleMessageIndex: number;
        lastUpdated: bigint;
        memberCount: number;
        mentions: Mention[];
        ownerId: string;
        public: boolean;
        myRole: MemberRole;
        permissions: GroupPermissions;
        historyVisibleToNewJoiners: boolean;
        latestThreads: ThreadSyncDetails[];
        subtype: GroupSubtype;
    };

export type GroupSubtype = GovernanceProposalsSubtype | undefined;

export type GovernanceProposalsSubtype = {
    kind: "governance_proposals";
    isNns: boolean;
    governanceCanisterId: string;
};

export type Mention = {
    messageId: bigint;
    eventIndex: number;
    mentionedBy: string;
    messageIndex: number;
};

export type CandidateMember = {
    role: MemberRole;
    user: UserSummary;
};

export type CandidateGroupChat = {
    name: string;
    description: string;
    historyVisible: boolean;
    isPublic: boolean;
    members: CandidateMember[];
    avatar?: DataContent;
    permissions: GroupPermissions;
};

// todo - there are all sorts of error conditions here that we need to deal with but - later
export type CreateGroupResponse =
    | CreateGroupSuccess
    | CreateGroupInternalError
    | CreateGroupNameTooShort
    | CreateGroupNameTooLong
    | CreateGroupNameReserved
    | CreateGroupDescriptionTooLong
    | GroupNameTaken
    | AvatarTooBig
    | MaxGroupsCreated
    | CreateGroupThrottled;

export type CreateGroupSuccess = {
    kind: "success";
    canisterId: string;
};

export type CreateGroupInternalError = InternalError;

export type CreateGroupInvalidName = {
    kind: "invalid_name";
};

export type CreateGroupNameTooLong = {
    kind: "name_too_long";
};

export type CreateGroupNameTooShort = {
    kind: "name_too_short";
};

export type CreateGroupNameReserved = {
    kind: "name_reserved";
};

export type CreateGroupDescriptionTooLong = {
    kind: "description_too_long";
};

export type GroupNameTaken = {
    kind: "group_name_taken";
};

export type AvatarTooBig = {
    kind: "avatar_too_big";
};

export type MaxGroupsCreated = {
    kind: "max_groups_created";
};

export type CreateGroupThrottled = {
    kind: "throttled";
};

export type AddMembersResponse =
    | AddMembersSuccess
    | AddMembersNotAuthorised
    | MemberLimitReached
    | AddMembersPartialSuccess
    | AddMembersFailed
    | AddMembersNotInGroup;

export type AddMembersSuccess = {
    kind: "add_members_success";
};

export type AddMembersNotInGroup = {
    kind: "add_members_not_in_group";
};

export type AddMembersNotAuthorised = {
    kind: "add_members_not_authorised";
};

export type MemberLimitReached = {
    kind: "member_limit_reached";
};

export type AddMembersPartialSuccess = {
    kind: "add_members_partial_success";
    usersAdded: string[];
    usersAlreadyInGroup: string[];
    usersBlockedFromGroup: string[];
    usersWhoBlockedRequest: string[];
    errors: string[];
};

export type AddMembersFailed = {
    kind: "add_members_failed";
    usersAlreadyInGroup: string[];
    usersBlockedFromGroup: string[];
    usersWhoBlockedRequest: string[];
    errors: string[];
};

export type EditMessageResponse =
    | "success"
    | "chat_not_found"
    | "message_not_found"
    | "user_blocked"
    | "not_in_group";

export type SendMessageResponse =
    | SendMessageSuccess
    | SendMessageRecipientBlocked
    | SendMessageInvalidRequest
    | SendMessageTooLong
    | SendMessageEmpty
    | TransferCannotBeZero
    | SendMessageRecipientNotFound
    | TransferFailed
    | TransferLimitExceeded
    | TransferSuccess
    | InvalidPoll
    | SendMessageNotInGroup
    | CallerNotInGroup
    | InternalError
    | CryptoCurrencyNotSupported
    | NotAuthorised
    | ThreadMessageNotFound;

export type SendMessageSuccess = {
    kind: "success";
    timestamp: bigint;
    messageIndex: number;
    eventIndex: number;
};

export type TransferSuccess = {
    kind: "transfer_success";
    timestamp: bigint;
    messageIndex: number;
    eventIndex: number;
    transfer: CompletedCryptocurrencyTransfer;
};

export type InvalidPoll = {
    kind: "invalid_poll";
};

export type ThreadMessageNotFound = {
    kind: "thread_message_not_found";
};

export type CryptoCurrencyNotSupported = {
    kind: "cryptocurrency_not_supported";
};

export type TransferFailed = {
    kind: "transfer_failed";
};

export type TransferLimitExceeded = {
    kind: "transfer_limit_exceeded";
};

export type TransferCannotBeZero = {
    kind: "transfer_cannot_be_zero";
};

export type SendMessageRecipientBlocked = {
    kind: "recipient_blocked";
};

export type SendMessageInvalidRequest = {
    kind: "invalid_request";
    reason: string;
};

export type SendMessageTooLong = {
    kind: "text_too_long";
};

export type SendMessageEmpty = {
    kind: "message_empty";
};

export type SendMessageRecipientNotFound = {
    kind: "recipient_not_found";
};

export type SendMessageNotInGroup = {
    kind: "not_in_group";
};

export type NotAuthorised = {
    kind: "not_authorised";
};

export type SetAvatarResponse = "avatar_too_big" | "success" | "internal_error";

export type ChangeRoleResponse =
    | "user_not_in_group"
    | "caller_not_in_group"
    | "not_authorised"
    | "invalid"
    | "success";

export type DeleteGroupResponse = "internal_error" | "not_authorised" | "success";

export type MakeGroupPrivateResponse =
    | "internal_error"
    | "not_authorised"
    | "already_private"
    | "success";

export type RemoveMemberResponse =
    | "user_not_in_group"
    | "caller_not_in_group"
    | "not_authorised"
    | "success"
    | "cannot_remove_self"
    | "cannot_remove_user"
    | "internal_error";

export type BlockUserResponse =
    | "success"
    | "group_not_public"
    | "user_not_in_group"
    | "caller_not_in_group"
    | "not_authorised"
    | "internal_error"
    | "cannot_block_self"
    | "cannot_block_user";

export type UnblockUserResponse =
    | "success"
    | "group_not_public"
    | "cannot_unblock_self"
    | "caller_not_in_group"
    | "not_authorised";

export type LeaveGroupResponse =
    | "success"
    | "group_not_found"
    | "internal_error"
    | "not_in_group"
    | "owner_cannot_leave"
    | "group_not_public";

export type JoinGroupResponse =
    | GroupChatSummary
    | { kind: "blocked" }
    | { kind: "group_not_found" }
    | { kind: "group_not_public" }
    | { kind: "already_in_group" }
    | { kind: "not_super_admin" }
    | { kind: "member_limit_reached" }
    | InternalError;

export type MarkReadRequest = {
    ranges: DRange;
    chatId: string;
    threads: ThreadRead[];
}[];

export type ThreadRead = {
    threadRootMessageIndex: number;
    readUpTo: number;
};

export type MarkReadResponse = "success";

export type UpdateGroupResponse =
    | "success"
    | "not_authorised"
    | "name_too_short"
    | "name_too_long"
    | "name_reserved"
    | "desc_too_long"
    | "unchanged"
    | "name_taken"
    | "not_in_group"
    | "avatar_too_big"
    | "internal_error";

export type UpdatePermissionsResponse = "success" | "not_authorised" | "not_in_group";

export type AddRemoveReactionResponse =
    | "success"
    | "no_change"
    | "invalid"
    | "message_not_found"
    | "not_in_group"
    | "not_authorised"
    | "chat_not_found";

export type DeleteMessageResponse =
    | "not_in_group"
    | "chat_not_found"
    | "success"
    | "message_not_found";

export type SerializableMergedUpdatesResponse = Omit<MergedUpdatesResponse, "chatSummaries"> & {
    chatSummaries: SerializableChatSummary[];
};
export type SerializableChatSummary = SerializableDirectChatSummary | SerializableGroupChatSummary;
export type SerializableDirectChatSummary = Omit<DirectChatSummary, "readByMe" | "readByThem"> & {
    readByMe: IndexRange[];
    readByThem: IndexRange[];
};
export type SerializableGroupChatSummary = Omit<GroupChatSummary, "readByMe"> & {
    readByMe: IndexRange[];
};

export type ScrollStrategy = "latestMessage" | "firstMessage" | "firstMention";

export type UnpinMessageResponse =
    | "no_change"
    | "caller_not_in_group"
    | "not_authorised"
    | "message_not_found"
    | "success";

export type PinMessageResponse =
    | "index_out_of_range"
    | "no_change"
    | "caller_not_in_group"
    | "not_authorised"
    | "message_not_found"
    | "success";

export type RegisterPollVoteResponse =
    | "caller_not_in_group"
    | "poll_ended"
    | "success"
    | "out_of_range"
    | "poll_not_found"
    | "chat_not_found"
    | "polls_not_valid_for_direct_chats";

export type InviteCodeResponse = InviteCodeSuccess | NotAuthorised;

export type InviteCodeSuccess = {
    kind: "success";
    code?: string;
};

export type EnableInviteCodeResponse = EnableInviteCodeSuccess | NotAuthorised;

export type EnableInviteCodeSuccess = {
    kind: "success";
    code: string;
};

export type DisableInviteCodeResponse = "not_authorised" | "success";

export type ResetInviteCodeResponse = ResetInviteCodeSuccess | NotAuthorised;

export type ThreadPreviewsResponse = CallerNotInGroup | ThreadPreviewsSuccess;

export type ThreadPreviewsSuccess = {
    kind: "thread_previews_success";
    threads: ThreadPreview[];
};

export type ThreadPreview = {
    chatId: string;
    latestReplies: EventWrapper<Message>[];
    totalReplies: number;
    rootMessage: EventWrapper<Message>;
};

export type ResetInviteCodeSuccess = {
    kind: "success";
    code: string;
};

export type MessageAction = "emoji" | "file" | undefined;

export type ChatMetrics = {
    audioMessages: number;
    cyclesMessages: number;
    edits: number;
    icpMessages: number;
    giphyMessages: number;
    deletedMessages: number;
    fileMessages: number;
    pollVotes: number;
    textMessages: number;
    imageMessages: number;
    replies: number;
    videoMessages: number;
    polls: number;
    reactions: number;
};

export type RegisterProposalVoteResponse =
    | "success"
    | "already_voted"
    | "caller_not_in_group"
    | "no_eligible_neurons"
    | "proposal_message_not_found"
    | "proposal_not_found"
    | "proposal_not_accepting_votes"
    | "internal_error";

export type ListNervousSystemFunctionsResponse = {
    reservedIds: bigint[];
    functions: NervousSystemFunction[];
};

export type NervousSystemFunction = {
    id: number;
    name: string;
    description: string;
    functionType?: SnsFunctionType;
};

export type SnsFunctionType =
    | { kind: "native_nervous_system_function" }
    | { kind: "generic_nervous_system_function" };
