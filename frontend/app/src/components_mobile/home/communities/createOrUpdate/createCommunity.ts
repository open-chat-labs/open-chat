import { publish, type OpenChat } from "@client";
import {
    startCommunityCreation,
    updateCommunityState,
} from "@src/logic/groupOrCommunity/community.svelte";

// Opens the page for creating a community, once the user is logged in and a Diamond member
export function openCommunityCreation(client: OpenChat) {
    switch (startCommunityCreation(client)) {
        case "logging_in":
            break;
        case "needs_diamond":
            publish("upgrade");
            break;
        case "ready":
            updateCommunityState.initialiseNew();
            publish("updateCommunity");
            break;
    }
}
