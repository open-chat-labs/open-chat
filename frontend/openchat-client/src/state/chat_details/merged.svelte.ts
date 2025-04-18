import { SvelteSet } from "svelte/reactivity";
import { LocalMap, ReadonlyMap } from "../map";
import { ReadonlySet, type IReadonlySet, type LocalSet } from "../set";
import { chatDetailsLocalUpdates } from "./local.svelte";
import { ChatDetailsServerState } from "./server";

const empty = ChatDetailsServerState.empty();

export class ChatDetailsMergedState {
    #server: ChatDetailsServerState | undefined;

    #focusMessageIndex = $state<number | undefined>();
    #focusThreadMessageIndex = $state<number | undefined>();
    #userIds = new SvelteSet<string>();
    #members = $derived(this.#mergeMap(this.server.members, this.#local?.members));
    #bots = $derived(this.#mergeMap(this.server.bots, this.#local?.bots));
    #apiKeys = $derived(this.#mergeMap(this.server.apiKeys, this.#local?.apiKeys));
    #invitedUsers = $derived(this.#mergeSet(this.server.invitedUsers, this.#local?.invitedUsers));
    #rules = $derived(this.#local?.rules ?? this.server.rules);
    #pinnedMessages = $derived(
        this.#mergeSet(this.server.pinnedMessages, this.#local?.pinnedMessages),
    );

    constructor(server: ChatDetailsServerState) {
        this.#server = server;
    }

    #mergeSet<T>(server: Set<T>, local?: LocalSet<T>): ReadonlySet<T> {
        return new ReadonlySet(local ? local.apply(server) : server);
    }

    #mergeMap<K, V>(server: Map<K, V>, local?: LocalMap<K, V>): ReadonlyMap<K, V> {
        return new ReadonlyMap(local ? local.apply(server) : server);
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

    get rules() {
        return this.#rules;
    }

    get pinnedMessages() {
        return this.#pinnedMessages;
    }

    get focusThreadMessageIndex() {
        return this.#focusThreadMessageIndex;
    }

    get focusMessageIndex() {
        return this.#focusMessageIndex;
    }

    set focusMessageIndex(val: number | undefined) {
        this.#focusMessageIndex = val;
    }

    set focusThreadMessageIndex(val: number | undefined) {
        this.#focusThreadMessageIndex = val;
    }

    addUserIds(userIds: string[]) {
        userIds.forEach((u) => this.#userIds.add(u));
    }

    get userIds(): IReadonlySet<string> {
        return this.#userIds;
    }
}
