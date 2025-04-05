import type { ChatIdentifier, Message, VideoCallContent } from "openchat-shared";
import { toBigInt64 } from "openchat-shared";

export function remoteVideoCallEndedEvent(messageId: bigint) {
    return toBigInt64(messageId);
}

export function remoteVideoCallStartedEvent(
    chatId: ChatIdentifier,
    currentUser: string,
    message: Message<VideoCallContent>,
    timestamp: bigint,
) {
    return {
        chatId,
        userId: message.sender,
        messageId: toBigInt64(message.messageId),
        currentUserIsParticipant: message.content.participants.some(
            (p) => p.userId === currentUser,
        ),
        timestamp,
    };
}
