import type { IUserClient } from "./user.client.interface";

export class UserClientMock implements IUserClient {
    getChats(): Promise<unknown> {
        throw new Error("Method not implemented.");
    }
}
