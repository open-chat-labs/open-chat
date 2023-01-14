import type {
    ChatEvent,
    ChatSummary,
    EventsResponse,
    IndexRange
} from "openchat-shared";
import { compareChats, missingUserIds, userIdsFromEvents } from "openchat-shared";
import { toRecord } from "./list";
import { Poller } from "./poller";
import type { OpenChatAgentWorker } from "../agentWorker";
import { boolFromLS } from "../stores/localStorageSetting";
import { messagesRead } from "../stores/markRead";
import { userStore } from "../stores/user";
import { get } from "svelte/store";

export class CachePrimer {
    private pending: Record<string, ChatSummary> = {};
    private runner: Poller | undefined = undefined;

    constructor(private api: OpenChatAgentWorker) {
        debug("initialized");
    }

    processChatUpdates(previous: ChatSummary[], next: ChatSummary[]): void {
        const record = toRecord(previous, (c) => c.chatId);
        const updated = next.filter((c) => !c.archived && hasBeenUpdated(record[c.chatId], c));

        if (updated.length > 0) {
            for (const chat of updated) {
                this.pending[chat.chatId] = chat;
                debug("enqueued " + chat.chatId);
            }

            if (this.runner === undefined) {
                this.runner = new Poller(() => this.processNext(), 0);
                debug("runner started");
            }
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

            const firstUnreadMessage = messagesRead.getFirstUnreadMessageIndex(
                chat.chatId,
                chat.latestMessage?.event.messageIndex
            );

            const userIds = new Set<string>();
            if (firstUnreadMessage !== undefined) {
                debug(chat.chatId + " loading events window");
                const eventsWindowResponse = await this.getEventsWindow(chat, firstUnreadMessage);
                debug(chat.chatId + " loaded events window");
                if (eventsWindowResponse !== "events_failed") {
                    userIdsFromEvents(eventsWindowResponse.events).forEach((u) => userIds.add(u));
                }
            }

            debug(chat.chatId + " loading latest events");
            const latestEventsResponse = await this.getLatestEvents(chat);
            debug(chat.chatId + " loaded latest events");
            if (latestEventsResponse !== "events_failed") {
                userIdsFromEvents(latestEventsResponse.events).forEach((u) => userIds.add(u));
            }

            if (userIds.size > 0) {
                const missing = missingUserIds(get(userStore), userIds);
                if (missing.length > 0) {
                    debug(`${chat.chatId} loading ${missing.length} users`);
                    await this.api.getUsers({userGroups: [{users: missing, updatedSince: BigInt(0)}]}, true);
                }
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

    private async getEventsWindow(chat: ChatSummary, firstUnreadMessage: number): Promise<EventsResponse<ChatEvent>> {
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
    }

    private async getLatestEvents(chat: ChatSummary): Promise<EventsResponse<ChatEvent>> {
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

function hasBeenUpdated(previous: ChatSummary | undefined, next: ChatSummary): boolean {
    return previous === undefined || next.latestEventIndex > previous.latestEventIndex;
}

function debug(message: string) {
    if (boolFromLS("openchat_cache_primer_debug_enabled", false)) {
        console.debug("CachePrimer - " + message)
    }
}
