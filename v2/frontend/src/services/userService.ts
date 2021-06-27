import type { Identity } from "@dfinity/agent";
import { CandidService } from "./candidService";
import idlFactory, { UserIndexService } from "api-canisters/user_index/canister";
import type { GetCurrentUserResponse } from "../domain/user";
import { fromCandid as mapGetCurrentUserResponse } from "./mappers/user";

export class UserService extends CandidService {
    private userService: UserIndexService;

    constructor(identity: Identity) {
        super(identity);
        console.log(idlFactory);
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
            mapGetCurrentUserResponse
        );
    }
}
