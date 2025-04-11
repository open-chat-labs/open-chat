import {
    emptyRules,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";
import { SvelteMap, SvelteSet } from "svelte/reactivity";

export class CommunityState {
    constructor(
        public readonly userGroups: SvelteMap<number, UserGroupDetails>,
        public readonly members: SvelteMap<string, Member>,
        public readonly blockedUsers: SvelteSet<string>,
        public readonly lapsedMembers: SvelteSet<string>,
        public readonly invitedUsers: SvelteSet<string>,
        public readonly referrals: SvelteSet<string>,
        public readonly bots: SvelteMap<string, ExternalBotPermissions>,
        public readonly apiKeys: SvelteMap<string, PublicApiKeyDetails>,
        public readonly rules?: VersionedRules,
    ) {}

    static empty(): CommunityState {
        return new CommunityState(
            new SvelteMap(),
            new SvelteMap(),
            new SvelteSet(),
            new SvelteSet(),
            new SvelteSet(),
            new SvelteSet(),
            new SvelteMap(),
            new SvelteMap(),
            emptyRules(),
        );
    }
}
