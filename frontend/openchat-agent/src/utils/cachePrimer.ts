import {
    type ChatEventsArgs,
    type ChatEventsResponse, type ChatIdentifier,
    chatIdentifierToString,
    type ChatStateFull,
    type ChatSummary,
    isProposalsChat,
    MAX_MESSAGES,
    userIdsFromEvents,
} from "openchat-shared";

const BATCH_SIZE = 20;

export class CachePrimer {
    private pending: QueuedChat[] = [];
    private usersLoaded: Set<string> = new Set<string>();
    private jobActive: boolean = false;
    private inProgress: Set<string> = new Set<string>();

    constructor(
        private userCanisterLocalUserIndex: string,
        private lastUpdatedTimestamps: Record<string, bigint>,
        private getEventsBatch: (localUserIndex: string, requests: ChatEventsArgs[]) => Promise<ChatEventsResponse[]>,
        private loadUsers: (userIds: string[]) => void
    ) {
        debug("initialized");
    }

    processState(state: ChatStateFull) {
        this.pending = [];

        state.directChats.forEach((c) => this.processChat(c, this.userCanisterLocalUserIndex));
        state.groupChats.forEach((c) => this.processChat(c, c.localUserIndex));
        for (const community of state.communities) {
            community.channels.forEach((c) => this.processChat(c, community.localUserIndex));
        }

        debug("Processed state, queue length: " + this.pending.length);

        if (!this.jobActive && this.pending.length > 0) {
            this.jobActive = true;
            // Sort by `lastUpdated` ascending
            this.pending.sort((a, b) => a.lastUpdated > b.lastUpdated ? 1 : -1);
            setTimeout(() => this.processNextBatch(), 0);
        }
    }

    private processChat(chat: ChatSummary, localUserIndex: string) {
        const chatIdString = chatIdentifierToString(chat.id);
        if (this.inProgress.has(chatIdString)) {
            return;
        }

        const lastUpdated = this.lastUpdatedTimestamps[chatIdString];
        if (this.shouldEnqueueChat(chat, lastUpdated)) {
            this.pending.push(normalizeChat(chat, localUserIndex));
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

            const responses = await this.getEventsBatch(localUserIndex, batch);

            const userIds = new Set<string>();
            for (let i = 0; i < responses.length; i++) {
                const request = batch[i];
                const response = responses[i];

                if (response.kind === "success") {
                    if (request.latestKnownUpdate !== undefined) {
                        this.lastUpdatedTimestamps[chatIdentifierToString(request.context.chatId)] = request.latestKnownUpdate;
                    }

                    for (const userId of userIdsFromEvents(response.result.events)) {
                        if (!this.usersLoaded.has(userId)) {
                            this.usersLoaded.add(userId);
                            userIds.add(userId);
                        }
                    }
                }
            }

            if (userIds.size > 0) {
                debug(`Loading ${userIds.size} users`);
                this.loadUsers([...userIds]);
            }

            debug(`Batch of size ${batch.length} completed`);
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

    private shouldEnqueueChat(chat: ChatSummary, lastUpdated: bigint | undefined): boolean {
        if (chat.membership.archived || isProposalsChat(chat)) return false;

        return lastUpdated === undefined || chat.lastUpdated > lastUpdated;
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