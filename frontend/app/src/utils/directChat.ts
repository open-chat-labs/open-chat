import { type ChatSummary, OPENCHAT_BOT_USER_ID, publish } from "openchat-client";

// A direct chat can be deleted unless it's the conversation with the OpenChat
// bot, which is always present and shouldn't be removable.
export function canDeleteDirectChat(chat: ChatSummary): boolean {
    return chat.kind === "direct_chat" && chat.id.userId !== OPENCHAT_BOT_USER_ID;
}

// Ask Home to confirm and delete the given direct chat. No-op for any other
// chat kind, so callers can pass whatever chat is currently in scope.
export function publishDeleteDirectChat(chat: ChatSummary): void {
    if (canDeleteDirectChat(chat)) {
        publish("deleteDirectChat", {
            kind: "delete_direct_chat",
            chatId: chat.id,
            blockUser: false,
        });
    }
}
}
