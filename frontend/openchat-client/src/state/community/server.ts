import {
    emptyRules,
    type CommunityIdentifier,
    type GrantedBotPermissions,
    type Member,
    type ReadonlyMap,
    type ReadonlySet,
    type UserGroupDetails,
    type VersionedRules,
} from "@shared";
import { addLookedUpMembers } from "../members";

// all of this stuff gets updated together so the whole thing will be a store, but the individual bits don't need to be
// I *think*
export class CommunityDetailsState {
    constructor(
        public communityId: CommunityIdentifier,
        public timestamp: bigint,
        public userGroups: ReadonlyMap<number, UserGroupDetails>,
        public members: ReadonlyMap<string, Member>,
        public blockedUsers: ReadonlySet<string>,
        public lapsedMembers: ReadonlySet<string>,
        public invitedUsers: ReadonlySet<string>,
        public referrals: ReadonlySet<string>,
        public bots: ReadonlyMap<string, GrantedBotPermissions>,
        public rules: VersionedRules = emptyRules(),
        // Set if not all of the members are held, to the user id after which those not in the
        // first page start
        public moreMembersAfter: string | undefined = undefined,
    ) {}

    // These details with members added who have been looked up, or undefined if there are none to
    // add (see `addLookedUpMembers`)
    withLookedUpMembers(found: Member[], asOf: bigint): CommunityDetailsState | undefined {
        const added = addLookedUpMembers(this, found, asOf);
        if (added === undefined) {
            return undefined;
        }
        return new CommunityDetailsState(
            this.communityId,
            this.timestamp,
            this.userGroups,
            added.members,
            this.blockedUsers,
            added.lapsedMembers,
            this.invitedUsers,
            this.referrals,
            this.bots,
            this.rules,
            this.moreMembersAfter,
        );
    }
}
