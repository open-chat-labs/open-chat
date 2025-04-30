import DRange from "drange";
import {
    chatIdentifiersEqual,
    emptyRules,
    type ChatEvent,
    type ChatIdentifier,
    type EventWrapper,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type ReadonlyMap,
    type ReadonlySet,
    type VersionedRules,
} from "openchat-shared";

// TODO I think we probably need a SelectedThread class that contains the thread events and the message context
// so that we can be sure that we are not accepting events for the wrong thread. At the moment this *might* be possible

export class ChatDetailsServerState {
    #chatId = $state<ChatIdentifier | undefined>();
    #members = $state<ReadonlyMap<string, Member>>(new Map());
    #lapsedMembers = $state<ReadonlySet<string>>(new Set());
    #blockedUsers = $state<ReadonlySet<string>>(new Set());
    #invitedUsers = $state<ReadonlySet<string>>(new Set());
    #pinnedMessages = $state<ReadonlySet<number>>(new Set());
    #rules = $state<VersionedRules>(emptyRules());
    #bots = $state<ReadonlyMap<string, ExternalBotPermissions>>(new Map());
    #apiKeys = $state<ReadonlyMap<string, PublicApiKeyDetails>>(new Map());
    #events = $state<EventWrapper<ChatEvent>[]>([]);
    #threadEvents = $state<EventWrapper<ChatEvent>[]>([]);
    #expiredEventRanges = $state<DRange>(new DRange());
    #confirmedEventIndexesLoaded = $derived.by(() => {
        const ranges = new DRange();
        this.#events.forEach((e) => ranges.add(e.index));
        ranges.add(this.#expiredEventRanges);
        return ranges;
    });
    #confirmedThreadEventIndexesLoaded = $derived.by(() => {
        const ranges = new DRange();
        this.#threadEvents.forEach((e) => ranges.add(e.index));
        return ranges;
    });

    constructor(chatId?: ChatIdentifier) {
        this.#chatId = chatId;
    }

    get chatId() {
        return this.#chatId;
    }

    get members() {
        return this.#members;
    }

    get lapsedMembers() {
        return this.#lapsedMembers;
    }

    get blockedUsers() {
        return this.#blockedUsers;
    }

    get invitedUsers() {
        return this.#invitedUsers;
    }

    get pinnedMessages() {
        return this.#pinnedMessages;
    }

    get rules() {
        return this.#rules;
    }

    get bots() {
        return this.#bots;
    }

    get apiKeys() {
        return this.#apiKeys;
    }

    get isEmpty() {
        return this.chatId === undefined;
    }

    get confirmedEventIndexesLoaded() {
        return this.#confirmedEventIndexesLoaded;
    }

    get confirmedThreadEventIndexesLoaded() {
        return this.#confirmedThreadEventIndexesLoaded;
    }

    get events() {
        return this.#events;
    }

    get threadEvents() {
        return this.#threadEvents;
    }

    get expiredEventRanges() {
        return this.#expiredEventRanges;
    }

    updateEvents(
        chatId: ChatIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        if (!chatIdentifiersEqual(chatId, this.#chatId)) {
            throw new Error("We should not be getting events for the wrong chat - investigate");
        }
        this.#events = fn(this.#events);
    }

    updateThreadEvents(
        chatId: ChatIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        if (!chatIdentifiersEqual(chatId, this.#chatId)) {
            throw new Error(
                "We should not be getting thread events for the wrong chat - investigate",
            );
        }
        this.#threadEvents = fn(this.#threadEvents);
    }

    updateExpiredEventRanges(fn: (existing: DRange) => DRange) {
        this.#expiredEventRanges = fn(this.#expiredEventRanges);
    }

    clearEvents() {
        this.#events = [];
        this.#expiredEventRanges = new DRange();
    }

    clearThreadEvents() {
        this.#threadEvents = [];
    }

    overwriteChatDetails(
        chatId: ChatIdentifier,
        members: Map<string, Member>,
        lapsedMembers: Set<string>,
        blockedUsers: Set<string>,
        invitedUsers: Set<string>,
        pinnedMessages: Set<number>,
        rules: VersionedRules,
        bots: Map<string, ExternalBotPermissions>,
        apiKeys: Map<string, PublicApiKeyDetails>,
    ) {
        this.#chatId = chatId;
        this.#members = members;
        this.#lapsedMembers = lapsedMembers;
        this.#blockedUsers = blockedUsers;
        this.#invitedUsers = invitedUsers;
        this.#pinnedMessages = pinnedMessages;
        this.#rules = rules;
        this.#bots = bots;
        this.#apiKeys = apiKeys;
    }

    static empty(chatId?: ChatIdentifier) {
        return new ChatDetailsServerState(chatId);
    }
}
