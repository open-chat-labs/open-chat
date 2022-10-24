import type { StorageStatus, ThreadRead } from "./domain";

export class StorageUpdated extends CustomEvent<StorageStatus> {
    constructor(detail: StorageStatus) {
        super("openchat_event", { detail });
    }
}

export class MessagesReadFromServer extends CustomEvent<{
    chatId: string;
    readByMeUpTo: number | undefined;
    threadsRead: ThreadRead[];
}> {
    constructor(chatId: string, readByMeUpTo: number | undefined, threadsRead: ThreadRead[]) {
        super("openchat_event", {
            detail: {
                chatId,
                readByMeUpTo,
                threadsRead,
            },
        });
    }
}
