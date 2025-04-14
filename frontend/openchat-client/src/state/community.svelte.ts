import {
    emptyRules,
    type CommunityIdentifier,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";
import { SvelteMap } from "svelte/reactivity";
import { LocalMap } from "./map";
import { LocalSet, ReadonlySet } from "./set";
import type { UndoLocalUpdate } from "./undo";

export class CommunityLocalState {
    readonly invitedUsers = new LocalSet<string>();
    readonly blockedUsers = new LocalSet<string>();
    readonly referrals = new LocalSet<string>();
    readonly lapsedMembers = new LocalSet<string>();
    readonly members = new LocalMap<string, Member>();
}

// Manager - urgh
// todo - this still needs to deal with pruning
export class CommunityLocalStateManager {
    #data = new SvelteMap<string, CommunityLocalState>();

    get(id: CommunityIdentifier): CommunityLocalState | undefined {
        return this.#data.get(id.communityId);
    }

    #getOrCreate(id: CommunityIdentifier): CommunityLocalState {
        let state = this.#data.get(id.communityId);
        if (state === undefined) {
            state = new CommunityLocalState();
            this.#data.set(id.communityId, state);
        }
        return state;
    }

    updateMember(id: CommunityIdentifier, userId: string, member: Member) {
        this.#getOrCreate(id).members.addOrUpdate(userId, member);
    }

    blockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).blockedUsers.add(userId);
    }

    unblockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).blockedUsers.remove(userId);
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
    #blockedUsers = $derived.by<ReadonlySet<string>>(() =>
        this.#mergeSet(this.server.blockedUsers, this.#local?.blockedUsers),
    );
    #lapsedMembers = $derived<ReadonlySet<string>>(
        this.#mergeSet(this.server.lapsedMembers, this.#local?.lapsedMembers),
    );
    #invitedUsers = $derived<ReadonlySet<string>>(
        this.#mergeSet(this.server.invitedUsers, this.#local?.invitedUsers),
    );
    #referrals = $derived<ReadonlySet<string>>(
        this.#mergeSet(this.server.referrals, this.#local?.referrals),
    );

    #mergeSet<T>(server: Set<T>, local?: LocalSet<T>): ReadonlySet<T> {
        return new ReadonlySet(local ? local.apply(server) : server);
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
