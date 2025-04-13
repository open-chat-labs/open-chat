import {
    emptyRules,
    type CommunityIdentifier,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";
import { SvelteMap, SvelteSet } from "svelte/reactivity";

export class LocalSet<T> {
    #added = new SvelteSet<T>();
    #removed = new SvelteSet<T>();

    add(thing: T) {
        this.#added.add(thing);
        this.#removed.delete(thing);
    }

    remove(thing: T) {
        this.#removed.add(thing);
        this.#added.delete(thing);
    }

    apply(original: Set<T>): SvelteSet<T> {
        const merged = new SvelteSet<T>(original);
        this.#added.forEach((t) => merged.add(t));
        this.#removed.forEach((t) => merged.delete(t));
        return merged;
    }
}

export class CommunityLocalState {
    readonly invitedUsers = new LocalSet<string>();
    readonly blockedUsers = new LocalSet<string>();
    readonly referrals = new LocalSet<string>();
    readonly lapsedMembers = new LocalSet<string>();
}

// Manager - urgh
// todo - this still needs to deal with pruning
export class CommunityLocalStateManager {
    #data = new SvelteMap<string, CommunityLocalState>();

    get(id: CommunityIdentifier): CommunityLocalState {
        let state = this.#data.get(id.communityId);
        if (state === undefined) {
            state = new CommunityLocalState();
            this.#data.set(id.communityId, state);
        }
        return state;
    }

    blockUser(id: CommunityIdentifier, userId: string) {
        this.get(id).blockedUsers.add(userId);
    }

    unblockUser(id: CommunityIdentifier, userId: string) {
        this.get(id).blockedUsers.remove(userId);
    }
}

export const communityLocalUpdates = new CommunityLocalStateManager();

// yes - this is just a plain old class.
// server state never actually changes it just gets overwritten.
export class CommunityServerState {
    constructor(
        readonly communityId: CommunityIdentifier | undefined,
        readonly userGroups: Map<number, UserGroupDetails>,
        readonly members: Map<string, Member>,
        readonly blockedUsers: Set<string>,
        readonly lapsedMembers: Set<string>,
        readonly invitedUsers: Set<string>,
        readonly referrals: Set<string>,
        readonly bots: Map<string, ExternalBotPermissions>,
        readonly apiKeys: Map<string, PublicApiKeyDetails>,
        readonly rules?: VersionedRules,
    ) {}

    static empty() {
        return new CommunityServerState(
            undefined,
            new Map(),
            new Map(),
            new Set(),
            new Set(),
            new Set(),
            new Set(),
            new Map(),
            new Map(),
            emptyRules(),
        );
    }
}

export class CommunityMergedState {
    #userGroups;
    #members;
    #bots;
    #apiKeys;
    #rules;
    #blockedUsers = $derived.by<Set<string>>(() => {
        console.log("deriving blocked users", this.server.blockedUsers, this.#local?.blockedUsers);
        return this.#mergeSet(this.server.blockedUsers, this.#local?.blockedUsers);
    });
    #lapsedMembers = $derived<Set<string>>(
        this.#mergeSet(this.server.lapsedMembers, this.#local?.lapsedMembers),
    );
    #invitedUsers = $derived<Set<string>>(
        this.#mergeSet(this.server.invitedUsers, this.#local?.invitedUsers),
    );
    #referrals = $derived<Set<string>>(
        this.#mergeSet(this.server.referrals, this.#local?.referrals),
    );

    #mergeSet<T>(server: Set<T>, local?: LocalSet<T>): Set<T> {
        return local ? local.apply(server) : server;
    }

    get #local() {
        const id = this.server.communityId;
        if (id) {
            return communityLocalUpdates.get(id);
        }
    }

    constructor(private server: CommunityServerState) {
        this.#userGroups = this.server.userGroups;
        this.#members = this.server.members;
        this.#bots = this.server.bots;
        this.#apiKeys = this.server.apiKeys;
        this.#rules = this.server.rules;
    }

    get userGroups() {
        return this.#userGroups;
    }
    get members() {
        return this.#members;
    }
    get blockedUsers() {
        return this.#blockedUsers;
    }
    get lapsedMembers() {
        return this.#lapsedMembers;
    }
    get invitedUsers() {
        return this.#invitedUsers;
    }
    get referrals() {
        return this.#referrals;
    }
    get bots() {
        return this.#bots;
    }
    get apiKeys() {
        return this.#apiKeys;
    }
    get rules() {
        return this.#rules;
    }
}
