// import { get } from "svelte/store";
// import { serverChatSummariesStore } from "../../stores/chat";
import { ReplicaNotUpToDateError } from "../error";

export function ensureReplicaIsUpToDate(
    _chatId: string,
    threadRootMessageIndex: number | undefined,
    latestClientEventIndexPreRequest: number | undefined,
    latestEventIndex: number
): void {
    const latestClientEventIndex =
        threadRootMessageIndex === undefined
            ? // FIXME - can't do this
              // ? get(serverChatSummariesStore)[chatId]?.latestEventIndex
              0
            : latestClientEventIndexPreRequest;

    if (latestClientEventIndex !== undefined && latestEventIndex < latestClientEventIndex) {
        throw ReplicaNotUpToDateError.byEventIndex(latestEventIndex, latestClientEventIndex, true);
    }
}
