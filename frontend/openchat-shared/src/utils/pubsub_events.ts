import type { Readable } from "svelte/store";
import type {
    ChannelIdentifier,
    ChatIdentifier,
    ChatSummary,
    ChitEarnedGate,
    ChitEvent,
    CommunityIdentifier,
    CommunitySummary,
    DirectChatIdentifier,
    DirectChatSummary,
    EnhancedReplyContext,
    EphemeralMessageEvent,
    EventWrapper,
    FullWebhookDetails,
    GroupChatSummary,
    Level,
    Message,
    MessageContext,
    MultiUserChat,
    MultiUserChatIdentifier,
    NamedAccount,
    NeuronGate,
    Notification,
    PaymentGate,
    PublicProfile,
    ResourceKey,
    TokenBalanceGate,
    UpdatedRules,
    UserGroupDetails,
    VideoCallType,
} from "..";

export type PubSubEvents = {
    startVideoCall: { chatId: ChatIdentifier; callType: VideoCallType; join: boolean };
    hangup: undefined;
    askToSpeak: undefined;
    chatWith: DirectChatIdentifier;
    showInviteGroupUsers: boolean;
    replyPrivatelyTo: EnhancedReplyContext;
    showGroupMembers: undefined;
    upgrade: undefined;
    verifyHumanity: undefined;
    deleteChat: MultiUserChat;
    deleteCommunityMobile: CommunitySummary;
    deleteGroup: {
        kind: "delete";
        chatId: MultiUserChatIdentifier;
        level: Level;
        doubleCheck: { challenge: ResourceKey; response: ResourceKey };
        after?: () => void;
    };
    deleteCommunity: {
        kind: "delete_community";
        communityId: CommunityIdentifier;
        doubleCheck: { challenge: ResourceKey; response: ResourceKey };
    };
    communityDetails: CommunitySummary;
    editCommunity: CommunitySummary;
    leaveCommunity: {
        kind: "leave_community";
        communityId: CommunityIdentifier;
    };
    makeProposal: undefined;
    leaveGroup: {
        kind: "leave";
        chatId: MultiUserChatIdentifier;
        level: Level;
    };
    newGroup: undefined;
    wallet: undefined;
    profile: undefined;
    claimDailyChit: undefined;
    joinGroup: {
        group: MultiUserChat;
        select: boolean;
    };
    createCommunity: undefined;
    unarchiveChat: ChatIdentifier;
    forward: Message;
    toggleMuteNotifications: {
        chatId: ChatIdentifier;
        mute: boolean | undefined;
        muteAtEveryone: boolean | undefined;
    };
    newChannel: boolean;
    successfulImport: ChannelIdentifier;
    showProposalFilters: undefined;
    convertGroupToCommunity: GroupChatSummary;
    convertedGroupToCommunity: { name: string; channelId: ChannelIdentifier };
    clearSelection: undefined;
    editGroup: { chat: MultiUserChat; rules: UpdatedRules | undefined };
    updateGroup: undefined;
    videoCallMessageUpdated: { chatId: ChatIdentifier; messageId: bigint };
    chatUpdated: MessageContext;
    sendingMessage: MessageContext;
    sentMessage: {
        context: MessageContext;
        event: EventWrapper<Message>;
    };
    userLoggedIn: string;
    reactionSelected: { messageId: bigint; kind: "add" | "remove" };
    userSuspensionChanged: undefined;
    selectedChatInvalid: undefined;
    chitEarned: ChitEvent[];
    sendMessageFailed: boolean;
    summonWitch: undefined;
    registerBot: undefined;
    updateBot: undefined;
    removeBot: undefined;
    registerWebhook: undefined;
    updateWebhook: FullWebhookDetails;
    deleteWebhook: undefined;
    loadedMessageWindow: {
        context: MessageContext;
        messageIndex: number;
        initialLoad: boolean;
    };
    loadedNewMessages: MessageContext;
    loadedPreviousMessages: {
        context: MessageContext;
        initialLoad: boolean;
    };
    createPoll: MessageContext;
    attachGif: [MessageContext, string];
    tokenTransfer: {
        context: MessageContext;
        ledger?: string;
        amount?: bigint;
    };
    createTestMessages: [MessageContext, number];
    searchChat: string;
    remoteVideoCallStarted: {
        chatId: ChatIdentifier;
        userId: string;
        messageId: bigint;
        currentUserIsParticipant: boolean;
        callType: VideoCallType;
        timestamp: bigint;
    };
    remoteVideoCallEnded: bigint;
    notification: Notification;
    noAccess: undefined;
    notFound: undefined;
    showFailureToast: {
        resourceKey: ResourceKey | Readable<ResourceKey | undefined>;
        err?: unknown;
    };
    showSuccessToast: ResourceKey;
    ephemeralMessage: EphemeralMessageEvent;
    copyUrl: undefined;
    suspendUser: string;
    userProfileChatsAndVideo: undefined;
    appSettings: undefined;
    userInformation: PublicProfile;
    userProfileShare: undefined;
    userProfileAbout: undefined;
    userProfileCacheManagement: undefined;
    userProfileBotConfig: undefined;
    userProfileDeleteAccount: undefined;
    userProfileAppearance: undefined;
    userProfileChitRewards: undefined;
    userProfileCommunitySettings: undefined;
    userProfileVerify: undefined;
    closeModalPage: undefined;
    closeModalStack: undefined;
    updateGroupDetails: undefined;
    updateRules: unknown;
    updateAccessGates: unknown;
    updateGroupPermissions: undefined;
    updateCommunityPermissions: undefined;
    updateNeuronGates: unknown;
    updatePaymentGates: unknown;
    updateTokenBalanceGates: unknown;
    accessGatesLearnMore: undefined;
    updateNeuronGate: {
        data: unknown;
        gate: NeuronGate;
    };
    updatePaymentGate: { data: unknown; gate: PaymentGate };
    updateChitGate: { data: unknown; gate: ChitEarnedGate };
    updateTokenBalanceGate: { data: unknown; gate: TokenBalanceGate };
    updateCommunity: undefined;
    updateCommunityDetails: undefined;
    updateCommunityGeneralSetup: undefined;
    updateCommunityRules: undefined;
    updateCommunityChannels: undefined;
    newCommunity: undefined;
    newMessage: undefined;
    directChatDetails: DirectChatSummary;
    groupChatDetails: MultiUserChat;
    tokenPage: unknown;
    receiveToken: unknown;
    sendToken: unknown;
    swapToken: unknown;
    manageRecipients: undefined;
    addRecipient: { account?: NamedAccount; onComplete: () => void };
    editRecipient: { account: NamedAccount; onComplete: () => void };
    walletSettings: undefined;
    showThreads: undefined;
    openThread: { chat: ChatSummary; msg: EventWrapper<Message> };
    showMembers: {
        collection: MultiUserChat | CommunitySummary;
        view: "members" | "add" | "lapsed" | "blocked";
    };
    showUserGroups: undefined;
    showUserGroup: UserGroupDetails;
    editUserGroup: UserGroupDetails;
    inviteAndShare: { collection: MultiUserChat | CommunitySummary; view: "invite" | "share" };
};
