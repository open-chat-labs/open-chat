import type { ChatEventsArgs, ChatEventsResponse, ChatSummary } from "openchat-shared";
import {
    ChatMap,
    compareChats,
    missingUserIds,
    userIdsFromEvents,
    chatIdentifiersEqual,
    chatIdentifierToString,
    MAX_EVENTS,
    MAX_MESSAGES,
} from "openchat-shared";
import { Poller } from "./poller";
import { boolFromLS } from "../stores/localStorageSetting";
import { messagesRead } from "../stores/markRead";
import { userStore } from "../stores/user";
import { get } from "svelte/store";
import type { OpenChat } from "../openchat";
import { runOnceIdle } from "./backgroundTasks";

const BATCH_SIZE = 20;

export class CachePrimer {
    private pending: ChatMap<ChatSummary> = new ChatMap();
    private runner: Poller | undefined = undefined;

    constructor(
        private api: OpenChat,
        private userCanisterLocalUserIndex: string,
    ) {
        debug("initialized");
    }

    async processChats(chats: ChatSummary[]): Promise<void> {
        if (chats.length > 0) {
            const lastUpdatedTimestamps = await this.api.getCachePrimerTimestamps();
            for (const chat of chats) {
                if (chat.membership.archived) continue;
                const lastUpdated = lastUpdatedTimestamps[chatIdentifierToString(chat.id)];
                if (lastUpdated === undefined || lastUpdated < chat.lastUpdated) {
                    this.pending.set(chat.id, chat);
                    debug("enqueued " + chat.id);
                }
            }

            if (this.pending.size > 0 && this.runner === undefined) {
                this.runner = new Poller(() => runOnceIdle(() => this.processNextBatch()), 0);
                debug("runner started");
            }
        }
    }

    async processNextBatch(): Promise<void> {
        try {
            const next = this.getNextBatch();
            if (next === undefined) {
                debug("queue empty");
                return;
            }

            const [localUserIndex, batch] = next;

            const responses = await this.getEventsBatch(localUserIndex, batch);

            const userIds = new Set<string>();
            for (const response of responses) {
                if (response.kind === "success") {
                    userIdsFromEvents(response.result.events).forEach((u) => userIds.add(u));
                }
            }

            if (userIds.size > 0) {
                const missing = missingUserIds(get(userStore), userIds);
                if (missing.length > 0) {
                    debug(`Loading ${missing.length} users`);
                    await this.api.getUsers(
                        { userGroups: [{ users: missing, updatedSince: BigInt(0) }] },
                        true,
                    );
                }
            }

            debug(`Batch of size ${batch.length} completed`);
        } finally {
            if (this.pending.size === 0) {
                this.runner?.stop();
                this.runner = undefined;
                debug("runner stopped");
            }
        }
    }

    private getNextBatch(): [string, ChatEventsArgs[]] | undefined {
        if (this.pending.size === 0) {
            return undefined;
        }
        const sorted = this.pending.values().sort(compareChats);
        const next = sorted[0];
        const batch = this.getEventsArgs(next);
        const localUserIndex = this.localUserIndex(next);

        this.pending.delete(next.id);

        for (let i = 1; i < sorted.length; i++) {
            const chat = sorted[i];
            if (this.localUserIndex(chat) === localUserIndex) {
                this.getEventsArgs(chat).forEach((args) => batch.push(args));
                this.pending.delete(chat.id);
                if (batch.length >= BATCH_SIZE) {
                    break;
                }
            }
        }

        return [localUserIndex, batch];
    }

    private getEventsArgs(chat: ChatSummary): ChatEventsArgs[] {
        const context = { chatId: chat.id };
        const latestKnownUpdate = chat.lastUpdated;

        const args = [] as ChatEventsArgs[];

        if (!chatIdentifiersEqual(get(this.api.selectedChatId), chat.id)) {
            const firstUnreadMessage = messagesRead.getFirstUnreadMessageIndex(
                chat.id,
                chat.latestMessage?.event.messageIndex,
            );
            if (firstUnreadMessage !== undefined) {
                args.push({
                    context,
                    args: {
                        kind: "window",
                        midPoint: firstUnreadMessage,
                        maxMessages: MAX_MESSAGES,
                        maxEvents: MAX_EVENTS,
                    },
                    latestKnownUpdate,
                });
            }
        }

        args.push({
            context,
            args: {
                kind: "page",
                maxMessages: MAX_MESSAGES,
                maxEvents: MAX_EVENTS,
                ascending: false,
                startIndex: chat.latestEventIndex,
            },
            latestKnownUpdate,
        });

        return args;
    }

    private getEventsBatch(
        localUserIndex: string,
        requests: ChatEventsArgs[],
    ): Promise<ChatEventsResponse[]> {
        return this.api.sendRequest({
            kind: "chatEventsBatch",
            localUserIndex,
            requests,
            cachePrimer: true,
        });
    }

    private localUserIndex(chat: ChatSummary): string {
        switch (chat.kind) {
            case "direct_chat":
                return this.userCanisterLocalUserIndex;
            case "group_chat":
                return chat.localUserIndex;
            case "channel":
                return this.api.localUserIndexForCommunity(chat.id.communityId);
        }
    }
}

function debug(message: string) {
    if (boolFromLS("openchat_cache_primer_debug_enabled", false)) {
        console.debug("CachePrimer - " + message);
    }
}
