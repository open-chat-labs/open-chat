import {
    ChatEvent,
    ChatSpecificState,
    ChatSummary,
    EnhancedReplyContext,
    EventWrapper,
    Message,
    MessageContent,
    ThreadSyncDetails,
    CreatedUser,
    compareChats,
    emptyChatMetrics,
} from "openchat-shared";
import { unconfirmed } from "./unconfirmed";
import { derived, get, Readable, writable, Writable } from "svelte/store";
import { immutableStore } from "./immutable";
import {
    getNextEventAndMessageIndexes,
    mergeServerEvents,
    mergeEventsAndLocalUpdates,
    mergeUnconfirmedIntoSummary,
    mergeChatMetrics,
    getFirstUnreadMessageIndex,
} from "../utils/chat";
import { userStore } from "./user";
import { pinnedChatsStore } from "./pinnedChats";
import DRange from "drange";
import { snsFunctions } from "./snsFunctions";
import { archivedChatsStore, mutedChatsStore } from "./tempChatsStore";
import { filteredProposalsStore, resetFilteredProposalsStore } from "./filteredProposals";
import { createDerivedPropStore, createChatSpecificObjectStore } from "./dataByChatFactory";
import { localMessageUpdates } from "./localMessageUpdates";
import type { DraftMessage } from "./draftMessageFactory";
import { messagesRead } from "./markRead";
import type { OpenChatAgentWorker } from "../agentWorker";

export type ChatState = {
    chatId: string;
    event: ChatLifecycleEvent;
};

export type ChatLifecycleEvent =
    | Nothing
    | LoadedNewEvents
    | SendingMessage
    | ChatUpdated
    | LoadedEventWindow
    | LoadedPreviousEvents;

type Nothing = { kind: "nothing" };
type LoadedNewEvents = { kind: "loaded_new_events"; newLatestMessage: boolean };
type SendingMessage = {
    kind: "sending_message";
    scroll: ScrollBehavior;
};
type ChatUpdated = { kind: "chat_updated" };
type LoadedPreviousEvents = { kind: "loaded_previous_events" };
type LoadedEventWindow = {
    kind: "loaded_event_window";
    focusThreadMessageIndex: number | undefined;
    messageIndex: number;
    preserveFocus: boolean;
    allowRecursion: boolean;
};

export const currentUserStore = immutableStore<CreatedUser | undefined>(undefined);

export const serverChatSummariesStore: Writable<Record<string, ChatSummary>> = immutableStore({});

export const chatSummariesStore: Readable<Record<string, ChatSummary>> = derived(
    [
        serverChatSummariesStore,
        unconfirmed,
        currentUserStore,
        localMessageUpdates,
        archivedChatsStore,
        mutedChatsStore,
    ],
    ([summaries, unconfirmed, currentUser, localUpdates, archivedChats, mutedChats]) => {
        return Object.entries(summaries).reduce<Record<string, ChatSummary>>(
            (result, [chatId, summary]) => {
                if (currentUser !== undefined) {
                    result[chatId] = mergeUnconfirmedIntoSummary(
                        (k) => k,
                        currentUser.userId,
                        summary,
                        unconfirmed,
                        localUpdates,
                        archivedChats.get(summary.chatId),
                        mutedChats.get(chatId)
                    );
                }
                return result;
            },
            {}
        );
    }
);

// This is annoying. If only the pinnedChatIndex was stored in the chatSummary...
export const chatSummariesListStore = derived(
    [chatSummariesStore, pinnedChatsStore],
    ([summaries, pinnedChats]) => {
        const pinned = pinnedChats
            .filter((id) => summaries[id] !== undefined)
            .map((id) => summaries[id]);
        const unpinned = Object.values(summaries)
            .filter((chat) => !pinnedChats.includes(chat.chatId))
            .sort(compareChats);
        return pinned.concat(unpinned);
    }
);

export const userMetrics = derived([chatSummariesListStore], ([$chats]) => {
    return $chats.map((c) => c.myMetrics).reduce(mergeChatMetrics, emptyChatMetrics());
});

export const selectedChatId = writable<string | undefined>(undefined);
export const selectedThreadRootMessageIndex = writable<number | undefined>(undefined);
export const selectedThreadKey = derived(
    [selectedChatId, selectedThreadRootMessageIndex],
    ([$selectedChatId, $selectedThreadRootMessageIndex]) => {
        if ($selectedChatId !== undefined && $selectedThreadRootMessageIndex !== undefined) {
            return `${$selectedChatId}_${$selectedThreadRootMessageIndex}`;
        }
        return undefined;
    }
);
export const chatsLoading = writable(false);
export const chatsInitialised = writable(false);
export const chatUpdatedStore: Writable<{ affectedEvents: number[] } | undefined> =
    writable(undefined);

export const selectedServerChatStore = derived(
    [serverChatSummariesStore, selectedChatId],
    ([$serverChats, $selectedChatId]) => {
        if ($selectedChatId === undefined) return undefined;
        return $serverChats[$selectedChatId];
    }
);

export const selectedChatStore = derived(
    [chatSummariesStore, selectedChatId],
    ([$chatSummaries, $selectedChatId]) => {
        if ($selectedChatId === undefined) return undefined;
        return $chatSummaries[$selectedChatId];
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

export function nextEventAndMessageIndexes(): [number, number] {
    const chat = get(selectedServerChatStore);
    if (chat === undefined) {
        return [0, 0];
    }
    return getNextEventAndMessageIndexes(chat, unconfirmed.getMessages(chat.chatId));
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
        if (chat.kind === "group_chat" && chat.latestThreads.length > 0) {
            result[chat.chatId] = chat.latestThreads;
        }
        return result;
    }, {} as Record<string, ThreadSyncDetails[]>);
});

export const threadsFollowedByMeStore = derived([threadsByChatStore], ([threadsByChat]) => {
    return Object.entries(threadsByChat).reduce<Record<string, Set<number>>>(
        (result, [chatId, threads]) => {
            const set = new Set<number>();
            for (const thread of threads) {
                set.add(thread.threadRootMessageIndex);
            }
            result[chatId] = set;
            return result;
        },
        {}
    );
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
                    [11, "SNS Decentralization Sale"],
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

function countThreads<T>(things: Record<string, T[]>): number {
    return Object.values(things)
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
    pinnedMessages: new Set<number>(),
    userIds: new Set<string>(),
    userGroupKeys: new Set<string>(),
    confirmedEventIndexesLoaded: new DRange(),
    serverEvents: [],
}));

export const threadServerEventsStore: Writable<EventWrapper<ChatEvent>[]> = immutableStore([]);
export const threadEvents = derived(
    [threadServerEventsStore, unconfirmed, localMessageUpdates, selectedThreadKey],
    ([serverEvents, unconf, localUpdates, threadKey]) => {
        if (threadKey === undefined) return [];
        return mergeEventsAndLocalUpdates(
            serverEvents,
            unconf[threadKey]?.messages ?? [],
            localUpdates
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

export const userGroupKeys = createDerivedPropStore<ChatSpecificState, "userGroupKeys">(
    chatStateStore,
    "userGroupKeys",
    () => new Set<string>()
);

const confirmedEventIndexesLoadedStore = derived([serverEventsStore], ([serverEvents]) => {
    const ranges = new DRange();
    serverEvents.forEach((e) => ranges.add(e.index));
    return ranges;
});

export function confirmedEventIndexesLoaded(chatId: string): DRange {
    return get(selectedChatId) === chatId ? get(confirmedEventIndexesLoadedStore) : new DRange();
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
export const chatDetailsLatestEventIndex = createDerivedPropStore<
    ChatSpecificState,
    "latestEventIndex"
>(chatStateStore, "latestEventIndex", () => undefined);

export const currentChatBlockedUsers = createDerivedPropStore<ChatSpecificState, "blockedUsers">(
    chatStateStore,
    "blockedUsers",
    () => new Set<string>()
);
export const currentChatPinnedMessages = createDerivedPropStore<
    ChatSpecificState,
    "pinnedMessages"
>(chatStateStore, "pinnedMessages", () => new Set<number>());

export function setSelectedChat(
    api: OpenChatAgentWorker,
    chat: ChatSummary,
    messageIndex?: number
): void {
    // TODO don't think this should be in here really
    if (
        chat.kind === "group_chat" &&
        chat.subtype !== undefined &&
        chat.subtype.kind === "governance_proposals" &&
        !chat.subtype.isNns
    ) {
        const { governanceCanisterId } = chat.subtype;
        api.listNervousSystemFunctions(governanceCanisterId).then((val) => {
            snsFunctions.set(governanceCanisterId, val.functions);
            return val;
        });
    }

    if (messageIndex === undefined) {
        messageIndex = getFirstUnreadMessageIndex(chat);

        if (messageIndex !== undefined) {
            const latestServerMessageIndex =
                get(serverChatSummariesStore)[chat.chatId]?.latestMessage?.event.messageIndex ?? 0;

            if (messageIndex > latestServerMessageIndex) {
                messageIndex = undefined;
            }
        }
    }

    clearSelectedChat(chat.chatId);

    // initialise a bunch of stores
    chatStateStore.clear(chat.chatId);
    chatStateStore.setProp(chat.chatId, "focusMessageIndex", messageIndex);
    chatStateStore.setProp(
        chat.chatId,
        "userIds",
        new Set<string>(chat.kind === "direct_chat" ? [chat.chatId] : [])
    );
    resetFilteredProposalsStore(chat);
}

export function updateSummaryWithConfirmedMessage(
    chatId: string,
    message: EventWrapper<Message>
): void {
    serverChatSummariesStore.update((summaries) => {
        const summary = summaries[chatId];
        if (summary === undefined) return summaries;

        const latestEventIndex = Math.max(message.index, summary.latestEventIndex);
        const overwriteLatestMessage =
            summary.latestMessage === undefined ||
            message.index > summary.latestMessage.index ||
            // If they are the same message, take the confirmed one since it'll have the correct timestamp
            message.event.messageId === summary.latestMessage.event.messageId;

        const latestMessage = overwriteLatestMessage ? message : summary.latestMessage;

        return {
            ...summaries,
            [chatId]: {
                ...summary,
                latestEventIndex,
                latestMessage,
            },
        };
    });
}

export function clearSelectedChat(newSelectedChatId?: string): void {
    filteredProposalsStore.set(undefined);
    selectedChatId.update((chatId) => {
        if (chatId !== undefined) {
            chatStateStore.clear(chatId);
        }
        return newSelectedChatId;
    });
}

export function createDirectChat(chatId: string): void {
    serverChatSummariesStore.update((chatSummaries) => {
        return {
            ...chatSummaries,
            [chatId]: {
                kind: "direct_chat",
                them: chatId,
                chatId,
                readByMeUpTo: undefined,
                readByThemUpTo: undefined,
                latestMessage: undefined,
                latestEventIndex: -1,
                dateCreated: BigInt(Date.now()),
                notificationsMuted: false,
                metrics: emptyChatMetrics(),
                myMetrics: emptyChatMetrics(),
                archived: false,
            },
        };
    });
}

export function removeChat(chatId: string): void {
    serverChatSummariesStore.update((summaries) => {
        return Object.entries(summaries).reduce((agg, [k, v]) => {
            if (k !== chatId) {
                agg[k] = v;
            }
            return agg;
        }, {} as Record<string, ChatSummary>);
    });
}

export const eventsStore: Readable<EventWrapper<ChatEvent>[]> = derived(
    [serverEventsStore, unconfirmed, localMessageUpdates],
    ([$serverEventsForSelectedChat, $unconfirmed, $localMessageUpdates]) => {
        const chatId = get(selectedChatId) ?? "";
        return mergeEventsAndLocalUpdates(
            $serverEventsForSelectedChat,
            $unconfirmed[chatId]?.messages ?? [],
            $localMessageUpdates
        );
    }
);

export function addServerEventsToStores(
    chatId: string,
    newEvents: EventWrapper<ChatEvent>[],
    threadRootMessageIndex: number | undefined
): void {
    if (newEvents.length === 0) {
        return;
    }

    for (const event of newEvents) {
        if (event.event.kind === "message") {
            const key =
                threadRootMessageIndex === undefined
                    ? chatId
                    : `${chatId}_${threadRootMessageIndex}`;
            if (unconfirmed.delete(key, event.event.messageId)) {
                if (threadRootMessageIndex === undefined) {
                    messagesRead.confirmMessage(
                        chatId,
                        event.event.messageIndex,
                        event.event.messageId
                    );
                } else {
                    messagesRead.markThreadRead(
                        chatId,
                        threadRootMessageIndex,
                        event.event.messageIndex
                    );
                }
            }
        }
    }

    if (threadRootMessageIndex === undefined) {
        chatStateStore.updateProp(chatId, "serverEvents", (events) =>
            mergeServerEvents(events, newEvents)
        );
    } else {
        threadServerEventsStore.update((events) => mergeServerEvents(events, newEvents));
    }
}

export function clearServerEvents(chatId: string): void {
    chatStateStore.setProp(chatId, "serverEvents", []);
}

/**
 * You might think that this belongs in the chatStateStore, but this needs to persist across chat selection boundary
 * so it has a different scope.
 */
const draftMessages = createChatSpecificObjectStore<DraftMessage>(() => ({}));

export const currentChatDraftMessage = {
    ...draftMessages,
    setTextContent: (id: string, textContent: string | undefined): void =>
        draftMessages.setProp(id, "textContent", textContent),
    setAttachment: (id: string, attachment: MessageContent | undefined): void =>
        draftMessages.setProp(id, "attachment", attachment),
    setReplyingTo: (id: string, replyingTo: EnhancedReplyContext | undefined): void =>
        draftMessages.setProp(id, "replyingTo", replyingTo),
    setEditing: (id: string, editingEvent: EventWrapper<Message>): void => {
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
