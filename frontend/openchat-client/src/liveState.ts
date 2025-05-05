import type {
    AuthProvider,
    ChatEvent,
    ChatMap,
    ChatSummary,
    DiamondMembershipStatus,
    EnhancedReplyContext,
    EventWrapper,
    MessageContext,
    PinNumberResolver,
    ThreadSyncDetails,
    UserLookup,
} from "openchat-shared";
import { locale } from "svelte-i18n";
import { selectedAuthProviderStore } from "./stores/authProviders";
import { blockedUsers } from "./stores/blockedUsers";
import {
    chatSummariesListStore,
    chatSummariesStore,
    currentChatReplyingTo,
    eventsStore,
    selectedChatStore,
    selectedMessageContext,
    selectedThreadRootMessageIndex,
    threadEvents,
    threadsByChatStore,
    threadsFollowedByMeStore,
} from "./stores/chat";
import { type DraftMessages, draftMessagesStore } from "./stores/draftMessages";
import { offlineStore } from "./stores/network";
import { capturePinNumberStore, pinNumberRequiredStore } from "./stores/pinNumber";
import { remainingStorage } from "./stores/storage";
import { userStore } from "./stores/user";
import { userCreatedStore } from "./stores/userCreated";

/**
 * Any stores that we reference inside the OpenChat client can be added here so that we always have the up to date current value
 * at hand without having to use svelte.get which will create and destroy a subscription every time
 */
export class LiveState {
    selectedChat: ChatSummary | undefined;
    events!: EventWrapper<ChatEvent>[];
    selectedAuthProvider!: AuthProvider | undefined;
    userCreated!: boolean;
    userStore!: UserLookup;
    remainingStorage!: number;
    currentChatReplyingTo: EnhancedReplyContext | undefined;
    chatSummaries!: ChatMap<ChatSummary>;
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
    draftMessages!: DraftMessages;
    suspendedUser!: boolean;
    platformModerator!: boolean;
    offlineStore!: boolean;
    locale!: string;
    pinNumberRequired!: boolean;
    capturePinNumber!: PinNumberResolver | undefined;

    constructor() {
        offlineStore.subscribe((offline) => (this.offlineStore = offline));
        remainingStorage.subscribe((data) => (this.remainingStorage = data));
        userStore.subscribe((data) => (this.userStore = data));
        userCreatedStore.subscribe((data) => (this.userCreated = data));
        selectedAuthProviderStore.subscribe((data) => (this.selectedAuthProvider = data));
        chatSummariesStore.subscribe((data) => (this.chatSummaries = data));
        eventsStore.subscribe((data) => (this.events = data));
        selectedChatStore.subscribe((data) => (this.selectedChat = data));
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
        draftMessagesStore.subscribe((data) => (this.draftMessages = data));
        locale.subscribe((data) => (this.locale = data ?? "en"));
        pinNumberRequiredStore.subscribe((data) => (this.pinNumberRequired = data));
        capturePinNumberStore.subscribe((data) => (this.capturePinNumber = data));
    }
}
