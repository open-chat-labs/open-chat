import { get } from "svelte/store";
import { serverChatSummariesStore } from "stores/chat";
import { ReplicaNotUpToDateError } from "services/error";

export function ensureReplicaIsUpToDate(
    chatId: string,
    threadRootMessageIndex: number | undefined,
    latestClientEventIndexPreRequest: number | undefined,
    latestEventIndex: number)
{
    const latestClientEventIndex = threadRootMessageIndex === undefined
        ? get(serverChatSummariesStore)[chatId]?.latestEventIndex
        : latestClientEventIndexPreRequest;

    if (latestClientEventIndex !== undefined && latestEventIndex < latestClientEventIndex) {
        throw new ReplicaNotUpToDateError(latestEventIndex, latestClientEventIndex, true);
    }
}
