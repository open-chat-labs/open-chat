import type { ChatIdentifier, ThreadRead } from "./chat";
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
    chatId: ChatIdentifier;
    readByMeUpTo: number | undefined;
    threadsRead: ThreadRead[];
    dateReadPinned: bigint | undefined;
}> {
    constructor(
        chatId: ChatIdentifier,
        readByMeUpTo: number | undefined,
        threadsRead: ThreadRead[],
        dateReadPinned: bigint | undefined
    ) {
        super("openchat_event", {
            detail: {
                chatId,
                readByMeUpTo,
                threadsRead,
                dateReadPinned,
            },
        });
    }
}
