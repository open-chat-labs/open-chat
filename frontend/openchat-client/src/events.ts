import type { EventWrapper, Message, MessageContext } from "openchat-shared";

export class LoadedNewMessages extends CustomEvent<MessageContext> {
    constructor(context: MessageContext) {
        super("openchat_event", { detail: context });
    }
}

export class SendMessageFailed extends CustomEvent<boolean> {
    constructor(alert: boolean) {
        super("openchat_event", { detail: alert });
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
