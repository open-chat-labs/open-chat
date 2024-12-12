import { derived } from "svelte/store";
import { selectedChatStore } from "./chat";
import { currentUser, userStore } from "./user";
import { permittedMessagesInDirectChat, permittedMessagesInGroup } from "../utils/chat";
import type { ChatSummary, CreatedUser, MessagePermission, UserLookup } from "openchat-shared";

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
                        process.env.PROPOSALS_BOT_CANISTER!,
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
    [selectedChatStore, userStore, currentUser],
    ([$chat, $userStore, $user]) => {
        return getMessagePermissionsForSelectedChat($chat, $userStore, $user, "message");
    },
);

export const threadPermissionsForSelectedChat = derived(
    [selectedChatStore, userStore, currentUser],
    ([$chat, $userStore, $user]) => {
        return getMessagePermissionsForSelectedChat($chat, $userStore, $user, "thread");
    },
);
