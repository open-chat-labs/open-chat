import type { ThreadRead } from "./chat";
import type { StorageStatus } from "./data/data";
import type { PartialUserSummary } from "./user";

export class StorageUpdated extends CustomEvent<StorageStatus> {
    constructor(detail: StorageStatus) {
        super("openchat_event", { detail });
    }
}

export class UsersLoaded extends CustomEvent<PartialUserSummary[]> {
    constructor(detail: PartialUserSummary[]) {
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
