import type { EventWrapper, Message } from "./domain";

export class LoadedNewMessages extends CustomEvent<boolean> {
    constructor(newLatestMessage: boolean) {
        super("openchat_event", { detail: newLatestMessage });
    }
}

export class LoadedPreviousMessages extends Event {
    constructor() {
        super("openchat_event");
    }
}

export class LoadedMessageWindow extends CustomEvent<number> {
    constructor(messageIndex: number) {
        super("openchat_event", { detail: messageIndex });
    }
}

export class MessageSentByOther extends CustomEvent<EventWrapper<Message>> {
    constructor(messageEvent: EventWrapper<Message>) {
        super("openchat_event", { detail: messageEvent });
    }
}

export class ChatUpdated extends Event {
    constructor() {
        super("openchat_event");
    }
}
