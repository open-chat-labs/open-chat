import DRange from "drange";
import {
    emptyRules,
    type ChatEvent,
    type ChatIdentifier,
    type EventWrapper,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type VersionedRules,
} from "openchat-shared";

export class ChatDetailsServerState {
    #events = $state<EventWrapper<ChatEvent>[]>([]);
    #expiredEventRanges = $state<DRange>(new DRange());
    #confirmedEventIndexesLoaded = $derived.by(() => {
        const ranges = new DRange();
        this.#events.forEach((e) => ranges.add(e.index));
        ranges.add(this.#expiredEventRanges);
        return ranges;
    });

    constructor(
        readonly chatId: ChatIdentifier | undefined,
        readonly members: Map<string, Member>,
        readonly lapsedMembers: Set<string>,
        readonly blockedUsers: Set<string>,
        readonly invitedUsers: Set<string>,
        readonly pinnedMessages: Set<number>,
        readonly rules: VersionedRules,
        readonly bots: Map<string, ExternalBotPermissions>,
        readonly apiKeys: Map<string, PublicApiKeyDetails>,
    ) {}

    get isEmpty() {
        return this.chatId === undefined;
    }

    get confirmedEventIndexesLoaded() {
        return this.#confirmedEventIndexesLoaded;
    }

    get events() {
        return this.#events;
    }

    get expiredEventRanges() {
        return this.#expiredEventRanges;
    }

    updateEvents(fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[]) {
        this.#events = fn(this.#events);
    }

    updateExpiredEventRanges(fn: (existing: DRange) => DRange) {
        this.#expiredEventRanges = fn(this.#expiredEventRanges);
    }

    clearEvents() {
        this.#events = [];
        this.#expiredEventRanges = new DRange();
    }

    static empty(chatId?: ChatIdentifier) {
        return new ChatDetailsServerState(
            chatId,
            new Map(),
            new Set(),
            new Set(),
            new Set(),
            new Set(),
            emptyRules(),
            new Map(),
            new Map(),
        );
    }
}
