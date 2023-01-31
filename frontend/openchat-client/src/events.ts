import type { EventWrapper, Message } from "openchat-shared";

export class LoadedNewMessages extends CustomEvent<boolean> {
    constructor(newLatestMessage: boolean) {
        super("openchat_event", { detail: newLatestMessage });
    }
}

export class SendMessageFailed extends CustomEvent<boolean> {
    constructor(alert: boolean) {
        super("openchat_event", { detail: alert });
    }
}

export class LoadedPreviousMessages extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class SentMessage extends CustomEvent<boolean> {
    constructor(upToDate: boolean) {
        super("openchat_event", { detail: upToDate });
    }
}

export class SentThreadMessage extends CustomEvent<EventWrapper<Message>> {
    constructor(event: EventWrapper<Message>) {
        super("openchat_event", { detail: event });
    }
}

export class LoadedMessageWindow extends CustomEvent<number> {
    constructor(messageIndex: number) {
        super("openchat_event", { detail: messageIndex });
    }
}

export class ChatUpdated extends Event {
    constructor() {
        super("openchat_event");
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

export class ThreadMessagesLoaded extends CustomEvent<boolean> {
    constructor(ascending: boolean) {
        super("openchat_event", { detail: ascending });
    }
}

export class ThreadSelected extends CustomEvent<{
    initiating: boolean;
    threadRootMessageId: bigint;
    threadRootMessageIndex: number;
}> {
    constructor(threadRootMessageId: bigint, threadRootMessageIndex: number, initiating: boolean) {
        super("openchat_event", {
            detail: { threadRootMessageId, initiating, threadRootMessageIndex },
        });
    }
}

export class ThreadClosed extends Event {
    constructor() {
        super("openchat_event");
    }
}
