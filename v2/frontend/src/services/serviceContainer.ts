import type { Identity } from "@dfinity/agent";
import { UserService } from "./userService";
import type { GetCurrentUserResponse } from "../domain/user";
import type { ClaimResponse, RegisterResponse } from "../domain/phone";
import { PhoneService } from "./phoneService";

export class ServiceContainer {
    private userService: UserService;
    private phoneService: PhoneService;

    constructor(identity: Identity) {
        this.userService = new UserService(identity);
        this.phoneService = new PhoneService(identity);
    }

    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return this.userService.getCurrentUser();
    }

    registerPhoneNumber(): Promise<RegisterResponse> {
        return this.phoneService.register();
    }

    claimPhoneNumber(): Promise<ClaimResponse> {
        return this.phoneService.claim();
    }
}
