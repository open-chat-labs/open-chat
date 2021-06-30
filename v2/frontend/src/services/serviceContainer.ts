import type { Identity } from "@dfinity/agent";
import type {
    GetCurrentUserResponse,
    UpdateUsernameResponse,
    RegisterPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
} from "../domain/user";
// import { UserService } from "./user/user.service";
import { UserIndexClientMock } from "./userIndex/userIndex.client.mock";
import type { Principal } from "@dfinity/principal";
import type { IUserIndexClient } from "./userIndex/userIndex.client.interface";
import type { IUserClient } from "./user/user.client.interface";
import { UserClientMock } from "./user/user.client.mock";
import type { ChatSummary } from "../domain/chat";

export class ServiceContainer {
    private userIndexClient: IUserIndexClient;
    private _userClient?: IUserClient;

    constructor(_identity: Identity) {
        // this.userService = new UserService(identity);
        this.userIndexClient = new UserIndexClientMock();

        // todo - we need to know when this is going to get created
        // as soon as we have the canister id we need to create this service
        // which is annoying because it means that we then need to guard all
        // references to that service in case it has *not* been created
        // this._userClient = new UserClientMock();
    }

    private get userClient(): IUserClient {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to user the user client before it has been initialised");
    }

    getChats(): Promise<ChatSummary[]> {
        return this.userClient.getChats();
    }

    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return this.userIndexClient.getCurrentUser();
    }

    registerPhoneNumber(
        countryCode: number,
        phoneNumber: number
    ): Promise<RegisterPhoneNumberResponse> {
        return this.userIndexClient.registerPhoneNumber(countryCode, phoneNumber);
    }

    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this.userIndexClient.confirmPhoneNumber(code);
    }

    updateUsername(userPrincipal: Principal, username: string): Promise<UpdateUsernameResponse> {
        return this.userIndexClient.updateUsername(userPrincipal, username);
    }
}
