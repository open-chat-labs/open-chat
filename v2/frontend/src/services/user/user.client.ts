import type { Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import idlFactory, { UserService } from "api-canisters/user/src/canister/app/idl";
import type { GetChatsResponse } from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import { getChatsResponse } from "./mappers";
import type { IUserClient } from "./user.client.interface";

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;

    constructor(identity: Identity, userId: Principal) {
        super(identity);
        this.userService = this.createServiceClient<UserService>(idlFactory, userId.toString());
    }
    getChats(since: bigint): Promise<GetChatsResponse> {
        return this.handleResponse(
            this.userService.get_chats({
                message_count_for_top_chat: [],
                updated_since: [since],
            }),
            getChatsResponse
        );
    }
}
