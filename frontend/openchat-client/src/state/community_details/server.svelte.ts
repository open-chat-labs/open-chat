import {
    emptyRules,
    type CommunityIdentifier,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type ReadonlyMap,
    type ReadonlySet,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";

export class CommunityServerState {
    #communityId = $state<CommunityIdentifier | undefined>();
    #userGroups = $state<ReadonlyMap<number, UserGroupDetails>>(new Map());
    #members = $state<ReadonlyMap<string, Member>>(new Map());
    #blockedUsers = $state<ReadonlySet<string>>(new Set());
    #lapsedMembers = $state<ReadonlySet<string>>(new Set());
    #invitedUsers = $state<ReadonlySet<string>>(new Set());
    #referrals = $state<ReadonlySet<string>>(new Set());
    #bots = $state<ReadonlyMap<string, ExternalBotPermissions>>(new Map());
    #apiKeys = $state<ReadonlyMap<string, PublicApiKeyDetails>>(new Map());
    #rules = $state<VersionedRules>(emptyRules());

    constructor(communityId?: CommunityIdentifier) {
        this.#communityId = communityId;
    }

    get communityId() {
        return this.#communityId;
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

    static empty(communityId?: CommunityIdentifier) {
        return new CommunityServerState(communityId);
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
        this.#communityId = communityId;
        this.#userGroups = userGroups;
        this.#members = members;
        this.#blockedUsers = blockedUsers;
        this.#lapsedMembers = lapsedMembers;
        this.#invitedUsers = invitedUsers;
        this.#referrals = referrals;
        this.#bots = bots;
        this.#apiKeys = apiKeys;
        this.#rules = rules ?? emptyRules();
    }
}
