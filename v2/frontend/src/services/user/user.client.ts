import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import idlFactory, { UserService } from "api-canisters/user/src/canister/app/idl";
import type { GetChatsResponse, GetMessagesResponse } from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import { getChatsResponse, getMessagesResponse } from "./mappers";
import type { IUserClient } from "./user.client.interface";

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;

    constructor(identity: Identity, userId: Principal) {
        super(identity);
        this.userService = this.createServiceClient<UserService>(idlFactory, userId.toString());
    }

    chatMessages(userId: string, fromIndex: number, toIndex: number): Promise<GetMessagesResponse> {
        return this.handleResponse(
            this.userService.get_messages({
                user_id: Principal.fromText(userId),
                to_index: toIndex,
                from_index: fromIndex,
            }),
            getMessagesResponse
        );
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
