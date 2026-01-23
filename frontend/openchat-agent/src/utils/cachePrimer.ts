import {
    type ChatEventsArgs,
    type ChatEventsArgsInner,
    type ChatEventsResponse,
    type ChatIdentifier,
    chatIdentifiersEqual,
    chatIdentifierToString,
    type ChatMap,
    type ChatSummary,
    type CommunitySummary,
    type DirectChatSummary,
    type GroupChatSummary,
    MAX_MESSAGES,
    type MultiUserChatIdentifier,
    ONE_MINUTE_MILLIS,
    ResponseTooLargeError,
    retain,
    type UpdatedEvent,
    userIdsFromEvents,
} from "openchat-shared";

const BATCH_SIZE = 20;
const FAILURE = { kind: "failure" };

export class CachePrimer {
    #pending: QueuedChat[] = [];
    #usersLoaded: Set<string> = new Set();
    #jobActive: boolean = false;
    #proposalTalliesJobStarted: boolean = false;
    #inProgress: Set<string> = new Set();
    #blockedChats: Set<string> = new Set();
    #proposalChats: Map<string, MultiUserChatIdentifier[]> = new Map();
    #isFirstIteration: boolean = true;

    constructor(
        private userCanisterLocalUserIndex: string,
        private lastUpdatedTimestamps: Record<string, bigint>,
        private getEventsBatch: (
            localUserIndex: string,
            requests: ChatEventsArgs[],
        ) => Promise<ChatEventsResponse[]>,
        private updateProposalTallies: (
            localUserIndex: string,
            chatIds: MultiUserChatIdentifier[],
        ) => Promise<void>,
        private loadUsers: (userIds: string[]) => void,
    ) {
        debug("initialized");
    }

    get isFirstIteration(): boolean {
        return this.#isFirstIteration;
    }

    processUpdates(
        directChats: DirectChatSummary[],
        groupChats: GroupChatSummary[],
        communities: CommunitySummary[],
        updatedEvents?: ChatMap<UpdatedEvent[]>,
        directChatsRemoved?: string[],
        groupsRemoved?: string[],
        communitiesRemoved?: string[],
    ) {
        directChatsRemoved?.forEach((userId) =>
            this.removeFromPending((c) => c.kind === "direct_chat" && c.userId === userId),
        );
        groupsRemoved?.forEach((groupId) =>
            this.removeFromPending((c) => c.kind === "group_chat" && c.groupId === groupId),
        );
        communitiesRemoved?.forEach((communityId) =>
            this.removeFromPending((c) => c.kind === "channel" && c.communityId === communityId),
        );

        directChats.forEach((c) =>
            this.processChat(c, this.userCanisterLocalUserIndex, updatedEvents?.get(c.id)),
        );
        groupChats.forEach((c) => this.processChat(c, c.localUserIndex, updatedEvents?.get(c.id)));
        for (const community of communities) {
            community.channels.forEach((c) =>
                this.processChat(c, community.localUserIndex, updatedEvents?.get(c.id)),
            );
        }

        debug("processed updated chats, queue length: " + this.#pending.length);

        // Sort by `lastUpdated` ascending
        this.#pending.sort((a, b) => (a.lastUpdated > b.lastUpdated ? 1 : -1));

        if (!this.#jobActive && this.#pending.length > 0) {
            this.#jobActive = true;
            setTimeout(() => this.processNextBatch(), 0);
        }

        if (!this.#proposalTalliesJobStarted && this.#proposalChats.size > 0) {
            this.#proposalTalliesJobStarted = true;
            this.processProposalTallies();
        }

        this.#isFirstIteration = false;
    }

    private processChat(
        chat: ChatSummary,
        localUserIndex: string,
        updatedEvents: UpdatedEvent[] | undefined,
    ) {
        const chatIdString = chatIdentifierToString(chat.id);
        if (this.#inProgress.has(chatIdString) || this.#blockedChats.has(chatIdString)) {
            return;
        }

        if (chat.kind !== "direct_chat" && chat.subtype?.kind === "governance_proposals") {
            let proposalChatIds = this.#proposalChats.get(localUserIndex);
            if (proposalChatIds === undefined) {
                proposalChatIds = [];
                this.#proposalChats.set(localUserIndex, proposalChatIds);
            }
            proposalChatIds.push(chat.id);
        }

        const cacheLastUpdated = this.lastUpdatedTimestamps[chatIdString];
        const eventsArgs = this.getEventsArgs(chat, cacheLastUpdated);
        const dirtyEventIndexes =
            (updatedEvents?.length ?? 0) > 0
                ? updatedEvents
                      ?.filter((e) => e.threadRootMessageIndex === undefined)
                      .map((e) => e.eventIndex)
                : undefined;

        if (eventsArgs === undefined && dirtyEventIndexes === undefined) {
            return;
        }

        if (!this.#isFirstIteration) {
            const existing = this.#pending.find((c) => chatIdentifiersEqual(c.chatId, chat.id));
            if (existing !== undefined) {
                existing.eventsArgs = eventsArgs;

                const combinedDirtyEventIndexes = new Set<number>();
                existing.dirtyEventIndexes?.forEach((i) => combinedDirtyEventIndexes.add(i));
                dirtyEventIndexes?.forEach((i) => combinedDirtyEventIndexes.add(i));

                if (combinedDirtyEventIndexes.size > 0) {
                    existing.dirtyEventIndexes = [...combinedDirtyEventIndexes];
                }
                return;
            }
        }
        this.#pending.push({
            chatId: chat.id,
            localUserIndex,
            lastUpdated: chat.lastUpdated,
            eventsArgs,
            dirtyEventIndexes,
        });
    }

    async processNextBatch(): Promise<void> {
        try {
            const next = this.getNextBatch();
            if (next === undefined) {
                this.#pending = [];
                debug("queue empty");
                return;
            }

            const [localUserIndex, batch] = next;

            const responses = await this.fetchEvents(localUserIndex, batch);

            const userIds = new Set<string>();
            const loadRepliesBatch: ChatEventsArgs[] = [];

            for (let i = 0; i < responses.length; i++) {
                const request = batch[i];
                const response = responses[i];

                if (response.kind === "success") {
                    if (request.latestKnownUpdate !== undefined) {
                        this.lastUpdatedTimestamps[chatIdentifierToString(request.context.chatId)] =
                            request.latestKnownUpdate;
                    }

                    const { userIds } = userIdsFromEvents(response.result.events);
                    for (const userId of userIds) {
                        if (!this.#usersLoaded.has(userId)) {
                            this.#usersLoaded.add(userId);
                            userIds.add(userId);
                        }
                    }

                    const repliesToLoad = new Set<number>();
                    for (const event of response.result.events) {
                        if (event.event.kind === "message") {
                            const repliesTo = event.event.repliesTo;
                            if (repliesTo !== undefined && repliesTo.sourceContext === undefined) {
                                repliesToLoad.add(repliesTo.eventIndex);
                            }
                        }
                    }

                    if (repliesToLoad.size > 0) {
                        loadRepliesBatch.push({
                            context: request.context,
                            args: {
                                kind: "by_index",
                                events: [...repliesToLoad],
                            },
                            latestKnownUpdate: request.latestKnownUpdate,
                        });
                    }
                }
            }

            if (loadRepliesBatch.length > 0) {
                const repliesResponse = await this.fetchEvents(localUserIndex, loadRepliesBatch);

                for (const response of repliesResponse) {
                    if (response.kind === "success") {
                        const { userIds } = userIdsFromEvents(response.result.events);
                        for (const userId of userIds) {
                            if (!this.#usersLoaded.has(userId)) {
                                this.#usersLoaded.add(userId);
                                userIds.add(userId);
                            }
                        }
                    }
                }
            }

            if (userIds.size > 0) {
                debug(`loading ${userIds.size} users`);
                this.loadUsers([...userIds]);
            }

            debug(`batch of size ${batch.length} completed`);
        } finally {
            this.#inProgress.clear();
            if (this.#pending.length === 0) {
                debug("runner stopped");
                this.#jobActive = false;
            } else {
                setTimeout(() => this.processNextBatch(), 500);
            }
        }
    }

    private getNextBatch(): [string, ChatEventsArgs[]] | undefined {
        const batch: ChatEventsArgs[] = [];
        let localUserIndexForBatch: string | undefined = undefined;

        // Iterate backwards to reduce the number of items having to be moved each time we `splice` the array
        for (let i = this.#pending.length - 1; i >= 0; i--) {
            const next = this.#pending[i];

            if (localUserIndexForBatch === undefined) {
                localUserIndexForBatch = next.localUserIndex;
            } else if (next.localUserIndex !== localUserIndexForBatch) {
                continue;
            }

            this.#pending.splice(i, 1);
            this.#inProgress.add(chatIdentifierToString(next.chatId));

            const context = { chatId: next.chatId };
            const latestKnownUpdate = next.lastUpdated;

            if (next.eventsArgs !== undefined) {
                batch.push({
                    context,
                    args: next.eventsArgs,
                    latestKnownUpdate,
                });
            }
            if (next.dirtyEventIndexes !== undefined) {
                batch.push({
                    context,
                    args: {
                        kind: "by_index",
                        events: next.dirtyEventIndexes,
                    },
                    latestKnownUpdate,
                });
            }

            if (batch.length >= BATCH_SIZE) {
                break;
            }
        }

        return localUserIndexForBatch !== undefined ? [localUserIndexForBatch, batch] : undefined;
    }

    private getEventsArgs(
        chat: ChatSummary,
        cacheLastUpdated: bigint | undefined,
    ): ChatEventsArgsInner | undefined {
        if (chat.membership.archived || (cacheLastUpdated ?? 0) >= chat.lastUpdated) {
            return undefined;
        }

        const minVisibleEventIndex = chat.kind === "direct_chat" ? 0 : chat.minVisibleEventIndex;
        const readByMeUpTo = chat.membership.readByMeUpTo ?? 0;
        const eventIndexRange: [number, number] = [minVisibleEventIndex, chat.latestEventIndex];
        const unreadCount = (chat.latestMessageIndex ?? 0) - readByMeUpTo;

        if (unreadCount > MAX_MESSAGES / 2) {
            return {
                kind: "window",
                midPoint: readByMeUpTo + 1,
                eventIndexRange,
            };
        } else {
            return {
                kind: "page",
                ascending: false,
                startIndex: chat.latestEventIndex,
                eventIndexRange,
            };
        }
    }

    // Get events for a batch of chats, if the response fails because it is too large, retry each request individually,
    // if any responses are still too large, mark those chats as blocked to avoid retrying them indefinitely.
    private async fetchEvents(
        localUserIndex: string,
        batch: ChatEventsArgs[],
    ): Promise<ChatEventsResponse[]> {
        try {
            return await this.getEventsBatch(localUserIndex, batch);
        } catch (error) {
            if (error instanceof ResponseTooLargeError) {
                if (batch.length === 1) {
                    // Block this chat to avoid retrying it indefinitely
                    this.#blockedChats.add(chatIdentifierToString(batch[0].context.chatId));
                } else {
                    // Split the batch into individual requests and try again
                    return (
                        await Promise.all(
                            batch.map((args) => this.fetchEvents(localUserIndex, [args])),
                        )
                    ).flat();
                }
            }
            return Array(batch.length).fill(FAILURE);
        }
    }

    private async processProposalTallies() {
        try {
            for (const [localUserIndex, chatIds] of this.#proposalChats) {
                await this.updateProposalTallies(localUserIndex, chatIds);
            }
        } finally {
            setTimeout(() => this.processProposalTallies(), ONE_MINUTE_MILLIS);
        }
    }

    private removeFromPending(excludeFn: (value: ChatIdentifier) => boolean) {
        retain(this.#pending, (c) => !excludeFn(c.chatId));
    }
}

function debug(message: string) {
    console.debug("CachePrimer - " + message);
}

type QueuedChat = {
    chatId: ChatIdentifier;
    localUserIndex: string;
    lastUpdated: bigint;
    eventsArgs?: ChatEventsArgsInner;
    dirtyEventIndexes?: number[];
};
