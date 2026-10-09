import {
    type ChatEvent,
    type ChatEventsArgs,
    type ChatEventsArgsInner,
    type ChatEventsResponse,
    type ChatIdentifier,
    chatIdentifierToString,
    type ChatMap,
    type ChatSummary,
    type CommunitySummary,
    type DirectChatSummary,
    type EventWrapper,
    type GroupChatSummary,
    MAX_MESSAGES,
    type MultiUserChatIdentifier,
    ONE_MINUTE_MILLIS,
    ResponseTooLargeError,
    type UpdatedEvent,
    userIdsFromEvents,
} from "@shared";
import { chunk } from "./list";

const BATCH_SIZE = 20;
const FAILURE = { kind: "failure" };

export class CachePrimer {
    // chatId string -> chat waiting to be primed. A chat is queued once, holding its latest summary,
    // and the events to fetch are worked out when it is taken off the queue, so an update which
    // arrives while the chat is being fetched is queued for the next batch rather than lost
    #pending: Map<string, QueuedChat> = new Map();
    #usersLoaded: Set<string> = new Set();
    #jobActive: boolean = false;
    #proposalTalliesJobStarted: boolean = false;
    #blockedChats: Set<string> = new Set();
    // localUserIndex -> (chatId string -> chatId), keyed by string so each chat is tracked once
    #proposalChats: Map<string, Map<string, MultiUserChatIdentifier>> = new Map();
    #proposalTalliesTimer: ReturnType<typeof setTimeout> | undefined = undefined;
    #stopped: boolean = false;
    #isFirstIteration: boolean = true;

    constructor(
        private userCanisterLocalUserIndex: string,
        private eventIndexesLoadedUpTo: Record<string, number>,
        private getEventsBatch: (
            localUserIndex: string,
            requests: ChatEventsArgs[],
        ) => Promise<ChatEventsResponse[]>,
        private updateProposalTallies: (
            localUserIndex: string,
            chatIds: MultiUserChatIdentifier[],
        ) => Promise<void>,
        private loadUsers: (userIds: string[]) => Promise<void>,
        private saveEventIndexesLoadedUpTo: (indexes: Map<string, number>) => Promise<void>,
    ) {
        debug("initialized");
    }

    get isFirstIteration(): boolean {
        return this.#isFirstIteration;
    }

    // Stops the background jobs so a replaced/logged-out agent is not kept alive by their timers
    stop() {
        this.#stopped = true;
        clearTimeout(this.#proposalTalliesTimer);
        this.#proposalTalliesTimer = undefined;
        this.#pending.clear();
        this.#proposalChats.clear();
        debug("stopped");
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
        if (this.#stopped) return;

        if (directChatsRemoved?.length || groupsRemoved?.length || communitiesRemoved?.length) {
            const directRemoved = new Set(directChatsRemoved);
            const groupRemoved = new Set(groupsRemoved);
            const communityRemoved = new Set(communitiesRemoved);
            this.removeChats((c) => {
                switch (c.kind) {
                    case "direct_chat":
                        return directRemoved.has(c.userId);
                    case "group_chat":
                        return groupRemoved.has(c.groupId);
                    case "channel":
                        return communityRemoved.has(c.communityId);
                }
            });
        }

        directChats.forEach((c) =>
            this.processChat(c, this.userCanisterLocalUserIndex, updatedEvents?.get(c.id)),
        );
        groupChats.forEach((c) => this.processChat(c, c.localUserIndex, updatedEvents?.get(c.id)));
        for (const community of communities) {
            community.channels.forEach((c) =>
                this.processChat(c, community.localUserIndex, updatedEvents?.get(c.id)),
            );
        }

        debug("processed updated chats, queue length: " + this.#pending.size);

        if (!this.#jobActive && this.#pending.size > 0) {
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
        if (
            this.#blockedChats.has(chatIdString) ||
            (chat.kind === "channel" && chat.externalUrl !== undefined)
        ) {
            return;
        }

        if (chat.kind !== "direct_chat" && chat.subtype?.kind === "governance_proposals") {
            // Archived proposal chats aren't polled, an open proposals chat polls its own tallies
            if (chat.membership.archived) {
                this.#proposalChats.get(localUserIndex)?.delete(chatIdString);
            } else {
                let proposalChatIds = this.#proposalChats.get(localUserIndex);
                if (proposalChatIds === undefined) {
                    proposalChatIds = new Map();
                    this.#proposalChats.set(localUserIndex, proposalChatIds);
                }
                proposalChatIds.set(chatIdString, chat.id);
            }
        }

        // Thread events aren't primed
        const dirtyEventIndexes = new Set<number>();
        updatedEvents?.forEach((e) => {
            if (e.threadRootMessageIndex === undefined) dirtyEventIndexes.add(e.eventIndex);
        });

        const existing = this.#pending.get(chatIdString);
        existing?.dirtyEventIndexes.forEach((i) => dirtyEventIndexes.add(i));

        if (
            existing !== undefined ||
            dirtyEventIndexes.size > 0 ||
            this.getEventsArgs(chat, this.eventIndexesLoadedUpTo[chatIdString]) !== undefined
        ) {
            this.#pending.set(chatIdString, { chat, localUserIndex, dirtyEventIndexes });
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

            const responses = await this.fetchEvents(localUserIndex, batch);
            if (this.#stopped) return;

            const missingUserIds = new Set<string>();
            const loadedUpTo = new Map<string, number>();
            const loadRepliesBatch: ChatEventsArgs[] = [];

            for (let i = 0; i < responses.length; i++) {
                const request = batch[i];
                const response = responses[i];
                if (response.kind !== "success") continue;

                const { events } = response.result;
                this.collectMissingUsers(events, missingUserIds);

                const eventIndexes = new Set<number>();
                const repliesTo = new Set<number>();
                for (const event of events) {
                    eventIndexes.add(event.index);
                    if (
                        event.event.kind === "message" &&
                        event.event.repliesTo !== undefined &&
                        event.event.repliesTo.sourceContext === undefined
                    ) {
                        repliesTo.add(event.event.repliesTo.eventIndex);
                    }
                }

                // Only the page or window request moves the mark on. The events fetched by index
                // may lie beyond events which have not been loaded yet.
                if (request.args.kind !== "by_index") {
                    const chatIdString = chatIdentifierToString(request.context.chatId);
                    const maxEventIndex = Math.max(0, ...eventIndexes);
                    if (maxEventIndex > (this.eventIndexesLoadedUpTo[chatIdString] ?? 0)) {
                        this.eventIndexesLoadedUpTo[chatIdString] = maxEventIndex;
                        loadedUpTo.set(chatIdString, maxEventIndex);
                    }
                }

                // Most replies are to messages in the same page, which have just been loaded
                const repliesToLoad = [...repliesTo].filter((i) => !eventIndexes.has(i));
                if (repliesToLoad.length > 0) {
                    loadRepliesBatch.push({
                        context: request.context,
                        args: {
                            kind: "by_index",
                            events: repliesToLoad,
                        },
                        latestKnownUpdate: request.latestKnownUpdate,
                    });
                }
            }

            if (loadedUpTo.size > 0) {
                this.saveEventIndexesLoadedUpTo(loadedUpTo).catch((err) =>
                    debug(`failed to save the event indexes loaded up to: ${err}`),
                );
            }

            if (loadRepliesBatch.length > 0) {
                const repliesResponse = await this.fetchEvents(localUserIndex, loadRepliesBatch);
                if (this.#stopped) return;

                for (const response of repliesResponse) {
                    if (response.kind === "success") {
                        this.collectMissingUsers(response.result.events, missingUserIds);
                    }
                }
            }

            if (missingUserIds.size > 0) {
                debug(`loading ${missingUserIds.size} users`);
                const userIds = [...missingUserIds];
                this.loadUsers(userIds).catch((err) => {
                    // Leave them for a later batch to try again
                    userIds.forEach((u) => this.#usersLoaded.delete(u));
                    debug(`failed to load users: ${err}`);
                });
            }

            debug(`batch of size ${batch.length} completed`);
        } catch (err) {
            // Run from a timer, so an error would otherwise surface as an unhandled rejection
            debug(`batch failed: ${err}`);
        } finally {
            if (this.#stopped || this.#pending.size === 0) {
                debug("runner stopped");
                this.#jobActive = false;
            } else {
                setTimeout(() => this.processNextBatch(), 500);
            }
        }
    }

    // Takes the most recently updated chat off the queue, along with the next most recently updated
    // chats which share its LocalUserIndex, up to the batch size
    private getNextBatch(): [string, ChatEventsArgs[]] | undefined {
        const queued = [...this.#pending.values()].sort((a, b) =>
            a.chat.lastUpdated < b.chat.lastUpdated
                ? 1
                : a.chat.lastUpdated > b.chat.lastUpdated
                  ? -1
                  : 0,
        );

        const batch: ChatEventsArgs[] = [];
        let localUserIndexForBatch: string | undefined = undefined;

        for (const next of queued) {
            if (
                localUserIndexForBatch !== undefined &&
                next.localUserIndex !== localUserIndexForBatch
            ) {
                continue;
            }

            this.#pending.delete(chatIdentifierToString(next.chat.id));

            const requests = this.getRequests(next);
            if (requests.length === 0) continue;

            localUserIndexForBatch = next.localUserIndex;
            batch.push(...requests);

            if (batch.length >= BATCH_SIZE) {
                break;
            }
        }

        return localUserIndexForBatch !== undefined ? [localUserIndexForBatch, batch] : undefined;
    }

    // Worked out against what has been loaded so far, which may have moved on since the chat was queued
    private getRequests({ chat, dirtyEventIndexes }: QueuedChat): ChatEventsArgs[] {
        const context = { chatId: chat.id };
        const latestKnownUpdate = chat.lastUpdated;
        const eventsArgs = this.getEventsArgs(
            chat,
            this.eventIndexesLoadedUpTo[chatIdentifierToString(chat.id)],
        );

        const requests: ChatEventsArgs[] = [];
        if (eventsArgs !== undefined) {
            requests.push({ context, args: eventsArgs, latestKnownUpdate });
        }

        const dirty = [...dirtyEventIndexes].filter(
            (i) => eventsArgs === undefined || !fetchesEvent(eventsArgs, i),
        );
        if (dirty.length > 0) {
            requests.push({
                context,
                args: { kind: "by_index", events: dirty },
                latestKnownUpdate,
            });
        }
        return requests;
    }

    private getEventsArgs(
        chat: ChatSummary,
        eventIndexLoadedUpTo: number | undefined,
    ): ChatEventsArgsInner | undefined {
        if (chat.membership.archived || (eventIndexLoadedUpTo ?? 0) >= chat.latestEventIndex) {
            return undefined;
        }

        const minVisibleEventIndex = chat.kind === "direct_chat" ? 0 : chat.minVisibleEventIndex;
        const eventIndexRange: [number, number] = [minVisibleEventIndex, chat.latestEventIndex];
        const earliestMissingEvent =
            eventIndexLoadedUpTo === undefined
                ? minVisibleEventIndex
                : Math.max(minVisibleEventIndex, eventIndexLoadedUpTo + 1);

        if (chat.latestEventIndex - earliestMissingEvent < MAX_MESSAGES) {
            return {
                kind: "page",
                ascending: true,
                startIndex: earliestMissingEvent,
                eventIndexRange,
            };
        }

        const readByMeUpTo = chat.membership.readByMeUpTo ?? 0;
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
                    const chatIdString = chatIdentifierToString(batch[0].context.chatId);
                    this.#blockedChats.add(chatIdString);
                    this.#pending.delete(chatIdString);
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

    private collectMissingUsers(events: EventWrapper<ChatEvent>[], into: Set<string>) {
        for (const userId of userIdsFromEvents(events).userIds) {
            if (!this.#usersLoaded.has(userId)) {
                this.#usersLoaded.add(userId);
                into.add(userId);
            }
        }
    }

    private async processProposalTallies() {
        try {
            for (const [localUserIndex, chatIds] of this.#proposalChats) {
                for (const batch of chunk([...chatIds.values()], 10)) {
                    if (this.#stopped) return;
                    await this.updateProposalTallies(localUserIndex, batch);
                }
            }
        } catch (err) {
            // Background refresh: failures (session expiry, gateway 5xx) are retried on the
            // next tick and must not surface as unhandled rejections
            debug(`failed to refresh proposal tallies: ${err}`);
        } finally {
            if (!this.#stopped) {
                this.#proposalTalliesTimer = setTimeout(
                    () => this.processProposalTallies(),
                    ONE_MINUTE_MILLIS,
                );
            }
        }
    }

    private removeChats(isRemoved: (chatId: ChatIdentifier) => boolean) {
        for (const [key, { chat }] of this.#pending) {
            if (isRemoved(chat.id)) this.#pending.delete(key);
        }
        for (const chatIds of this.#proposalChats.values()) {
            for (const [key, chatId] of chatIds) {
                if (isRemoved(chatId)) chatIds.delete(key);
            }
        }
    }
}

// Whether the page request is sure to return the event, so it needn't be fetched again by index
function fetchesEvent(eventsArgs: ChatEventsArgsInner, eventIndex: number): boolean {
    switch (eventsArgs.kind) {
        case "page": {
            const { startIndex } = eventsArgs;
            return eventsArgs.ascending
                ? eventIndex >= startIndex && eventIndex < startIndex + MAX_MESSAGES
                : eventIndex <= startIndex && eventIndex > startIndex - MAX_MESSAGES;
        }
        case "window":
            return false;
        case "by_index":
            return eventsArgs.events.includes(eventIndex);
    }
}

function debug(message: string) {
    console.debug("CachePrimer - " + message);
}

type QueuedChat = {
    chat: ChatSummary;
    localUserIndex: string;
    dirtyEventIndexes: Set<number>;
};
