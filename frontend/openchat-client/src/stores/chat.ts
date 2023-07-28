/* eslint-disable no-case-declarations */
import {
    ChatEvent,
    ChatSpecificState,
    ChatSummary,
    DirectChatSummary,
    EnhancedReplyContext,
    EventWrapper,
    Message,
    MessageContent,
    ThreadSyncDetails,
    CreatedUser,
    compareChats,
    emptyChatMetrics,
    ChatIdentifier,
    ChatMap,
    DirectChatIdentifier,
    nullMembership,
    chatIdentifiersEqual,
    MultiUserChat,
    ChatListScope,
} from "openchat-shared";
import { unconfirmed } from "./unconfirmed";
import { derived, get, Readable, writable, Writable } from "svelte/store";
import { immutableStore } from "./immutable";
import {
    getNextEventAndMessageIndexes,
    mergeEventsAndLocalUpdates,
    mergeUnconfirmedIntoSummary,
    mergeChatMetrics,
    getFirstUnreadMessageIndex,
    mergeLocalSummaryUpdates,
} from "../utils/chat";
import { userStore } from "./user";
import DRange from "drange";
import { snsFunctions } from "./snsFunctions";
import { filteredProposalsStore, resetFilteredProposalsStore } from "./filteredProposals";
import { createChatSpecificObjectStore } from "./dataByChatFactory";
import { localMessageUpdates } from "./localMessageUpdates";
import type { DraftMessage } from "./draftMessageFactory";
import { localChatSummaryUpdates } from "./localChatSummaryUpdates";
import { setsAreEqual } from "../utils/set";
import { failedMessagesStore } from "./failedMessages";
import { proposalTallies } from "./proposalTallies";
import type { OpenChat } from "../openchat";
import {
    allChats,
    chatListScopeStore,
    getAllChats,
    globalStateStore,
    pinnedChatsStore,
} from "./global";
import { createDerivedPropStore } from "./derived";
import { messagesRead } from "./markRead";
import { safeWritable } from "./safeWritable";
import { communityPreviewsStore } from "./community";

export const currentUserStore = immutableStore<CreatedUser | undefined>(undefined);
let currentScope: ChatListScope = { kind: "direct_chat" };
chatListScopeStore.subscribe((s) => (currentScope = s));

const communitiesEnabled = localStorage.getItem("openchat_communities_enabled") === "true";

export const myServerChatSummariesStore = derived(
    [globalStateStore, chatListScopeStore],
    ([$allState, $scope]) => {
        const allChats = getAllChats($allState);
        if (communitiesEnabled) {
            if ($scope.kind === "community") {
                const community = $allState.communities.get($scope.id);
                return community
                    ? ChatMap.fromList(community.channels)
                    : new ChatMap<ChatSummary>();
            } else if ($scope.kind === "group_chat") {
                return $allState.groupChats;
            } else if ($scope.kind === "direct_chat") {
                return $allState.directChats;
            } else if ($scope.kind === "favourite") {
                return $allState.favourites.values().reduce((favs, chatId) => {
                    const chat = allChats.get(chatId);
                    if (chat !== undefined) {
                        favs.set(chat.id, chat);
                    }
                    return favs;
                }, new ChatMap<ChatSummary>());
            } else {
                return new ChatMap<ChatSummary>();
            }
        } else {
            return allChats;
        }
    }
);

export const uninitializedDirectChats: Writable<ChatMap<DirectChatSummary>> = immutableStore(
    new ChatMap<DirectChatSummary>()
);

// Groups which the current user is previewing
export const groupPreviewsStore: Writable<ChatMap<MultiUserChat>> = immutableStore(
    new ChatMap<MultiUserChat>()
);

export const serverChatSummariesStore: Readable<ChatMap<ChatSummary>> = derived(
    [
        myServerChatSummariesStore,
        uninitializedDirectChats,
        groupPreviewsStore,
        communityPreviewsStore,
    ],
    ([summaries, directChats, previews, communityPreviews]) => {
        let all = [...summaries.entries()];
        if (currentScope.kind === "none" || currentScope.kind === "direct_chat") {
            all = all.concat([...directChats.entries()]);
        }
        if (currentScope.kind === "none") {
            all = all.concat([...previews.entries()]);
        }
        if (currentScope.kind === "group_chat") {
            all = all.concat([...previews.filter((c) => c.kind === "group_chat").entries()]);
        }
        if (currentScope.kind === "community") {
            const previewChannels = ChatMap.fromList(
                communityPreviews.get(currentScope.id)?.channels ?? []
            );
            all = all.concat([
                ...previewChannels.entries(),
                ...previews.filter((c) => c.kind === "channel").entries(),
            ]);
        }
        return all.reduce<ChatMap<ChatSummary>>((result, [chatId, summary]) => {
            result.set(chatId, summary);
            return result;
        }, new ChatMap<ChatSummary>());
    }
);

export const chatSummariesStore: Readable<ChatMap<ChatSummary>> = derived(
    [
        serverChatSummariesStore,
        localChatSummaryUpdates,
        unconfirmed,
        currentUserStore,
        localMessageUpdates,
    ],
    ([summaries, localSummaryUpdates, unconfirmed, currentUser, localUpdates]) => {
        const mergedSummaries = mergeLocalSummaryUpdates(
            currentScope,
            summaries,
            localSummaryUpdates
        );

        return mergedSummaries
            .entries()
            .reduce<ChatMap<ChatSummary>>((result, [chatId, summary]) => {
                if (currentUser !== undefined) {
                    result.set(
                        chatId,
                        mergeUnconfirmedIntoSummary(
                            (k) => k,
                            currentUser.userId,
                            summary,
                            unconfirmed,
                            localUpdates
                        )
                    );
                }
                return result;
            }, new ChatMap<ChatSummary>());
    }
);

// This is annoying. If only the pinnedChatIndex was stored in the chatSummary...
export const chatSummariesListStore = derived([chatSummariesStore], ([summaries]) => {
    const pinnedChats = get(pinnedChatsStore);
    const pinnedByScope = pinnedChats[currentScope.kind];
    const pinned = pinnedByScope.reduce<ChatSummary[]>((result, id) => {
        const summary = summaries.get(id);
        if (summary !== undefined) {
            result.push(summary);
        }
        return result;
    }, []);
    const unpinned = summaries
        .values()
        .filter((chat) => pinnedByScope.findIndex((p) => chatIdentifiersEqual(p, chat.id)) === -1)
        .sort(compareChats);
    return pinned.concat(unpinned);
});

export const userMetrics = derived([allChats], ([$chats]) => {
    return $chats
        .values()
        .map((c) => c.membership?.myMetrics ?? emptyChatMetrics())
        .reduce(mergeChatMetrics, emptyChatMetrics());
});

export const selectedChatId = safeWritable<ChatIdentifier | undefined>(
    undefined,
    chatIdentifiersEqual
);
export const selectedThreadRootEvent = writable<EventWrapper<Message> | undefined>(undefined);
export const selectedThreadRootMessageIndex = derived(selectedThreadRootEvent, ($rootEvent) => {
    return $rootEvent !== undefined ? $rootEvent.event.messageIndex : undefined;
});
export const selectedMessageContext = derived(
    [selectedChatId, selectedThreadRootMessageIndex],
    ([$selectedChatId, $selectedThreadRootMessageIndex]) => {
        if ($selectedChatId !== undefined) {
            return {
                chatId: $selectedChatId,
                threadRootMessageIndex: $selectedThreadRootMessageIndex,
            };
        }
        return undefined;
    }
);
export const chatsLoading = writable(true);
export const chatsInitialised = writable(false);

export const selectedServerChatStore = derived(
    [serverChatSummariesStore, selectedChatId],
    ([$serverChats, $selectedChatId]) => {
        if ($selectedChatId === undefined) return undefined;
        return $serverChats.get($selectedChatId);
    }
);

export const selectedChatStore = derived(
    [chatSummariesStore, selectedChatId],
    ([$chatSummaries, $selectedChatId]) => {
        if ($selectedChatId === undefined) return undefined;
        return $chatSummaries.get($selectedChatId);
    }
);

export function nextEventAndMessageIndexesForThread(
    events: EventWrapper<ChatEvent>[]
): [number, number] {
    return events.reduce(
        ([maxEvtIdx, maxMsgIdx], evt) => {
            const msgIdx =
                evt.event.kind === "message"
                    ? Math.max(evt.event.messageIndex + 1, maxMsgIdx)
                    : maxMsgIdx;
            const evtIdx = Math.max(evt.index + 1, maxEvtIdx);
            return [evtIdx, msgIdx];
        },
        [0, 0]
    );
}

function sortByIndex(a: EventWrapper<ChatEvent>, b: EventWrapper<ChatEvent>): number {
    return a.index - b.index;
}

export function nextEventAndMessageIndexes(): [number, number] {
    const chat = get(selectedServerChatStore);
    if (chat === undefined) {
        return [0, 0];
    }
    return getNextEventAndMessageIndexes(
        chat,
        unconfirmed.getMessages({ chatId: chat.id }).sort(sortByIndex)
    );
}

export const isProposalGroup = derived([selectedChatStore], ([$selectedChat]) => {
    return (
        $selectedChat !== undefined &&
        $selectedChat.kind === "group_chat" &&
        $selectedChat.subtype?.kind === "governance_proposals"
    );
});

export const threadsByChatStore = derived([chatSummariesListStore], ([summaries]) => {
    return summaries.reduce((result, chat) => {
        if (
            (chat.kind === "group_chat" || chat.kind === "channel") &&
            chat.membership &&
            chat.membership.latestThreads.length > 0
        ) {
            result.set(chat.id, chat.membership.latestThreads);
        }
        return result;
    }, new ChatMap<ThreadSyncDetails[]>());
});

export const staleThreadsCount = derived(
    [threadsByChatStore, messagesRead],
    ([$threadsByChat, _messagesRead]) => {
        return messagesRead.staleThreadsCount($threadsByChat);
    }
);

export const threadsFollowedByMeStore = derived([threadsByChatStore], ([threadsByChat]) => {
    return threadsByChat.entries().reduce<ChatMap<Set<number>>>((result, [chatId, threads]) => {
        const set = new Set<number>();
        for (const thread of threads) {
            set.add(thread.threadRootMessageIndex);
        }
        result.set(chatId, set);
        return result;
    }, new ChatMap<Set<number>>());
});

export const proposalTopicsStore = derived(
    [selectedChatStore, snsFunctions],
    ([$selectedChat, $snsFunctions]): Map<number, string> => {
        if (
            $selectedChat !== undefined &&
            $selectedChat.kind === "group_chat" &&
            $selectedChat.subtype !== undefined
        ) {
            if ($selectedChat.subtype.isNns) {
                return new Map([
                    [1, "Neuron Management"],
                    [3, "Network Economics"],
                    [4, "Governance"],
                    [5, "Node Admin"],
                    [6, "Participant Management"],
                    [7, "Subnet Management"],
                    [8, "Network Canister Management"],
                    [9, "KYC"],
                    [10, "Node Provider Rewards"],
                    [12, "Subnet Replica Version Management"],
                    [13, "Replica Version Management"],
                    [14, "SNS & CommunityFund"],
                ]);
            } else {
                const snsFunctionsMap = $snsFunctions.get(
                    $selectedChat.subtype.governanceCanisterId
                );
                if (snsFunctionsMap !== undefined) {
                    return new Map([...snsFunctionsMap].slice(1).map((e) => [e[0], e[1].name]));
                }
            }
        }

        return new Map();
    }
);

function countThreads<T>(things: ChatMap<T[]>): number {
    return things
        .values()
        .map((ts) => ts.length)
        .reduce((total, n) => total + n, 0);
}

// returns the total number of threads that we are involved in
export const numberOfThreadsStore = derived([threadsByChatStore], ([threads]) =>
    countThreads(threads)
);

export const chatStateStore = createChatSpecificObjectStore<ChatSpecificState>(() => ({
    detailsLoaded: false,
    members: [],
    blockedUsers: new Set<string>(),
    invitedUsers: new Set<string>(),
    pinnedMessages: new Set<number>(),
    userIds: new Set<string>(),
    userGroupKeys: new Set<string>(),
    confirmedEventIndexesLoaded: new DRange(),
    serverEvents: [],
    expandedDeletedMessages: new Set(),
    lastUpdated: BigInt(0),
}));

export const threadServerEventsStore: Writable<EventWrapper<ChatEvent>[]> = immutableStore([]);
export const threadEvents = derived(
    [
        threadServerEventsStore,
        unconfirmed,
        localMessageUpdates,
        selectedMessageContext,
        failedMessagesStore,
        proposalTallies,
    ],
    ([
        $serverEvents,
        $unconfirmed,
        $localUpdates,
        $messageContext,
        $failedMessages,
        $proposalTallies,
    ]) => {
        if ($messageContext === undefined || $messageContext.threadRootMessageIndex === undefined)
            return [];
        const failed = $failedMessages.has($messageContext)
            ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              Object.values($failedMessages.get($messageContext)!)
            : [];
        const unconfirmed = $unconfirmed.get($messageContext)?.messages ?? [];
        return mergeEventsAndLocalUpdates(
            $serverEvents,
            [...unconfirmed, ...failed],
            $localUpdates,
            $proposalTallies
        );
    }
);

const serverEventsStore = createDerivedPropStore<ChatSpecificState, "serverEvents">(
    chatStateStore,
    "serverEvents",
    () => []
);

export const currentChatUserIds = createDerivedPropStore<ChatSpecificState, "userIds">(
    chatStateStore,
    "userIds",
    () => new Set<string>()
);

export const focusMessageIndex = createDerivedPropStore<ChatSpecificState, "focusMessageIndex">(
    chatStateStore,
    "focusMessageIndex",
    () => undefined
);

export const focusThreadMessageIndex = createDerivedPropStore<
    ChatSpecificState,
    "focusThreadMessageIndex"
>(chatStateStore, "focusThreadMessageIndex", () => undefined);

export const expandedDeletedMessages = createDerivedPropStore<
    ChatSpecificState,
    "expandedDeletedMessages"
>(chatStateStore, "expandedDeletedMessages", () => new Set());

export const userGroupKeys = createDerivedPropStore<ChatSpecificState, "userGroupKeys">(
    chatStateStore,
    "userGroupKeys",
    () => new Set<string>()
);

export const confirmedThreadEventIndexesLoadedStore = derived(
    [threadServerEventsStore],
    ([serverEvents]) => {
        const ranges = new DRange();
        serverEvents.forEach((e) => ranges.add(e.index));
        return ranges;
    }
);

const confirmedEventIndexesLoadedStore = derived([serverEventsStore], ([serverEvents]) => {
    const ranges = new DRange();
    serverEvents.forEach((e) => ranges.add(e.index));
    return ranges;
});

export function confirmedEventIndexesLoaded(chatId: ChatIdentifier): DRange {
    const selected = get(selectedChatId);
    return selected !== undefined && chatIdentifiersEqual(selected, chatId)
        ? get(confirmedEventIndexesLoadedStore)
        : new DRange();
}

export const currentChatRules = createDerivedPropStore<ChatSpecificState, "rules">(
    chatStateStore,
    "rules",
    () => undefined
);
export const currentChatMembers = createDerivedPropStore<ChatSpecificState, "members">(
    chatStateStore,
    "members",
    () => []
);

export const currentChatBlockedUsers = createDerivedPropStore<ChatSpecificState, "blockedUsers">(
    chatStateStore,
    "blockedUsers",
    () => new Set<string>(),
    setsAreEqual
);
export const currentChatInvitedUsers = createDerivedPropStore<ChatSpecificState, "invitedUsers">(
    chatStateStore,
    "invitedUsers",
    () => new Set<string>(),
    setsAreEqual
);
export const currentChatPinnedMessages = createDerivedPropStore<
    ChatSpecificState,
    "pinnedMessages"
>(chatStateStore, "pinnedMessages", () => new Set<number>(), setsAreEqual);

export function setSelectedChat(
    api: OpenChat,
    clientChat: ChatSummary,
    serverChat: ChatSummary | undefined,
    messageIndex?: number,
    threadMessageIndex?: number
): void {
    // TODO don't think this should be in here really
    if (
        (clientChat.kind === "group_chat" || clientChat.kind === "channel") &&
        clientChat.subtype !== undefined &&
        clientChat.subtype.kind === "governance_proposals" &&
        !clientChat.subtype.isNns
    ) {
        const { governanceCanisterId } = clientChat.subtype;
        api.sendRequest({
            kind: "listNervousSystemFunctions",
            snsGovernanceCanisterId: governanceCanisterId,
        }).then((val) => {
            snsFunctions.set(governanceCanisterId, val.functions);
            return val;
        });
    }

    if (messageIndex === undefined) {
        messageIndex = getFirstUnreadMessageIndex(clientChat);

        if (messageIndex !== undefined) {
            const latestServerMessageIndex = serverChat?.latestMessage?.event.messageIndex ?? 0;

            if (messageIndex > latestServerMessageIndex) {
                messageIndex = undefined;
            }
        }
    }

    clearSelectedChat(clientChat.id);

    // initialise a bunch of stores
    chatStateStore.clear(clientChat.id);
    chatStateStore.setProp(clientChat.id, "focusMessageIndex", messageIndex);
    chatStateStore.setProp(clientChat.id, "focusThreadMessageIndex", threadMessageIndex);
    chatStateStore.setProp(clientChat.id, "expandedDeletedMessages", new Set());
    chatStateStore.setProp(
        clientChat.id,
        "userIds",
        new Set<string>(clientChat.kind === "direct_chat" ? [clientChat.id.userId] : [])
    );
    resetFilteredProposalsStore(clientChat);
}

export function clearSelectedChat(newSelectedChatId?: ChatIdentifier): void {
    filteredProposalsStore.set(undefined);
    selectedChatId.update((chatId) => {
        if (chatId !== undefined) {
            chatStateStore.clear(chatId);
        }
        return newSelectedChatId;
    });
}

export function createDirectChat(chatId: DirectChatIdentifier): void {
    uninitializedDirectChats.update((chatSummaries) => {
        chatSummaries.set(chatId, {
            kind: "direct_chat",
            id: chatId,
            them: chatId,
            readByThemUpTo: undefined,
            latestMessage: undefined,
            latestEventIndex: 0,
            dateCreated: BigInt(Date.now()),
            metrics: emptyChatMetrics(),
            membership: {
                ...nullMembership(),
                role: "owner",
            },
        });
        return chatSummaries;
    });
}

export function addGroupPreview(chat: MultiUserChat): void {
    localChatSummaryUpdates.delete(chat.id);
    groupPreviewsStore.update((summaries) => {
        summaries.set(chat.id, chat);
        return summaries;
    });
}

export function removeUninitializedDirectChat(chatId: ChatIdentifier): void {
    uninitializedDirectChats.update((summaries) => {
        summaries.delete(chatId);
        return summaries;
    });
}

export function removeGroupPreview(chatId: ChatIdentifier): void {
    groupPreviewsStore.update((summaries) => {
        summaries.delete(chatId);
        return summaries;
    });
}

export const eventsStore: Readable<EventWrapper<ChatEvent>[]> = derived(
    [serverEventsStore, unconfirmed, localMessageUpdates, failedMessagesStore, proposalTallies],
    ([
        $serverEventsForSelectedChat,
        $unconfirmed,
        $localMessageUpdates,
        $failedMessages,
        $proposalTallies,
    ]) => {
        const chatId = get(selectedChatId) ?? { kind: "group_chat", groupId: "" };
        const failedForChat = $failedMessages.get({ chatId });
        // for the purpose of merging, unconfirmed and failed can be treated the same
        const failed = failedForChat ? Object.values(failedForChat) : [];
        const unconfirmed = $unconfirmed.get({ chatId })?.messages ?? [];
        return mergeEventsAndLocalUpdates(
            $serverEventsForSelectedChat,
            [...unconfirmed, ...failed],
            $localMessageUpdates,
            $proposalTallies
        );
    }
);

function isContiguousInternal(range: DRange, events: EventWrapper<ChatEvent>[]): boolean {
    if (range.length === 0 || events.length === 0) return true;

    const indexes = [events[0].index, events[events.length - 1].index];
    const minIndex = Math.min(...indexes);
    const maxIndex = Math.max(...indexes);
    const contiguousCheck = new DRange(minIndex - 1, maxIndex + 1);

    const isContiguous = range.clone().intersect(contiguousCheck).length > 0;

    if (!isContiguous) {
        console.log(
            "Events in response are not contiguous with the loaded events",
            range,
            minIndex,
            maxIndex
        );
    }

    return isContiguous;
}

export function isContiguousInThread(events: EventWrapper<ChatEvent>[]): boolean {
    return isContiguousInternal(get(confirmedThreadEventIndexesLoadedStore), events);
}

export function isContiguous(chatId: ChatIdentifier, events: EventWrapper<ChatEvent>[]): boolean {
    return isContiguousInternal(confirmedEventIndexesLoaded(chatId), events);
}

export function clearServerEvents(id: ChatIdentifier): void {
    chatStateStore.setProp(id, "serverEvents", []);
}

/**
 * You might think that this belongs in the chatStateStore, but this needs to persist across chat selection boundary
 * so it has a different scope.
 */
const draftMessages = createChatSpecificObjectStore<DraftMessage>(() => ({}));

export const currentChatDraftMessage = {
    ...draftMessages,
    setTextContent: (id: ChatIdentifier, textContent: string | undefined): void =>
        draftMessages.setProp(id, "textContent", textContent),
    setAttachment: (id: ChatIdentifier, attachment: MessageContent | undefined): void =>
        draftMessages.setProp(id, "attachment", attachment),
    setReplyingTo: (id: ChatIdentifier, replyingTo: EnhancedReplyContext | undefined): void =>
        draftMessages.setProp(id, "replyingTo", replyingTo),
    setEditing: (id: ChatIdentifier, editingEvent: EventWrapper<Message>): void => {
        const users = get(userStore);
        const updated = {
            editingEvent,
            attachment:
                editingEvent?.event.content.kind !== "text_content"
                    ? editingEvent?.event.content
                    : undefined,
            replyingTo:
                editingEvent.event.repliesTo &&
                editingEvent.event.repliesTo.kind === "rehydrated_reply_context"
                    ? {
                          ...editingEvent.event.repliesTo,
                          content: editingEvent.event.content,
                          sender: users[editingEvent.event.sender],
                      }
                    : undefined,
        };
        draftMessages.update(id, (d) => ({ ...d, ...updated }));
    },
};
export const currentChatTextContent = createDerivedPropStore(
    currentChatDraftMessage,
    "textContent",
    () => undefined
);
export const currentChatReplyingTo = createDerivedPropStore(
    currentChatDraftMessage,
    "replyingTo",
    () => undefined
);
export const currentChatFileToAttach = createDerivedPropStore(
    currentChatDraftMessage,
    "attachment",
    () => undefined
);
export const currentChatEditingEvent = createDerivedPropStore(
    currentChatDraftMessage,
    "editingEvent",
    () => undefined
);
