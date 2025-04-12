import {
    communityIdentifiersEqual,
    type CommunityIdentifier,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";
import { CommunityState } from "./community.svelte";
import { pathState } from "./path.svelte";
import { withEqCheck } from "./reactivity.svelte";

/**
 * AppState is basically all data that comes from the backend
 */
class AppState {
    constructor() {
        $effect.root(() => {
            $effect(() => {
                if (this.#selectedCommunityId === undefined) {
                    this.#selectedCommunityDetails = CommunityState.empty();
                }
            });
        });
    }

    // TODO this will run every time scope changes. And because CommunityIdentifier is an object, any effect that depends
    // on it may run when the actual community id has not changed (only the reference to the object has changed). We need
    // to be very careful with that. Effects only check the reference equality of the things.
    #selectedCommunityId = $derived.by<CommunityIdentifier | undefined>(
        withEqCheck(() => {
            switch (pathState.route.scope.kind) {
                case "community":
                    return pathState.route.scope.id;
                case "favourite":
                    return pathState.route.scope.communityId;
                default:
                    return undefined;
            }
        }, communityIdentifiersEqual),
    );

    // this should actually be a derivation of server state + local updates
    #selectedCommunityDetails = $state<CommunityState>(CommunityState.empty());

    get selectedCommunityId() {
        return this.#selectedCommunityId;
    }

    get selectedCommunityDetails() {
        return this.#selectedCommunityDetails;
    }

    setSelectedCommunityDetails(
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
        this.#selectedCommunityDetails = new CommunityState(
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

export const app = new AppState();
