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
