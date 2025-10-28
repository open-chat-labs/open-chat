import { ROLE_NONE } from "../../constants";
import { emptyChatMetrics } from "../../utils";
import type { AccessControlled, AccessGateConfig, UpdatedRules, VersionedRules } from "../access";
import type {
    CommandArg,
    GrantedBotPermissions,
    InstalledBotDetails,
    WebhookDetails,
} from "../bots";
import type { ChitEvent, PremiumItem } from "../chit";
import type {
    CommunityCanisterCommunitySummaryUpdates,
    CommunityIdentifier,
    CommunitySummary,
} from "../community";
import type { WalletConfig } from "../crypto";
import type { DataContent } from "../data/data";
import type { OCError } from "../error";
import type { OptionUpdate } from "../optionUpdate";
import type {
    ChatPermissionRole,
    ChatPermissions,
    HasMembershipRole,
    MemberRole,
    Permissioned,
} from "../permission";
import type {
    ChatFrozen,
    Failure,
    InternalError,
    NotAuthorised,
    Offline,
    Success,
    SuccessNoUpdates,
    UserLapsed,
    UserSuspended,
} from "../response";
import type { ChatListScope, HasLevel } from "../structure";
import type { Referral, UserSummary } from "../user/user";

export type CallerNotInGroup = { kind: "caller_not_in_group" };
export type CanisterNotFound = { kind: "canister_not_found" };

export type MessageContent =
    | FileContent
    | TextContent
    | ImageContent
    | VideoContent
    | AudioContent
    | DeletedContent
    | BlockedContent
    | PlaceholderContent
    | BotPlaceholderContent
    | PollContent
    | CryptocurrencyContent
    | GiphyContent
    | ProposalContent
    | PrizeContent
    | PrizeContentInitial
    | P2PSwapContent
    | P2PSwapContentInitial
    | PrizeWinnerContent
    | MessageReminderCreatedContent
    | MessageReminderContent
    | ReportedMessageContent
    | UserReferralCard
    | MemeFighterContent
    | VideoCallContent
    | EncryptedContent;

export type VideoCallParticipant = {
    userId: string;
    joined: bigint;
};

export type EncryptedContent = {
    kind: "encrypted_content";
};

export type VideoCallContent = {
    kind: "video_call_content";
    participants: VideoCallParticipant[];
    ended?: bigint;
    callType: VideoCallType;
};

export type VideoCallType = "broadcast" | "default";

export interface PrizeContentInitial {
    kind: "prize_content_initial";
    diamondOnly: boolean;
    lifetimeDiamondOnly: boolean;
    uniquePersonOnly: boolean;
    streakOnly: number;
    minChitEarned: number;
    endDate: bigint;
    caption?: string;
    transfer: PendingCryptocurrencyTransfer;
    prizes: bigint[];
    requiresCaptcha: boolean;
}

export interface P2PSwapContentInitial {
    kind: "p2p_swap_content_initial";
    token0: TokenInfo;
    token1: TokenInfo;
    token0Amount: bigint;
    token1Amount: bigint;
    caption?: string;
    expiresIn: bigint;
}

export interface TokenInfo {
    fee: bigint;
    decimals: number;
    symbol: string;
    ledger: string;
}

export type CaptionedContent =
    | AttachmentContent
    | CryptocurrencyContent
    | GiphyContent
    | PrizeContent;

export type AttachmentContent = ImageContent | VideoContent | AudioContent | FileContent;

export function isAttachmentContent(content: MessageContent): content is AttachmentContent {
    switch (content.kind) {
        case "image_content":
        case "video_content":
        case "audio_content":
        case "file_content":
            return true;
        default:
            return false;
    }
}

export type EditableContent =
    | FileContent
    | TextContent
    | ImageContent
    | VideoContent
    | AudioContent
    | GiphyContent;

export function isEditableContent(kind: MessageContent["kind"]): kind is EditableContent["kind"] {
    switch (kind) {
        case "file_content":
        case "text_content":
        case "image_content":
        case "video_content":
        case "audio_content":
        case "giphy_content":
            return true;
        default:
            return false;
    }
}

export function isCaptionedContent(content: MessageContent): content is CaptionedContent {
    switch (content.kind) {
        case "image_content":
        case "video_content":
        case "audio_content":
        case "file_content":
        case "crypto_content":
        case "giphy_content":
        case "prize_content":
        case "p2p_swap_content":
            return true;
        default:
            return false;
    }
}

export function isTransfer(content: MessageContent): boolean {
    return (
        content.kind === "crypto_content" ||
        content.kind === "prize_content_initial" ||
        content.kind === "p2p_swap_content_initial"
    );
}

export function canRetryMessage(content: MessageContent): boolean {
    return (
        content.kind !== "poll_content" &&
        content.kind !== "crypto_content" &&
        content.kind !== "prize_content_initial" &&
        content.kind !== "p2p_swap_content_initial"
    );
}

export type IndexRange = [number, number];

export interface PlaceholderContent {
    kind: "placeholder_content";
}

export interface BotPlaceholderContent {
    kind: "bot_placeholder_content";
}

export type CryptocurrencyDeposit = {
    ledger: string;
    token: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    blockIndex: bigint;
    fromAddress: string;
};

export type PendingCryptocurrencyWithdrawal = {
    kind: "pending";
    ledger: string;
    token: string;
    to: string;
    amountE8s: bigint;
    feeE8s?: bigint;
    memo?: bigint;
    createdAtNanos: bigint;
};

export type CompletedCryptocurrencyWithdrawal = {
    kind: "completed";
    ledger: string;
    to: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    blockIndex: bigint;
};

export type FailedCryptocurrencyWithdrawal = {
    kind: "failed";
    ledger: string;
    to: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    errorMessage: string;
};

export type WithdrawCryptocurrencyResponse =
    | FailedCryptocurrencyWithdrawal
    | CompletedCryptocurrencyWithdrawal
    | OCError
    | Offline;

export type CryptocurrencyWithdrawal =
    | PendingCryptocurrencyWithdrawal
    | CompletedCryptocurrencyWithdrawal
    | FailedCryptocurrencyWithdrawal;

export type CompletedCryptocurrencyTransfer = {
    kind: "completed";
    ledger: string;
    recipient: string;
    sender: string;
    amountE8s: bigint;
    feeE8s: bigint;
    memo: bigint;
    blockIndex: bigint;
};

export type PendingCryptocurrencyTransfer = {
    kind: "pending";
    ledger: string;
    token: string;
    recipient: string;
    amountE8s: bigint;
    feeE8s?: bigint;
    memo?: bigint;
    createdAtNanos: bigint;
};

export type FailedCryptocurrencyTransfer = {
    kind: "failed";
    ledger: string;
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

export type UserReferralCard = {
    kind: "user_referral_card";
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
    diamondOnly: boolean;
    lifetimeDiamondOnly: boolean;
    uniquePersonOnly: boolean;
    streakOnly: number;
    winnerCount: number;
    userIsWinner: boolean;
    token: string;
    endDate: bigint;
    caption?: string;
    requiresCaptcha: boolean;
    minChitEarned: number;
}

export interface P2PSwapContent {
    kind: "p2p_swap_content";
    token0: TokenInfo;
    token1: TokenInfo;
    token0Amount: bigint;
    token1Amount: bigint;
    caption?: string;
    expiresAt: bigint;
    status: P2PSwapStatus;
    swapId: number;
    token0TxnIn: TransactionId;
}

export type TransactionId = bigint;

export type P2PSwapStatus =
    | P2PSwapOpen
    | P2PSwapReserved
    | P2PSwapAccepted
    | P2PSwapCancelled
    | P2PSwapExpired
    | P2PSwapCompleted;

export interface P2PSwapOpen {
    kind: "p2p_swap_open";
}

export interface P2PSwapReserved {
    kind: "p2p_swap_reserved";
    reservedBy: string;
}

export interface P2PSwapAccepted {
    kind: "p2p_swap_accepted";
    acceptedBy: string;
    token1TxnIn: TransactionId;
}

export interface P2PSwapCancelled {
    kind: "p2p_swap_cancelled";
    token0TxnOut?: TransactionId;
}

export interface P2PSwapExpired {
    kind: "p2p_swap_expired";
    token0TxnOut?: TransactionId;
}

export interface P2PSwapCompleted {
    kind: "p2p_swap_completed";
    acceptedBy: string;
    token1TxnIn: TransactionId;
    token0TxnOut: TransactionId;
    token1TxnOut: TransactionId;
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
    payloadTextRendering?: string;
    minYesPercentageOfTotal: number;
    minYesPercentageOfExercised: number;
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
    ApiBoundaryNodeManagement,
    SubnetRental,
    ProtocolCanisterManagement,
    ServiceNervousSystemManagement,
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

export interface MemeFighterContent {
    kind: "meme_fighter_content";
    height: number;
    width: number;
    url: string;
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
    samples: Uint8Array;
    duration: number;
}

export type DeletedContent = {
    kind: "deleted_content";
    deletedBy: string;
    timestamp: bigint;
};

export type BlockedContent = {
    kind: "blocked_content";
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
    allowUserToChangeVote: boolean;
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

export function messageContextToChatListScope(ctx: MessageContext): ChatListScope {
    switch (ctx.chatId.kind) {
        case "channel":
            return {
                kind: "community",
                id: { kind: "community", communityId: ctx.chatId.communityId },
            };
        case "direct_chat":
        case "group_chat":
            return { kind: "chats" };
    }
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
    sender?: UserSummary;
    content: MessageContent;
};

type LedgerId = string;
type UserId = string;
export type TipsReceived = Record<LedgerId, Record<UserId, bigint>>;

export type Message<T extends MessageContent = MessageContent> = {
    kind: "message";
    messageId: bigint;
    messageIndex: number;
    sender: string;
    content: T;
    repliesTo?: ReplyContext;
    reactions: Reaction[];
    tips: TipsReceived;
    edited: boolean;
    forwarded: boolean;
    deleted: boolean;
    thread?: ThreadSummary;
    blockLevelMarkdown: boolean;
    senderContext?: SenderContext;
};

export type BotContextCommand = {
    name: string;
    args: CommandArg[];
    initiator: string;
};

export type BotMessageContext = {
    kind: "bot";
    command?: BotContextCommand;
    finalised: boolean;
};

export type WebhookContext = {
    kind: "webhook";
};

export type SenderContext = BotMessageContext | WebhookContext;

export type ThreadSummary = {
    participantIds: Set<string>;
    followedByMe: boolean;
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
    linkRemoved: boolean;
    cancelledReminder?: MessageContent;
    undeletedContent?: MessageContent;
    revealedContent?: MessageContent;
    prizeClaimed?: string;
    p2pSwapStatus?: P2PSwapStatus;
    reactions?: LocalReaction[];
    pollVotes?: LocalPollVote[];
    threadSummary?: Partial<ThreadSummary>;
    tips?: TipsReceived;
    hiddenMessageRevealed?: boolean;
    blockLevelMarkdown?: boolean;
    lastUpdated: number;
};

export type EventsResponse<T extends ChatEvent> =
    | EventsSuccessResult<T>
    | ReplicaNotUpToDate
    | OCError
    | Failure;

export function isSuccessfulEventsResponse<T extends ChatEvent>(
    response: EventsResponse<T> | undefined,
): response is EventsSuccessResult<T> {
    return response !== undefined && typeof response === "object" && "events" in response;
}

export type ChatEvent =
    | Message
    | DirectChatCreated
    | GroupChatCreated
    | MembersAdded
    | MemberJoined
    | AggregateCommonEvents
    | MembersRemoved
    | MemberLeft
    | GroupNameChanged
    | AvatarChanged
    | GroupDescChanged
    | GroupRulesChanged
    | UsersBlocked
    | UsersUnblocked
    | RoleChanged
    | MessagePinned
    | MessageUnpinned
    | PermissionsChanged
    | GroupVisibilityChanged
    | GroupInviteCodeChanged
    | ChatFrozenEvent
    | GateUpdatedEvent
    | ChatUnfrozenEvent
    | EventsTimeToLiveUpdated
    | UsersInvitedEvent
    | MembersAddedToDefaultChannel
    | EmptyEvent
    | ExternalUrlUpdated
    | BotAdded
    | BotRemoved
    | BotUpdated;

export type BotAdded = {
    kind: "bot_added";
    userId: string;
    addedBy: string;
};

export type BotRemoved = {
    kind: "bot_removed";
    userId: string;
    removedBy: string;
};

export type BotUpdated = {
    kind: "bot_updated";
    userId: string;
    updatedBy: string;
};

export type MembersAdded = {
    kind: "members_added";
    userIds: string[];
    addedBy: string;
};

export type AggregateCommonEvents = {
    kind: "aggregate_common_events";
    usersJoined: Set<string>;
    usersLeft: Set<string>;
    rolesChanged: Map<string, Map<MemberRole, Set<string>>>;
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
    public?: boolean;
    messagesVisibleToNonMembers?: boolean;
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

export type TimelineItem<T extends ChatEvent> = TimelineDate | TimelineEventGroup<T>;

export type TimelineDate = {
    kind: "timeline_date";
    timestamp: bigint;
};

export type TimelineEventGroup<T extends ChatEvent> = {
    kind: "timeline_event_group";
    group: EventWrapper<T>[][];
};

export type EventWrapper<T extends ChatEvent> = {
    event: T;
    timestamp: bigint;
    index: number;
    expiresAt?: number;
};

export type EventsSuccessResult<T extends ChatEvent> = {
    events: EventWrapper<T>[];
    expiredEventRanges: ExpiredEventsRange[];
    expiredMessageRanges: ExpiredMessagesRange[];
    latestEventIndex: number | undefined;
};

export type UpdatesResult = {
    directChatsAddedUpdated: DirectChatSummary[];
    directChatsRemoved: string[];
    groupsAddedUpdated: GroupChatSummary[];
    groupsRemoved: string[];
    communitiesAddedUpdated: CommunitySummary[];
    communitiesRemoved: string[];
    avatarId: OptionUpdate<bigint>;
    blockedUsers: string[] | undefined;
    pinnedChats: ChatIdentifier[] | undefined;
    pinnedChannels: ChannelIdentifier[] | undefined;
    pinnedFavouriteChats: ChatIdentifier[] | undefined;
    favouriteChats: ChatIdentifier[] | undefined;
    pinNumberSettings: OptionUpdate<PinNumberSettings>;
    achievements: Set<string> | undefined;
    chitState: ChitState | undefined;
    referrals: Referral[] | undefined;
    walletConfig: WalletConfig | undefined;
    messageActivitySummary: MessageActivitySummary | undefined;
    installedBots: Map<string, GrantedBotPermissions> | undefined;
    bitcoinAddress: string | undefined;
    oneSecAddress: string | undefined;
    streakInsurance: OptionUpdate<StreakInsurance>;
    updatedEvents: Map<string, UpdatedEvent[]>;
    suspensionChanged: boolean | undefined;
    newAchievements: ChitEvent[];
    premiumItems: Set<PremiumItem> | undefined;
};

export type ChatStateFull = {
    latestUserCanisterUpdates: bigint;
    directChats: DirectChatSummary[];
    groupChats: GroupChatSummary[];
    communities: CommunitySummary[];
    avatarId: bigint | undefined;
    blockedUsers: string[];
    pinnedChats: ChatIdentifier[];
    pinnedFavouriteChats: ChatIdentifier[];
    pinnedChannels: ChannelIdentifier[];
    favouriteChats: ChatIdentifier[];
    pinNumberSettings: PinNumberSettings | undefined;
    userCanisterLocalUserIndex: string;
    achievements: Set<string>;
    achievementsLastSeen: bigint;
    chitState: ChitState;
    referrals: Referral[];
    walletConfig: WalletConfig;
    messageActivitySummary: MessageActivitySummary;
    installedBots: Map<string, GrantedBotPermissions>;
    bitcoinAddress: string | undefined;
    oneSecAddress: string | undefined;
    streakInsurance: StreakInsurance | undefined;
    premiumItems: Set<PremiumItem>;
};

export type ChitState = {
    streak: number;
    streakEnds: bigint;
    maxStreak: number;
    nextDailyChitClaim: bigint;
    chitBalance: number;
    totalChitEarned: number;
};

export type CurrentChatState = {
    chatSummaries: ChatSummary[];
    blockedUsers: Set<string>;
    pinnedChats: ChatIdentifier[];
};

export type CachedGroupChatSummaries = {
    summaries: GroupChatSummary[];
    timestamp: bigint;
};

export type GroupChatsInitial = {
    summaries: UserCanisterGroupChatSummary[];
};

export type DirectChatsInitial = {
    summaries: DirectChatSummary[];
};

export type ChatIdentifier = MultiUserChatIdentifier | DirectChatIdentifier;
export type MultiUserChatIdentifier = ChannelIdentifier | GroupChatIdentifier;

export type ExpiredEventsRange = { kind: "expired_events_range"; start: number; end: number };
export type ExpiredMessagesRange = { kind: "expired_messages_range"; start: number; end: number };

export function messageContextsEqual(
    a: MessageContext | undefined,
    b: MessageContext | undefined,
): boolean {
    if (a === undefined && b === undefined) {
        return true;
    }

    if (a === undefined || b === undefined) {
        return false;
    }

    return (
        chatIdentifiersEqual(a.chatId, b.chatId) &&
        a.threadRootMessageIndex === b.threadRootMessageIndex
    );
}

export function chatIdentifierUnset(id: ChatIdentifier | undefined): boolean {
    if (id === undefined) return true;
    switch (id.kind) {
        case "channel":
            return id.channelId === 0;
        case "direct_chat":
            return id.userId === "";
        case "group_chat":
            return id.groupId === "";
    }
}

export function chatIdentifiersEqual(
    a: ChatIdentifier | undefined,
    b: ChatIdentifier | undefined,
): boolean {
    if (a === undefined && b === undefined) {
        return true;
    }

    if (a === undefined || b === undefined) {
        return false;
    }

    if (a.kind !== b.kind) {
        return false;
    }

    switch (a.kind) {
        case "channel":
            return (
                b.kind === "channel" &&
                a.communityId === b.communityId &&
                a.channelId === b.channelId
            );
        case "direct_chat":
            return b.kind === "direct_chat" && a.userId === b.userId;
        case "group_chat":
            return b.kind === "group_chat" && a.groupId === b.groupId;
    }
}

export type ThreadIdentifier = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number;
};

export type DirectChatIdentifier = {
    kind: "direct_chat";
    userId: string;
};

export type GroupChatIdentifier = {
    kind: "group_chat";
    groupId: string;
};

export type ChannelIdentifier = {
    kind: "channel";
    communityId: string;
    channelId: number;
};

export type FavouriteChatsInitial = {
    chats: ChatIdentifier[];
    pinned: ChatIdentifier[];
};

export type UserCanisterChannelSummary = {
    id: ChannelIdentifier;
    readByMeUpTo?: number;
    dateReadPinned?: bigint;
    threadsRead: Record<number, number>;
    archived: boolean;
};

export type UserCanisterCommunitySummary = {
    id: CommunityIdentifier;
    index: number;
    channels: UserCanisterChannelSummary[];
    pinned: ChannelIdentifier[];
    archived: boolean;
    localUserIndex: string;
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
    suspended: boolean;
    pinNumberSettings: PinNumberSettings | undefined;
    localUserIndex: string;
    achievements: ChitEvent[];
    achievementsLastSeen: bigint;
    streakEnds: bigint;
    streak: number;
    maxStreak: number;
    nextDailyClaim: bigint;
    chitBalance: number;
    totalChitEarned: number;
    referrals: Referral[];
    walletConfig: WalletConfig;
    messageActivitySummary: MessageActivitySummary;
    bots: Map<string, GrantedBotPermissions>;
    bitcoinAddress: string | undefined;
    oneSecAddress: string | undefined;
    streakInsurance?: StreakInsurance;
    premiumItems: Set<PremiumItem>;
    pinnedChats: ChatIdentifier[];
};

export type StreakInsurance = {
    daysInsured: number;
    daysMissed: number;
};

export type MessageActivitySummary = {
    readUpToTimestamp: bigint;
    latestTimestamp: bigint;
    unreadCount: number;
};

export type MessageActivityEvent = {
    messageContext: MessageContext;
    eventIndex: number;
    messageId: bigint;
    messageIndex: number;
    activity: MessageActivity;
    timestamp: bigint;
    userId: string | undefined;
    message: Message | undefined;
};

export type MessageActivity =
    | "mention"
    | "reaction"
    | "quote_reply"
    | "tip"
    | "crypto"
    | "poll_vote"
    | "p2p_swap_accepted";

export type MessageActivityFeedResponse = {
    total: number;
    events: MessageActivityEvent[];
};

export type PinNumberSettings = {
    length: number;
    attemptsBlockedUntil: bigint | undefined;
};

export type PinNumberResolver = {
    resolve: (pin: string) => void;
    reject: () => void;
    message: string | undefined;
};

export type RulesAcceptanceResolver = {
    resolve: (accepted: boolean) => void;
};

export type AcceptedRules = {
    chat: number | undefined;
    community: number | undefined;
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
    suspended: boolean | undefined;
    pinNumberSettings: OptionUpdate<PinNumberSettings>;
    achievements: ChitEvent[];
    achievementsLastSeen: bigint | undefined;
    chitBalance: number;
    streakEnds: bigint;
    streak: number;
    maxStreak: number;
    nextDailyClaim: bigint;
    totalChitEarned: number;
    referrals: Referral[];
    walletConfig: WalletConfig | undefined;
    messageActivitySummary: MessageActivitySummary | undefined;
    botsAddedOrUpdated: InstalledBotDetails[];
    botsRemoved: string[];
    bitcoinAddress: string | undefined;
    oneSecAddress: string | undefined;
    streakInsurance: OptionUpdate<StreakInsurance>;
    premiumItems: Set<PremiumItem> | undefined;
    pinnedChats: ChatIdentifier[] | undefined;
};

export type DirectChatsUpdates = {
    added: DirectChatSummary[];
    updated: DirectChatSummaryUpdates[];
    removed: string[];
};

export type GroupChatsUpdates = {
    added: UserCanisterGroupChatSummary[];
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
    id: CommunityIdentifier;
    channels: UserCanisterChannelSummaryUpdates[];
    pinned?: ChannelIdentifier[];
    index?: number;
    archived?: boolean;
};

export type UserCanisterChannelSummaryUpdates = {
    id: ChannelIdentifier;
    readByMeUpTo?: number;
    dateReadPinned?: bigint;
    threadsRead: Record<number, number>;
    archived?: boolean;
};

export type UserCanisterGroupChatSummary = {
    id: GroupChatIdentifier;
    readByMeUpTo: number | undefined;
    threadsRead: Record<number, number>;
    archived: boolean;
    dateReadPinned: bigint | undefined;
    localUserIndex: string;
};

export type UserCanisterGroupChatSummaryUpdates = {
    id: GroupChatIdentifier;
    readByMeUpTo: number | undefined;
    threadsRead: Record<number, number>;
    archived: boolean | undefined;
    dateReadPinned: bigint | undefined;
};

export type DirectChatSummaryUpdates = {
    id: DirectChatIdentifier;
    kind: "direct_chat";
    readByThemUpTo?: number;
    readByMeUpTo?: number;
    lastUpdated: bigint;
    latestMessage?: EventWrapper<Message>;
    latestEventIndex?: number;
    latestMessageIndex?: number;
    notificationsMuted?: boolean;
    updatedEvents: UpdatedEvent[];
    eventsTTL: OptionUpdate<bigint>;
    eventsTtlLastUpdated?: bigint;
    metrics?: Metrics;
    myMetrics?: Metrics;
    archived?: boolean;
    videoCallInProgress: OptionUpdate<VideoCallInProgress>;
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
    displayName: string | undefined;
    lapsed: boolean;
};

export type FullMember = Member & UserSummary;

export type GroupChatDetailsResponse = GroupChatDetails | OCError | Failure;

export type GroupChatDetailsUpdatesResponse =
    | ({ kind: "success" } & GroupChatDetailsUpdates)
    | { kind: "success_no_updates"; timestamp: bigint }
    | Failure;

export type GroupChatDetails = {
    members: Member[];
    blockedUsers: Set<string>;
    invitedUsers: Set<string>;
    pinnedMessages: Set<number>;
    rules: VersionedRules;
    timestamp: bigint;
    bots: InstalledBotDetails[];
    webhooks: WebhookDetails[];
};

export type GroupChatDetailsUpdates = {
    membersAddedOrUpdated: Member[];
    membersRemoved: Set<string>;
    blockedUsersAdded: Set<string>;
    blockedUsersRemoved: Set<string>;
    pinnedMessagesRemoved: Set<number>;
    pinnedMessagesAdded: Set<number>;
    rules?: VersionedRules;
    invitedUsers?: Set<string>;
    timestamp: bigint;
    botsAddedOrUpdated: InstalledBotDetails[];
    botsRemoved: Set<string>;
    webhooks?: WebhookDetails[];
};

export type ChatSummary = DirectChatSummary | MultiUserChat;

export type MultiUserChat = GroupChatSummary | ChannelSummary;

export type ChatType = ChatSummary["kind"];

type ChatSummaryCommon = HasMembershipRole & {
    lastUpdated: bigint;
    latestMessage: EventWrapper<Message> | undefined;
    latestEventIndex: number;
    latestMessageIndex: number | undefined;
    metrics: Metrics;
    membership: ChatMembership;
    eventsTTL: bigint | undefined;
    eventsTtlLastUpdated: bigint;
    videoCallInProgress?: VideoCallInProgress;
};

export type ChannelSummary = DataContent &
    AccessControlled &
    ChatSummaryCommon &
    HasLevel &
    Permissioned<ChatPermissions> & {
        kind: "channel";
        id: ChannelIdentifier;
        subtype: GroupSubtype;
        name: string;
        description: string;
        minVisibleEventIndex: number;
        minVisibleMessageIndex: number;
        memberCount: number;
        dateLastPinned: bigint | undefined;
        dateReadPinned: bigint | undefined;
        isInvited: boolean;
        messagesVisibleToNonMembers: boolean;
        externalUrl?: string;
    };

export type DirectChatSummary = ChatSummaryCommon & {
    kind: "direct_chat";
    id: DirectChatIdentifier;
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
        id: GroupChatIdentifier;
        name: string;
        description: string;
        minVisibleEventIndex: number;
        minVisibleMessageIndex: number;
        memberCount: number;
        subtype: GroupSubtype;
        previewed: boolean;
        dateLastPinned: bigint | undefined;
        dateReadPinned: bigint | undefined;
        localUserIndex: string;
        isInvited: boolean;
        messagesVisibleToNonMembers: boolean;
        verified: boolean;
    };

export function nullMembership(): ChatMembership {
    return {
        joined: BigInt(0),
        role: ROLE_NONE,
        mentions: [],
        latestThreads: [],
        myMetrics: emptyChatMetrics(),
        notificationsMuted: false,
        atEveryoneMuted: false,
        readByMeUpTo: undefined,
        archived: false,
        rulesAccepted: false,
        lapsed: false,
    };
}

export type ChatMembership = {
    joined: bigint;
    role: ChatPermissionRole;
    mentions: Mention[];
    latestThreads: ThreadSyncDetails[];
    myMetrics: Metrics;
    notificationsMuted: boolean;
    atEveryoneMuted: boolean;
    readByMeUpTo: number | undefined;
    archived: boolean;
    rulesAccepted: boolean;
    lapsed: boolean;
};

export type GroupCanisterSummaryResponse =
    | GroupCanisterGroupChatSummary
    | CallerNotInGroup
    | CanisterNotFound
    | OCError;

export type GroupCanisterSummaryUpdatesResponse =
    | GroupCanisterGroupChatSummaryUpdates
    | { kind: "success_no_updates" }
    | CallerNotInGroup
    | OCError;

export type GroupCanisterGroupChatSummary = AccessControlled &
    Permissioned<ChatPermissions> & {
        id: GroupChatIdentifier;
        lastUpdated: bigint;
        name: string;
        description: string;
        subtype: GroupSubtype;
        avatarId: bigint | undefined;
        minVisibleEventIndex: number;
        minVisibleMessageIndex: number;
        latestMessage: EventWrapper<Message> | undefined;
        latestEventIndex: number;
        latestMessageIndex: number | undefined;
        memberCount: number;
        metrics: Metrics;
        dateLastPinned: bigint | undefined;
        eventsTTL?: bigint;
        eventsTtlLastUpdated: bigint;
        localUserIndex: string;
        videoCallInProgress?: VideoCallInProgress;
        messagesVisibleToNonMembers: boolean;
        membership: GroupCanisterGroupMembership;
        verified: boolean;
    };

export type GroupCanisterGroupMembership = {
    role: ChatPermissionRole;
    notificationsMuted: boolean;
    atEveryoneMuted: boolean;
    lapsed: boolean;
    joined: bigint;
    rulesAccepted: boolean;
    latestThreads: ThreadSyncDetails[];
    mentions: Mention[];
    myMetrics: Metrics;
};

export type UpdatedEvent = {
    eventIndex: number;
    threadRootMessageIndex?: number;
    timestamp: bigint;
};

export type GroupCanisterGroupChatSummaryUpdates = {
    id: GroupChatIdentifier;
    lastUpdated: bigint;
    name: string | undefined;
    description: string | undefined;
    subtype: OptionUpdate<GroupSubtype>;
    avatarId: OptionUpdate<bigint>;
    public: boolean | undefined;
    latestMessage: EventWrapper<Message> | undefined;
    latestEventIndex: number | undefined;
    latestMessageIndex: number | undefined;
    memberCount: number | undefined;
    permissions: ChatPermissions | undefined;
    metrics: Metrics | undefined;
    frozen: OptionUpdate<boolean>;
    updatedEvents: UpdatedEvent[];
    dateLastPinned: bigint | undefined;
    gateConfig: OptionUpdate<AccessGateConfig>;
    eventsTTL: OptionUpdate<bigint>;
    eventsTtlLastUpdated?: bigint;
    videoCallInProgress: OptionUpdate<VideoCallInProgress>;
    messagesVisibleToNonMembers?: boolean;
    membership: GroupMembershipUpdates | undefined;
    verified?: boolean;
};

export type GroupMembershipUpdates = {
    myRole: MemberRole | undefined;
    notificationsMuted: boolean | undefined;
    atEveryoneMuted: boolean | undefined;
    lapsed: boolean | undefined;
    unfollowedThreads: number[];
    rulesAccepted: boolean | undefined;
    latestThreads: GroupCanisterThreadDetails[];
    mentions: Mention[];
    myMetrics: Metrics | undefined;
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
        id: MultiUserChatIdentifier;
        kind: "candidate_group_chat";
        name: string;
        description: string;
        rules: UpdatedRules;
        members: CandidateMember[];
        avatar?: DataContent;
        eventsTTL?: bigint;
        messagesVisibleToNonMembers?: boolean;
        externalUrl?: string;
        verified: boolean;
    };

export type CandidateChannel = CandidateGroupChat;

export type CreateGroupResponse = CreateGroupSuccess | OCError | Offline;

export type CreateGroupSuccess = {
    kind: "success";
    canisterId: MultiUserChatIdentifier;
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

export type EditMessageResponse = Success | OCError | Offline;

export type SendMessageResponse =
    | SendMessageSuccess
    | SendMessageRecipientBlocked
    | SendMessageInvalidRequest
    | SendMessageTooLong
    | SendMessageEmpty
    | TransferCannotBeZero
    | TransferCannotBeToSelf
    | SendMessageRecipientNotFound
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
    | UserLapsed
    | Failure
    | ChatFrozen
    | RulesNotAccepted
    | Offline
    | CommunityRulesNotAccepted
    | P2PSwapSetUpFailed
    | DuplicateMessageId
    | PinNumberFailures
    | MessageThrottled
    | MessageAlreadyExists
    | OCError;

export type MessageAlreadyExists = {
    kind: "message_already_exists";
};

export type SendMessageSuccess = {
    kind: "success";
    timestamp: bigint;
    messageIndex: number;
    eventIndex: number;
    expiresAt?: number; // Timestamp in seconds
};

export type TransferSuccess = {
    kind: "transfer_success";
    timestamp: bigint;
    messageIndex: number;
    eventIndex: number;
    transfer: CompletedCryptocurrencyTransfer;
    expiresAt?: number; // Timestamp in seconds
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

export type TransferLimitExceeded = {
    kind: "transfer_limit_exceeded";
};

export type TransferCannotBeZero = {
    kind: "transfer_cannot_be_zero";
};

export type TransferCannotBeToSelf = {
    kind: "transfer_cannot_be_to_self";
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
    | "min_stake_not_met"
    | "payment_failed"
    | "insufficient_balance"
    | "failed_verified_credential_check"
    | "no_unique_person_proof"
    | "not_lifetime_diamond"
    | "locked"
    | "not_referred_by_member"
    | "chit_earned_too_low";

export type ChatFrozenEvent = {
    kind: "chat_frozen";
    frozenBy: string;
    reason: string | undefined;
};

export type RulesNotAccepted = {
    kind: "rules_not_accepted";
};

export type CommunityRulesNotAccepted = {
    kind: "community_rules_not_accepted";
};

export type P2PSwapSetUpFailed = {
    kind: "p2p_swap_setup_failed";
    text: string;
};

export type DuplicateMessageId = {
    kind: "duplicate_message_id";
};

export type MessageThrottled = {
    kind: "message_throttled";
};

export type PinRequired = {
    kind: "pin_required";
};

export type PinIncorrect = {
    kind: "pin_incorrect";
    nextRetryAt: bigint;
};

export type TooManyFailedPinAttempts = {
    kind: "too_main_failed_pin_attempts";
    nextRetryAt: bigint;
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

export type MembersAddedToDefaultChannel = {
    kind: "members_added_to_default_channel";
    count: number;
};

export type EmptyEvent = {
    kind: "empty";
};

export type ExternalUrlUpdated = {
    kind: "external_url_updated";
    newUrl?: string;
    updatedBy: string;
};

export type SetAvatarResponse = Success | OCError | Offline;
export type ChangeRoleResponse = Success | OCError | Offline;
export type DeleteGroupResponse = Success | OCError | Offline;
export type RemoveMemberResponse = Success | OCError | Offline | Failure;
export type BlockUserResponse = Success | OCError | Offline;
export type UnblockUserResponse = Success | OCError | Offline;
export type LeaveGroupResponse = Success | OCError | Offline;

export type JoinGroupResponse =
    | (Success & { group: MultiUserChat })
    | SuccessJoinedCommunity
    | GateCheckFailed
    | Failure
    | Offline
    | OCError;

export type SuccessJoinedCommunity = {
    kind: "success_joined_community";
    community: CommunitySummary;
};

export type MarkReadRequest = {
    readUpTo: number | undefined;
    chatId: ChatIdentifier;
    threads: ThreadRead[];
    dateReadPinned: bigint | undefined;
}[];

export type ThreadRead = {
    threadRootMessageIndex: number;
    readUpTo: number;
};

export type MarkReadResponse = "success";

export type UpdateGroupResponse =
    | {
          kind: "success";
          rulesVersion: number | undefined;
      }
    | { kind: "not_authorized" }
    | { kind: "name_too_short" }
    | { kind: "name_too_long" }
    | { kind: "name_reserved" }
    | { kind: "desc_too_long" }
    | { kind: "unchanged" }
    | { kind: "name_taken" }
    | { kind: "not_in_group" }
    | { kind: "avatar_too_big" }
    | { kind: "rules_too_short" }
    | { kind: "rules_too_long" }
    | { kind: "user_suspended" }
    | { kind: "user_lapsed" }
    | { kind: "chat_frozen" }
    | { kind: "internal_error" }
    | { kind: "failure" }
    | { kind: "access_gate_invalid" }
    | Offline
    | OCError;

export type UpdatePermissionsResponse =
    | "success"
    | "not_authorized"
    | "not_in_group"
    | "user_suspended"
    | "user_lapsed"
    | "chat_frozen"
    | "offline";

export type AddRemoveReactionResponse = Success | OCError | Offline;
export type DeleteMessageResponse = Success | OCError | Offline;

export type UndeleteMessageResponse =
    | {
          kind: "success";
          message: Message;
      }
    | Failure
    | OCError
    | Offline;

export type PushEventSuccess = {
    kind: "success";
    eventIndex: number;
    timestamp: bigint;
};

export type UnpinMessageResponse = PushEventSuccess | OCError | Offline;
export type PinMessageResponse = PushEventSuccess | OCError | Offline;

export type DeletedGroupMessageResponse =
    | {
          kind: "success";
          content: MessageContent;
      }
    | OCError
    | Offline;

export type DeletedDirectMessageResponse =
    | {
          kind: "success";
          content: MessageContent;
      }
    | OCError
    | Offline;

export type RegisterPollVoteResponse = Success | OCError | Offline;
export type InviteCodeResponse = InviteCodeSuccess | OCError | Offline | Failure;

export type InviteCodeSuccess = {
    kind: "success";
    code?: string;
};

export type EnableInviteCodeResponse = EnableInviteCodeSuccess | OCError | Offline | Failure;

export type EnableInviteCodeSuccess = {
    kind: "success";
    code: string;
};

export type DisableInviteCodeResponse = Success | OCError | Offline | Failure;
export type ResetInviteCodeResponse = ResetInviteCodeSuccess | OCError | Offline | Failure;

export type ResetInviteCodeSuccess = {
    kind: "success";
    code: string;
};

export type ThreadPreviewsResponse = ThreadPreviewsSuccess | OCError | Offline;

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

export type RegisterProposalVoteResponse = Success | OCError | Offline | Failure;

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

export type ActiveGroupsResponse = {
    timestamp: bigint;
    activeGroups: string[];
    deletedGroups: DeletedInfo[];
    deletedCommunities: DeletedInfo[];
    activeCommunities: string[];
};

export type DeletedInfo = {
    id: string;
    timestamp: bigint;
    name: string;
    public: boolean;
    deletedBy: string;
};

export type FreezeGroupResponse =
    | EventWrapper<ChatFrozenEvent>
    | "chat_already_frozen"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error"
    | "offline";

export type UnfreezeGroupResponse =
    | EventWrapper<ChatUnfrozenEvent>
    | "chat_not_frozen"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error"
    | "offline";

export type DeleteFrozenGroupResponse =
    | "success"
    | "chat_not_frozen"
    | "chat_not_frozen_long_enough"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error"
    | "offline";

export type AddHotGroupExclusionResponse =
    | "success"
    | "chat_already_excluded"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error"
    | "offline";

export type RemoveHotGroupExclusionResponse =
    | "success"
    | "chat_not_excluded"
    | "chat_not_found"
    | "not_authorized"
    | "internal_error"
    | "offline";

export type SetGroupUpgradeConcurrencyResponse =
    | "success"
    | "not_authorized"
    | "internal_error"
    | "offline";
export type SetCommunityModerationFlagsResponse =
    | "success"
    | "community_not_found"
    | "not_authorized"
    | "invalid_flags"
    | "internal_error"
    | "offline";

export type MarkPinnedMessagesReadResponse = Success | OCError | Offline;
export type ClaimPrizeResponse = Success | OCError | Failure | Offline;
export type DeclineInvitationResponse = Success | OCError | Offline;

export type PublicGroupSummaryResponse =
    | (Success & { group: GroupChatSummary })
    | OCError
    | Failure
    | Offline
    | GroupMoved;

export type GroupMoved = { kind: "group_moved"; location: ChannelIdentifier };

export type TipMessageResponse = Success | OCError | Failure;

export type GroupAndCommunitySummaryUpdatesArgs = {
    canisterId: string;
    isCommunity: boolean;
    inviteCode: bigint | undefined;
    updatesSince: bigint | undefined;
};

export type GroupAndCommunitySummaryUpdatesResponseBatch = {
    timestamp: bigint;
    updates: GroupAndCommunitySummaryUpdatesResponse[];
    excessUpdates: string[];
    errors: [string, OCError][];
    notFound: string[];
};

export type GroupAndCommunitySummaryUpdatesResponse =
    | {
          kind: "group";
          value: GroupCanisterGroupChatSummary;
      }
    | {
          kind: "group_updates";
          value: GroupCanisterGroupChatSummaryUpdates;
      }
    | {
          kind: "community";
          value: CommunitySummary;
      }
    | {
          kind: "community_updates";
          value: CommunityCanisterCommunitySummaryUpdates;
      }
    | {
          kind: "not_found";
          canisterId: string;
      }
    | { kind: "error"; error: string; canisterId: string };

export type ChatEventsArgs = {
    context: MessageContext;
    args: ChatEventsArgsInner;
    latestKnownUpdate: bigint | undefined;
};

export type ChatEventsArgsInner =
    | {
          kind: "page";
          ascending: boolean;
          startIndex: number;
          eventIndexRange: [number, number];
      }
    | {
          kind: "by_index";
          events: number[];
      }
    | {
          kind: "window";
          midPoint: number;
          eventIndexRange: [number, number];
      };

export type ReplicaNotUpToDate = {
    kind: "replica_not_up_to_date";
    replicaTimestamp: bigint;
    clientTimestamp: bigint;
};

export type ChatEventsBatchResponse = {
    responses: ChatEventsResponse[];
    timestamp: bigint;
};

export type ChatEventsResponse =
    | {
          kind: "success";
          result: EventsSuccessResult<ChatEvent>;
      }
    | ReplicaNotUpToDate
    | { kind: "not_found" }
    | { kind: "internal_error"; error: string }
    | Failure
    | OCError;

export type AcceptP2PSwapResponse =
    | { kind: "success"; token1TxnIn: TransactionId }
    | OCError
    | { kind: "internal_error"; text: string };

export type CancelP2PSwapResponse = Success | OCError | { kind: "internal_error"; text: string };
export type JoinVideoCallResponse = Success | OCError | Offline;

export type VideoCallPresence = "default" | "owner" | "hidden";

export type SetVideoCallPresenceResponse = Success | OCError | Offline;

export type VideoCallParticipants = {
    participants: VideoCallParticipant[];
    hidden: VideoCallParticipant[];
    lastUpdated: bigint;
};

export type VideoCallParticipantsResponse = (Success & VideoCallParticipants) | OCError | Offline;

export type SetPinNumberResponse =
    | Success
    | PinNumberFailures
    | { kind: "too_short"; minLength: number }
    | { kind: "too_long"; maxLength: number }
    | { kind: "delegation_too_old" }
    | { kind: "malformed_signature" }
    | OCError;

export type PinNumberFailures = PinRequired | PinIncorrect | TooManyFailedPinAttempts;

export type MessageFilter = {
    id: bigint;
    regex: RegExp;
};

export type UnconfirmedMessageEvent = EventWrapper<Message> & { accepted: boolean };

export type UnconfirmedState = Map<bigint, UnconfirmedMessageEvent>;

export type NewUnconfirmedMessage = {
    timestamp: bigint;
    expiresAt?: number;
    messageId: bigint;
    sender: string;
    content: MessageContent;
    repliesTo?: ReplyContext;
    forwarded: boolean;
    blockLevelMarkdown: boolean;
    senderContext?: SenderContext;
};

export type VideoCallInProgress = {
    started: bigint;
    startedBy: string;
    messageIndex: number;
    messageId: bigint;
    callType: "default" | "broadcast";
    joinedByCurrentUser: boolean;
};

export type PinnedByScope = Map<ChatListScope["kind"], ChatIdentifier[]>;

export type ChatEventType =
    | "Message"
    | "MessageEdited"
    | "MessageReaction"
    | "MessageTipped"
    | "MessageDeleted"
    | "MessageUndeleted"
    | "MessagePollVote"
    | "MessagePollEnded"
    | "MessagePrizeClaim"
    | "MessageP2pSwapCompleted"
    | "MessageP2pSwapCancelled"
    | "MessageVideoCall"
    | "MessageOther"
    | "Created"
    | "NameChanged"
    | "DescriptionChanged"
    | "RulesChanged"
    | "AvatarChanged"
    | "ExternalUrlUpdated"
    | "PermissionsChanged"
    | "GateUpdated"
    | "VisibilityChanged"
    | "InviteCodeChanged"
    | "Frozen"
    | "Unfrozen"
    | "DisappearingMessagesUpdated"
    | "MessagePinned"
    | "MessageUnpinned"
    | "MembersJoined"
    | "MembersLeft"
    | "RoleChanged"
    | "UsersInvited"
    | "UsersBlocked"
    | "UsersUnblocked"
    | "BotAdded"
    | "BotRemoved"
    | "BotUpdated";
