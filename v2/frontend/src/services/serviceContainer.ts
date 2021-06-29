import type { Identity } from "@dfinity/agent";
import type { GetCurrentUserResponse, UpdateUsernameResponse } from "../domain/user";
import type { ClaimResponse, RegisterResponse } from "../domain/phone";
import type { IPhoneService } from "./phone/phone.service.interface";
// import { UserService } from "./user/user.service";
// import { PhoneService } from "./phone/phone.service";
import { UserIndexClientMock } from "./userIndex/userIndex.client.mock";
import { PhoneServiceMock } from "./phone/phone.service.mock";
import type { Principal } from "@dfinity/principal";
import type { IUserIndexClient } from "./userIndex/userIndex.client.interface";
import type { IUserClient } from "./user/user.client.interface";
import { UserClientMock } from "./user/user.client.mock";

export class ServiceContainer {
    private userIndexClient: IUserIndexClient;
    private _userClient?: IUserClient;
    private phoneService: IPhoneService;

    constructor(_identity: Identity) {
        // this.userService = new UserService(identity);
        // this.phoneService = new PhoneService(identity);
        this.userIndexClient = new UserIndexClientMock();
        this.phoneService = new PhoneServiceMock();

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

    getChats(): Promise<unknown> {
        return this.userClient.getChats();
    }

    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return this.userIndexClient.getCurrentUser();
    }

    registerPhoneNumber(countryCode: number, phoneNumber: number): Promise<RegisterResponse> {
        return this.phoneService.register(countryCode, phoneNumber);
    }

    claimPhoneNumber(
        code: number,
        countryCode: number,
        phoneNumber: number
    ): Promise<ClaimResponse> {
        return this.phoneService.claim(code, countryCode, phoneNumber);
    }

    updateUsername(userPrincipal: Principal, username: string): Promise<UpdateUsernameResponse> {
        return this.userIndexClient.updateUsername(userPrincipal, username);
    }
}
