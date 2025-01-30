/* eslint-disable no-case-declarations */
import type {
    ChatEvent,
    ChatSpecificState,
    ChatSummary,
    DirectChatSummary,
    EventWrapper,
    ThreadSyncDetails,
    ChatIdentifier,
    DirectChatIdentifier,
    MultiUserChat,
    ChatListScope,
    ExpiredEventsRange,
    MessageContext,
    ExternalBotPermissions,
} from "openchat-shared";
import {
    compareChats,
    emptyChatMetrics,
    emptyRules,
    ChatMap,
    nullMembership,
    chatIdentifiersEqual,
    messageContextsEqual,
} from "openchat-shared";
import { unconfirmed } from "./unconfirmed";
import { derived, get, type Readable, writable, type Writable } from "svelte/store";
import { immutableStore } from "./immutable";
import {
    getNextEventAndMessageIndexes,
    isPreviewing,
    mergeEventsAndLocalUpdates,
    mergeUnconfirmedIntoSummary,
    mergeChatMetrics,
    mergeLocalSummaryUpdates,
} from "../utils/chat";
import { currentUser, currentUserIdStore, suspendedUsers } from "./user";
import DRange from "drange";
import { snsFunctions } from "./snsFunctions";
import { filteredProposalsStore, resetFilteredProposalsStore } from "./filteredProposals";
import { createChatSpecificObjectStore } from "./dataByChatFactory";
import { localMessageUpdates } from "./localMessageUpdates";
import { localChatSummaryUpdates } from "./localChatSummaryUpdates";
import { setsAreEqual } from "../utils/set";
import { failedMessagesStore } from "./failedMessages";
import { proposalTallies } from "./proposalTallies";
import type { OpenChat } from "../openchat";
import { allServerChats, chatListScopeStore, getAllServerChats, globalStateStore } from "./global";
import { createDerivedPropStore } from "./derived";
import { messagesRead } from "./markRead";
import { safeWritable } from "./safeWritable";
import { communityPreviewsStore, currentCommunityBlockedUsers } from "./community";
import { translationStore } from "./translation";
import { messageFiltersStore } from "./messageFilters";
import { draftMessagesStore } from "./draftMessages";
import { blockedUsers } from "./blockedUsers";
import { createLsBoolStore } from "./localStorageSetting";
import { configKeys } from "../utils/config";
import { recentlySentMessagesStore } from "./recentlySentMessages";

let currentScope: ChatListScope = { kind: "direct_chat" };
chatListScopeStore.subscribe((s) => (currentScope = s));

export const selectedMessageContext = safeWritable<MessageContext | undefined>(
    undefined,
    messageContextsEqual,
);

export const selectedThreadRootMessageIndex = derived(selectedMessageContext, ($messageContext) => {
    return $messageContext?.threadRootMessageIndex;
});

export const selectedChatId = derived(selectedMessageContext, ($messageContext) => {
    return $messageContext?.chatId;
});

export const chatStateStore = createChatSpecificObjectStore<ChatSpecificState>(
    selectedChatId,
    () => ({
        lapsedMembers: new Set<string>(),
        members: [],
        membersMap: new Map(),
        blockedUsers: new Set<string>(),
        invitedUsers: new Set<string>(),
        pinnedMessages: new Set<number>(),
        rules: emptyRules(),
        userIds: new Set<string>(),
        userGroupKeys: new Set<string>(),
        confirmedEventIndexesLoaded: new DRange(),
        serverEvents: [],
        expandedDeletedMessages: new Set(),
        expiredEventRanges: new DRange(),
        bots: new Map(),
        apiKeys: [],
    }),
);

const serverEventsStore = createDerivedPropStore<ChatSpecificState, "serverEvents">(
    chatStateStore,
    "serverEvents",
    () => [],
);

export const currentChatBots = createDerivedPropStore<ChatSpecificState, "bots">(
    chatStateStore,
    "bots",
    () => new Map<string, ExternalBotPermissions>(),
);

export const currentChatApiKeys = createDerivedPropStore<ChatSpecificState, "apiKeys">(
    chatStateStore,
    "apiKeys",
    () => [],
);

export const currentChatUserIds = createDerivedPropStore<ChatSpecificState, "userIds">(
    chatStateStore,
    "userIds",
    () => new Set<string>(),
);

export const focusMessageIndex = createDerivedPropStore<ChatSpecificState, "focusMessageIndex">(
    chatStateStore,
    "focusMessageIndex",
    () => undefined,
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
    () => new Set<string>(),
);

export const currentChatRules = createDerivedPropStore<ChatSpecificState, "rules">(
    chatStateStore,
    "rules",
    () => undefined,
);

export const currentChatMembers = createDerivedPropStore<ChatSpecificState, "members">(
    chatStateStore,
    "members",
    () => [],
);

export const currentChatMembersMap = createDerivedPropStore<ChatSpecificState, "membersMap">(
    chatStateStore,
    "membersMap",
    () => new Map(),
);

export const currentChatLapsedMembers = createDerivedPropStore<ChatSpecificState, "lapsedMembers">(
    chatStateStore,
    "lapsedMembers",
    () => new Set<string>(),
    setsAreEqual,
);

export const currentChatBlockedUsers = createDerivedPropStore<ChatSpecificState, "blockedUsers">(
    chatStateStore,
    "blockedUsers",
    () => new Set<string>(),
    setsAreEqual,
);
export const currentChatInvitedUsers = createDerivedPropStore<ChatSpecificState, "invitedUsers">(
    chatStateStore,
    "invitedUsers",
    () => new Set<string>(),
    setsAreEqual,
);
export const currentChatPinnedMessages = createDerivedPropStore<
    ChatSpecificState,
    "pinnedMessages"
>(chatStateStore, "pinnedMessages", () => new Set<number>(), setsAreEqual);

export const expiredEventRangesStore = createDerivedPropStore<
    ChatSpecificState,
    "expiredEventRanges"
>(chatStateStore, "expiredEventRanges", () => new DRange());

export const hideMessagesFromDirectBlocked = createLsBoolStore(configKeys.hideBlocked, false);

const currentChatBlockedOrSuspendedUsers = derived(
    [
        currentChatBlockedUsers,
        currentCommunityBlockedUsers,
        suspendedUsers,
        blockedUsers,
        hideMessagesFromDirectBlocked,
    ],
    ([chatBlocked, communityBlocked, suspended, directBlocked, hideBlocked]) => {
        const direct = hideBlocked ? directBlocked : [];
        return new Set<string>([...chatBlocked, ...communityBlocked, ...suspended, ...direct]);
    },
);

export const favouritesStore = derived(
    [globalStateStore, localChatSummaryUpdates],
    ([$global, $localUpdates]) => {
        const mergedFavs = $global.favourites.clone();
        $localUpdates.entries().forEach(([key, val]) => {
            if (val.favourited && !val.unfavourited) {
                mergedFavs.add(key);
            }
            if (!val.favourited && val.unfavourited) {
                mergedFavs.delete(key);
            }
        });
        return mergedFavs;
    },
);

export const pinnedChatsStore = derived(
    [globalStateStore, localChatSummaryUpdates],
    ([$global, $localUpdates]) => {
        const mergedPinned = new Map($global.pinnedChats);

        $localUpdates.forEach((val, key) => {
            if (val.pinned !== undefined) {
                val.pinned.forEach((scope) => {
                    const ids = mergedPinned.get(scope) ?? [];
                    if (!ids.find((id) => chatIdentifiersEqual(id, key))) {
                        ids.unshift(key);
                    }
                    mergedPinned.set(scope, ids);
                });
            }
            if (val.unpinned !== undefined) {
                val.unpinned.forEach((scope) => {
                    const ids = mergedPinned.get(scope) ?? [];
                    mergedPinned.set(
                        scope,
                        ids.filter((id) => !chatIdentifiersEqual(id, key)),
                    );
                });
            }
        });

        return mergedPinned;
    },
);

export const myServerChatSummariesStore = derived(
    [globalStateStore, chatListScopeStore, favouritesStore],
    ([$allState, $scope, $favourites]) => {
        const allChats = getAllServerChats($allState);
        if ($scope.kind === "community") {
            const community = $allState.communities.get($scope.id);
            return community ? ChatMap.fromList(community.channels) : new ChatMap<ChatSummary>();
        } else if ($scope.kind === "group_chat") {
            return $allState.groupChats;
        } else if ($scope.kind === "direct_chat") {
            return $allState.directChats;
        } else if ($scope.kind === "favourite") {
            return $favourites.values().reduce((favs, chatId) => {
                const chat = allChats.get(chatId);
                if (chat !== undefined) {
                    favs.set(chat.id, chat);
                }
                return favs;
            }, new ChatMap<ChatSummary>());
        } else {
            return new ChatMap<ChatSummary>();
        }
    },
);

export const uninitializedDirectChats: Writable<ChatMap<DirectChatSummary>> = immutableStore(
    new ChatMap<DirectChatSummary>(),
);

// Groups which the current user is previewing
export const groupPreviewsStore: Writable<ChatMap<MultiUserChat>> = immutableStore(
    new ChatMap<MultiUserChat>(),
);

type ChatEntry = [ChatIdentifier, ChatSummary];

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
            all = (previews.entries() as ChatEntry[]).concat(all);
        }
        if (currentScope.kind === "group_chat") {
            all = (previews.filter((c) => c.kind === "group_chat").entries() as ChatEntry[]).concat(
                all,
            );
        }
        if (currentScope.kind === "community") {
            const communityId = currentScope.id.communityId;
            const previewChannels = ChatMap.fromList(
                communityPreviews.get(currentScope.id)?.channels ?? [],
            );
            all = (previewChannels.entries() as ChatEntry[])
                .concat(
                    previews
                        .filter((c) => c.kind === "channel" && c.id.communityId === communityId)
                        .entries() as ChatEntry[],
                )
                .concat(all);
        }
        return all.reduce<ChatMap<ChatSummary>>((result, [chatId, summary]) => {
            result.set(chatId, summary);
            return result;
        }, new ChatMap<ChatSummary>());
    },
);

export const allChats = derived(
    [allServerChats, uninitializedDirectChats, groupPreviewsStore, localChatSummaryUpdates],
    ([$all, $direct, $group, $localSummaryUpdates]) => {
        const merged = ($direct.entries() as ChatEntry[])
            .concat($group.entries() as ChatEntry[])
            .concat($all.entries());
        const reduced = merged.reduce<ChatMap<ChatSummary>>((result, [chatId, summary]) => {
            result.set(chatId, summary);
            return result;
        }, new ChatMap<ChatSummary>());
        return mergeLocalSummaryUpdates(currentScope, reduced, $localSummaryUpdates);
    },
);

export const chatSummariesStore: Readable<ChatMap<ChatSummary>> = derived(
    [
        serverChatSummariesStore,
        localChatSummaryUpdates,
        unconfirmed,
        currentUser,
        localMessageUpdates,
        translationStore,
        currentChatBlockedOrSuspendedUsers,
        currentUserIdStore,
        messageFiltersStore,
    ],
    ([
        summaries,
        localSummaryUpdates,
        unconfirmed,
        currentUser,
        localUpdates,
        translations,
        blockedOrSuspendedUsers,
        $currentUserId,
        $messageFilters,
    ]) => {
        const mergedSummaries = mergeLocalSummaryUpdates(
            currentScope,
            summaries,
            localSummaryUpdates,
        );

        return mergedSummaries
            .entries()
            .reduce<ChatMap<ChatSummary>>((result, [chatId, summary]) => {
                result.set(
                    chatId,
                    mergeUnconfirmedIntoSummary(
                        (k) => k,
                        currentUser.userId,
                        summary,
                        unconfirmed,
                        localUpdates,
                        translations,
                        blockedOrSuspendedUsers,
                        $currentUserId,
                        $messageFilters,
                    ),
                );
                return result;
            }, new ChatMap<ChatSummary>());
    },
);

// This is annoying. If only the pinnedChatIndex was stored in the chatSummary...
export const chatSummariesListStore = derived([chatSummariesStore], ([summaries]) => {
    const pinnedChats = get(pinnedChatsStore);
    const pinnedByScope = pinnedChats.get(currentScope.kind) ?? [];
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

export const userMetrics = derived([allServerChats], ([$chats]) => {
    return $chats
        .values()
        .map((c) => c.membership?.myMetrics ?? emptyChatMetrics())
        .reduce(mergeChatMetrics, emptyChatMetrics());
});

export const chatsLoading = writable(true);
export const chatsInitialised = writable(false);

export const selectedServerChatStore = derived(
    [serverChatSummariesStore, selectedChatId],
    ([$serverChats, $selectedChatId]) => {
        if ($selectedChatId === undefined) return undefined;
        return $serverChats.get($selectedChatId);
    },
);

export const selectedChatStore = derived(
    [chatSummariesStore, selectedChatId],
    ([$chatSummaries, $selectedChatId]) => {
        if ($selectedChatId === undefined) return undefined;
        return $chatSummaries.get($selectedChatId);
    },
);

export function nextEventAndMessageIndexesForThread(
    events: EventWrapper<ChatEvent>[],
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
        [0, 0],
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
        unconfirmed.getMessages({ chatId: chat.id }).sort(sortByIndex),
    );
}

export const isProposalGroup = derived([selectedChatStore], ([$selectedChat]) => {
    return (
        $selectedChat !== undefined &&
        $selectedChat.kind !== "direct_chat" &&
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
            $selectedChat.kind !== "direct_chat" &&
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
                    [14, "SNS & Neurons' Fund"],
                ]);
            } else {
                const snsFunctionsMap = $snsFunctions.get(
                    $selectedChat.subtype.governanceCanisterId,
                );
                if (snsFunctionsMap !== undefined) {
                    return new Map([...snsFunctionsMap].slice(1).map((e) => [e[0], e[1].name]));
                }
            }
        }

        return new Map();
    },
);

function countThreads<T>(things: ChatMap<T[]>): number {
    return things
        .values()
        .map((ts) => ts.length)
        .reduce((total, n) => total + n, 0);
}

// returns the total number of threads that we are involved in
export const numberOfThreadsStore = derived([threadsByChatStore], ([threads]) =>
    countThreads(threads),
);

export const threadServerEventsStore: Writable<EventWrapper<ChatEvent>[]> = immutableStore([]);
export const threadEvents = derived(
    [
        threadServerEventsStore,
        unconfirmed,
        localMessageUpdates,
        selectedMessageContext,
        failedMessagesStore,
        proposalTallies,
        translationStore,
        currentChatBlockedOrSuspendedUsers,
        currentUserIdStore,
        messageFiltersStore,
        recentlySentMessagesStore,
    ],
    ([
        $serverEvents,
        $unconfirmed,
        $localUpdates,
        $messageContext,
        $failedMessages,
        $proposalTallies,
        $translationStore,
        $blockedOrSuspendedUsers,
        $currentUserId,
        $messageFilters,
        $recentlySentMessagesStore,
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
            new DRange(),
            $proposalTallies,
            $translationStore,
            $blockedOrSuspendedUsers,
            $currentUserId,
            $messageFilters,
            $recentlySentMessagesStore,
        );
    },
);

export const confirmedThreadEventIndexesLoadedStore = derived(
    [threadServerEventsStore],
    ([serverEvents]) => {
        const ranges = new DRange();
        serverEvents.forEach((e) => ranges.add(e.index));
        return ranges;
    },
);

const confirmedEventIndexesLoadedStore = derived(
    [serverEventsStore, expiredEventRangesStore],
    ([serverEvents, expiredEventRanges]) => {
        const ranges = new DRange();
        serverEvents.forEach((e) => ranges.add(e.index));
        ranges.add(expiredEventRanges);
        return ranges;
    },
);

export function confirmedEventIndexesLoaded(chatId: ChatIdentifier): DRange {
    const selected = get(selectedChatId);
    return selected !== undefined && chatIdentifiersEqual(selected, chatId)
        ? get(confirmedEventIndexesLoadedStore)
        : new DRange();
}

export function setSelectedChat(
    api: OpenChat,
    clientChat: ChatSummary,
    serverChat: ChatSummary | undefined,
    messageIndex?: number,
    threadMessageIndex?: number,
): void {
    // TODO don't think this should be in here really
    if (
        (clientChat.kind === "group_chat" || clientChat.kind === "channel") &&
        clientChat.subtype !== undefined &&
        clientChat.subtype.kind === "governance_proposals" &&
        !clientChat.subtype.isNns
    ) {
        const { governanceCanisterId } = clientChat.subtype;
        api.listNervousSystemFunctions(governanceCanisterId).then((val) => {
            snsFunctions.set(governanceCanisterId, val.functions);
            return val;
        });
    }

    if (messageIndex === undefined) {
        messageIndex = isPreviewing(clientChat)
            ? undefined
            : messagesRead.getFirstUnreadMessageIndex(
                  clientChat.id,
                  clientChat.latestMessage?.event.messageIndex,
              );

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
        new Set<string>(clientChat.kind === "direct_chat" ? [clientChat.id.userId] : []),
    );
    resetFilteredProposalsStore(clientChat);
}

export function clearSelectedChat(newSelectedChatId?: ChatIdentifier): void {
    filteredProposalsStore.set(undefined);
    selectedMessageContext.update((context) => {
        if (context !== undefined) {
            chatStateStore.clear(context.chatId);
        }
        return newSelectedChatId ? { chatId: newSelectedChatId } : undefined;
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
            latestMessageIndex: undefined,
            lastUpdated: BigInt(Date.now()),
            dateCreated: BigInt(Date.now()),
            metrics: emptyChatMetrics(),
            eventsTTL: undefined,
            eventsTtlLastUpdated: BigInt(0),
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
    [
        serverEventsStore,
        unconfirmed,
        localMessageUpdates,
        expiredEventRangesStore,
        failedMessagesStore,
        proposalTallies,
        translationStore,
        currentChatBlockedOrSuspendedUsers,
        currentUserIdStore,
        messageFiltersStore,
        recentlySentMessagesStore,
    ],
    ([
        $serverEventsForSelectedChat,
        $unconfirmed,
        $localMessageUpdates,
        $expiredEventRanges,
        $failedMessages,
        $proposalTallies,
        $translationStore,
        $blockedOrSuspendedUsers,
        $currentUserId,
        $messageFilters,
        $recentlySentMessagesStore,
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
            $expiredEventRanges,
            $proposalTallies,
            $translationStore,
            $blockedOrSuspendedUsers,
            $currentUserId,
            $messageFilters,
            $recentlySentMessagesStore,
        );
    },
);

function isContiguousInternal(
    range: DRange,
    events: EventWrapper<ChatEvent>[],
    expiredEventRanges: ExpiredEventsRange[],
): boolean {
    if (range.length === 0 || events.length === 0) return true;

    const indexes = [events[0].index, events[events.length - 1].index];
    const minIndex = Math.min(...indexes, ...expiredEventRanges.map((e) => e.start));
    const maxIndex = Math.max(...indexes, ...expiredEventRanges.map((e) => e.end));
    const contiguousCheck = new DRange(minIndex - 1, maxIndex + 1);

    const isContiguous = range.clone().intersect(contiguousCheck).length > 0;

    if (!isContiguous) {
        console.log(
            "Events in response are not contiguous with the loaded events",
            range,
            minIndex,
            maxIndex,
        );
    }

    return isContiguous;
}

export function isContiguousInThread(events: EventWrapper<ChatEvent>[]): boolean {
    return isContiguousInternal(get(confirmedThreadEventIndexesLoadedStore), events, []);
}

export function isContiguous(
    chatId: ChatIdentifier,
    events: EventWrapper<ChatEvent>[],
    expiredEventRanges: ExpiredEventsRange[],
): boolean {
    return isContiguousInternal(confirmedEventIndexesLoaded(chatId), events, expiredEventRanges);
}

export function clearServerEvents(id: ChatIdentifier): void {
    chatStateStore.setProp(id, "serverEvents", []);
    chatStateStore.setProp(id, "expiredEventRanges", new DRange());
}

export const currentChatDraftMessage = derived(
    [draftMessagesStore, selectedChatId],
    ([draftMessages, chatId]) => {
        return chatId !== undefined ? draftMessages.get({ chatId }) ?? {} : {};
    },
);

export const currentChatTextContent = createDerivedPropStore(
    currentChatDraftMessage,
    "textContent",
    () => undefined,
);
export const currentChatReplyingTo = createDerivedPropStore(
    currentChatDraftMessage,
    "replyingTo",
    () => undefined,
);
export const currentChatAttachment = createDerivedPropStore(
    currentChatDraftMessage,
    "attachment",
    () => undefined,
);
export const currentChatEditingEvent = createDerivedPropStore(
    currentChatDraftMessage,
    "editingEvent",
    () => undefined,
);
