import type DRange from "drange";
import type {
    AuthProvider,
    ChatEvent,
    ChatIdentifier,
    ChatMap,
    ChatSummary,
    ChitState,
    CreatedUser,
    DiamondMembershipStatus,
    DirectChatSummary,
    EnhancedReplyContext,
    EventWrapper,
    MessageContext,
    MultiUserChat,
    ObjectSet,
    PinNumberResolver,
    StreakInsurance,
    ThreadSyncDetails,
    UserLookup,
} from "openchat-shared";
import { locale } from "svelte-i18n";
import { serverStreakInsuranceStore } from "./stores";
import { selectedAuthProviderStore } from "./stores/authProviders";
import { blockedUsers } from "./stores/blockedUsers";
import {
    allChats,
    chatSummariesListStore,
    chatSummariesStore,
    confirmedThreadEventIndexesLoadedStore,
    currentChatReplyingTo,
    eventsStore,
    favouritesStore,
    groupPreviewsStore,
    myServerChatSummariesStore,
    selectedChatId,
    selectedChatStore,
    selectedMessageContext,
    selectedServerChatStore,
    selectedThreadRootMessageIndex,
    serverChatSummariesStore,
    threadEvents,
    threadsByChatStore,
    threadsFollowedByMeStore,
    uninitializedDirectChats,
} from "./stores/chat";
import { diamondStatus, isDiamond, isLifetimeDiamond } from "./stores/diamond";
import { type DraftMessages, draftMessagesStore } from "./stores/draftMessages";
import { type GlobalState, chitStateStore, globalStateStore } from "./stores/global";
import { offlineStore } from "./stores/network";
import { capturePinNumberStore, pinNumberRequiredStore } from "./stores/pinNumber";
import { remainingStorage } from "./stores/storage";
import { anonUser, currentUser, platformModerator, suspendedUser, userStore } from "./stores/user";
import { userCreatedStore } from "./stores/userCreated";

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
    selectedChatId: ChatIdentifier | undefined;
    chatSummariesList!: ChatSummary[];
    threadsByChat!: ChatMap<ThreadSyncDetails[]>;
    threadEvents!: EventWrapper<ChatEvent>[];
    selectedMessageContext: MessageContext | undefined;
    threadsFollowedByMe!: ChatMap<Set<number>>;
    selectedThreadRootMessageIndex: number | undefined;
    blockedUsers!: Set<string>;
    diamondStatus!: DiamondMembershipStatus;
    isDiamond!: boolean;
    isLifetimeDiamond!: boolean;
    confirmedThreadEventIndexesLoaded!: DRange;
    globalState!: GlobalState;
    favourites!: ObjectSet<ChatIdentifier>;
    allChats!: ChatMap<ChatSummary>;
    draftMessages!: DraftMessages;
    user!: CreatedUser;
    anonUser!: boolean;
    suspendedUser!: boolean;
    platformModerator!: boolean;
    offlineStore!: boolean;
    locale!: string;
    pinNumberRequired!: boolean;
    capturePinNumber!: PinNumberResolver | undefined;
    chitState!: ChitState;
    serverStreakInsurance!: StreakInsurance;

    constructor() {
        serverStreakInsuranceStore.subscribe((state) => (this.serverStreakInsurance = state));
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
        selectedChatId.subscribe((data) => (this.selectedChatId = data));
        eventsStore.subscribe((data) => (this.events = data));
        selectedChatStore.subscribe((data) => (this.selectedChat = data));
        selectedServerChatStore.subscribe((data) => (this.selectedServerChat = data));
        currentChatReplyingTo.subscribe((data) => (this.currentChatReplyingTo = data));
        chatSummariesListStore.subscribe((data) => (this.chatSummariesList = data));
        threadsByChatStore.subscribe((data) => (this.threadsByChat = data));
        threadEvents.subscribe((data) => (this.threadEvents = data));
        selectedMessageContext.subscribe((data) => (this.selectedMessageContext = data));
        threadsFollowedByMeStore.subscribe((data) => (this.threadsFollowedByMe = data));
        selectedThreadRootMessageIndex.subscribe(
            (data) => (this.selectedThreadRootMessageIndex = data),
        );
        blockedUsers.subscribe((data) => (this.blockedUsers = data));
        diamondStatus.subscribe((data) => (this.diamondStatus = data));
        isDiamond.subscribe((data) => (this.isDiamond = data));
        isLifetimeDiamond.subscribe((data) => (this.isDiamond = data));
        globalStateStore.subscribe((data) => (this.globalState = data));
        favouritesStore.subscribe((data) => (this.favourites = data));
        allChats.subscribe((data) => (this.allChats = data));
        draftMessagesStore.subscribe((data) => (this.draftMessages = data));
        locale.subscribe((data) => (this.locale = data ?? "en"));
        pinNumberRequiredStore.subscribe((data) => (this.pinNumberRequired = data));
        capturePinNumberStore.subscribe((data) => (this.capturePinNumber = data));
    }
}
