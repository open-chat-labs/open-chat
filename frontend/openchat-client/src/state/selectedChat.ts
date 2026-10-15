import DRange from "drange";
import {
    chatIdentifiersEqual,
    messageContextsEqual,
    type ChatEvent,
    type ChatIdentifier,
    type EventWrapper,
    type ThreadIdentifier,
} from "@shared";
import { writable, type Readable } from "../utils/stores";
import { notEq } from "./utils";

// The selected chat's server events. Only this module writes them: anything loaded for the
// selected chat is written through the SelectedChat or SelectedThread it was loaded for, which
// does nothing once that selection has gone, so a late response can't land on a later selection.

const serverEvents = writable<EventWrapper<ChatEvent>[]>([], undefined, notEq);
const serverThreadEvents = writable<EventWrapper<ChatEvent>[]>([], undefined, notEq);
const expiredEventRanges = writable<DRange>(new DRange(), undefined, notEq);

export const serverEventsStore: Readable<EventWrapper<ChatEvent>[]> = serverEvents;
export const serverThreadEventsStore: Readable<EventWrapper<ChatEvent>[]> = serverThreadEvents;
export const expiredServerEventRanges: Readable<DRange> = expiredEventRanges;

let selected: SelectedChat | undefined;
let openThread: SelectedThread | undefined;

/**
 * One visit to a chat. A new one is created each time a chat is selected, including a chat
 * that was selected before, so whatever was loaded for an earlier visit is dropped.
 */
export class SelectedChat {
    constructor(readonly chatId: ChatIdentifier) {}

    get current(): boolean {
        return this === selected;
    }

    get chat(): SelectedChat {
        return this;
    }

    updateEvents(fn: (events: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[]) {
        if (this.current) serverEvents.update(fn);
    }

    updateExpiredEventRanges(fn: (ranges: DRange) => DRange) {
        if (this.current) expiredEventRanges.update(fn);
    }

    // The expired ranges go too: they're part of what decides whether new events are contiguous
    // with those loaded
    clearEvents() {
        if (this.current) {
            serverEvents.set([]);
            expiredEventRanges.set(new DRange());
        }
    }
}

/**
 * One visit to a thread. As for chats, opening the same thread again starts a new visit. A thread
 * can be open in a chat which isn't selected (mobile's thread previews), so it is current for as
 * long as it stays open, whatever the selected chat.
 */
export class SelectedThread {
    // The visit to the thread's chat, if the chat was selected when the thread was opened
    readonly chat: SelectedChat | undefined;

    constructor(
        readonly chatId: ChatIdentifier,
        readonly threadRootMessageIndex: number,
    ) {
        this.chat = selectedChatFor(chatId);
    }

    get current(): boolean {
        return this === openThread;
    }

    updateEvents(fn: (events: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[]) {
        if (this.current) serverThreadEvents.update(fn);
    }

    clearEvents() {
        if (this.current) serverThreadEvents.set([]);
    }
}

// The selected chat's visit, if the chat is selected. For events that are true whenever they
// arrive, such as a message just sent; anything loaded holds on to the visit it was loaded for.
export function selectedChatFor(chatId: ChatIdentifier): SelectedChat | undefined {
    return selected !== undefined && chatIdentifiersEqual(selected.chatId, chatId)
        ? selected
        : undefined;
}

// The open thread's visit, if it is this thread
export function selectedThreadFor(context: ThreadIdentifier): SelectedThread | undefined {
    return openThread !== undefined &&
        messageContextsEqual(context, {
            chatId: openThread.chatId,
            threadRootMessageIndex: openThread.threadRootMessageIndex,
        })
        ? openThread
        : undefined;
}

export type EventsVisit = SelectedChat | SelectedThread;

// The visit to the selected chat, or to the open thread, if that's where these events belong
export function eventsVisitFor(
    chatId: ChatIdentifier,
    threadRootMessageIndex: number | undefined,
): EventsVisit | undefined {
    return threadRootMessageIndex === undefined
        ? selectedChatFor(chatId)
        : selectedThreadFor({ chatId, threadRootMessageIndex });
}

// A chat was selected, or the selection was cleared. Its thread events are cleared when the thread
// is (each store is written as often as before there were visits, since each write is a publish).
export function startChatVisit(chatId: ChatIdentifier | undefined) {
    selected = chatId === undefined ? undefined : new SelectedChat(chatId);
    serverEvents.set([]);
    expiredEventRanges.set(new DRange());
}

// A thread was opened, or closed
export function startThreadVisit(thread: ThreadIdentifier | undefined) {
    openThread =
        thread === undefined
            ? undefined
            : new SelectedThread(thread.chatId, thread.threadRootMessageIndex);
    serverThreadEvents.set([]);
}
