import type { Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import idlFactory, { UserService } from "api-canisters/user/canister";
import { CandidService } from "../candidService";
import type { IUserClient } from "./user.client.interface";

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;

    constructor(identity: Identity) {
        super(identity);
        this.userService = this.createServiceClient<UserService>(
            idlFactory,
            "user_canister_id" // todo - we need to pass this in as it is dynamic
        );
    }
    getChats(): Promise<unknown> {
        throw new Error("Method not implemented.");
    }
}
