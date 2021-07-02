import type { ChatSummary } from "../../domain/chat";
import type { IUserClient } from "./user.client.interface";

export class UserClientMock implements IUserClient {
    getChats(): Promise<ChatSummary[]> {
        return fetch("https://my.api.mockaroo.com/chat_summary.json?key=02f66dd0").then((res) =>
            res.json()
        );
    }
}
