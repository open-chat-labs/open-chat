import type { Principal } from "@dfinity/principal";
import { openDbAndGetCachedChats } from "../../utils/caching";
import { ReplicaNotUpToDateError } from "../error";
import {
    chatIdentifiersEqual,
    type ChatIdentifier,
    type ChatSummary,
    type ReplicaNotUpToDate,
} from "openchat-shared";

const DATE_FIXED = BigInt(1699800000000);

export async function ensureReplicaIsUpToDate(
    principal: Principal,
    chatId: ChatIdentifier,
    replicaChatLastUpdated: bigint,
    suppressError = false,
): Promise<undefined | ReplicaNotUpToDate> {
    const clientChat = await getChat(principal, chatId);

    if (
        clientChat !== undefined &&
        replicaChatLastUpdated < clientChat.lastUpdated &&
        clientChat.lastUpdated > DATE_FIXED
    ) {
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

export function excludeLatestKnownUpdateIfBeforeFix(
    latestKnownUpdate: bigint | undefined,
): bigint | undefined {
    if (latestKnownUpdate !== undefined && latestKnownUpdate < DATE_FIXED) {
        return undefined;
    }

    return latestKnownUpdate;
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
