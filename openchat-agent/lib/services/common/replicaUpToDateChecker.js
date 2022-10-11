import { get } from "svelte/store";
import { serverChatSummariesStore } from "stores/chat";
import { ReplicaNotUpToDateError } from "services/error";
export function ensureReplicaIsUpToDate(chatId, threadRootMessageIndex, latestClientEventIndexPreRequest, latestEventIndex) {
    var _a;
    const latestClientEventIndex = threadRootMessageIndex === undefined
        ? (_a = get(serverChatSummariesStore)[chatId]) === null || _a === void 0 ? void 0 : _a.latestEventIndex
        : latestClientEventIndexPreRequest;
    if (latestClientEventIndex !== undefined && latestEventIndex < latestClientEventIndex) {
        throw ReplicaNotUpToDateError.byEventIndex(latestEventIndex, latestClientEventIndex, true);
    }
}
//# sourceMappingURL=replicaUpToDateChecker.js.map