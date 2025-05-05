/* eslint-disable no-case-declarations */
import DRange from "drange";
import type {
    ChatEvent,
    ChatIdentifier,
    EventWrapper,
    ExpiredEventsRange,
    MessageContext,
    ThreadIdentifier,
} from "openchat-shared";
import { chatIdentifiersEqual, messageContextsEqual } from "openchat-shared";
import { derived, writable, type Readable } from "svelte/store";
import { app } from "../state/app.svelte";
import { localUpdates } from "../state/global";
import { getNextEventAndMessageIndexes, mergeEventsAndLocalUpdates } from "../utils/chat";
import { createDerivedPropStore } from "./derived";
import { draftMessagesStore } from "./draftMessages";
import { createDummyStore } from "./dummyStore";
import { safeWritable } from "./safeWritable";
import { snsFunctions } from "./snsFunctions";

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
    const chat = app.selectedServerChatSummary;
    if (chat === undefined) {
        return [0, 0];
    }
    return getNextEventAndMessageIndexes(
        chat,
        localUpdates.unconfirmedMessages({ chatId: chat.id }).sort(sortByIndex),
    );
}

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
            app.currentUserId,
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
        $messageFilters,
        $recentlySentMessagesStore,
        $ephemeralMessages,
    ]) => {
        const chatId = app.selectedChatId ?? { kind: "group_chat", groupId: "" };
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
            app.currentUserId,
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

export function isContiguousInThread(
    threadId: ThreadIdentifier,
    events: EventWrapper<ChatEvent>[],
): boolean {
    return (
        messageContextsEqual(threadId, app.selectedChat?.selectedThread?.id) &&
        isContiguousInternal(app.selectedChat.confirmedThreadEventIndexesLoaded, events, [])
    );
}

export function isContiguous(
    chatId: ChatIdentifier,
    events: EventWrapper<ChatEvent>[],
    expiredEventRanges: ExpiredEventsRange[],
): boolean {
    return (
        chatIdentifiersEqual(chatId, app.selectedChat.chatId) &&
        isContiguousInternal(confirmedEventIndexesLoaded(chatId), events, expiredEventRanges)
    );
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
