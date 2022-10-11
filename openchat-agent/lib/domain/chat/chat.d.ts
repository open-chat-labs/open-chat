import type { BlobReference, DataContent } from "../data/data";
import type { PartialUserSummary, UserSummary } from "../user/user";
import type { OptionUpdate } from "../optionUpdate";
import type { Cryptocurrency } from "../crypto";
export declare type InternalError = {
    kind: "internal_error";
};
export declare type CallerNotInGroup = {
    kind: "caller_not_in_group";
};
export declare type MessageContent = FileContent | TextContent | ImageContent | VideoContent | AudioContent | DeletedContent | PlaceholderContent | PollContent | CryptocurrencyContent | GiphyContent | ProposalContent;
export declare type IndexRange = [number, number];
export interface PlaceholderContent {
    kind: "placeholder_content";
}
export declare type CryptocurrencyDeposit = {
    token: Cryptocurrency;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    blockIndex: bigint;
    fromAddress: string;
};
export declare type PendingCryptocurrencyWithdrawal = {
    kind: "pending";
    token: Cryptocurrency;
    to: string;
    amountE8s: bigint;
    feeE8s?: bigint;
    memo?: bigint;
};
export declare type CompletedCryptocurrencyWithdrawal = {
    kind: "completed";
    token: Cryptocurrency;
    to: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    blockIndex: bigint;
    transactionHash: string;
};
export declare type FailedCryptocurrencyWithdrawal = {
    kind: "failed";
    token: Cryptocurrency;
    to: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    errorMessage: string;
};
export declare type WithdrawCryptocurrencyResponse = {
    kind: "currency_not_supported";
} | FailedCryptocurrencyWithdrawal | CompletedCryptocurrencyWithdrawal;
export declare type CryptocurrencyWithdrawal = PendingCryptocurrencyWithdrawal | CompletedCryptocurrencyWithdrawal | FailedCryptocurrencyWithdrawal;
export declare type CompletedCryptocurrencyTransfer = {
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
export declare type PendingCryptocurrencyTransfer = {
    kind: "pending";
    token: Cryptocurrency;
    recipient: string;
    amountE8s: bigint;
    feeE8s?: bigint;
    memo?: bigint;
};
export declare type FailedCryptocurrencyTransfer = {
    kind: "failed";
    token: Cryptocurrency;
    recipient: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    errorMessage: string;
};
export declare type CryptocurrencyTransfer = CompletedCryptocurrencyTransfer | PendingCryptocurrencyTransfer | FailedCryptocurrencyTransfer;
export declare type CryptocurrencyTransaction = CryptocurrencyTransfer | CryptocurrencyWithdrawal | CryptocurrencyDeposit;
export interface CryptocurrencyContent {
    kind: "crypto_content";
    caption?: string;
    transfer: CryptocurrencyTransfer;
}
export declare type GiphyImage = {
    height: number;
    width: number;
    url: string;
    mimeType: string;
};
export interface GiphyContent {
    kind: "giphy_content";
    caption?: string;
    title: string;
    desktop: GiphyImage;
    mobile: GiphyImage;
}
export interface ProposalContent {
    kind: "proposal_content";
    governanceCanisterId: string;
    proposal: Proposal;
    myVote?: boolean;
}
export declare type Proposal = NnsProposal | SnsProposal;
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
export declare enum ProposalDecisionStatus {
    Unspecified = 0,
    Failed = 1,
    Open = 2,
    Rejected = 3,
    Executed = 4,
    Adopted = 5
}
export declare enum ProposalRewardStatus {
    Unspecified = 0,
    AcceptVotes = 1,
    ReadyToSettle = 2,
    Settled = 3
}
export declare enum NnsProposalTopic {
    Unspecified = 0,
    NeuronManagement = 1,
    ExchangeRate = 2,
    NetworkEconomics = 3,
    Governance = 4,
    NodeAdmin = 5,
    ParticipantManagement = 6,
    SubnetManagement = 7,
    NetworkCanisterManagement = 8,
    KYC = 9,
    NodeProviderRewards = 10,
    SnsDecentralizationSale = 11
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
export declare type DeletedContent = {
    kind: "deleted_content";
    deletedBy: string;
    timestamp: bigint;
};
export declare type PollContent = {
    kind: "poll_content";
    votes: PollVotes;
    config: PollConfig;
    ended: boolean;
};
export declare type PollVotes = {
    total: TotalPollVotes;
    user: number[];
};
export declare type PollConfig = {
    allowMultipleVotesPerUser: boolean;
    text?: string;
    showVotesBeforeEndDate: boolean;
    endDate?: bigint;
    anonymous: boolean;
    options: string[];
};
export declare type TotalPollVotes = AnonymousPollVotes | VisiblePollVotes | HiddenPollVotes;
export declare type AnonymousPollVotes = {
    kind: "anonymous_poll_votes";
    votes: Record<number, number>;
};
export declare type VisiblePollVotes = {
    kind: "visible_poll_votes";
    votes: Record<number, string[]>;
};
export declare type HiddenPollVotes = {
    kind: "hidden_poll_votes";
    votes: number;
};
export interface TextContent {
    kind: "text_content";
    text: string;
}
export declare type StoredMediaContent = FileContent | VideoContent | AudioContent | ImageContent;
export interface FileContent extends DataContent {
    kind: "file_content";
    name: string;
    caption?: string;
    mimeType: string;
    fileSize: number;
}
export declare type ReplyContext = RawReplyContext | RehydratedReplyContext;
export declare type RawReplyContext = {
    kind: "raw_reply_context";
    eventIndex: number;
    chatIdIfOther?: string;
};
export declare type RehydratedReplyContext = {
    kind: "rehydrated_reply_context";
    content: MessageContent;
    senderId: string;
    messageId: bigint;
    messageIndex: number;
    eventIndex: number;
    chatId: string;
    edited: boolean;
};
export declare type EnhancedReplyContext = RehydratedReplyContext & {
    sender?: PartialUserSummary;
    content: MessageContent;
};
export declare type Message = {
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
export declare type ThreadSummary = {
    participantIds: Set<string>;
    numberOfReplies: number;
    latestEventIndex: number;
    latestEventTimestamp: bigint;
};
export declare type LocalReaction = {
    reaction: string;
    kind: "add" | "remove";
    userId: string;
};
export declare type Reaction = {
    reaction: string;
    userIds: Set<string>;
};
export declare type LocalPollVote = {
    answerIndex: number;
    type: "register" | "delete";
    userId: string;
};
export declare type LocalMessageUpdates = {
    deleted?: {
        deletedBy: string;
        timestamp: bigint;
    };
    editedContent?: MessageContent;
    reactions?: LocalReaction[];
    pollVotes?: LocalPollVote[];
    threadSummary?: ThreadSummary;
    lastUpdated: number;
};
export declare type EventsResponse<T extends ChatEvent> = "events_failed" | EventsSuccessResult<T>;
export declare type DirectChatEvent = Message | MessageDeleted | MessageEdited | ReactionAdded | ReactionRemoved | PollVoteDeleted | PollVoteRegistered | PollEnded | DirectChatCreated | ThreadUpdated;
export declare type GroupChatEvent = Message | GroupChatCreated | MembersAdded | MemberJoined | AggregateMembersJoinedOrLeft | MembersRemoved | MemberLeft | GroupNameChanged | AvatarChanged | MessageDeleted | MessageEdited | ReactionAdded | ReactionRemoved | GroupDescChanged | GroupRulesChanged | UsersBlocked | UsersUnblocked | MemberAssumesSuperAdmin | MemberRelinquishesSuperAdmin | MemberDismissedAsSuperAdmin | RoleChanged | OwnershipTransferred | MessagePinned | MessageUnpinned | PollVoteRegistered | PollVoteDeleted | PollEnded | PermissionsChanged | GroupVisibilityChanged | GroupInviteCodeChanged | DirectChatCreated | ThreadUpdated | ProposalsUpdated;
export declare type ChatEvent = GroupChatEvent | DirectChatEvent;
export declare type MembersAdded = {
    kind: "members_added";
    userIds: string[];
    addedBy: string;
};
export declare type AggregateMembersJoinedOrLeft = {
    kind: "aggregate_members_joined_left";
    users_joined: Set<string>;
    users_left: Set<string>;
};
export declare type MemberJoined = {
    kind: "member_joined";
    userId: string;
};
export declare type MemberLeft = {
    kind: "member_left";
    userId: string;
};
export declare type GroupNameChanged = {
    kind: "name_changed";
    changedBy: string;
};
export declare type GroupDescChanged = {
    kind: "desc_changed";
    changedBy: string;
};
export declare type GroupRulesChanged = {
    kind: "rules_changed";
    enabled: boolean;
    enabledPrev: boolean;
    changedBy: string;
};
export declare type AvatarChanged = {
    kind: "avatar_changed";
    changedBy: string;
};
export declare type MessageDeleted = {
    kind: "message_deleted";
    message: StaleMessage;
};
export declare type MessageEdited = {
    kind: "message_edited";
    message: StaleMessage;
};
export declare type ReactionAdded = {
    kind: "reaction_added";
    message: StaleMessage;
};
export declare type ReactionRemoved = {
    kind: "reaction_removed";
    message: StaleMessage;
};
export declare type StaleMessage = {
    updatedBy: string;
    eventIndex: number;
    messageId: bigint;
};
export declare type UsersBlocked = {
    kind: "users_blocked";
    userIds: string[];
    blockedBy: string;
};
export declare type UsersUnblocked = {
    kind: "users_unblocked";
    userIds: string[];
    unblockedBy: string;
};
export declare type MembersRemoved = {
    kind: "members_removed";
    userIds: string[];
    removedBy: string;
};
export declare type OwnershipTransferred = {
    kind: "ownership_transferred";
    oldOwner: string;
    newOwner: string;
};
export declare type MemberAssumesSuperAdmin = {
    kind: "member_assumes_super_admin";
    userId: string;
};
export declare type MemberRelinquishesSuperAdmin = {
    kind: "member_relinquishes_super_admin";
    userId: string;
};
export declare type MemberDismissedAsSuperAdmin = {
    kind: "member_dismissed_as_super_admin";
    userId: string;
};
export declare type PollVoteRegistered = {
    kind: "poll_vote_registered";
    message: StaleMessage;
};
export declare type PollVoteDeleted = {
    kind: "poll_vote_deleted";
    message: StaleMessage;
};
export declare type PollEnded = {
    kind: "poll_ended";
    messageIndex: number;
    eventIndex: number;
};
export declare type ThreadUpdated = {
    kind: "thread_updated";
    messageIndex: number;
    eventIndex: number;
};
export declare type ProposalsUpdated = {
    kind: "proposals_updated";
    proposals: {
        messageIndex: number;
        eventIndex: number;
    }[];
};
export declare type PermissionsChanged = {
    kind: "permissions_changed";
    oldPermissions: GroupPermissions;
    newPermissions: GroupPermissions;
    changedBy: string;
};
export declare type GroupVisibilityChanged = {
    kind: "group_visibility_changed";
    nowPublic: boolean;
    changedBy: string;
};
export declare type GroupInviteCodeChanged = {
    kind: "group_invite_code_changed";
    change: GroupInviteCodeChange;
    changedBy: string;
};
export declare type GroupInviteCodeChange = "enabled" | "disabled" | "reset";
export declare type MessagePinned = {
    kind: "message_pinned";
    pinnedBy: string;
    messageIndex: number;
};
export declare type MessageUnpinned = {
    kind: "message_unpinned";
    unpinnedBy: string;
    messageIndex: number;
};
export declare type RoleChanged = {
    kind: "role_changed";
    userIds: string[];
    changedBy: string;
    oldRole: MemberRole;
    newRole: MemberRole;
};
export declare type PinnedMessageUpdated = {
    kind: "pinned_message_updated";
    newValue: number | undefined;
    updatedBy: string;
};
export declare type GroupChatCreated = {
    kind: "group_chat_created";
    name: string;
    description: string;
    created_by: string;
};
export declare type DirectChatCreated = {
    kind: "direct_chat_created";
};
export declare type EventWrapper<T extends ChatEvent> = {
    event: T;
    timestamp: bigint;
    index: number;
};
export declare type EventsSuccessResult<T extends ChatEvent> = {
    events: EventWrapper<T>[];
    affectedEvents: EventWrapper<T>[];
    latestEventIndex: number | undefined;
};
export declare type GroupChatUpdatesSince = {
    updatesSince: bigint;
    chatId: string;
};
export declare type UpdatesSince = {
    groupChats: {
        lastUpdated: bigint;
        chatId: string;
    }[];
    timestamp: bigint;
};
export declare type UpdateArgs = {
    updatesSince: UpdatesSince;
};
export declare type MergedUpdatesResponse = {
    wasUpdated: boolean;
    chatSummaries: ChatSummary[];
    blockedUsers: Set<string>;
    pinnedChats: string[];
    avatarIdUpdate: OptionUpdate<bigint>;
    affectedEvents: Record<string, number[]>;
    timestamp: bigint;
};
export declare type CurrentChatState = {
    chatSummaries: ChatSummary[];
    blockedUsers: Set<string>;
    pinnedChats: string[];
};
export declare type UpdatesResponse = {
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
export declare type InitialStateResponse = {
    blockedUsers: Set<string>;
    pinnedChats: string[];
    chats: ChatSummary[];
    timestamp: bigint;
    cyclesBalance: bigint;
};
export declare type ChatSummaryUpdates = DirectChatSummaryUpdates | GroupChatSummaryUpdates;
declare type ChatSummaryUpdatesCommon = {
    chatId: string;
    readByMeUpTo?: number;
    latestEventIndex?: number;
    latestMessage?: EventWrapper<Message>;
    notificationsMuted?: boolean;
    affectedEvents: number[];
    metrics?: ChatMetrics;
    myMetrics?: ChatMetrics;
    archived?: boolean;
};
export declare type DirectChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    kind: "direct_chat";
    readByThemUpTo?: number;
};
export declare type GroupChatSummaryUpdates = ChatSummaryUpdatesCommon & {
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
export declare type GroupSubtypeUpdate = {
    kind: "no_change";
} | {
    kind: "set_to_none";
} | {
    kind: "set_to_some";
    subtype: GroupSubtype;
};
export declare type ThreadSyncDetailsUpdates = {
    threadRootMessageIndex: number;
    lastUpdated: bigint;
    readUpTo?: number;
    latestEventIndex?: number;
    latestMessageIndex?: number;
};
export declare type ThreadSyncDetails = {
    threadRootMessageIndex: number;
    lastUpdated: bigint;
    readUpTo?: number;
    latestEventIndex: number;
    latestMessageIndex: number;
};
export declare type MemberRole = "admin" | "participant" | "owner" | "super_admin" | "previewer";
export declare type Member = {
    role: MemberRole;
    userId: string;
};
export declare type FullMember = Member & PartialUserSummary & {
    memberKind: "full_member";
};
export declare type BlockedMember = Member & PartialUserSummary & {
    memberKind: "blocked_member";
};
export declare type PermissionRole = "owner" | "admins" | "members";
export declare type GroupPermissions = {
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
export declare type GroupChatDetailsResponse = "caller_not_in_group" | GroupChatDetails;
export declare type GroupChatDetailsUpdatesResponse = ({
    kind: "success";
} & GroupChatDetailsUpdates) | {
    kind: "success_no_updates";
    latestEventIndex: number;
} | "caller_not_in_group";
export declare type GroupChatDetails = {
    members: Member[];
    blockedUsers: Set<string>;
    pinnedMessages: Set<number>;
    latestEventIndex: number;
    rules: GroupRules;
};
/**
 * This will hold all chat specific state
 * All properties are optional but individual derived stores can provide their own default values
 */
export declare type ChatSpecificState = {
    detailsLoaded: boolean;
    members: Member[];
    blockedUsers: Set<string>;
    pinnedMessages: Set<number>;
    latestEventIndex?: number;
    rules?: GroupRules;
    userIds: Set<string>;
    focusMessageIndex?: number;
    focusThreadMessageIndex?: number;
    userGroupKeys: Set<string>;
    serverEvents: EventWrapper<ChatEvent>[];
};
export declare type GroupRules = {
    text: string;
    enabled: boolean;
};
export declare const defaultGroupRules = "- Do not impersonate others in a deceptive or misleading manner\n- Do not intentionally share false or misleading information\n- Keep messages relevant to the group\n\nIf you break the rules you might be blocked and/or have your message(s) deleted.";
export declare type GroupChatDetailsUpdates = {
    membersAddedOrUpdated: Member[];
    membersRemoved: Set<string>;
    blockedUsersAdded: Set<string>;
    blockedUsersRemoved: Set<string>;
    pinnedMessagesRemoved: Set<number>;
    pinnedMessagesAdded: Set<number>;
    latestEventIndex: number;
    rules?: GroupRules;
};
export declare type ChatSummary = DirectChatSummary | GroupChatSummary;
declare type ChatSummaryCommon = {
    chatId: string;
    readByMeUpTo: number | undefined;
    latestEventIndex: number;
    latestMessage?: EventWrapper<Message>;
    notificationsMuted: boolean;
    metrics: ChatMetrics;
    myMetrics: ChatMetrics;
    archived: boolean;
};
export declare type DirectChatSummary = ChatSummaryCommon & {
    kind: "direct_chat";
    them: string;
    readByThemUpTo: number | undefined;
    dateCreated: bigint;
};
export declare type GroupChatSummary = DataContent & ChatSummaryCommon & {
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
    previewed: boolean;
};
export declare type GroupSubtype = GovernanceProposalsSubtype | undefined;
export declare type GovernanceProposalsSubtype = {
    kind: "governance_proposals";
    isNns: boolean;
    governanceCanisterId: string;
};
export declare type Mention = {
    messageId: bigint;
    eventIndex: number;
    mentionedBy: string;
    messageIndex: number;
};
export declare type CandidateMember = {
    role: MemberRole;
    user: UserSummary;
};
export declare type CandidateGroupChat = {
    name: string;
    description: string;
    rules: GroupRules;
    historyVisible: boolean;
    isPublic: boolean;
    members: CandidateMember[];
    avatar?: DataContent;
    permissions: GroupPermissions;
};
export declare type CreateGroupResponse = CreateGroupSuccess | CreateGroupInternalError | CreateGroupNameTooShort | CreateGroupNameTooLong | CreateGroupNameReserved | CreateGroupDescriptionTooLong | GroupNameTaken | AvatarTooBig | MaxGroupsCreated | CreateGroupThrottled | GroupRulesTooShort | GroupRulesTooLong;
export declare type CreateGroupSuccess = {
    kind: "success";
    canisterId: string;
};
export declare type CreateGroupInternalError = InternalError;
export declare type CreateGroupInvalidName = {
    kind: "invalid_name";
};
export declare type CreateGroupNameTooLong = {
    kind: "name_too_long";
};
export declare type CreateGroupNameTooShort = {
    kind: "name_too_short";
};
export declare type CreateGroupNameReserved = {
    kind: "name_reserved";
};
export declare type CreateGroupDescriptionTooLong = {
    kind: "description_too_long";
};
export declare type GroupNameTaken = {
    kind: "group_name_taken";
};
export declare type AvatarTooBig = {
    kind: "avatar_too_big";
};
export declare type GroupRulesTooLong = {
    kind: "rules_too_long";
};
export declare type GroupRulesTooShort = {
    kind: "rules_too_short";
};
export declare type MaxGroupsCreated = {
    kind: "max_groups_created";
};
export declare type CreateGroupThrottled = {
    kind: "throttled";
};
export declare type AddMembersResponse = AddMembersSuccess | AddMembersNotAuthorised | MemberLimitReached | AddMembersPartialSuccess | AddMembersFailed | AddMembersNotInGroup;
export declare type AddMembersSuccess = {
    kind: "add_members_success";
};
export declare type AddMembersNotInGroup = {
    kind: "add_members_not_in_group";
};
export declare type AddMembersNotAuthorised = {
    kind: "add_members_not_authorised";
};
export declare type MemberLimitReached = {
    kind: "member_limit_reached";
};
export declare type AddMembersPartialSuccess = {
    kind: "add_members_partial_success";
    usersAdded: string[];
    usersAlreadyInGroup: string[];
    usersBlockedFromGroup: string[];
    usersWhoBlockedRequest: string[];
    errors: string[];
};
export declare type AddMembersFailed = {
    kind: "add_members_failed";
    usersAlreadyInGroup: string[];
    usersBlockedFromGroup: string[];
    usersWhoBlockedRequest: string[];
    errors: string[];
};
export declare type EditMessageResponse = "success" | "chat_not_found" | "message_not_found" | "user_blocked" | "not_in_group";
export declare type SendMessageResponse = SendMessageSuccess | SendMessageRecipientBlocked | SendMessageInvalidRequest | SendMessageTooLong | SendMessageEmpty | TransferCannotBeZero | SendMessageRecipientNotFound | TransferFailed | TransferLimitExceeded | TransferSuccess | InvalidPoll | SendMessageNotInGroup | CallerNotInGroup | InternalError | CryptoCurrencyNotSupported | NotAuthorised | ThreadMessageNotFound;
export declare type SendMessageSuccess = {
    kind: "success";
    timestamp: bigint;
    messageIndex: number;
    eventIndex: number;
};
export declare type TransferSuccess = {
    kind: "transfer_success";
    timestamp: bigint;
    messageIndex: number;
    eventIndex: number;
    transfer: CompletedCryptocurrencyTransfer;
};
export declare type InvalidPoll = {
    kind: "invalid_poll";
};
export declare type ThreadMessageNotFound = {
    kind: "thread_message_not_found";
};
export declare type CryptoCurrencyNotSupported = {
    kind: "cryptocurrency_not_supported";
};
export declare type TransferFailed = {
    kind: "transfer_failed";
};
export declare type TransferLimitExceeded = {
    kind: "transfer_limit_exceeded";
};
export declare type TransferCannotBeZero = {
    kind: "transfer_cannot_be_zero";
};
export declare type SendMessageRecipientBlocked = {
    kind: "recipient_blocked";
};
export declare type SendMessageInvalidRequest = {
    kind: "invalid_request";
    reason: string;
};
export declare type SendMessageTooLong = {
    kind: "text_too_long";
};
export declare type SendMessageEmpty = {
    kind: "message_empty";
};
export declare type SendMessageRecipientNotFound = {
    kind: "recipient_not_found";
};
export declare type SendMessageNotInGroup = {
    kind: "not_in_group";
};
export declare type NotAuthorised = {
    kind: "not_authorised";
};
export declare type SetAvatarResponse = "avatar_too_big" | "success" | "internal_error";
export declare type ChangeRoleResponse = "user_not_in_group" | "caller_not_in_group" | "not_authorised" | "invalid" | "success";
export declare type DeleteGroupResponse = "internal_error" | "not_authorised" | "success";
export declare type MakeGroupPrivateResponse = "internal_error" | "not_authorised" | "already_private" | "success";
export declare type RemoveMemberResponse = "user_not_in_group" | "caller_not_in_group" | "not_authorised" | "success" | "cannot_remove_self" | "cannot_remove_user" | "internal_error";
export declare type BlockUserResponse = "success" | "group_not_public" | "user_not_in_group" | "caller_not_in_group" | "not_authorised" | "internal_error" | "cannot_block_self" | "cannot_block_user";
export declare type UnblockUserResponse = "success" | "group_not_public" | "cannot_unblock_self" | "caller_not_in_group" | "not_authorised";
export declare type LeaveGroupResponse = "success" | "group_not_found" | "internal_error" | "not_in_group" | "owner_cannot_leave" | "group_not_public";
export declare type JoinGroupResponse = GroupChatSummary | {
    kind: "blocked";
} | {
    kind: "group_not_found";
} | {
    kind: "group_not_public";
} | {
    kind: "already_in_group";
} | {
    kind: "not_super_admin";
} | {
    kind: "member_limit_reached";
} | InternalError;
export declare type MarkReadRequest = {
    readUpTo: number | undefined;
    chatId: string;
    threads: ThreadRead[];
}[];
export declare type ThreadRead = {
    threadRootMessageIndex: number;
    readUpTo: number;
};
export declare type MarkReadResponse = "success";
export declare type UpdateGroupResponse = "success" | "not_authorised" | "name_too_short" | "name_too_long" | "name_reserved" | "desc_too_long" | "unchanged" | "name_taken" | "not_in_group" | "avatar_too_big" | "rules_too_short" | "rules_too_long" | "internal_error";
export declare type UpdatePermissionsResponse = "success" | "not_authorised" | "not_in_group";
export declare type AddRemoveReactionResponse = "success" | "no_change" | "invalid" | "message_not_found" | "not_in_group" | "not_authorised" | "chat_not_found";
export declare type DeleteMessageResponse = "not_in_group" | "chat_not_found" | "success" | "message_not_found";
export declare type UnpinMessageResponse = "no_change" | "caller_not_in_group" | "not_authorised" | "message_not_found" | "success";
export declare type PinMessageResponse = "index_out_of_range" | "no_change" | "caller_not_in_group" | "not_authorised" | "message_not_found" | "success";
export declare type RegisterPollVoteResponse = "caller_not_in_group" | "poll_ended" | "success" | "out_of_range" | "poll_not_found" | "chat_not_found" | "polls_not_valid_for_direct_chats";
export declare type InviteCodeResponse = InviteCodeSuccess | NotAuthorised;
export declare type InviteCodeSuccess = {
    kind: "success";
    code?: string;
};
export declare type EnableInviteCodeResponse = EnableInviteCodeSuccess | NotAuthorised;
export declare type EnableInviteCodeSuccess = {
    kind: "success";
    code: string;
};
export declare type DisableInviteCodeResponse = "not_authorised" | "success";
export declare type ResetInviteCodeResponse = ResetInviteCodeSuccess | NotAuthorised;
export declare type ThreadPreviewsResponse = CallerNotInGroup | ThreadPreviewsSuccess;
export declare type ThreadPreviewsSuccess = {
    kind: "thread_previews_success";
    threads: ThreadPreview[];
};
export declare type ThreadPreview = {
    chatId: string;
    latestReplies: EventWrapper<Message>[];
    totalReplies: number;
    rootMessage: EventWrapper<Message>;
};
export declare type ResetInviteCodeSuccess = {
    kind: "success";
    code: string;
};
export declare type MessageAction = "emoji" | "file" | undefined;
export declare type ChatMetrics = {
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
export declare type RegisterProposalVoteResponse = "success" | "already_voted" | "caller_not_in_group" | "no_eligible_neurons" | "proposal_message_not_found" | "proposal_not_found" | "proposal_not_accepting_votes" | "internal_error";
export declare type ListNervousSystemFunctionsResponse = {
    reservedIds: bigint[];
    functions: NervousSystemFunction[];
};
export declare type NervousSystemFunction = {
    id: number;
    name: string;
    description: string;
    functionType?: SnsFunctionType;
};
export declare type SnsFunctionType = {
    kind: "native_nervous_system_function";
} | {
    kind: "generic_nervous_system_function";
};
export {};
