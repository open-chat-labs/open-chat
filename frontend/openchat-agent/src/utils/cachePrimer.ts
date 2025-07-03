import {
    type ChatEventsArgs,
    type ChatEventsResponse,
    type ChatIdentifier,
    chatIdentifierToString,
    type ChatStateFull,
    type ChatSummary,
    MAX_MESSAGES,
    type MultiUserChatIdentifier,
    ResponseTooLargeError,
    userIdsFromEvents,
} from "openchat-shared";

const BATCH_SIZE = 20;
const FAILURE = { kind: "failure" };

export class CachePrimer {
    private pending: QueuedChat[] = [];
    private usersLoaded: Set<string> = new Set();
    private jobActive: boolean = false;
    private proposalTalliesJobActive: boolean = false;
    private inProgress: Set<string> = new Set();
    private blockedChats: Set<string> = new Set();
    private proposalChats: Map<string, MultiUserChatIdentifier[]> = new Map();

    constructor(
        private userCanisterLocalUserIndex: string,
        private lastUpdatedTimestamps: Record<string, bigint>,
        private getEventsBatch: (localUserIndex: string, requests: ChatEventsArgs[]) => Promise<ChatEventsResponse[]>,
        private updateProposalTallies: (localUserIndex: string, chatIds: MultiUserChatIdentifier[]) => Promise<void>,
        private loadUsers: (userIds: string[]) => void
    ) {
        debug("initialized");
    }

    processState(state: ChatStateFull) {
        this.pending = [];
        this.proposalChats.clear();

        state.directChats.forEach((c) => this.processChat(c, this.userCanisterLocalUserIndex));
        state.groupChats.forEach((c) => this.processChat(c, c.localUserIndex));
        for (const community of state.communities) {
            community.channels.forEach((c) => this.processChat(c, community.localUserIndex));
        }

        debug("processed state, queue length: " + this.pending.length);

        if (!this.jobActive && this.pending.length > 0) {
            this.jobActive = true;
            // Sort by `lastUpdated` ascending
            this.pending.sort((a, b) => a.lastUpdated > b.lastUpdated ? 1 : -1);
            setTimeout(() => this.processNextBatch(), 0);
        }

        if (!this.proposalTalliesJobActive && this.proposalChats.size > 0) {
            this.proposalTalliesJobActive = true;
            this.processProposalTallies();
        }
    }

    private processChat(chat: ChatSummary, localUserIndex: string) {
        const chatIdString = chatIdentifierToString(chat.id);
        if (this.inProgress.has(chatIdString) || this.blockedChats.has(chatIdString)) {
            return;
        }

        const lastUpdated = this.lastUpdatedTimestamps[chatIdString];
        if (this.shouldEnqueueChat(chat, lastUpdated)) {
            this.pending.push(normalizeChat(chat, localUserIndex));
        }

        if (chat.kind !== "direct_chat" && chat.subtype?.kind === "governance_proposals") {
            let proposalChatIds = this.proposalChats.get(localUserIndex);
            if (proposalChatIds === undefined) {
                proposalChatIds = [];
                this.proposalChats.set(localUserIndex, proposalChatIds);
            }
            proposalChatIds.push(chat.id);
        }
    }

    async processNextBatch(): Promise<void> {
        try {
            const next = this.getNextBatch();
            if (next === undefined) {
                this.pending = [];
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
                        this.lastUpdatedTimestamps[chatIdentifierToString(request.context.chatId)] = request.latestKnownUpdate;
                    }

                    const { userIds } = userIdsFromEvents(response.result.events);
                    for (const userId of userIds) {
                        if (!this.usersLoaded.has(userId)) {
                            this.usersLoaded.add(userId);
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
                                events: [...repliesToLoad]
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
                            if (!this.usersLoaded.has(userId)) {
                                this.usersLoaded.add(userId);
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
            this.inProgress.clear();
            if (this.pending.length === 0) {
                debug("runner stopped");
                this.jobActive = false;
            } else {
                setTimeout(() => this.processNextBatch(), 500);
            }
        }
    }

    private getNextBatch(): [string, ChatEventsArgs[]] | undefined {
        const batch: ChatEventsArgs[] = [];
        let localUserIndexForBatch: string | undefined = undefined;

        // Iterate backwards to reduce the number of items having to be moved each time we `splice` the array
        for (let i = this.pending.length - 1; i >= 0; i--) {
            const next = this.pending[i];

            if (localUserIndexForBatch === undefined) {
                localUserIndexForBatch = next.localUserIndex;
            } else if (next.localUserIndex !== localUserIndexForBatch) {
                continue;
            }

            this.pending.splice(i, 1);
            this.inProgress.add(chatIdentifierToString(next.chatId));

            batch.push(...this.getEventsArgs(next));

            if (batch.length >= BATCH_SIZE) {
                break;
            }
        }

        return localUserIndexForBatch !== undefined ? [localUserIndexForBatch, batch] : undefined;
    }

    private getEventsArgs(chat: QueuedChat): ChatEventsArgs[] {
        const context = { chatId: chat.chatId };
        const latestKnownUpdate = chat.lastUpdated;
        const eventIndexRange: [number, number] = [chat.minVisibleEventIndex, chat.latestEventIndex];
        const unreadCount = chat.latestMessageIndex - chat.readByMeUpTo;
        const args = [] as ChatEventsArgs[];

        if (unreadCount > MAX_MESSAGES / 2) {
            args.push({
                context,
                args: {
                    kind: "window",
                    midPoint: chat.readByMeUpTo + 1,
                    eventIndexRange,
                },
                latestKnownUpdate,
            });
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

    // Get events for a batch of chats, if the response fails because it is too large, retry each request individually,
    // if any responses are still too large, mark those chats as blocked to avoid retrying them indefinitely.
    private async fetchEvents(localUserIndex: string, batch: ChatEventsArgs[]): Promise<ChatEventsResponse[]> {
        try {
            return await this.getEventsBatch(localUserIndex, batch);
        } catch (error) {
            if (error instanceof ResponseTooLargeError) {
                if (batch.length === 1) {
                    // Block this chat to avoid retrying it indefinitely
                    this.blockedChats.add(chatIdentifierToString(batch[0].context.chatId));
                } else {
                    // Split the batch into individual requests and try again
                    return (await Promise.all(batch.map((args) => this.fetchEvents(localUserIndex, [args])))).flat();
                }
            }
            return Array(batch.length).fill(FAILURE);
        }
    }

    private async processProposalTallies() {
        try {
            for (const [localUserIndex, chatIds] of this.proposalChats) {
                await this.updateProposalTallies(localUserIndex, chatIds);
            }
        } finally {
            setTimeout(() => this.processNextBatch(), 60_000);
        }
    }

    private shouldEnqueueChat(chat: ChatSummary, lastUpdated: bigint | undefined): boolean {
        return !chat.membership.archived && (lastUpdated === undefined || chat.lastUpdated > lastUpdated);
    }
}

function debug(message: string) {
    console.debug("CachePrimer - " + message);
}

function normalizeChat(chat: ChatSummary, localUserIndex: string): QueuedChat {
    return {
        chatId: chat.id,
        kind: chat.kind,
        localUserIndex,
        lastUpdated: chat.lastUpdated,
        latestEventIndex: chat.latestEventIndex,
        latestMessageIndex: chat.latestMessageIndex ?? 0,
        readByMeUpTo: chat.membership.readByMeUpTo ?? 0,
        minVisibleEventIndex: chat.kind === "direct_chat" ? 0 : chat.minVisibleEventIndex,
    };
}

type QueuedChat = {
    chatId: ChatIdentifier;
    kind: ChatSummary["kind"];
    localUserIndex: string;
    lastUpdated: bigint;
    latestEventIndex: number;
    latestMessageIndex: number;
    readByMeUpTo: number;
    minVisibleEventIndex: number;
}