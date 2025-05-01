import type {
    CommunityIdentifier,
    ExternalBotPermissions,
    Member,
    PublicApiKeyDetails,
    ReadonlyMap,
    ReadonlySet,
    UserGroupDetails,
    VersionedRules,
} from "openchat-shared";
import { type LocalMap } from "../map";
import { LocalSet } from "../set";
import { communityLocalUpdates } from "./local.svelte";
import { CommunityServerState } from "./server.svelte";

const empty = CommunityServerState.empty();

export class CommunityMergedState {
    #server = $state<CommunityServerState | undefined>();
    #userGroups = $derived(this.#mergeMap(this.server.userGroups, this.#local?.userGroups));
    #members = $derived(this.#mergeMap(this.server.members, this.#local?.members));
    #bots = $derived(this.#mergeMap(this.server.bots, this.#local?.bots));
    #apiKeys = $derived(this.#mergeMap(this.server.apiKeys, this.#local?.apiKeys));
    #blockedUsers = $derived(this.#mergeSet(this.server.blockedUsers, this.#local?.blockedUsers));
    #lapsedMembers = $derived(
        this.#mergeSet(this.server.lapsedMembers, this.#local?.lapsedMembers),
    );
    #invitedUsers = $derived(this.#mergeSet(this.server.invitedUsers, this.#local?.invitedUsers));
    #referrals = $derived(this.#mergeSet(this.server.referrals, this.#local?.referrals));
    #rules = $derived(this.#local?.rules ?? this.server.rules);

    #mergeSet<T>(server: ReadonlySet<T>, local?: LocalSet<T>): ReadonlySet<T> {
        return local ? local.apply(server) : server;
    }

    #mergeMap<K, V>(server: ReadonlyMap<K, V>, local?: LocalMap<K, V>): ReadonlyMap<K, V> {
        return local ? local.apply(server) : server;
    }

    get #local() {
        const id = this.server.communityId;
        if (id) {
            return communityLocalUpdates.get(id);
        }
    }

    get communityId() {
        return this.#server?.communityId;
    }

    private get server() {
        return this.#server ?? empty;
    }

    constructor(server: CommunityServerState) {
        this.#server = server;
    }

    overwriteServerState(val: CommunityServerState) {
        this.#server = val;
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

    overwriteCommunityDetails(
        communityId: CommunityIdentifier,
        userGroups: Map<number, UserGroupDetails>,
        members: Map<string, Member>,
        blockedUsers: Set<string>,
        lapsedMembers: Set<string>,
        invitedUsers: Set<string>,
        referrals: Set<string>,
        bots: Map<string, ExternalBotPermissions>,
        apiKeys: Map<string, PublicApiKeyDetails>,
        rules?: VersionedRules,
    ) {
        this.#server?.overwriteCommunityDetails(
            communityId,
            userGroups,
            members,
            blockedUsers,
            lapsedMembers,
            invitedUsers,
            referrals,
            bots,
            apiKeys,
            rules,
        );
    }
}
