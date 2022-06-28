import { writable } from "svelte/store";
import { dedupe } from "../utils/list";
import type {
    ChatEvent,
    EventWrapper,
    Message,
    MessageContent,
    ThreadSummary,
} from "../domain/chat/chat";
import { updateEventPollContent } from "../domain/chat/chat.utils";

/**
 * This just holds some dummy state for us while we don't have an api
 */

// messageIndex -> events
type ThreadLookup = Record<number, EventWrapper<Message>[]>;

// messageIndex -> ThreadSummary for fake threads
export type ThreadSummaryLookup = Record<number, ThreadSummary>;

// todo this needs to be per chat! but let's work out whether this is going to be permanent first
const internalThreadSummaryStore = writable<ThreadSummaryLookup>({});

export const threadSummaryStore = {
    subscribe: internalThreadSummaryStore.subscribe,
    addMessageToThread: (rootEvt: EventWrapper<Message>, evt: EventWrapper<Message>): void => {
        internalThreadSummaryStore.update((lookup) => {
            const summary = lookup[rootEvt.event.messageIndex];
            return summary
                ? {
                      ...lookup,
                      [rootEvt.event.messageIndex]: {
                          ...summary,
                          participantIds: summary.participantIds.add(evt.event.sender),
                          numberOfReplies: summary.numberOfReplies + 1,
                          latestEventIndex: evt.index,
                          latestEventTimestamp: evt.timestamp,
                      },
                  }
                : lookup;
        });
    },
    createThread: (ev: EventWrapper<Message>): void => {
        internalThreadSummaryStore.update((lookup) => {
            const summary = lookup[ev.event.messageIndex] ?? {
                participantIds: new Set<string>([ev.event.sender]),
                numberOfReplies: 0,
                latestEventIndex: -1,
                latestEventTimestamp: BigInt(0),
            };
            return {
                ...lookup,
                [ev.event.messageIndex]: summary,
            };
        });
    },
};

const { subscribe, set, update } = writable<ThreadLookup>({});

export const threadStore = {
    subscribe,
    set,
    removeMessageFromThread: (threadRootMessageIndex: number, messageIndex: number): void => {
        update((store) => {
            const evts = store[threadRootMessageIndex] ?? [];
            return {
                ...store,
                [threadRootMessageIndex]: evts.filter((e) => e.event.messageIndex !== messageIndex),
            };
        });
    },
    addMessageToThread: (
        messageIndex: number,
        rootEvt: EventWrapper<Message>,
        evt: EventWrapper<Message>
    ): void => {
        update((store) => {
            let evts = store[messageIndex] ?? [];
            evts.push(evt);
            evts = dedupe(
                (a, b) => a.index === b.index,
                evts.sort((a, b) => a.index - b.index)
            );
            if (evt !== rootEvt) {
                // we are adding a new message to the root of the thread so we should create a thread summary
                threadSummaryStore.createThread(rootEvt);
                threadSummaryStore.addMessageToThread(rootEvt, evt);
            }
            return {
                ...store,
                [messageIndex]: evts,
            };
        });
    },
    replaceMessageInThread: (messageIndex: number, evt: EventWrapper<Message>): void => {
        update((store) => {
            if (store[messageIndex] === undefined) {
                return store;
            }
            store[messageIndex] = store[messageIndex].map((ev) =>
                ev.index === evt.index ? evt : ev
            );
            return store;
        });
    },
    replaceMessageContent: (
        rootMessageIndex: number,
        messageIndex: number,
        content: MessageContent
    ): void => {
        update((store) => {
            if (store[rootMessageIndex] === undefined) {
                return store;
            }
            store[rootMessageIndex] = store[rootMessageIndex].map((ev) =>
                ev.event.messageIndex === messageIndex
                    ? {
                          ...ev,
                          event: {
                              ...ev.event,
                              content,
                          },
                      }
                    : ev
            );
            return store;
        });
    },
    registerVote: (
        rootMessageIndex: number,
        messageIndex: number,
        answerIndex: number,
        type: "register" | "delete",
        userId: string
    ): void => {
        update((store) => {
            store[rootMessageIndex] = store[rootMessageIndex].map((e) =>
                updateEventPollContent(messageIndex, answerIndex, type, userId, e)
            );
            return store;
        });
    },
};

export function getNextEventAndMessageIndexes(events: EventWrapper<ChatEvent>[]): [number, number] {
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
