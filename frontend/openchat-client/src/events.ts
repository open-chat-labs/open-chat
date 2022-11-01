import type { EventWrapper, Message } from "openchat-shared";

export class UpgradeRequired extends CustomEvent<"explain" | "icp" | "sms"> {
    constructor(mode: "explain" | "icp" | "sms") {
        super("openchat_event", { detail: mode });
    }
}

export class LoadedNewMessages extends CustomEvent<boolean> {
    constructor(newLatestMessage: boolean) {
        super("openchat_event", { detail: newLatestMessage });
    }
}

export class SendMessageFailed extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class LoadedPreviousMessages extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class SentMessage extends CustomEvent<number | undefined> {
    constructor(jumpTo: number | undefined) {
        super("openchat_event", { detail: jumpTo });
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
