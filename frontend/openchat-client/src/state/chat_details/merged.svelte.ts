import DRange from "drange";
import {
    type ChatEvent,
    type EventWrapper,
    type ReadonlyMap,
    type ReadonlySet,
} from "openchat-shared";
import { SvelteSet } from "svelte/reactivity";
import { LocalMap } from "../map";
import { type LocalSet } from "../set";
import { chatDetailsLocalUpdates } from "./local.svelte";
import { ChatDetailsServerState } from "./server.svelte";

const empty = ChatDetailsServerState.empty();

export class ChatDetailsMergedState {
    #server = $state<ChatDetailsServerState | undefined>();
    #userIds = new SvelteSet<string>();
    #userGroupKeys = new SvelteSet<string>();
    #expandedDeletedMessages = new SvelteSet<number>();
    #members = $derived(this.#mergeMap(this.server.members, this.#local?.members));
    #bots = $derived(this.#mergeMap(this.server.bots, this.#local?.bots));
    #apiKeys = $derived(this.#mergeMap(this.server.apiKeys, this.#local?.apiKeys));
    #blockedUsers = $derived(this.#mergeSet(this.server.blockedUsers, this.#local?.blockedUsers));
    #invitedUsers = $derived(this.#mergeSet(this.server.invitedUsers, this.#local?.invitedUsers));
    #rules = $derived(this.#local?.rules ?? this.server.rules);
    #pinnedMessages = $derived(
        this.#mergeSet(this.server.pinnedMessages, this.#local?.pinnedMessages),
    );

    constructor(server: ChatDetailsServerState) {
        this.#server = server;
    }

    #mergeSet<T>(server: Set<T>, local?: LocalSet<T>): ReadonlySet<T> {
        return local ? local.apply(server) : server;
    }

    #mergeMap<K, V>(server: Map<K, V>, local?: LocalMap<K, V>): ReadonlyMap<K, V> {
        return local ? local.apply(server) : server;
    }

    get chatId() {
        return this.#server?.chatId;
    }

    get empty() {
        return this.#server === undefined || this.#server.isEmpty;
    }

    get #local() {
        const id = this.server.chatId;
        if (id) {
            return chatDetailsLocalUpdates.get(id);
        }
    }

    private get server() {
        return this.#server ?? empty;
    }

    overwriteServerState(val: ChatDetailsServerState) {
        this.#server = val;
    }

    updateServerEvents(fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[]) {
        this.#server?.updateEvents(fn);
    }

    updateServerExpiredEventRanges(fn: (existing: DRange) => DRange) {
        this.#server?.updateExpiredEventRanges(fn);
    }

    clearServerEvents() {
        this.#server?.clearEvents();
    }

    get confirmedEventIndexesLoaded() {
        return this.#server?.confirmedEventIndexesLoaded ?? new DRange();
    }

    get serverEvents() {
        return this.#server?.events ?? [];
    }

    get expiredEventRanges() {
        return this.#server?.expiredEventRanges ?? new DRange();
    }

    get members() {
        return this.#members;
    }

    get lapsedMembers() {
        return this.server.lapsedMembers;
    }

    get bots() {
        return this.#bots;
    }

    get apiKeys() {
        return this.#apiKeys;
    }

    get invitedUsers() {
        return this.#invitedUsers;
    }

    get blockedUsers() {
        return this.#blockedUsers;
    }

    get rules() {
        return this.#rules;
    }

    get pinnedMessages() {
        return this.#pinnedMessages;
    }

    addUserIds(userIds: string[]) {
        userIds.forEach((u) => this.#userIds.add(u));
    }

    get userIds(): ReadonlySet<string> {
        return this.#userIds;
    }

    addUserGroupKey(key: string) {
        this.#userGroupKeys.add(key);
    }

    get userGroupKeys(): ReadonlySet<string> {
        return this.#userGroupKeys;
    }

    expandDeletedMessages(messageIndexes: Set<number>): void {
        messageIndexes.forEach((i) => this.#expandedDeletedMessages.add(i));
    }

    get expandedDeletedMessages(): ReadonlySet<number> {
        return this.#expandedDeletedMessages;
    }
}
