import type { DataContent } from "./data/data";
import type { Cryptocurrency } from "./crypto";

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

export type ReplyContext = RawReplyContext;

export type RawReplyContext = {
    kind: "raw_reply_context";
    eventIndex: number;
    chatIdIfOther?: string;
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
        deletedBy: string;
        timestamp: bigint;
    };
    editedContent?: MessageContent;
    reactions?: LocalReaction[];
    pollVotes?: LocalPollVote[];
    threadSummary?: ThreadSummary;
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
    | GroupRulesChanged
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

export type GroupRulesChanged = {
    kind: "rules_changed";
    enabled: boolean;
    enabledPrev: boolean;
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

export type MemberRole = "admin" | "participant" | "owner" | "super_admin" | "previewer";

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

export type Mention = {
    messageId: bigint;
    eventIndex: number;
    mentionedBy: string;
    messageIndex: number;
};
