import type { ChatSummary } from "../../domain/chat";
import type { IUserClient } from "./user.client.interface";

export class UserClientMock implements IUserClient {
    getChats(): Promise<ChatSummary[]> {
        throw new Error("Method not implemented.");
    }
}
