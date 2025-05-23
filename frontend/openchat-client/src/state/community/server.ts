import {
    emptyRules,
    type CommunityIdentifier,
    type ExternalBotPermissions,
    type Member,
    type ReadonlyMap,
    type ReadonlySet,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";

// all of this stuff gets updated together so the whole thing will be a store, but the individual bits don't need to be
// I *think*
export class CommunityDetailsState {
    constructor(
        public communityId: CommunityIdentifier,
        public userGroups: ReadonlyMap<number, UserGroupDetails>,
        public members: ReadonlyMap<string, Member>,
        public blockedUsers: ReadonlySet<string>,
        public lapsedMembers: ReadonlySet<string>,
        public invitedUsers: ReadonlySet<string>,
        public referrals: ReadonlySet<string>,
        public bots: ReadonlyMap<string, ExternalBotPermissions>,
        public rules: VersionedRules = emptyRules(),
    ) {}
}
