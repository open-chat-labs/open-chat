import type { Identity } from "@dfinity/agent";
import idlFactory, { UserService } from "api-canisters/user/canister";
import type { ChatSummary } from "../../domain/chat";
import { CandidService } from "../candidService";
import { getChatsResponse } from "./mappers";
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
    getChats(): Promise<ChatSummary[]> {
        return this.handleResponse(
            this.userService.get_chats({
                message_count_for_top_chat: [],
                updated_since: [],
            }),
            getChatsResponse
        );
    }
}
