import type { BlobReference, DataContent } from "../data/data";
import type { PartialUserSummary, UserSummary } from "../user/user";
import type { OptionUpdate } from "../optionUpdate";
import type { Cryptocurrency } from "../crypto";
import type { AccessGate, AccessControlled, AccessRules } from "../access";
import type {
    ChatPermissionRole,
    ChatPermissions,
    HasMembershipRole,
    MemberRole,
    Permissioned,
} from "../permission";
import type { HasIdentity } from "../identity";
import type { HasLevel } from "../structure";
import type {
    NotAuthorised,
    Success,
    SuccessNoUpdates,
    UserSuspended,
    ChatFrozen,
    Failure,
} from "../response";
import { ChatMap, emptyChatMetrics } from "../../utils";

export const Sns1GovernanceCanisterId = "zqfso-syaaa-aaaaq-aaafq-cai";
export const OpenChatGovernanceCanisterId = "2jvtu-yqaaa-aaaaq-aaama-cai";

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
    | ProposalContent
    | PrizeContent
    | PrizeWinnerContent
    | MessageReminderCreatedContent
    | MessageReminderContent
    | ReportedMessageContent
    | CustomContent;

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
    createdAtNanos: bigint;
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
    createdAtNanos: bigint;
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

export type CustomContent = {
    kind: "custom_content";
    subtype: string;
    data: unknown;
};

export type ReportedMessageContent = {
    kind: "reported_message_content";
    total: number;
    reports: MessageReport[];
};

export type MessageReport = {
    notes?: string;
    reasonCode: number;
    timestamp: number;
    reportedBy: string;
};

export type MessageReminderCreatedContent = {
    kind: "message_reminder_created_content";
    notes?: string;
    remindAt: number;
    reminderId: bigint;
    hidden: boolean;
};

export type MessageReminderContent = {
    kind: "message_reminder_content";
    notes?: string;
    reminderId: bigint;
};

export interface PrizeWinnerContent {
    kind: "prize_winner_content";
    transaction: CompletedCryptocurrencyTransfer;
    prizeMessageIndex: number;
}

export interface PrizeContent {
    kind: "prize_content";
    prizesRemaining: number;
    prizesPending: number;
    winners: string[];
    token: Cryptocurrency;
    endDate: bigint;
    caption?: string;
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

export type ManageNeuronResponse =
    | { kind: "success" }
    | { kind: "error"; type: number; message: string };

export interface Tally {
    yes: number;
    no: number;
    total: number;
    timestamp: bigint;
}

export interface Ballot {
    neuronId: string;
    vote: boolean | undefined;
    votingPower: bigint;
}

export interface ProposalVoteDetails {
    id: bigint;
    ballots: Ballot[];
    latestTally: Tally;
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
    SubnetReplicaVersionManagement,
    ReplicaVersionManagement,
    SnsAndCommunityFund,
}

export interface SnsProposal extends ProposalCommon {
    kind: "sns";
    action: number;
    payloadTextRendering?: string;
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

export type MessageContext = {
    chatId: ChatIdentifier;
    threadRootMessageIndex?: number;
};

export function messageContextFromString(ctxStr: string): MessageContext {
    return JSON.parse(ctxStr);
}

export function messageContextToString(ctx: MessageContext): string {
    return JSON.stringify(ctx);
}

export type RawReplyContext = {
    kind: "raw_reply_context";
    eventIndex: number;
    sourceContext?: MessageContext;
};

export type RehydratedReplyContext = {
    kind: "rehydrated_reply_context";
    content: MessageContent;
    senderId: string;
    messageId: bigint;
    messageIndex: number;
    eventIndex: number;
    edited: boolean;
    isThreadRoot: boolean;
    sourceContext: MessageContext;
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
    deleted: boolean;
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

export type LocalChatSummaryUpdates = {
    added?: ChatSummary;
    updated?:
        | {
              kind?: undefined;
              notificationsMuted?: boolean;
              archived?: boolean;
          }
        | {
              kind: "group_chat" | "channel";
              name?: string;
              description?: string;
              public?: boolean;
              permissions?: Partial<ChatPermissions>;
              frozen?: boolean;
              gate?: AccessGate;
              notificationsMuted?: boolean;
              archived?: boolean;
          };
    removedAtTimestamp?: bigint;
    lastUpdated: number;
};

export type LocalMessageUpdates = {
    deleted?: {
        deletedBy: string;
        timestamp: bigint;
    };
    editedContent?: MessageContent;
    cancelledReminder?: MessageContent;
    undeletedContent?: MessageContent;
    revealedContent?: MessageContent;
    prizeClaimed?: string;
    reactions?: LocalReaction[];
    pollVotes?: LocalPollVote[];
    threadSummary?: ThreadSummary;
    lastUpdated: number;
};

export type EventsResponse<T extends ChatEvent> = "events_failed" | EventsSuccessResult<T>;

export type DirectChatEvent =
    | Message
    | MessageDeleted
    | MessageUndeleted
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
    | AggregateCommonEvents
    | MembersRemoved
    | MemberLeft
    | GroupNameChanged
    | AvatarChanged
    | MessageDeleted
    | MessageUndeleted
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
    | ProposalsUpdated
    | ChatFrozenEvent
    | GateUpdatedEvent
    | ChatUnfrozenEvent
    | EventsTimeToLiveUpdated
    | UsersInvitedEvent
    | EmptyEvent;

export type ChatEvent = GroupChatEvent | DirectChatEvent;

export type MembersAdded = {
    kind: "members_added";
    userIds: string[];
    addedBy: string;
};

export type AggregateCommonEvents = {
    kind: "aggregate_common_events";
    usersJoined: Set<string>;
    usersLeft: Set<string>;
    messagesDeleted: number[];
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

export type MessageUndeleted = {
    kind: "message_undeleted";
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
    oldPermissions: ChatPermissions;
    newPermissions: ChatPermissions;
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
    latestEventIndex: number | undefined;
};

export type UpdatesResult = {
    state: ChatStateFull;
    updatedEvents: ChatMap<UpdatedEvent[]>;
    anyUpdates: boolean;
};

export type ChatStateFull = {
    latestUserCanisterUpdates: bigint;
    latestActiveGroupsCheck: bigint;
    directChats: DirectChatSummary[];
    groupChats: GroupChatSummary[];
    avatarId: bigint | undefined;
    blockedUsers: string[];
    pinnedChats: string[];
};

export type CurrentChatState = {
    chatSummaries: ChatSummary[];
    blockedUsers: Set<string>;
    pinnedChats: string[];
};

export type CachedGroupChatSummaries = {
    summaries: GroupChatSummary[];
    timestamp: bigint;
};

export type GroupChatsInitial = {
    summaries: UserCanisterGroupChatSummary[];
    pinned: string[];
    cached?: CachedGroupChatSummaries;
};

export type DirectChatsInitial = {
    summaries: DirectChatSummary[];
    pinned: string[];
};

export type ChatIdentifier = ChannelIdentifier | DirectChatIdentifier | GroupChatIdentifier;
export type MultiUserChatIdentifier = ChannelIdentifier | GroupChatIdentifier;

export function chatIdentifiersEqual(a: ChatIdentifier, b: ChatIdentifier): boolean {
    if (a.kind !== b.kind) {
        return false;
    }

    switch (a.kind) {
        case "channel":
            return b.kind === "channel" && a.communityId === b.communityId && a.id === b.id;
        default:
            return a.id === b.id;
    }
}

// export class ChatIdentifier {
//     private constructor(
//         public value: ChannelIdentifier | DirectChatIdentifier | GroupChatIdentifier
//     ) {}

//     create(value: ChannelIdentifier | DirectChatIdentifier | GroupChatIdentifier): ChatIdentifier {
//         return new ChatIdentifier(value);
//     }

//     toString(): string {
//         switch (this.value.kind) {
//             case "channel":
//                 return `${this.value.communtityId}_${this.value.id}`;
//             default:
//                 return this.value.id;
//         }
//     }

//     static directFromString(id: string): ChatIdentifier {
//         return new ChatIdentifier({
//             kind: "direct_chat",
//             id,
//         });
//     }

//     static groupFromString(id: string): ChatIdentifier {
//         return new ChatIdentifier({
//             kind: "group_chat",
//             id,
//         });
//     }

//     equals(other: ChatIdentifier): boolean {
//         const thisVal = this.toString();
//         const otherVal = other.toString();
//         return thisVal === otherVal;
//     }
// }

export type DirectChatIdentifier = {
    kind: "direct_chat";
    id: string;
};

export type GroupChatIdentifier = {
    kind: "group_chat";
    id: string;
};

export type ChannelIdentifier = {
    kind: "channel";
    communityId: string;
    id: string;
};

export type FavouriteChatsInitial = {
    chats: ChatIdentifier[];
    pinned: ChatIdentifier[];
};

export type UserCanisterChannelSummary = {
    chatId: ChannelIdentifier;
    readByMeUpTo?: number;
    dateReadPinned?: bigint;
    threadsRead: [number, number][];
    archived: boolean;
};

export type UserCanisterCommunitySummary = {
    communityId: string;
    channels: UserCanisterChannelSummary[];
    pinnedChannels: string[];
    archived: boolean;
};

export type CommunitiesInitial = {
    summaries: UserCanisterCommunitySummary[];
};

export type InitialStateResponse = {
    blockedUsers: string[];
    communities: CommunitiesInitial;
    groupChats: GroupChatsInitial;
    avatarId: bigint | undefined;
    directChats: DirectChatsInitial;
    favouriteChats: FavouriteChatsInitial;
    timestamp: bigint;
};

export type UpdatesResponse = UpdatesSuccessResponse | SuccessNoUpdates;

export type UpdatesSuccessResponse = {
    kind: "success";
    timestamp: bigint;
    communities: CommunitiesUpdates;
    blockedUsers: string[] | undefined;
    favouriteChats: FavouriteChatsUpdates;
    groupChats: GroupChatsUpdates;
    avatarId: OptionUpdate<bigint>;
    directChats: DirectChatsUpdates;
};

export function emptyUpdatesSuccessResponse(timestamp: bigint): UpdatesSuccessResponse {
    return {
        kind: "success",
        timestamp,
        blockedUsers: undefined,
        favouriteChats: {},
        avatarId: undefined,
        communities: {
            added: [],
            updated: [],
            removed: [],
        },
        groupChats: {
            added: [],
            pinned: undefined,
            updated: [],
            removed: [],
        },
        directChats: {
            added: [],
            pinned: undefined,
            updated: [],
        },
    };
}

export type DirectChatsUpdates = {
    added: DirectChatSummary[];
    pinned?: string[];
    updated: DirectChatSummaryUpdates[];
};

export type GroupChatsUpdates = {
    added: UserCanisterGroupChatSummary[];
    pinned?: string[];
    updated: UserCanisterGroupChatSummaryUpdates[];
    removed: string[];
};

export type FavouriteChatsUpdates = {
    chats?: ChatIdentifier[];
    pinned?: ChatIdentifier[];
};

export type CommunitiesUpdates = {
    added: UserCanisterCommunitySummary[];
    updated: UserCanisterCommunitySummaryUpdates[];
    removed: string[];
};

export type UserCanisterCommunitySummaryUpdates = {
    communityId: string;
    channels: UserCanisterChannelSummaryUpdates[];
    pinned?: string[];
    archived?: boolean;
};

export type UserCanisterChannelSummaryUpdates = {
    channelId: string;
    readByMeUpTo?: number;
    dateReadPinned?: bigint;
    threadsRead: [number, number][];
    archived?: boolean;
};

export type UserCanisterGroupChatSummary = {
    chatId: GroupChatIdentifier;
    readByMeUpTo: number | undefined;
    threadsRead: Record<number, number>;
    archived: boolean;
    dateReadPinned: bigint | undefined;
};

export type UserCanisterGroupChatSummaryUpdates = {
    chatId: GroupChatIdentifier;
    readByMeUpTo: number | undefined;
    threadsRead: Record<number, number>;
    archived: boolean | undefined;
    dateReadPinned: bigint | undefined;
};

export type ChatSummaryUpdates = DirectChatSummaryUpdates | GroupChatSummaryUpdates;

type ChatSummaryUpdatesCommon = {
    readByMeUpTo?: number;
    latestEventIndex?: number;
    latestMessage?: EventWrapper<Message>;
    notificationsMuted?: boolean;
    updatedEvents: UpdatedEvent[];
    metrics?: Metrics;
    myMetrics?: Metrics;
    archived?: boolean;
};

export type DirectChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    chatId: DirectChatIdentifier;
    kind: "direct_chat";
    readByThemUpTo?: number;
};

export type GroupChatSummaryUpdates = ChatSummaryUpdatesCommon & {
    chatId: GroupChatIdentifier;
    kind: "group_chat";
    lastUpdated: bigint;
    name?: string;
    description?: string;
    avatarBlobReferenceUpdate?: OptionUpdate<BlobReference>;
    memberCount?: number;
    myRole?: MemberRole;
    mentions: Mention[];
    permissions?: ChatPermissions;
    public?: boolean;
    latestThreads?: ThreadSyncDetailsUpdates[];
    subtype?: GroupSubtypeUpdate;
    frozen?: OptionUpdate<boolean>;
    dateLastPinned?: bigint;
    dateReadPinned?: bigint;
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

export type Member = {
    role: MemberRole;
    userId: string;
};

export type FullMember = Member & PartialUserSummary;

export type GroupChatDetailsResponse = "caller_not_in_group" | GroupChatDetails;

export type GroupChatDetailsUpdatesResponse =
    | ({ kind: "success" } & GroupChatDetailsUpdates)
    | { kind: "success_no_updates"; latestEventIndex: number }
    | "caller_not_in_group";

export type GroupChatDetails = {
    members: Member[];
    blockedUsers: Set<string>;
    invitedUsers: Set<string>;
    pinnedMessages: Set<number>;
    latestEventIndex: number;
    rules: AccessRules;
};

/**
 * This will hold all chat specific state
 * All properties are optional but individual derived stores can provide their own default values
 */
export type ChatSpecificState = {
    detailsLoaded: boolean;
    members: Member[];
    blockedUsers: Set<string>;
    invitedUsers: Set<string>;
    pinnedMessages: Set<number>;
    latestEventIndex?: number;
    rules?: AccessRules;
    userIds: Set<string>;
    focusMessageIndex?: number;
    focusThreadMessageIndex?: number;
    userGroupKeys: Set<string>;
    serverEvents: EventWrapper<ChatEvent>[];
    expandedDeletedMessages: Set<number>;
};

export type GroupChatDetailsUpdates = {
    membersAddedOrUpdated: Member[];
    membersRemoved: Set<string>;
    blockedUsersAdded: Set<string>;
    blockedUsersRemoved: Set<string>;
    pinnedMessagesRemoved: Set<number>;
    pinnedMessagesAdded: Set<number>;
    latestEventIndex: number;
    rules?: AccessRules;
    invitedUsers?: Set<string>;
};

export type ChatSummary = DirectChatSummary | MultiUserChat;

export type MultiUserChat = GroupChatSummary | ChannelSummary;

export type ChatType = ChatSummary["kind"];

type ChatSummaryCommon = HasMembershipRole & {
    latestEventIndex: number;
    latestMessage?: EventWrapper<Message>;
    metrics: Metrics;
    membership: ChatMembership;
};

export type ChannelSummary = DataContent &
    AccessControlled &
    ChatSummaryCommon &
    HasLevel &
    Permissioned<ChatPermissions> & {
        kind: "channel";
        chatId: ChannelIdentifier;
        subtype: GroupSubtype;
        name: string;
        description: string;
        minVisibleEventIndex: number;
        minVisibleMessageIndex: number;
        lastUpdated: bigint;
        memberCount: number;
        dateLastPinned: bigint | undefined;
        dateReadPinned: bigint | undefined;
    };

export type DirectChatSummary = ChatSummaryCommon & {
    kind: "direct_chat";
    chatId: DirectChatIdentifier;
    them: DirectChatIdentifier;
    readByThemUpTo: number | undefined;
    dateCreated: bigint;
};

export type GroupChatSummary = DataContent &
    ChatSummaryCommon &
    AccessControlled &
    HasLevel &
    Permissioned<ChatPermissions> & {
        kind: "group_chat";
        chatId: GroupChatIdentifier;
        name: string;
        description: string;
        minVisibleEventIndex: number;
        minVisibleMessageIndex: number;
        lastUpdated: bigint;
        memberCount: number;
        subtype: GroupSubtype;
        previewed: boolean;
        dateLastPinned: bigint | undefined;
        dateReadPinned: bigint | undefined;
    };

export const nullMembership: ChatMembership = {
    joined: BigInt(0),
    role: "none",
    mentions: [],
    latestThreads: [],
    myMetrics: emptyChatMetrics(),
    notificationsMuted: false,
    readByMeUpTo: undefined,
    archived: false,
};

export type ChatMembership = {
    joined: bigint;
    role: ChatPermissionRole;
    mentions: Mention[];
    latestThreads: ThreadSyncDetails[];
    myMetrics: Metrics;
    notificationsMuted: boolean;
    readByMeUpTo: number | undefined;
    archived: boolean;
};

export type GroupCanisterSummaryResponse = GroupCanisterGroupChatSummary | CallerNotInGroup;

export type GroupCanisterSummaryUpdatesResponse =
    | GroupCanisterGroupChatSummaryUpdates
    | { kind: "success_no_updates" }
    | CallerNotInGroup;

export type GroupCanisterGroupChatSummary = AccessControlled &
    Permissioned<ChatPermissions> & {
        chatId: GroupChatIdentifier;
        lastUpdated: bigint;
        name: string;
        description: string;
        subtype: GroupSubtype;
        avatarId: bigint | undefined;
        minVisibleEventIndex: number;
        minVisibleMessageIndex: number;
        latestMessage: EventWrapper<Message> | undefined;
        latestEventIndex: number;
        joined: bigint;
        myRole: MemberRole;
        memberCount: number;
        mentions: Mention[];
        notificationsMuted: boolean;
        metrics: Metrics;
        myMetrics: Metrics;
        latestThreads: GroupCanisterThreadDetails[];
        dateLastPinned: bigint | undefined;
    };

export type UpdatedEvent = {
    eventIndex: number;
    threadRootMessageIndex?: number;
    timestamp: bigint;
};

export type GroupCanisterGroupChatSummaryUpdates = {
    chatId: GroupChatIdentifier;
    lastUpdated: bigint;
    name: string | undefined;
    description: string | undefined;
    subtype: OptionUpdate<GroupSubtype>;
    avatarId: OptionUpdate<bigint>;
    public: boolean | undefined;
    latestMessage: EventWrapper<Message> | undefined;
    latestEventIndex: number | undefined;
    memberCount: number | undefined;
    myRole: MemberRole | undefined;
    mentions: Mention[];
    permissions: ChatPermissions | undefined;
    notificationsMuted: boolean | undefined;
    metrics: Metrics | undefined;
    myMetrics: Metrics | undefined;
    latestThreads: GroupCanisterThreadDetails[];
    frozen: OptionUpdate<boolean>;
    updatedEvents: UpdatedEvent[];
    dateLastPinned: bigint | undefined;
    gate: OptionUpdate<AccessGate>;
};

export type GroupCanisterThreadDetails = {
    threadRootMessageIndex: number;
    lastUpdated: bigint;
    latestEventIndex: number;
    latestMessageIndex: number;
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

export type CandidateGroupChat = AccessControlled &
    HasLevel &
    HasMembershipRole &
    Permissioned<ChatPermissions> & {
        chatId: GroupChatIdentifier;
        name: string;
        description: string;
        rules: AccessRules;
        members: CandidateMember[];
        avatar?: DataContent;
    };

export type CandidateChannel = CandidateGroupChat;

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
    | CreateGroupThrottled
    | GroupRulesTooShort
    | GroupRulesTooLong
    | UnauthorizedToCreatePublicGroup
    | UserSuspended;

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

export type GroupRulesTooLong = {
    kind: "rules_too_long";
};

export type GroupRulesTooShort = {
    kind: "rules_too_short";
};

export type MaxGroupsCreated = {
    kind: "max_groups_created";
};

export type CreateGroupThrottled = {
    kind: "throttled";
};

export type UnauthorizedToCreatePublicGroup = {
    kind: "unauthorized_to_create_public_group";
};

export type MemberLimitReached = {
    kind: "member_limit_reached";
};

export type EditMessageResponse =
    | "success"
    | "chat_not_found"
    | "message_not_found"
    | "user_blocked"
    | "not_in_group"
    | "user_suspended"
    | "chat_frozen";

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
    | ThreadMessageNotFound
    | UserSuspended
    | ChatFrozen;

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

export type GateCheckFailed = {
    kind: "gate_check_failed";
    reason: GateCheckFailedReason;
};

export type GateCheckFailedReason =
    | "not_diamond"
    | "no_sns_neuron_found"
    | "dissolve_delay_not_met"
    | "min_stake_not_met";

export type ChatFrozenEvent = {
    kind: "chat_frozen";
    frozenBy: string;
    reason: string | undefined;
};

export type GateUpdatedEvent = {
    kind: "gate_updated";
    updatedBy: string;
};

export type UsersInvitedEvent = {
    kind: "users_invited";
    userIds: string[];
    invitedBy: string;
};

export type ChatUnfrozenEvent = {
    kind: "chat_unfrozen";
    unfrozenBy: string;
};

export type EventsTimeToLiveUpdated = {
    kind: "events_ttl_updated";
    updatedBy: string;
    newTimeToLive: bigint | undefined;
};

export type EmptyEvent = {
    kind: "empty";
};

export type SetAvatarResponse = "avatar_too_big" | "success" | "internal_error" | "user_suspended";

export type ChangeRoleResponse =
    | "internal_error"
    | "user_not_in_group"
    | "caller_not_in_group"
    | "not_authorized"
    | "invalid"
    | "user_suspended"
    | "chat_frozen"
    | "success";

export type DeleteGroupResponse =
    | "internal_error"
    | "not_authorized"
    | "chat_frozen"
    | "success"
    | "user_suspended";

export type MakeGroupPrivateResponse =
    | "internal_error"
    | "not_authorized"
    | "already_private"
    | "user_suspended"
    | "chat_frozen"
    | "success";

export type RemoveMemberResponse =
    | "user_not_in_group"
    | "caller_not_in_group"
    | "not_authorized"
    | "success"
    | "cannot_remove_self"
    | "cannot_remove_user"
    | "user_suspended"
    | "chat_frozen"
    | "internal_error";

export type BlockUserResponse =
    | "success"
    | "group_not_public"
    | "user_not_in_group"
    | "caller_not_in_group"
    | "not_authorized"
    | "internal_error"
    | "cannot_block_self"
    | "cannot_block_user"
    | "user_suspended"
    | "chat_frozen";

export type UnblockUserResponse =
    | "success"
    | "group_not_public"
    | "cannot_unblock_self"
    | "caller_not_in_group"
    | "not_authorized"
    | "user_suspended"
    | "chat_frozen";

export type LeaveGroupResponse =
    | "success"
    | "group_not_found"
    | "internal_error"
    | "not_in_group"
    | "owner_cannot_leave"
    | "group_not_public"
    | "user_suspended"
    | "chat_frozen";

export type JoinGroupResponse =
    | GroupChatSummary
    | { kind: "blocked" }
    | { kind: "group_not_found" }
    | { kind: "not_invited" }
    | { kind: "group_not_public" }
    | { kind: "not_invited" }
    | { kind: "already_in_group" }
    | { kind: "not_super_admin" }
    | { kind: "member_limit_reached" }
    | GateCheckFailed
    | UserSuspended
    | ChatFrozen
    | InternalError;

export type InviteUsersResponse =
    | "success"
    | "group_not_found"
    | "caller_not_in_group"
    | "not_authorized"
    | "chat_frozen"
    | "too_many_invites"
    | "internal_error";

export type MarkReadRequest = {
    readUpTo: number | undefined;
    chatId: string;
    threads: ThreadRead[];
    dateReadPinned: bigint | undefined;
}[];

export type ThreadRead = {
    threadRootMessageIndex: number;
    readUpTo: number;
};

export type MarkReadResponse = "success";

export type UpdateGroupResponse =
    | "success"
    | "not_authorized"
    | "name_too_short"
    | "name_too_long"
    | "name_reserved"
    | "desc_too_long"
    | "unchanged"
    | "name_taken"
    | "not_in_group"
    | "avatar_too_big"
    | "rules_too_short"
    | "rules_too_long"
    | "user_suspended"
    | "chat_frozen"
    | "internal_error";

export type UpdatePermissionsResponse =
    | "success"
    | "not_authorized"
    | "not_in_group"
    | "user_suspended"
    | "chat_frozen";

export type AddRemoveReactionResponse = Success | Failure;

export type DeleteMessageResponse =
    | "not_in_group"
    | "chat_not_found"
    | "success"
    | "message_not_found"
    | "user_suspended"
    | "chat_frozen"
    | "internal_error"
    | "not_platform_moderator";

export type UndeleteMessageResponse =
    | {
          kind: "success";
          message: Message;
      }
    | { kind: "not_in_group" }
    | { kind: "chat_not_found" }
    | { kind: "internal_error" }
    | { kind: "message_not_found" }
    | UserSuspended
    | ChatFrozen;

export type UnpinMessageResponse =
    | "no_change"
    | "caller_not_in_group"
    | "not_authorized"
    | "message_not_found"
    | "user_suspended"
    | "chat_frozen"
    | "success";

export type PinMessageResponse =
    | {
          kind: "success";
          eventIndex: number;
          timestamp: bigint;
      }
    | { kind: "index_out_of_range" }
    | { kind: "no_change" }
    | { kind: "caller_not_in_group" }
    | { kind: "not_authorized" }
    | { kind: "message_not_found" }
    | UserSuspended
    | ChatFrozen;

export type DeletedGroupMessageResponse =
    | {
          kind: "success";
          content: MessageContent;
      }
    | { kind: "caller_not_in_group" }
    | { kind: "not_authorized" }
    | { kind: "message_not_found" }
    | { kind: "message_not_deleted" }
    | { kind: "message_hard_deleted" };

export type DeletedDirectMessageResponse =
    | {
          kind: "success";
          content: MessageContent;
      }
    | { kind: "chat_not_found" }
    | { kind: "not_authorized" }
    | { kind: "message_not_found" }
    | { kind: "message_not_deleted" }
    | { kind: "message_hard_deleted" };

export type RegisterPollVoteResponse =
    | "caller_not_in_group"
    | "poll_ended"
    | "success"
    | "out_of_range"
    | "poll_not_found"
    | "chat_not_found"
    | "user_suspended"
    | "chat_frozen"
    | "polls_not_valid_for_direct_chats";

export type InviteCodeResponse = InviteCodeSuccess | NotAuthorised;

export type InviteCodeSuccess = {
    kind: "success";
    code?: string;
};

export type EnableInviteCodeResponse =
    | EnableInviteCodeSuccess
    | NotAuthorised
    | UserSuspended
    | ChatFrozen;

export type EnableInviteCodeSuccess = {
    kind: "success";
    code: string;
};

export type DisableInviteCodeResponse =
    | "not_authorized"
    | "user_suspended"
    | "chat_frozen"
    | "success";

export type ResetInviteCodeResponse =
    | ResetInviteCodeSuccess
    | NotAuthorised
    | UserSuspended
    | ChatFrozen;

export type ResetInviteCodeSuccess = {
    kind: "success";
    code: string;
};

export type ThreadPreviewsResponse = CallerNotInGroup | ThreadPreviewsSuccess;

export type ThreadPreviewsSuccess = {
    kind: "thread_previews_success";
    threads: ThreadPreview[];
};

export type ThreadPreview = {
    chatId: ChatIdentifier;
    latestReplies: EventWrapper<Message>[];
    totalReplies: number;
    rootMessage: EventWrapper<Message>;
};

export type MessageAction = "emoji" | "file" | undefined;

export type Metrics = {
    audioMessages: number;
    edits: number;
    icpMessages: number;
    sns1Messages: number;
    ckbtcMessages: number;
    giphyMessages: number;
    deletedMessages: number;
    reportedMessages: number;
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
    | "chat_frozen"
    | "user_suspended"
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

export type FilterGroupsResponse = {
    timestamp: bigint;
    activeGroups: string[];
    deletedGroups: DeletedGroupInfo[];
    upgradesInProgress: string[];
};

export type DeletedGroupInfo = {
    id: string;
    timestamp: bigint;
    deletedBy: string;
    groupName: string;
    public: boolean;
};

export type FreezeGroupResponse =
    | EventWrapper<ChatFrozenEvent>
    | "chat_already_frozen"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error";

export type UnfreezeGroupResponse =
    | EventWrapper<ChatUnfrozenEvent>
    | "chat_not_frozen"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error";

export type DeleteFrozenGroupResponse =
    | "success"
    | "chat_not_frozen"
    | "chat_not_frozen_long_enough"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error";

export type AddHotGroupExclusionResponse =
    | "success"
    | "chat_already_excluded"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error";

export type RemoveHotGroupExclusionResponse =
    | "success"
    | "chat_not_excluded"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error";

export type SetGroupUpgradeConcurrencyResponse = "success" | "not_authorized" | "internal_error";

export type MarkPinnedMessagesReadResponse = "success" | "chat_frozen";

export type ClaimPrizeResponse =
    | CallerNotInGroup
    | { kind: "message_not_found" }
    | { kind: "chat_frozen" }
    | { kind: "already_claimed" }
    | { kind: "success" }
    | { kind: "user_suspended" }
    | { kind: "prize_ended" }
    | { kind: "prize_fully_claimed" }
    | { kind: "failed_after_transfer" }
    | { kind: "transfer_failed" };

export type ReportMessageResponse = "success" | "failure";

export type DeclineInvitationResponse = "success" | "not_invited" | "internal_error";
