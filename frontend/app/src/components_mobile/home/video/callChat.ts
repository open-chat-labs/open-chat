import type { ChatIdentifier, DirectChatIdentifier, VideoCallInProgress } from "openchat-client";

export type VideoCallChat = {
    chatId: ChatIdentifier;
    name: string;
    avatarUrl: string;
    userId: DirectChatIdentifier | undefined;
    videoCallInProgress?: VideoCallInProgress;
};
