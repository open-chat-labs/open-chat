import { untrack } from "svelte";
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
        // set selected community when communityId changes
        $effect(() => {
            if (app.chatsInitialised && app.selectedCommunityId !== undefined) {
                const id = app.selectedCommunityId;

                // this untrack is not really necessary in this case but it's probably a good pattern to follow to
                // make double sure we are only reacting to the things we want to react to
                untrack(() => {
                    client.setSelectedCommunity(id, true).then((found) => {
                        if (found) {
                            client.selectFirstChat();
                        }
                    });
                });
            }
        });

        //TODO - imagine we also had an effect here track selectedChatId, we would then have two things potentially
        // loading the selected chat. We'll cross that bridge when we come to it.
    });
}
