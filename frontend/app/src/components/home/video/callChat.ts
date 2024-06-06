import type { ChatIdentifier, DirectChatIdentifier } from "openchat-client";

export type VideoCallChat = {
    chatId: ChatIdentifier;
    name: string;
    avatarUrl: string;
    userId: DirectChatIdentifier | undefined;
    messageIndex?: number;
};
