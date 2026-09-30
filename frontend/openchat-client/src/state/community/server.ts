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
import { addLoadedMembers, type MembersPagePosition } from "../members";

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
        // If not all of the members are held, the user id after which the next page of them starts
        public moreMembersAfter: string | undefined = undefined,
    ) {}

    // These details with members added who have been loaded since: a page of them, or some who
    // were looked up
    withMembers(loaded: Member[], page?: MembersPagePosition): CommunityDetailsState {
        const { members, lapsedMembers, moreMembersAfter } = addLoadedMembers(this, loaded, page);
        return new CommunityDetailsState(
            this.communityId,
            this.timestamp,
            this.userGroups,
            members,
            this.blockedUsers,
            lapsedMembers,
            this.invitedUsers,
            this.referrals,
            this.bots,
            this.rules,
            moreMembersAfter,
        );
    }
}
