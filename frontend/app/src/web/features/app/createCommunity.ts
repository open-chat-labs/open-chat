import { publish, type OpenChat } from "@client";
import { startCommunityCreation } from "@src/logic/groupOrCommunity/community.svelte";
import type { DialogStack } from "../../shell/dialogStack.svelte";
import type { LocalDialog } from "./dialogs";

/**
 * Creating a community, from the rail or Explore (4b's `CreateGroupDialog`). Only Diamond members
 * can create one: anyone else gets the upgrade. A guest is sent to sign in, and AppScreen picks the
 * creation up after it (`postLoginCreateCommunity`).
 */
export function openCommunityCreation(client: OpenChat, dialogs: DialogStack<LocalDialog>): void {
    switch (startCommunityCreation(client)) {
        case "ready":
            dialogs.open({ kind: "create_group", level: "community" });
            break;
        case "needs_diamond":
            publish("upgrade");
            break;
        case "logging_in":
            break;
    }
}
