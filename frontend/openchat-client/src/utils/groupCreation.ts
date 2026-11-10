import type { ChatEvent, EventWrapper, GroupCreation } from "@shared";

/** When the group was created and by whom, from the events read: its `group_chat_created`. */
export function groupCreation(events: EventWrapper<ChatEvent>[]): GroupCreation | undefined {
    for (const e of events) {
        if (e.event.kind === "group_chat_created") {
            return { timestamp: e.timestamp, createdBy: e.event.created_by };
        }
    }
    return undefined;
}
