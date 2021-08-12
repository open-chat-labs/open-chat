import type { EventsResponse } from "../../domain/chat/chat";

export interface IGroupClient {
    chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse>;
}
