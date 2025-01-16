import type {
    ChatIdentifier,
    ChitEarned,
    EventWrapper,
    Message,
    MessageContext,
    VideoCallContent,
} from "openchat-shared";
import { toBigInt64 } from "openchat-shared";

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

export class SummonWitch extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class CreatePoll extends CustomEvent<MessageContext> {
    constructor(context: MessageContext) {
        super("openchat_event", {
            detail: context,
        });
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

export class RegisterBot extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class UpdateBot extends Event {
    constructor() {
        super("openchat_event");
    }
}
