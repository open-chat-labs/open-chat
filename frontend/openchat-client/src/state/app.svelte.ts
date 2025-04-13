import {
    communityIdentifiersEqual,
    type CommunityIdentifier,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";
import { CommunityMergedState, CommunityServerState } from "./community.svelte";
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
                    this.#selectedCommunityDetails = new CommunityMergedState(
                        CommunityServerState.empty(),
                    );
                }
            });
        });
    }

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

    #selectedCommunityDetails = $state<CommunityMergedState>(
        new CommunityMergedState(CommunityServerState.empty()),
    );

    get selectedCommunityId() {
        return this.#selectedCommunityId;
    }

    get selectedCommunityDetails() {
        return this.#selectedCommunityDetails;
    }

    setSelectedCommunityDetails(
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
        if (communityId.communityId === this.#selectedCommunityId?.communityId) {
            this.#selectedCommunityDetails = new CommunityMergedState(
                new CommunityServerState(
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
                ),
            );
        }
    }
}

export const app = new AppState();
