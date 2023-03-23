import type { EventWrapper, Message } from "openchat-shared";

export class LoadedNewMessages extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class LoadedNewThreadMessages extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class SendMessageFailed extends CustomEvent<boolean> {
    constructor(alert: boolean) {
        super("openchat_event", { detail: alert });
    }
}

export class LoadedPreviousMessages extends CustomEvent<boolean> {
    constructor(initialising: boolean) {
        super("openchat_event", { detail: initialising });
    }
}

export class LoadedPreviousThreadMessages extends CustomEvent<boolean> {
    constructor(initialising: boolean) {
        super("openchat_event", { detail: initialising });
    }
}

export class SentMessage extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class SendingMessage extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class SentThreadMessage extends CustomEvent<EventWrapper<Message>> {
    constructor(event: EventWrapper<Message>) {
        super("openchat_event", { detail: event });
    }
}

export class SendingThreadMessage extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class LoadedThreadMessageWindow extends CustomEvent<{
    messageIndex: number;
    initialLoad: boolean;
}> {
    constructor(messageIndex: number, initialLoad: boolean) {
        super("openchat_event", { detail: { messageIndex, initialLoad } });
    }
}

export class LoadedMessageWindow extends CustomEvent<{
    messageIndex: number;
    initialLoad: boolean;
}> {
    constructor(messageIndex: number, initialLoad: boolean) {
        super("openchat_event", { detail: { messageIndex, initialLoad } });
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
