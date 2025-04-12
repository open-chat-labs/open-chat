import {
    emptyRules,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";

// yes - this is just a plain old class.
// server state never actually changes it just gets overwritten.
export class CommunityState {
    constructor(
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
        return new CommunityState(
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
