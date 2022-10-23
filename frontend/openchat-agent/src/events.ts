import type { StorageStatus, ThreadRead, UserSummary } from "./domain";

export class StorageUpdated extends CustomEvent<StorageStatus> {
    constructor(detail: StorageStatus) {
        super("openchat_event", { detail });
    }
}

export class LoadedCachedUsers extends CustomEvent<Record<string, UserSummary>> {
    constructor(detail: Record<string, UserSummary>) {
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
