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

export class CreateTestMessages extends CustomEvent<[MessageContext, number]> {
    constructor(detail: [MessageContext, number]) {
        super("openchat_event", {
            detail,
        });
    }
}

export class SearchChat extends CustomEvent<string> {
    constructor(search: string) {
        super("openchat_event", {
            detail: search,
        });
    }
}

export class AttachGif extends CustomEvent<[MessageContext, string]> {
    constructor(detail: [MessageContext, string]) {
        super("openchat_event", {
            detail,
        });
    }
}

export class TokenTransfer extends CustomEvent<{
    context: MessageContext;
    ledger?: string;
    amount?: bigint;
}> {
    constructor(detail: { context: MessageContext; ledger?: string; amount?: bigint }) {
        super("openchat_event", {
            detail,
        });
    }
}
