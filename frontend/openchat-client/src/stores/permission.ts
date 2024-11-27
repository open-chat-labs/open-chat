import { derived } from "svelte/store";
import { selectedChatStore } from "./chat";
import { currentUser, userStore } from "./user";
import { permittedMessagesInDirectChat, permittedMessagesInGroup } from "../utils/chat";
import type { ChatSummary, CreatedUser, MessagePermission, UserLookup } from "openchat-shared";

function getMessagePermissionsForSelectedChat(
    chat: ChatSummary | undefined,
    userStore: UserLookup,
    user: CreatedUser,
    mode: "thread" | "message",
): Map<MessagePermission, boolean> {
    if (chat !== undefined) {
        if (chat.kind === "direct_chat") {
            const recipient = userStore.get(chat.them.userId);
            if (recipient !== undefined) {
                return permittedMessagesInDirectChat(
                    recipient,
                    mode,
                    process.env.PROPOSALS_BOT_CANISTER!,
                );
            }
        } else {
            return permittedMessagesInGroup(user, chat, mode);
        }
    }
    return new Map();
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
