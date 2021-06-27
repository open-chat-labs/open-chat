import type { Identity } from "@dfinity/agent";
import type { GetCurrentUserResponse } from "../domain/user";
import type { ClaimResponse, RegisterResponse } from "../domain/phone";
import type { IUserService } from "./user/user.service.interface";
import type { IPhoneService } from "./phone/phone.service.interface";
// import { UserService } from "./user/user.service";
// import { PhoneService } from "./phone/phone.service";
import { UserServiceMock } from "./user/user.service.mock";
import { PhoneServiceMock } from "./phone/phone.service.mock";

export class ServiceContainer {
    private userService: IUserService;
    private phoneService: IPhoneService;

    constructor(_identity: Identity) {
        // this.userService = new UserService(identity);
        // this.phoneService = new PhoneService(identity);
        this.userService = new UserServiceMock();
        this.phoneService = new PhoneServiceMock();
    }

    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return this.userService.getCurrentUser();
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
}
