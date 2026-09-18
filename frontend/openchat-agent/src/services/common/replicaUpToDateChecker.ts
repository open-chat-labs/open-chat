import type { ChatsDb } from "../../utils/chatsDb";
import { ReplicaNotUpToDateError } from "../error";
import type { ChatIdentifier, ReplicaNotUpToDate } from "@shared";

export async function ensureReplicaIsUpToDate(
    chatsDb: ChatsDb,
    chatId: ChatIdentifier,
    replicaChatLastUpdated: bigint,
    suppressError = false,
): Promise<undefined | ReplicaNotUpToDate> {
    const clientChat = await chatsDb.getCachedChatSummary(chatId);

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
