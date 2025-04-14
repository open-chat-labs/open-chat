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
import { LocalMap, ReadonlyMap } from "./map";
import { LocalSet, ReadonlySet } from "./set";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";

export class CommunityLocalState {
    #rules = $state<VersionedRules | undefined>();

    readonly invitedUsers = new LocalSet<string>();
    readonly blockedUsers = new LocalSet<string>();
    readonly referrals = new LocalSet<string>();
    readonly lapsedMembers = new LocalSet<string>();
    readonly members = new LocalMap<string, Member>();
    readonly userGroups = new LocalMap<number, UserGroupDetails>();
    readonly bots = new LocalMap<string, ExternalBotPermissions>();
    readonly apiKeys = new LocalMap<string, PublicApiKeyDetails>();

    get rules() {
        return this.#rules;
    }
    set rules(val: VersionedRules | undefined) {
        this.#rules = val;
    }
}

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
        return this.#getOrCreate(id).members.addOrUpdate(userId, member);
    }

    blockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).blockedUsers.add(userId);
    }

    unblockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).blockedUsers.remove(userId);
    }

    removeMember(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).members.remove(userId);
    }

    inviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        const invited = this.#getOrCreate(id).invitedUsers;
        const undos = userIds.map((u) => invited.add(u));
        return () => {
            undos.forEach((u) => {
                u();
            });
        };
    }

    uninviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        const invited = this.#getOrCreate(id).invitedUsers;
        const undos = userIds.map((u) => invited.remove(u));
        return () => {
            undos.forEach((u) => {
                u();
            });
        };
    }

    updateRules(id: CommunityIdentifier, rules: VersionedRules): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.rules;
        state.rules = rules;
        return scheduleUndo(() => {
            state.rules = previous;
        });
    }

    deleteUserGroup(id: CommunityIdentifier, userGroupId: number): UndoLocalUpdate {
        return this.#getOrCreate(id).userGroups.remove(userGroupId);
    }

    addOrUpdateUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): UndoLocalUpdate {
        return this.#getOrCreate(id).userGroups.addOrUpdate(userGroup.id, userGroup);
    }

    removeBot(id: CommunityIdentifier, botId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).bots.remove(botId);
    }

    installBot(
        id: CommunityIdentifier,
        botId: string,
        perm: ExternalBotPermissions,
    ): UndoLocalUpdate {
        return this.#getOrCreate(id).bots.addOrUpdate(botId, perm);
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

const empty = CommunityServerState.empty();

export class CommunityMergedState {
    #server: CommunityServerState | undefined;
    #userGroups = $derived(this.#mergeMap(this.server.userGroups, this.#local?.userGroups));
    #members = $derived(this.#mergeMap(this.server.members, this.#local?.members));
    #bots = $derived(this.#mergeMap(this.server.bots, this.#local?.bots));
    #apiKeys = $derived(this.#mergeMap(this.server.apiKeys, this.#local?.apiKeys));
    #blockedUsers = $derived.by(() => {
        console.log("Deriving blocked users");
        return this.#mergeSet(this.server.blockedUsers, this.#local?.blockedUsers);
    });
    #lapsedMembers = $derived(
        this.#mergeSet(this.server.lapsedMembers, this.#local?.lapsedMembers),
    );
    #invitedUsers = $derived(this.#mergeSet(this.server.invitedUsers, this.#local?.invitedUsers));
    #referrals = $derived(this.#mergeSet(this.server.referrals, this.#local?.referrals));
    #rules = $derived(this.#local?.rules ?? this.server.rules);

    #mergeSet<T>(server: Set<T>, local?: LocalSet<T>): ReadonlySet<T> {
        return new ReadonlySet(local ? local.apply(server) : server);
    }

    #mergeMap<K, V>(server: Map<K, V>, local?: LocalMap<K, V>): ReadonlyMap<K, V> {
        return new ReadonlyMap(local ? local.apply(server) : server);
    }

    get #local() {
        const id = this.server.communityId;
        if (id) {
            return communityLocalUpdates.get(id);
        }
    }

    private get server() {
        return this.#server ?? empty;
    }

    constructor(server: CommunityServerState) {
        this.#server = server;
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
