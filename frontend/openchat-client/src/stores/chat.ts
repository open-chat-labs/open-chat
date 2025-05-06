/* eslint-disable no-case-declarations */
import DRange from "drange";
import type {
    ChatEvent,
    ChatIdentifier,
    EventWrapper,
    ExpiredEventsRange,
    ThreadIdentifier,
} from "openchat-shared";
import { chatIdentifiersEqual, messageContextsEqual } from "openchat-shared";
import { derived, writable } from "svelte/store";
import { app } from "../state/app.svelte";
import { localUpdates } from "../state/global";
import { getNextEventAndMessageIndexes } from "../utils/chat";
import { snsFunctions } from "./snsFunctions";

// TODO - this will be synced from the Svelte5 rune for now and ultimately removed
export const selectedChatId = writable<ChatIdentifier | undefined>(undefined);

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
    [snsFunctions],
    ([$snsFunctions]): Map<number, string> => {
        if (
            app.selectedChatSummary !== undefined &&
            app.selectedChatSummary.kind !== "direct_chat" &&
            app.selectedChatSummary.subtype !== undefined
        ) {
            if (app.selectedChatSummary.subtype.isNns) {
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
                    app.selectedChatSummary.subtype.governanceCanisterId,
                );
                if (snsFunctionsMap !== undefined) {
                    return new Map([...snsFunctionsMap].slice(1).map((e) => [e[0], e[1].name]));
                }
            }
        }

        return new Map();
    },
);

export function confirmedEventIndexesLoaded(chatId: ChatIdentifier): DRange {
    const selected = app.selectedChatId;
    return selected !== undefined && chatIdentifiersEqual(selected, chatId)
        ? app.selectedChat.confirmedEventIndexesLoaded
        : new DRange();
}

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
