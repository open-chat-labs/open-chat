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
    type ThreadIdentifier,
    type VersionedRules,
    type WebhookDetails,
} from "openchat-shared";
import { ThreadServerState } from "../thread/server.svelte";

export class ChatDetailsServerState {
    #thread = $state<ThreadServerState | undefined>();
    #chatId = $state<ChatIdentifier | undefined>();
    #members = $state<ReadonlyMap<string, Member>>(new Map());
    #lapsedMembers = $state<ReadonlySet<string>>(new Set());
    #blockedUsers = $state<ReadonlySet<string>>(new Set());
    #invitedUsers = $state<ReadonlySet<string>>(new Set());
    #pinnedMessages = $state<ReadonlySet<number>>(new Set());
    #rules = $state<VersionedRules>(emptyRules());
    #bots = $state<ReadonlyMap<string, ExternalBotPermissions>>(new Map());
    #apiKeys = $state<ReadonlyMap<string, PublicApiKeyDetails>>(new Map());
    #webhooks = $state<WebhookDetails[]>([]);
    #events = $state<EventWrapper<ChatEvent>[]>([]);
    #expiredEventRanges = $state<DRange>(new DRange());
    #confirmedEventIndexesLoaded = $derived.by(() => {
        const ranges = new DRange();
        this.#events.forEach((e) => ranges.add(e.index));
        ranges.add(this.#expiredEventRanges);
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

    get webhooks() {
        return this.#webhooks;
    }

    get isEmpty() {
        return this.chatId === undefined;
    }

    get confirmedEventIndexesLoaded() {
        return this.#confirmedEventIndexesLoaded;
    }

    get confirmedThreadEventIndexesLoaded() {
        return this.#thread?.confirmedEventIndexesLoaded;
    }

    get events() {
        return this.#events;
    }

    get threadEvents() {
        return this.#thread?.events ?? [];
    }

    get expiredEventRanges() {
        return this.#expiredEventRanges;
    }

    updateEvents(
        chatId: ChatIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        if (!chatIdentifiersEqual(chatId, this.#chatId)) {
            console.warn(
                "Attempting to updateServerEvents for the wrong chat - probably a stale response",
                chatId,
                this.#chatId,
            );
            return;
        }
        this.#events = fn(this.#events);
    }

    setSelectedThread(id: ThreadIdentifier) {
        this.#thread = ThreadServerState.empty(id);
    }

    updateThreadEvents(
        id: ThreadIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        this.#thread?.updateEvents(id, fn);
    }

    updateExpiredEventRanges(fn: (existing: DRange) => DRange) {
        this.#expiredEventRanges = fn(this.#expiredEventRanges);
    }

    clearEvents() {
        this.#events = [];
        this.#expiredEventRanges = new DRange();
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
        webhooks: WebhookDetails[],
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
        this.#webhooks = webhooks;
    }

    static empty(chatId?: ChatIdentifier) {
        return new ChatDetailsServerState(chatId);
    }
}
