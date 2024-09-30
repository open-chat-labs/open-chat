import type {
    ChatIdentifier,
    ChitEarned,
    EventWrapper,
    Message,
    MessageContext,
    VideoCallContent,
} from "openchat-shared";

export class LoadedNewMessages extends CustomEvent<MessageContext> {
    constructor(context: MessageContext) {
        super("openchat_event", { detail: context });
    }
}

export class SendMessageFailed extends CustomEvent<{ alert: boolean }> {
    constructor(alert: boolean) {
        super("openchat_event", { detail: { alert } });
    }
}

export class LoadedPreviousMessages extends CustomEvent<{
    context: MessageContext;
    initializing: boolean;
}> {
    constructor(context: MessageContext, initializing: boolean) {
        super("openchat_event", { detail: { context, initializing } });
    }
}

export class ReactionSelected extends CustomEvent<{ messageId: bigint; kind: "add" | "remove" }> {
    constructor(messageId: bigint, kind: "add" | "remove") {
        super("openchat_event", { detail: { messageId, kind } });
    }
}

export class RemoteVideoCallEndedEvent extends CustomEvent<{ messageId: bigint }> {
    constructor(messageId: bigint) {
        super("openchat_event", {
            detail: { messageId: BigInt(messageId) },
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
                messageId: BigInt(messageId),
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

export class VideoCallMessageUpdated extends CustomEvent<{
    chatId: ChatIdentifier;
    messageId: bigint;
}> {
    constructor(chatId: ChatIdentifier, messageId: bigint) {
        super("openchat_event", { detail: { chatId, messageId } });
    }
}

export class SendingMessage extends CustomEvent<MessageContext> {
    constructor(context: MessageContext) {
        super("openchat_event", { detail: context });
    }
}

export class SentMessage extends CustomEvent<{
    context: MessageContext;
    event: EventWrapper<Message>;
}> {
    constructor(context: MessageContext, event: EventWrapper<Message>) {
        super("openchat_event", { detail: { context, event } });
    }
}

export class LoadedMessageWindow extends CustomEvent<{
    context: MessageContext;
    messageIndex: number;
    initialLoad: boolean;
}> {
    constructor(context: MessageContext, messageIndex: number, initialLoad: boolean) {
        super("openchat_event", { detail: { context, messageIndex, initialLoad } });
    }
}

export class ChatUpdated extends CustomEvent<MessageContext> {
    constructor(context: MessageContext) {
        super("openchat_event", { detail: context });
    }
}

export class ChatsUpdated extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class SelectedChatInvalid extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class UserSuspensionChanged extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class ThreadSelected extends CustomEvent<{
    initiating: boolean;
    threadRootEvent: EventWrapper<Message>;
}> {
    constructor(threadRootEvent: EventWrapper<Message>, initiating: boolean) {
        super("openchat_event", {
            detail: { threadRootEvent, initiating },
        });
    }
}

export class ThreadClosed extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class UserLoggedIn extends CustomEvent<string> {
    constructor(userId: string) {
        super("openchat_event", {
            detail: userId,
        });
    }
}

export class ChitEarnedEvent extends CustomEvent<ChitEarned[]> {
    constructor(earned: ChitEarned[]) {
        super("openchat_event", {
            detail: earned,
        });
    }
}
