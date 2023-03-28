import type {
    AuthProvider,
    ChatEvent,
    ChatSummary,
    DiamondMembershipDetails,
    DirectChatSummary,
    EnhancedReplyContext,
    EventWrapper,
    GroupChatSummary,
    Message,
    ThreadSyncDetails,
    UserLookup,
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
    selectedThreadKey,
    threadsFollowedByMeStore,
    currentChatUserIds,
    selectedThreadRootMessageIndex,
    chatsInitialised,
    chatsLoading,
    uninitializedDirectChats,
    confirmedThreadEventIndexesLoadedStore,
    selectedThreadRootEvent,
} from "./stores/chat";
import { remainingStorage } from "./stores/storage";
import { userCreatedStore } from "./stores/userCreated";
import { userStore } from "./stores/user";
import { pinnedChatsStore } from "./stores/pinnedChats";
import { blockedUsers } from "./stores/blockedUsers";
import { diamondMembership, isDiamond } from "./stores/diamond";
import type DRange from "drange";

/**
 * Any stores that we reference inside the OpenChat client can be added here so that we always have the up to date current value
 * at hand without having to use svelte.get which will create and destroy a subscription every time
 */
export class LiveState {
    selectedChat: ChatSummary | undefined;
    selectedServerChat: ChatSummary | undefined;
    events!: EventWrapper<ChatEvent>[];
    selectedAuthProvider!: AuthProvider;
    userCreated!: boolean;
    userStore!: UserLookup;
    remainingStorage!: number;
    currentChatReplyingTo: EnhancedReplyContext | undefined;
    serverChatSummaries!: Record<string, ChatSummary>;
    myServerChatSummaries!: Record<string, ChatSummary>;
    chatSummaries!: Record<string, ChatSummary>;
    uninitializedDirectChats!: Record<string, DirectChatSummary>;
    groupPreviews!: Record<string, GroupChatSummary>;
    selectedChatId: string | undefined;
    pinnedChats!: string[];
    chatSummariesList!: ChatSummary[];
    threadsByChat!: Record<string, ThreadSyncDetails[]>;
    focusMessageIndex: number | undefined;
    focusThreadMessageIndex: number | undefined;
    threadEvents!: EventWrapper<ChatEvent>[];
    selectedThreadKey: string | undefined;
    selectedThreadRootEvent: EventWrapper<Message> | undefined;
    threadsFollowedByMe!: Record<string, Set<number>>;
    currentChatUserIds!: Set<string>;
    selectedThreadRootMessageIndex: number | undefined;
    chatsInitialised!: boolean;
    chatsLoading!: boolean;
    blockedUsers!: Set<string>;
    diamondMembership!: DiamondMembershipDetails | undefined;
    isDiamond!: boolean;
    confirmedThreadEventIndexesLoaded!: DRange;

    constructor() {
        confirmedThreadEventIndexesLoadedStore.subscribe(
            (data) => (this.confirmedThreadEventIndexesLoaded = data)
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
        pinnedChatsStore.subscribe((data) => (this.pinnedChats = data));
        chatSummariesListStore.subscribe((data) => (this.chatSummariesList = data));
        threadsByChatStore.subscribe((data) => (this.threadsByChat = data));
        focusMessageIndex.subscribe((data) => (this.focusMessageIndex = data));
        focusThreadMessageIndex.subscribe((data) => (this.focusThreadMessageIndex = data));
        threadEvents.subscribe((data) => (this.threadEvents = data));
        selectedThreadKey.subscribe((data) => (this.selectedThreadKey = data));
        selectedThreadRootEvent.subscribe((data) => (this.selectedThreadRootEvent = data));
        threadsFollowedByMeStore.subscribe((data) => (this.threadsFollowedByMe = data));
        currentChatUserIds.subscribe((data) => (this.currentChatUserIds = data));
        selectedThreadRootMessageIndex.subscribe(
            (data) => (this.selectedThreadRootMessageIndex = data)
        );
        chatsInitialised.subscribe((data) => (this.chatsInitialised = data));
        chatsLoading.subscribe((data) => (this.chatsLoading = data));
        blockedUsers.subscribe((data) => (this.blockedUsers = data));
        diamondMembership.subscribe((data) => (this.diamondMembership = data));
        isDiamond.subscribe((data) => (this.isDiamond = data));
    }
}
