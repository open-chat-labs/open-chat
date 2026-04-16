import type { ChatsDb } from "../../utils/chatsDb";
import { ReplicaNotUpToDateError } from "../error";
import {
    chatIdentifiersEqual,
    type ChatIdentifier,
    type ChatSummary,
    type ReplicaNotUpToDate,
} from "openchat-shared";

export async function ensureReplicaIsUpToDate(
    chatsDb: ChatsDb,
    chatId: ChatIdentifier,
    replicaChatLastUpdated: bigint,
    suppressError = false,
): Promise<undefined | ReplicaNotUpToDate> {
    const clientChat = await getChat(chatsDb, chatId);

    if (clientChat !== undefined && replicaChatLastUpdated < clientChat.lastUpdated) {
        if (suppressError) {
            return {
                kind: "replica_not_up_to_date",
                replicaTimestamp: replicaChatLastUpdated,
                clientTimestamp: clientChat.lastUpdated,
            };
        }
        throw ReplicaNotUpToDateError.byTimestamp(
            replicaChatLastUpdated,
            clientChat.lastUpdated,
            true,
        );
    }
}

async function getChat(chatsDb: ChatsDb, chatId: ChatIdentifier): Promise<ChatSummary | undefined> {
    const chats = await chatsDb.getCachedChats();
    if (chats === undefined) return undefined;

    switch (chatId.kind) {
        case "direct_chat":
            return chats.directChats.find((c) => chatIdentifiersEqual(c.id, chatId));

        case "group_chat":
            return chats.groupChats.find((c) => chatIdentifiersEqual(c.id, chatId));

        case "channel":
            return chats.communities
                .find((c) => c.id.communityId === chatId.communityId)
                ?.channels.find((c) => c.id === chatId);
    }
}
