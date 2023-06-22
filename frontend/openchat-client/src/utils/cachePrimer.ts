import type { ChatEvent, ChatSummary, EventsResponse, IndexRange } from "openchat-shared";
import { ChatMap, compareChats, missingUserIds, userIdsFromEvents } from "openchat-shared";
import { Poller } from "./poller";
import { boolFromLS } from "../stores/localStorageSetting";
import { messagesRead } from "../stores/markRead";
import { userStore } from "../stores/user";
import { get } from "svelte/store";
import type { OpenChat } from "../openchat";

export class CachePrimer {
    private pending: ChatMap<ChatSummary> = new ChatMap();
    private runner: Poller | undefined = undefined;

    constructor(private api: OpenChat) {
        debug("initialized");
    }

    processChatUpdates(previous: ChatSummary[], next: ChatSummary[]): void {
        const record = ChatMap.fromList(previous);
        const updated = next.filter(
            (c) => !c.membership.archived && hasBeenUpdated(record.get(c.id), c)
        );

        if (updated.length > 0) {
            for (const chat of updated) {
                this.pending.set(chat.id, chat);
                debug("enqueued " + chat.id);
            }

            if (this.runner === undefined) {
                this.runner = new Poller(() => this.processNext(), 0);
                debug("runner started");
            }
        }
    }

    async processNext(): Promise<void> {
        try {
            const chat = this.pending.values().sort(compareChats)[0];
            if (chat === undefined) {
                debug("queue empty");
                return;
            }
            this.pending.delete(chat.id);

            const firstUnreadMessage = messagesRead.getFirstUnreadMessageIndex(
                chat.id,
                chat.latestMessage?.event.messageIndex
            );

            const userIds = new Set<string>();
            if (firstUnreadMessage !== undefined) {
                debug(chat.id + " loading events window");
                const eventsWindowResponse = await this.getEventsWindow(chat, firstUnreadMessage);
                debug(chat.id + " loaded events window");
                if (eventsWindowResponse !== "events_failed") {
                    userIdsFromEvents(eventsWindowResponse.events).forEach((u) => userIds.add(u));
                }
            }

            debug(chat.id + " loading latest events");
            const latestEventsResponse = await this.getLatestEvents(chat);
            debug(chat.id + " loaded latest events");
            if (latestEventsResponse !== "events_failed") {
                userIdsFromEvents(latestEventsResponse.events).forEach((u) => userIds.add(u));
            }

            if (userIds.size > 0) {
                const missing = missingUserIds(get(userStore), userIds);
                if (missing.length > 0) {
                    debug(`${chat.id} loading ${missing.length} users`);
                    await this.api.getUsers(
                        { userGroups: [{ users: missing, updatedSince: BigInt(0) }] },
                        true
                    );
                }
            }
            debug(chat.id + " completed");
        } finally {
            if (this.pending.size === 0) {
                this.runner?.stop();
                this.runner = undefined;
                debug("runner stopped");
            }
        }
    }

    private async getEventsWindow(
        chat: ChatSummary,
        firstUnreadMessage: number
    ): Promise<EventsResponse<ChatEvent>> {
        switch (chat.kind) {
            case "direct_chat":
                return await this.api.sendRequest({
                    kind: "directChatEventsWindow",
                    eventIndexRange: [0, chat.latestEventIndex],
                    chatId: chat.them,
                    messageIndex: firstUnreadMessage,
                    latestClientMainEventIndex: chat.latestEventIndex,
                });
            case "group_chat":
                return await this.api.sendRequest({
                    kind: "groupChatEventsWindow",
                    eventIndexRange: [chat.minVisibleEventIndex, chat.latestEventIndex],
                    chatId: chat.id,
                    messageIndex: firstUnreadMessage,
                    latestClientMainEventIndex: chat.latestEventIndex,
                    threadRootMessageIndex: undefined,
                });
            case "channel":
                throw new Error("TODO - cache primer doesn't work for channels yet");
        }
    }

    private async getLatestEvents(chat: ChatSummary): Promise<EventsResponse<ChatEvent>> {
        const range: IndexRange =
            chat.kind === "direct_chat"
                ? [0, chat.latestEventIndex]
                : [chat.minVisibleEventIndex, chat.latestEventIndex];

        return await this.api.sendRequest({
            kind: "chatEvents",
            chatType: chat.kind,
            chatId: chat.id,
            eventIndexRange: range,
            startIndex: chat.latestEventIndex,
            ascending: false,
            threadRootMessageIndex: undefined,
            latestClientEventIndex: chat.latestEventIndex,
        });
    }
}

function hasBeenUpdated(previous: ChatSummary | undefined, next: ChatSummary): boolean {
    return previous === undefined || next.latestEventIndex > previous.latestEventIndex;
}

function debug(message: string) {
    if (boolFromLS("openchat_cache_primer_debug_enabled", false)) {
        console.debug("CachePrimer - " + message);
    }
}
