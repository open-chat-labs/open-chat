import type { ChatIdentifier, ThreadRead } from "./chat";
import type { StorageStatus } from "./data/data";
import type { UserSummary } from "./user";

export class StorageUpdated extends CustomEvent<StorageStatus> {
    constructor(detail: StorageStatus) {
        super("openchat_event", { detail });
    }
}

export class UsersLoaded extends CustomEvent<UserSummary[]> {
    constructor(detail: UserSummary[]) {
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
        dateReadPinned: bigint | undefined,
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

/** The chat cache's sync head moved (or a write pass completed): the UI may have something to pull */
export class SyncHeadMoved extends CustomEvent<{ userId: string; version: number }> {
    constructor(userId: string, version: number) {
        super("openchat_event", { detail: { userId, version } });
    }
}
