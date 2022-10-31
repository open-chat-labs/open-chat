import type { Principal } from "@dfinity/principal";
import { openDbAndGetCachedChats } from "../../utils/caching";
import { ReplicaNotUpToDateError } from "../error";

export async function ensureReplicaIsUpToDate(
    principal: Principal,
    chatId: string,
    threadRootMessageIndex: number | undefined,
    latestClientEventIndexPreRequest: number | undefined,
    latestEventIndex: number
): Promise<void> {
    const chats = await openDbAndGetCachedChats(principal);
    const latestSavedEventIndex = chats?.chatSummaries.find(
        (c) => c.chatId === chatId
    )?.latestEventIndex;

    const latestClientEventIndex =
        threadRootMessageIndex === undefined
            ? latestSavedEventIndex
            : latestClientEventIndexPreRequest;

    if (latestClientEventIndex !== undefined && latestEventIndex < latestClientEventIndex) {
        throw ReplicaNotUpToDateError.byEventIndex(latestEventIndex, latestClientEventIndex, true);
    }
}
