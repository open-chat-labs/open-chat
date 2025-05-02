import type { ChatSummary, CreatedUser, MessagePermission, UserLookup } from "openchat-shared";
import { derived } from "svelte/store";
import { app } from "../state/app.svelte";
import { permittedMessagesInDirectChat, permittedMessagesInGroup } from "../utils/chat";
import { selectedChatStore } from "./chat";
import { dummyCurrentUser, userStore } from "./user";

function toSet(map: Map<MessagePermission, boolean>): Set<MessagePermission> {
    return [...map.entries()].reduce((s, [k, v]) => {
        if (v) {
            s.add(k);
        }
        return s;
    }, new Set<MessagePermission>());
}

function getMessagePermissionsForSelectedChat(
    chat: ChatSummary | undefined,
    userStore: UserLookup,
    user: CreatedUser,
    mode: "thread" | "message",
): Set<MessagePermission> {
    if (chat !== undefined) {
        if (chat.kind === "direct_chat") {
            const recipient = userStore.get(chat.them.userId);
            if (recipient !== undefined) {
                return toSet(
                    permittedMessagesInDirectChat(
                        recipient,
                        mode,
                        import.meta.env.OC_PROPOSALS_BOT_CANISTER!,
                    ),
                );
            }
        } else {
            return toSet(permittedMessagesInGroup(user, chat, mode));
        }
    }
    return new Set();
}

export const messagePermissionsForSelectedChat = derived(
    [selectedChatStore, userStore, dummyCurrentUser],
    ([$chat, $userStore, _]) => {
        return getMessagePermissionsForSelectedChat($chat, $userStore, app.currentUser, "message");
    },
);

export const threadPermissionsForSelectedChat = derived(
    [selectedChatStore, userStore, dummyCurrentUser],
    ([$chat, $userStore, _]) => {
        return getMessagePermissionsForSelectedChat($chat, $userStore, app.currentUser, "thread");
    },
);
