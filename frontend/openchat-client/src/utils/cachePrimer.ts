import type {
    ChatEvent,
    ChatSummary,
    EventsResponse,
    EventWrapper,
    IndexRange
} from "openchat-shared";
import { compareChats, missingUserIds, userIdsFromEvents } from "openchat-shared";
import { toRecord } from "./list";
import { Poller } from "./poller";
import type { OpenChatAgentWorker } from "../agentWorker";
import { selectedChatId } from "../stores/chat";
import { boolFromLS } from "../stores/localStorageSetting";
import { messagesRead } from "../stores/markRead";
import { userStore } from "../stores/user";
import { get } from "svelte/store";

export class CachePrimer {
    private pending: Record<string, ChatSummary> = {};
    private runner: Poller | undefined = undefined;
    private selectedChatId: string | undefined = undefined;

    constructor(private api: OpenChatAgentWorker) {
        selectedChatId.subscribe((chatId) => {
            if (chatId !== undefined) {
                delete this.pending[chatId];
            }
            this.selectedChatId = chatId;
        });
        debug("initialized");
    }

    processChatUpdates(previous: ChatSummary[], next: ChatSummary[]): void {
        const record = toRecord(previous, (c) => c.chatId);

        const updated = next.filter((c) =>
            c.chatId !== this.selectedChatId &&
            !c.archived &&
            hasBeenUpdated(record[c.chatId], c)
        );

        this.enqueue(updated);
    }

    processChatMarkedAsRead(chat: ChatSummary): void {
        if (chat.chatId !== this.selectedChatId && !chat.archived) {
            this.enqueue([chat]);
        }
    }

    async processNext(): Promise<void> {
        try {
            const chat = Object.values(this.pending).sort(compareChats)[0];
            if (chat === undefined) {
                debug("queue empty");
                return;
            }
            delete this.pending[chat.chatId];

            debug(chat.chatId + " loading events");

            const eventsResponse = await this.getPageOfEvents(chat);

            if (eventsResponse !== "events_failed" && eventsResponse.events.length > 0) {
                await this.loadMissingUsers(chat.chatId, eventsResponse.events);
            }

            debug(chat.chatId + " completed");
        } finally {
            if (Object.keys(this.pending).length === 0) {
                this.runner?.stop();
                this.runner = undefined;
                debug("runner stopped");
            }
        }
    }

    private async getPageOfEvents(chat: ChatSummary): Promise<EventsResponse<ChatEvent>> {
        const firstUnreadMessage = messagesRead.getFirstUnreadMessageIndex(
            chat.chatId,
            chat.latestMessage?.event.messageIndex
        );

        if (firstUnreadMessage !== undefined) {
            if (chat.kind === "direct_chat") {
                return await this.api.directChatEventsWindow(
                    [0, chat.latestEventIndex],
                    chat.them,
                    firstUnreadMessage,
                    chat.latestEventIndex
                );
            } else {
                return await this.api.groupChatEventsWindow(
                    [chat.minVisibleEventIndex, chat.latestEventIndex],
                    chat.chatId,
                    firstUnreadMessage,
                    chat.latestEventIndex
                );
            }
        } else {
            const range: IndexRange = chat.kind === "direct_chat"
                ? [0, chat.latestEventIndex]
                : [chat.minVisibleEventIndex, chat.latestEventIndex];

            return await this.api.chatEvents(
                chat.kind,
                chat.chatId,
                range,
                chat.latestEventIndex,
                false,
                undefined,
                chat.latestEventIndex
            );
        }
    }

    private async loadMissingUsers(chatId: string, events: EventWrapper<ChatEvent>[]): Promise<void> {
        const usersFromEvents = userIdsFromEvents(events);
        const missingUsers = missingUserIds(get(userStore), usersFromEvents);
        if (missingUsers.length > 0) {
            debug(`${chatId} loading ${missingUsers.length} users`);
            await this.api.getUsers({userGroups: [{users: missingUsers, updatedSince: BigInt(0)}]}, true);
        }
    }

    private enqueue(chats: ChatSummary[]): void {
        if (chats.length > 0) {
            for (const chat of chats) {
                this.pending[chat.chatId] = chat;
                debug("enqueued " + chat.chatId);
            }

            if (this.runner === undefined) {
                this.runner = new Poller(() => this.processNext(), 0);
                debug("runner started");
            }
        }
    }
}

function hasBeenUpdated(previous: ChatSummary | undefined, next: ChatSummary): boolean {
    return previous === undefined || next.latestEventIndex > previous.latestEventIndex;
}

function debug(message: string) {
    if (boolFromLS("openchat_cache_primer_debug_enabled", false)) {
        console.debug("CachePrimer - " + message)
    }
}
