import type { GetMessagesResponse } from "../../domain/chat/chat";
import type { IGroupClient } from "./group.client.interface";

export class GroupClientMock implements IGroupClient {
    chatMessages(_fromIndex: number, _toIndex: number): Promise<GetMessagesResponse> {
        throw new Error("Method not implemented.");
    }
}
