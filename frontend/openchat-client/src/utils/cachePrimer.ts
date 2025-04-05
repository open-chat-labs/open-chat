import {
    type ChatEventsArgs,
    type ChatEventsResponse,
    type ChatSummary,
    MAX_MESSAGES,
    type Message,
    publish,
    type VideoCallContent,
} from "openchat-shared";
import {
    ChatMap,
    compareChats,
    missingUserIds,
    userIdsFromEvents,
    chatIdentifiersEqual,
    chatIdentifierToString,
} from "openchat-shared";
import { Poller } from "./poller";
import { boolFromLS } from "../stores/localStorageSetting";
import { messagesRead } from "../stores/markRead";
import { userStore } from "../stores/user";
import { get } from "svelte/store";
import type { OpenChat } from "../openchat";
import { runOnceIdle } from "./backgroundTasks";
import { isProposalsChat } from "./chat";
import { remoteVideoCallEndedEvent, remoteVideoCallStartedEvent } from "../events";
import { selectedChatId } from "../stores";

const BATCH_SIZE = 20;

export class CachePrimer {
    private pending: ChatMap<ChatSummary> = new ChatMap();
    private runner: Poller | undefined = undefined;

    constructor(
        private api: OpenChat,
        private userId: string,
        private userCanisterLocalUserIndex: string,
    ) {
        debug("initialized");
    }

    async processChats(chats: ChatSummary[]): Promise<void> {
        if (chats.length > 0) {
            const lastUpdatedTimestamps = await this.api.getCachePrimerTimestamps();
            for (const chat of chats) {
                const lastUpdated = lastUpdatedTimestamps[chatIdentifierToString(chat.id)];
                if (this.shouldEnqueueChat(chat, lastUpdated)) {
                    this.pending.set(chat.id, chat);
                    debug("enqueued " + chat.id);
                }
            }

            if (this.pending.size > 0 && this.runner === undefined) {
                this.runner = new Poller(() => runOnceIdle(() => this.processNextBatch()), 500);
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
            for (let i = 0; i < responses.length; i++) {
                const request = batch[i];
                const response = responses[i];

                if (response.kind === "success") {
                    userIdsFromEvents(response.result.events).forEach((u) => userIds.add(u));
                    response.result.events.forEach((e) => {
                        if (
                            e.event.kind === "message" &&
                            e.event.sender !== this.userId &&
                            e.event.content.kind === "video_call_content" &&
                            e.event.content.callType === "default"
                        ) {
                            if (e.event.content.ended === undefined) {
                                publish(
                                    "remoteVideoCallStarted",
                                    remoteVideoCallStartedEvent(
                                        request.context.chatId,
                                        this.userId,
                                        e.event as Message<VideoCallContent>,
                                        e.timestamp,
                                    ),
                                );
                            } else {
                                publish(
                                    "remoteVideoCallEnded",
                                    remoteVideoCallEndedEvent(e.event.messageId),
                                );
                            }
                        }
                    });
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
        const sorted = this.pending.values().sort(compareChats);
        const batch: ChatEventsArgs[] = [];
        let localUserIndexForBatch: string | undefined = undefined;

        for (const next of sorted) {
            const localUserIndex = this.localUserIndex(next);
            if (localUserIndex === undefined) {
                this.pending.delete(next.id);
                continue;
            }
            if (localUserIndexForBatch === undefined) {
                localUserIndexForBatch = localUserIndex;
            } else if (localUserIndex !== localUserIndexForBatch) {
                continue;
            }

            this.pending.delete(next.id);
            batch.push(...this.getEventsArgs(next));

            if (batch.length >= BATCH_SIZE) {
                break;
            }
        }

        return localUserIndexForBatch !== undefined ? [localUserIndexForBatch, batch] : undefined;
    }

    private getEventsArgs(chat: ChatSummary): ChatEventsArgs[] {
        const context = { chatId: chat.id };
        const latestKnownUpdate = chat.lastUpdated;
        const minVisible = "minVisibleEventIndex" in chat ? chat.minVisibleEventIndex : 0;
        const eventIndexRange: [number, number] = [minVisible, chat.latestEventIndex];

        const args = [] as ChatEventsArgs[];

        if (
            !chatIdentifiersEqual(get(selectedChatId), chat.id) &&
            messagesRead.unreadMessageCount(chat.id, chat.latestMessageIndex) > MAX_MESSAGES / 2
        ) {
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
                        eventIndexRange,
                    },
                    latestKnownUpdate,
                });
            }
        }

        args.push({
            context,
            args: {
                kind: "page",
                ascending: false,
                startIndex: chat.latestEventIndex,
                eventIndexRange,
            },
            latestKnownUpdate,
        });

        return args;
    }

    private getEventsBatch(
        localUserIndex: string,
        requests: ChatEventsArgs[],
    ): Promise<ChatEventsResponse[]> {
        return this.api.chatEventsBatch(localUserIndex, requests);
    }

    private localUserIndex(chat: ChatSummary): string | undefined {
        switch (chat.kind) {
            case "direct_chat":
                return this.userCanisterLocalUserIndex;
            case "group_chat":
                return chat.localUserIndex;
            case "channel":
                return this.api.cachedLocalUserIndexForCommunity(chat.id.communityId);
        }
    }

    private shouldEnqueueChat(chat: ChatSummary, lastUpdated: bigint | undefined): boolean {
        if (chat.membership.archived || isProposalsChat(chat)) return false;

        return lastUpdated === undefined || chat.lastUpdated > lastUpdated;
    }
}

function debug(message: string) {
    if (boolFromLS("openchat_cache_primer_debug_enabled", false)) {
        console.debug("CachePrimer - " + message);
    }
}
