import type { OpenChat } from "./openchat";
import { app } from "./state/app.svelte";

/**
 * The idea here is to respond to changes in reactive state in ways that require side-effects
 *
 * For example: the route changes (a state change) and we need to load some data (a side-effect)
 *
 * Currently we handle this in the Home component but this is arbitrary - it really has nothing to
 * do with the component hierarchy.
 */

export function configureEffects(client: OpenChat) {
    $effect.root(() => {
        $effect(() => {
            if (app.selectedCommunityId !== undefined) {
                console.log("Setting selected community from an effect", app.selectedCommunityId);
                client.setSelectedCommunity(app.selectedCommunityId, null, true);
            }
        });
    });
}
