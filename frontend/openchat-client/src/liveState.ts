import type {
    AuthProvider,
    ChatEvent,
    ChatIdentifier,
    ChatMap,
    ChatSummary,
    CommunitySummary,
    CommunityMap,
    DirectChatSummary,
    EnhancedReplyContext,
    EventWrapper,
    MessageContext,
    ThreadSyncDetails,
    UserLookup,
    MultiUserChat,
    ChatListScope,
    Member,
    VersionedRules,
    CreatedUser,
    DiamondMembershipStatus,
    ChitState,
    WalletConfig,
    ObjectSet,
    ExternalBot,
    ExternalBotPermissions,
} from "openchat-shared";
import { selectedAuthProviderStore } from "./stores/authProviders";
import {
    serverChatSummariesStore,
    myServerChatSummariesStore,
    chatSummariesStore,
    groupPreviewsStore,
    selectedChatId,
    eventsStore,
    selectedChatStore,
    selectedServerChatStore,
    currentChatReplyingTo,
    chatSummariesListStore,
    threadsByChatStore,
    focusMessageIndex,
    focusThreadMessageIndex,
    threadEvents,
    threadsFollowedByMeStore,
    currentChatUserIds,
    selectedThreadRootMessageIndex,
    chatsInitialised,
    chatsLoading,
    uninitializedDirectChats,
    confirmedThreadEventIndexesLoadedStore,
    selectedMessageContext,
    allChats,
    currentChatMembers,
    currentChatRules,
    pinnedChatsStore,
    favouritesStore,
    currentChatBots,
} from "./stores/chat";
import { remainingStorage } from "./stores/storage";
import { userCreatedStore } from "./stores/userCreated";
import { anonUser, currentUser, platformModerator, suspendedUser, userStore } from "./stores/user";
import { blockedUsers } from "./stores/blockedUsers";
import { diamondStatus, isDiamond, isLifetimeDiamond } from "./stores/diamond";
import type DRange from "drange";
import {
    communities,
    communityPreviewsStore,
    currentCommunityMembers,
    selectedCommunity,
    currentCommunityRules,
    currentCommunityBots,
} from "./stores/community";
import {
    type GlobalState,
    chatListScopeStore,
    globalStateStore,
    chitStateStore,
    type PinnedByScope,
    installedDirectBots,
} from "./stores/global";
import { offlineStore } from "./stores/network";
import { type DraftMessages, draftMessagesStore } from "./stores/draftMessages";
import { locale } from "svelte-i18n";
import type { PinNumberResolver } from "openchat-shared";
import { capturePinNumberStore, pinNumberRequiredStore } from "./stores/pinNumber";
import { walletConfigStore } from "./stores/crypto";
import { externalBots } from "./stores";

/**
 * Any stores that we reference inside the OpenChat client can be added here so that we always have the up to date current value
 * at hand without having to use svelte.get which will create and destroy a subscription every time
 */
export class LiveState {
    selectedChat: ChatSummary | undefined;
    selectedServerChat: ChatSummary | undefined;
    events!: EventWrapper<ChatEvent>[];
    selectedAuthProvider!: AuthProvider | undefined;
    userCreated!: boolean;
    userStore!: UserLookup;
    remainingStorage!: number;
    currentChatReplyingTo: EnhancedReplyContext | undefined;
    serverChatSummaries!: ChatMap<ChatSummary>;
    myServerChatSummaries!: ChatMap<ChatSummary>;
    chatSummaries!: ChatMap<ChatSummary>;
    uninitializedDirectChats!: ChatMap<DirectChatSummary>;
    groupPreviews!: ChatMap<MultiUserChat>;
    communityPreviews!: CommunityMap<CommunitySummary>;
    selectedChatId: ChatIdentifier | undefined;
    chatSummariesList!: ChatSummary[];
    threadsByChat!: ChatMap<ThreadSyncDetails[]>;
    focusMessageIndex: number | undefined;
    focusThreadMessageIndex: number | undefined;
    threadEvents!: EventWrapper<ChatEvent>[];
    selectedMessageContext: MessageContext | undefined;
    threadsFollowedByMe!: ChatMap<Set<number>>;
    currentChatMembers!: Member[];
    currentChatRules!: VersionedRules | undefined;
    currentChatUserIds!: Set<string>;
    selectedThreadRootMessageIndex: number | undefined;
    chatsInitialised!: boolean;
    chatsLoading!: boolean;
    blockedUsers!: Set<string>;
    diamondStatus!: DiamondMembershipStatus;
    isDiamond!: boolean;
    isLifetimeDiamond!: boolean;
    confirmedThreadEventIndexesLoaded!: DRange;
    communities!: CommunityMap<CommunitySummary>;
    chatListScope!: ChatListScope;
    globalState!: GlobalState;
    pinnedChats!: PinnedByScope;
    favourites!: ObjectSet<ChatIdentifier>;
    allChats!: ChatMap<ChatSummary>;
    selectedCommunity!: CommunitySummary | undefined;
    currentCommunityMembers!: Map<string, Member>;
    draftMessages!: DraftMessages;
    currentCommunityRules!: VersionedRules | undefined;
    user!: CreatedUser;
    anonUser!: boolean;
    suspendedUser!: boolean;
    platformModerator!: boolean;
    offlineStore!: boolean;
    locale!: string;
    pinNumberRequired!: boolean;
    capturePinNumber!: PinNumberResolver | undefined;
    chitState!: ChitState;
    walletConfig!: WalletConfig;
    externalBots!: Map<string, ExternalBot>;
    installedDirectBots!: Map<string, ExternalBotPermissions>;
    currentChatBots!: Map<string, ExternalBotPermissions>;
    currentCommunityBots!: Map<string, ExternalBotPermissions>;

    constructor() {
        currentChatBots.subscribe((state) => (this.currentChatBots = state));
        currentCommunityBots.subscribe((state) => (this.currentCommunityBots = state));
        installedDirectBots.subscribe((state) => (this.installedDirectBots = state));
        externalBots.subscribe((state) => (this.externalBots = state));
        chitStateStore.subscribe((state) => (this.chitState = state));
        offlineStore.subscribe((offline) => (this.offlineStore = offline));
        currentUser.subscribe((user) => (this.user = user));
        anonUser.subscribe((anon) => (this.anonUser = anon));
        suspendedUser.subscribe((suspended) => (this.suspendedUser = suspended));
        platformModerator.subscribe((mod) => (this.platformModerator = mod));
        confirmedThreadEventIndexesLoadedStore.subscribe(
            (data) => (this.confirmedThreadEventIndexesLoaded = data),
        );
        remainingStorage.subscribe((data) => (this.remainingStorage = data));
        userStore.subscribe((data) => (this.userStore = data));
        userCreatedStore.subscribe((data) => (this.userCreated = data));
        selectedAuthProviderStore.subscribe((data) => (this.selectedAuthProvider = data));
        serverChatSummariesStore.subscribe((data) => (this.serverChatSummaries = data));
        myServerChatSummariesStore.subscribe((data) => (this.myServerChatSummaries = data));
        chatSummariesStore.subscribe((data) => (this.chatSummaries = data));
        uninitializedDirectChats.subscribe((data) => (this.uninitializedDirectChats = data));
        groupPreviewsStore.subscribe((data) => (this.groupPreviews = data));
        communityPreviewsStore.subscribe((data) => (this.communityPreviews = data));
        selectedChatId.subscribe((data) => (this.selectedChatId = data));
        eventsStore.subscribe((data) => (this.events = data));
        selectedChatStore.subscribe((data) => (this.selectedChat = data));
        selectedServerChatStore.subscribe((data) => (this.selectedServerChat = data));
        currentChatReplyingTo.subscribe((data) => (this.currentChatReplyingTo = data));
        chatSummariesListStore.subscribe((data) => (this.chatSummariesList = data));
        threadsByChatStore.subscribe((data) => (this.threadsByChat = data));
        focusMessageIndex.subscribe((data) => (this.focusMessageIndex = data));
        focusThreadMessageIndex.subscribe((data) => (this.focusThreadMessageIndex = data));
        threadEvents.subscribe((data) => (this.threadEvents = data));
        selectedMessageContext.subscribe((data) => (this.selectedMessageContext = data));
        threadsFollowedByMeStore.subscribe((data) => (this.threadsFollowedByMe = data));
        currentChatMembers.subscribe((data) => (this.currentChatMembers = data));
        currentChatRules.subscribe((data) => (this.currentChatRules = data));
        currentChatUserIds.subscribe((data) => (this.currentChatUserIds = data));
        selectedThreadRootMessageIndex.subscribe(
            (data) => (this.selectedThreadRootMessageIndex = data),
        );
        chatsInitialised.subscribe((data) => (this.chatsInitialised = data));
        chatsLoading.subscribe((data) => (this.chatsLoading = data));
        blockedUsers.subscribe((data) => (this.blockedUsers = data));
        diamondStatus.subscribe((data) => (this.diamondStatus = data));
        isDiamond.subscribe((data) => (this.isDiamond = data));
        isLifetimeDiamond.subscribe((data) => (this.isDiamond = data));
        communities.subscribe((data) => (this.communities = data));
        chatListScopeStore.subscribe((scope) => (this.chatListScope = scope));
        globalStateStore.subscribe((data) => (this.globalState = data));
        pinnedChatsStore.subscribe((data) => (this.pinnedChats = data));
        favouritesStore.subscribe((data) => (this.favourites = data));
        allChats.subscribe((data) => (this.allChats = data));
        selectedCommunity.subscribe((data) => (this.selectedCommunity = data));
        currentCommunityMembers.subscribe((data) => (this.currentCommunityMembers = data));
        draftMessagesStore.subscribe((data) => (this.draftMessages = data));
        currentCommunityRules.subscribe((data) => (this.currentCommunityRules = data));
        locale.subscribe((data) => (this.locale = data ?? "en"));
        pinNumberRequiredStore.subscribe((data) => (this.pinNumberRequired = data));
        capturePinNumberStore.subscribe((data) => (this.capturePinNumber = data));
        walletConfigStore.subscribe((data) => (this.walletConfig = data));
    }
}
