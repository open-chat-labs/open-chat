import { untrack } from "svelte";
import type { OpenChat } from "./openchat";
import { app } from "./state/app.svelte";
import { pathState } from "./state/path.svelte";

/**
 * The idea here is to respond to changes in reactive state in ways that require side-effects
 *
 * For example: the route changes (a state change) and we need to load some data (a side-effect)
 *
 * Currently we handle this in the Home component but this is arbitrary - it really has nothing to
 * do with the component hierarchy.
 *
 * Question: Are these effects going to get out of hand and become impossible to reason about?
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
                    client.setSelectedCommunity(id, true);
                });
            }
        });

        $effect(() => {
            // we have to be *so* careful with the reactivity here. Is this actually better?
            if (
                app.chatsInitialised &&
                app.selectedChatId !== undefined &&
                (pathState.routeKind === "selected_channel_route" ||
                    pathState.routeKind === "global_chat_selected_route")
            ) {
                untrack(() => {
                    if (
                        pathState.route.kind === "selected_channel_route" ||
                        pathState.route.kind === "global_chat_selected_route"
                    ) {
                        const id = app.selectedChatId;
                        const messageIndex = pathState.route.messageIndex;
                        const threadMessageIndex = pathState.route.threadMessageIndex;
                        if (id !== undefined) {
                            client.setSelectedChat(id, messageIndex, threadMessageIndex);
                        }
                    }
                });
            }
        });

        $effect(() => {
            if (app.selectedChatId === undefined) {
                client.clearSelectedChat();
            }
        });

        // TODO - this seems to be a reasonable approach, but it causes a flicker of No Chat Selected for some reason
        // so we might need to rethink - ok for now though.
        // Actually this is already the case on webtest & prod so it's no worse - but could it be better?
        $effect(() => {
            if (app.selectedChatId === undefined && pathState.route.scope.kind !== "none") {
                client.selectFirstChat();
            }
        });

        // this exists only to syncronise the legacy chatListScopeStore until we can get rid of it
        $effect(() => {
            client.setChatListScopeAndRedirect(pathState.route);
        });
    });
}
