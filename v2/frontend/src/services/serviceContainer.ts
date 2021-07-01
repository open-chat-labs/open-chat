import type { Identity } from "@dfinity/agent";
import type {
    CurrentUserResponse,
    SetUsernameResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
} from "../domain/user";
import { UserIndexClientMock } from "./userIndex/userIndex.client.mock";
import type { IUserIndexClient } from "./userIndex/userIndex.client.interface";
import type { IUserClient } from "./user/user.client.interface";
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
        throw new Error("Attempted to use the user client before it has been initialised");
    }

    getChats(): Promise<ChatSummary[]> {
        return this.userClient.getChats();
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.userIndexClient.getCurrentUser();
    }

    upgradeUser(): Promise<void> {
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

    createCanister(): Promise<void> {
        return this.userIndexClient.createCanister();
    }
}
