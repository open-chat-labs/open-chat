import type { Principal } from "@dfinity/principal";
import { openDbAndGetCachedChats } from "../../utils/caching";
import { ReplicaNotUpToDateError } from "../error";
import { chatIdentifiersEqual, type ChatIdentifier, type ChatSummary } from "openchat-shared";

export async function ensureReplicaIsUpToDate(
    principal: Principal,
    chatId: ChatIdentifier,
    replicaChatLastUpdated: bigint,
): Promise<void> {
    const clientChat = await getChat(principal, chatId);

    if (clientChat !== undefined && replicaChatLastUpdated < clientChat.lastUpdated) {
        throw ReplicaNotUpToDateError.byTimestamp(
            replicaChatLastUpdated,
            clientChat.lastUpdated,
            true,
        );
    }
}

async function getChat(
    principal: Principal,
    chatId: ChatIdentifier,
): Promise<ChatSummary | undefined> {
    const chats = await openDbAndGetCachedChats(principal);
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
