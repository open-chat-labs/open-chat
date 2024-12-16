import {
    type ChatEventsArgs,
    type ChatEventsResponse,
    type ChatSummary,
    MAX_MESSAGES,
    type Message,
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
import { RemoteVideoCallEndedEvent, RemoteVideoCallStartedEvent } from "../events";
import { selectedChatId } from "../stores";

const BATCH_SIZE = 20;

export class CachePrimer {
    private pending: ChatMap<ChatSummary> = new ChatMap();
    private runner: Poller | undefined = undefined;

    constructor(
        private api: OpenChat,
        private userId: string,
        private userCanisterLocalUserIndex: string,
        private onVideoStart: (ev: RemoteVideoCallStartedEvent) => void,
        private onVideoEnded: (ev: RemoteVideoCallEndedEvent) => void,
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
                                this.onVideoStart(
                                    RemoteVideoCallStartedEvent.create(
                                        request.context.chatId,
                                        this.userId,
                                        e.event as Message<VideoCallContent>,
                                        e.timestamp,
                                    ),
                                );
                            } else {
                                this.onVideoEnded(new RemoteVideoCallEndedEvent(e.event.messageId));
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
