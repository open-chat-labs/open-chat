import type { Identity } from "@dfinity/agent";
import idlFactory, { UserIndexService } from "api-canisters/user_index/canister";
import type { GetCurrentUserResponse } from "../../domain/user";
import { CandidService } from "../candidService";
import { getCurrentUserResponse } from "./mappers";
import type { IUserService } from "./user.service.interface";

export class UserService extends CandidService implements IUserService {
    private userService: UserIndexService;

    constructor(identity: Identity) {
        super(identity);
        this.userService = this.createServiceClient<UserIndexService>(
            idlFactory,
            "user_index_canister_id" // todo - where does this come from
        );
    }

    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return this.handleResponse(
            this.userService.get_current_user({
                user_id: [],
                username: [],
            }),
            getCurrentUserResponse
        );
    }
}
