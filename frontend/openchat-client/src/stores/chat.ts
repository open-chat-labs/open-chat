/* eslint-disable no-case-declarations */
import DRange from "drange";
import type {
    ChatEvent,
    ChatIdentifier,
    ChatSummary,
    DirectChatIdentifier,
    DirectChatSummary,
    EventWrapper,
    ExpiredEventsRange,
    MessageContext,
    MultiUserChat,
    ThreadSyncDetails,
} from "openchat-shared";
import {
    chatIdentifiersEqual,
    ChatMap,
    compareChats,
    emptyChatMetrics,
    messageContextsEqual,
    nullMembership,
} from "openchat-shared";
import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import { app } from "../state/app.svelte";
import { localUpdates } from "../state/global";
import {
    getNextEventAndMessageIndexes,
    mergeChatMetrics,
    mergeEventsAndLocalUpdates,
    mergeLocalSummaryUpdates,
    mergeUnconfirmedIntoSummary,
} from "../utils/chat";
import { configKeys } from "../utils/config";
import { blockedUsers } from "./blockedUsers";
import { createDerivedPropStore } from "./derived";
import { draftMessagesStore } from "./draftMessages";
import { createDummyStore } from "./dummyStore";
import { ephemeralMessages } from "./ephemeralMessages";
import { failedMessagesStore } from "./failedMessages";
import { allServerChats } from "./global";
import { immutableStore } from "./immutable";
import { localChatSummaryUpdates } from "./localChatSummaryUpdates";
import { localMessageUpdates } from "./localMessageUpdates";
import { createLsBoolStore } from "./localStorageSetting";
import { messageFiltersStore } from "./messageFilters";
import { proposalTallies } from "./proposalTallies";
import { recentlySentMessagesStore } from "./recentlySentMessages";
import { safeWritable } from "./safeWritable";
import { snsFunctions } from "./snsFunctions";
import { translationStore } from "./translation";
import { unconfirmed } from "./unconfirmed";
import { currentUser, currentUserIdStore, suspendedUsers } from "./user";

export const dummyCommunityPreviewStore = writable(0);

// TODO - this will be synced from the Svelte5 rune for now and ultimately removed
export const selectedChatId = writable<ChatIdentifier | undefined>(undefined);

// TODO - get rid of this - it's dangerous at best
export const selectedMessageContext = safeWritable<MessageContext | undefined>(
    undefined,
    messageContextsEqual,
);

export const selectedThreadRootMessageIndex = derived(selectedMessageContext, ($messageContext) => {
    return $messageContext?.threadRootMessageIndex;
});

export const hideMessagesFromDirectBlocked = createLsBoolStore(configKeys.hideBlocked, false);

export const currentChatBlockedOrSuspendedUsers = derived(
    [suspendedUsers, blockedUsers, hideMessagesFromDirectBlocked],
    ([suspended, directBlocked, hideBlocked]) => {
        const direct = hideBlocked ? directBlocked : [];
        return new Set<string>([
            ...app.selectedChat.blockedUsers, //TODO This is no longer reactive - not ideal but probably liveable with short term
            ...app.selectedCommunity.blockedUsers, //TODO This is no longer reactive - not ideal but probably liveable with short term
            ...suspended,
            ...direct,
        ]);
    },
);

export const dummyScopedServerChats = createDummyStore();

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
        dummyScopedServerChats,
        uninitializedDirectChats,
        groupPreviewsStore,
        dummyCommunityPreviewStore,
    ],
    ([_, directChats, previews]) => {
        let all = [...app.scopedServerChats.entries()];
        if (app.chatListScope.kind === "none" || app.chatListScope.kind === "direct_chat") {
            all = all.concat([...directChats.entries()]);
        }
        if (app.chatListScope.kind === "none") {
            all = ([...previews.entries()] as ChatEntry[]).concat(all);
        }
        if (app.chatListScope.kind === "group_chat") {
            all = (
                [...previews.filter((c) => c.kind === "group_chat").entries()] as ChatEntry[]
            ).concat(all);
        }
        if (app.chatListScope.kind === "community") {
            const communityId = app.chatListScope.id.communityId;
            const previewChannels = ChatMap.fromList(
                localUpdates.getPreviewingCommunity(app.chatListScope.id)?.channels ?? [],
            );
            all = ([...previewChannels.entries()] as ChatEntry[])
                .concat([
                    ...previews
                        .filter((c) => c.kind === "channel" && c.id.communityId === communityId)
                        .entries(),
                ] as ChatEntry[])
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
        const merged = ([...$direct.entries()] as ChatEntry[])
            .concat([...$group.entries()] as ChatEntry[])
            .concat([...$all.entries()]);
        const reduced = merged.reduce<ChatMap<ChatSummary>>((result, [chatId, summary]) => {
            result.set(chatId, summary);
            return result;
        }, new ChatMap<ChatSummary>());
        return mergeLocalSummaryUpdates(app.chatListScope, reduced, $localSummaryUpdates);
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
            app.chatListScope,
            summaries,
            localSummaryUpdates,
        );

        return mergedSummaries.reduce<ChatMap<ChatSummary>>((result, [chatId, summary]) => {
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

// TODO - remove me when you can
export const dummyPinnedChatsStore = createDummyStore();

// This is annoying. If only the pinnedChatIndex was stored in the chatSummary...
export const chatSummariesListStore = derived(
    [chatSummariesStore, dummyPinnedChatsStore],
    ([summaries, _]) => {
        const pinnedByScope = app.pinnedChats.get(app.chatListScope.kind) ?? [];
        const pinned = pinnedByScope.reduce<ChatSummary[]>((result, id) => {
            const summary = summaries.get(id);
            if (summary !== undefined) {
                result.push(summary);
            }
            return result;
        }, []);
        const unpinned = [...summaries.values()]
            .filter(
                (chat) => pinnedByScope.findIndex((p) => chatIdentifiersEqual(p, chat.id)) === -1,
            )
            .sort(compareChats);
        return pinned.concat(unpinned);
    },
);

export const userMetrics = derived([allServerChats], ([$chats]) => {
    return [...$chats.values()]
        .map((c) => c.membership?.myMetrics ?? emptyChatMetrics())
        .reduce(mergeChatMetrics, emptyChatMetrics());
});

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
    return threadsByChat.reduce<ChatMap<Set<number>>>((result, [chatId, threads]) => {
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
    return things.map((_, ts) => ts.length).reduce((total, [_, n]) => total + n, 0);
}

// returns the total number of threads that we are involved in
export const numberOfThreadsStore = derived([threadsByChatStore], ([threads]) =>
    countThreads(threads),
);

export const dummyThreadEventsStore = createDummyStore();

export const threadEvents = derived(
    [
        dummyThreadEventsStore,
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
        ephemeralMessages,
    ],
    ([
        _,
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
        $ephemeralMessages,
    ]) => {
        if ($messageContext === undefined || $messageContext.threadRootMessageIndex === undefined)
            return [];
        const failed = $failedMessages.has($messageContext)
            ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              Object.values($failedMessages.get($messageContext)!)
            : [];
        const unconfirmed = $unconfirmed.get($messageContext)?.messages ?? [];
        const ephemeral = [...($ephemeralMessages.get($messageContext)?.values() ?? [])];
        return mergeEventsAndLocalUpdates(
            app.selectedChat.serverThreadEvents,
            [...unconfirmed, ...failed, ...ephemeral],
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

export function confirmedEventIndexesLoaded(chatId: ChatIdentifier): DRange {
    const selected = app.selectedChatId;
    return selected !== undefined && chatIdentifiersEqual(selected, chatId)
        ? app.selectedChat.confirmedEventIndexesLoaded
        : new DRange();
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

export const dummyServerEventsStore = createDummyStore();
export const dummyExpiredEventRangeStore = createDummyStore();

export const eventsStore: Readable<EventWrapper<ChatEvent>[]> = derived(
    [
        dummyServerEventsStore,
        unconfirmed,
        localMessageUpdates,
        dummyExpiredEventRangeStore,
        failedMessagesStore,
        proposalTallies,
        translationStore,
        currentChatBlockedOrSuspendedUsers,
        currentUserIdStore,
        messageFiltersStore,
        recentlySentMessagesStore,
        ephemeralMessages,
    ],
    ([
        _serverEvents,
        $unconfirmed,
        $localMessageUpdates,
        _expiredEventRanges,
        $failedMessages,
        $proposalTallies,
        $translationStore,
        $blockedOrSuspendedUsers,
        $currentUserId,
        $messageFilters,
        $recentlySentMessagesStore,
        $ephemeralMessages,
    ]) => {
        const chatId = get(selectedChatId) ?? { kind: "group_chat", groupId: "" };
        const failedForChat = $failedMessages.get({ chatId });
        // for the purpose of merging, unconfirmed and failed can be treated the same
        const failed = failedForChat ? Object.values(failedForChat) : [];
        const unconfirmed = $unconfirmed.get({ chatId })?.messages ?? [];
        const ephemeral = [...($ephemeralMessages.get({ chatId })?.values() ?? [])];
        return mergeEventsAndLocalUpdates(
            app.selectedChat.serverEvents,
            [...unconfirmed, ...failed, ...ephemeral],
            $localMessageUpdates,
            app.selectedChat.expiredEventRanges,
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
    return isContiguousInternal(app.selectedChat.confirmedThreadEventIndexesLoaded, events, []);
}

export function isContiguous(
    chatId: ChatIdentifier,
    events: EventWrapper<ChatEvent>[],
    expiredEventRanges: ExpiredEventsRange[],
): boolean {
    return isContiguousInternal(confirmedEventIndexesLoaded(chatId), events, expiredEventRanges);
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
