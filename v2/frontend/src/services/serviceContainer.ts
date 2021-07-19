import type { Identity } from "@dfinity/agent";
import type {
    CurrentUserResponse,
    SetUsernameResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersResponse,
    UserSummary,
    UpgradeCanisterResponse,
    CreateCanisterResponse,
} from "../domain/user/user";
import { UserIndexClientMock } from "./userIndex/userIndex.client.mock";
import type { IUserIndexClient } from "./userIndex/userIndex.client.interface";
import type { IUserClient } from "./user/user.client.interface";
import type { GetChatsResponse, GetMessagesResponse } from "../domain/chat/chat";
// import { UserClient } from "./user/user.client";
import { UserClientMock } from "./user/user.client.mock";
import type { IGroupClient } from "./group/group.client.interface";
// import { GroupClient } from "./group/group.client";
// import { Principal } from "@dfinity/principal";
import { GroupClientMock } from "./group/group.client.mock";

export class ServiceContainer {
    private userIndexClient: IUserIndexClient;
    private _userClient?: IUserClient;
    private _groupClients: Record<string, IGroupClient>;

    constructor(private identity: Identity) {
        this.userIndexClient = new UserIndexClientMock();
        this._groupClients = {};
    }

    private getGroupClient(chatId: string): IGroupClient {
        if (!this._groupClients[chatId]) {
            // this._groupClients[chatId] = new GroupClient(this.identity, Principal.fromText(chatId));
            this._groupClients[chatId] = new GroupClientMock();
        }
        return this._groupClients[chatId];
    }

    private get userClient(): IUserClient {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to use the user client before it has been initialised");
    }

    directChatMessages(
        userId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<GetMessagesResponse> {
        return this.userClient.chatMessages(userId, fromIndex, toIndex);
    }

    groupChatMessages(
        chatId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<GetMessagesResponse> {
        return this.getGroupClient(chatId).chatMessages(fromIndex, toIndex);
    }

    createUserClient(_userId: string): ServiceContainer {
        this._userClient = new UserClientMock();
        // this._userClient = new UserClient(this.identity, userId);
        return this;
    }

    searchUsers(searchTerm: string): Promise<UserSummary[]> {
        return this.userIndexClient.searchUsers(searchTerm);
    }

    getUsers(userIds: string[], since: bigint): Promise<UsersResponse> {
        return this.userIndexClient.getUsers(userIds, since);
    }

    getChats(since: bigint): Promise<GetChatsResponse> {
        return this.userClient.getChats(since);
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.userIndexClient.getCurrentUser();
    }

    upgradeUser(): Promise<UpgradeCanisterResponse> {
        return this.userIndexClient.upgradeUser();
    }

    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return this.userIndexClient.submitPhoneNumber(phoneNumber);
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return this.userIndexClient.resendRegistrationCode();
    }

    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this.userIndexClient.confirmPhoneNumber(code);
    }

    setUsername(username: string): Promise<SetUsernameResponse> {
        return this.userIndexClient.setUsername(username);
    }

    createCanister(): Promise<CreateCanisterResponse> {
        return this.userIndexClient.createCanister();
    }
}
