import type { Principal } from "@dfinity/principal";
import { openDbAndGetCachedChats } from "../../utils/caching";
import { ReplicaNotUpToDateError } from "../error";
import { chatIdentifiersEqual, type ChatIdentifier } from "openchat-shared";

export async function ensureReplicaIsUpToDate(
    principal: Principal,
    chatId: ChatIdentifier,
    threadRootMessageIndex: number | undefined,
    latestClientEventIndexPreRequest: number | undefined,
    latestEventIndex: number
): Promise<void> {
    const chats = await openDbAndGetCachedChats(principal);
    if (chats === undefined) return;

    const chat =
        chats.directChats.find((c) => chatIdentifiersEqual(c.chatId, chatId)) ??
        chats.groupChats.find((c) => chatIdentifiersEqual(c.chatId, chatId));

    const latestSavedEventIndex = chat?.latestEventIndex;
    if (latestSavedEventIndex === undefined) return;

    const latestClientEventIndex =
        threadRootMessageIndex === undefined
            ? latestSavedEventIndex
            : latestClientEventIndexPreRequest;

    if (latestClientEventIndex !== undefined && latestEventIndex < latestClientEventIndex) {
        throw ReplicaNotUpToDateError.byEventIndex(latestEventIndex, latestClientEventIndex, true);
    }
}
