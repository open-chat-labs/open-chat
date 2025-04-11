import { communityIdentifiersEqual, type CommunityIdentifier } from "openchat-shared";
import { pathState } from "./path.svelte";
import { withEqCheck } from "./reactivity.svelte";

/**
 * AppState is basically all data that comes from the backend
 */
class AppState {
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

    get selectedCommunityId() {
        return this.#selectedCommunityId;
    }
}

export const app = new AppState();
