import type { ChatIdentifier, Message, MessageContext, VideoCallContent } from "openchat-shared";
import { toBigInt64 } from "openchat-shared";

export class RemoteVideoCallEndedEvent extends CustomEvent<{ messageId: bigint }> {
    constructor(messageId: bigint) {
        super("openchat_event", {
            detail: { messageId: toBigInt64(messageId) },
        });
    }
}

export class RemoteVideoCallStartedEvent extends CustomEvent<{
    chatId: ChatIdentifier;
    userId: string;
    messageId: bigint;
    currentUserIsParticipant: boolean;
    timestamp: bigint;
}> {
    constructor(
        chatId: ChatIdentifier,
        userId: string,
        messageId: bigint,
        currentUserIsParticipant: boolean,
        timestamp: bigint,
    ) {
        super("openchat_event", {
            detail: {
                chatId,
                userId,
                messageId: toBigInt64(messageId),
                currentUserIsParticipant,
                timestamp,
            },
        });
    }

    static create(
        chatId: ChatIdentifier,
        currentUser: string,
        message: Message<VideoCallContent>,
        timestamp: bigint,
    ): RemoteVideoCallStartedEvent {
        return new RemoteVideoCallStartedEvent(
            chatId,
            message.sender,
            message.messageId,
            message.content.participants.some((p) => p.userId === currentUser),
            timestamp,
        );
    }
}
