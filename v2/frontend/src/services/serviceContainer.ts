import type { Identity } from "@dfinity/agent";
import { UserService } from "./userService";
import type { GetCurrentUserResponse } from "../domain/user";

export class ServiceContainer {
    private userService: UserService;
    constructor(identity: Identity) {
        this.userService = new UserService(identity);
    }

    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return this.userService.getCurrentUser();
    }
}
