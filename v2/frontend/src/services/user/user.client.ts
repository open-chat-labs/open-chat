import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import idlFactory, { UserService } from "api-canisters/user/src/canister/app/idl";
import type { ChatSummary, UpdatesResponse, MessagesResponse } from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import { getChatsResponse, getMessagesResponse } from "./mappers";
import type { IUserClient } from "./user.client.interface";

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;

    constructor(identity: Identity, userId: Principal) {
        super(identity);
        this.userService = this.createServiceClient<UserService>(idlFactory, userId.toString());
    }

    chatMessages(userId: string, fromIndex: number, toIndex: number): Promise<MessagesResponse> {
        return this.handleResponse(
            this.userService.get_messages({
                user_id: Principal.fromText(userId),
                to_index: toIndex,
                from_index: fromIndex,
            }),
            getMessagesResponse
        );
    }

    getChats(since: bigint): Promise<UpdatesResponse> {
        return this.handleResponse(
            this.userService.get_chats({
                message_count_for_top_chat: [],
                updated_since: [since],
            }),
            getChatsResponse
        );
    }

    // todo - this is not actually going to look like this but we need a stub in the meantime that does the job
    updateChats(chats: ChatSummary[]): Promise<UpdatesResponse> {
        const _req = chats.map((c) => ({ chatId: c.chatId, lastUpdated: c.lastUpdated }));
        return this.handleResponse(
            this.userService.get_chats({
                message_count_for_top_chat: [],
                updated_since: [BigInt(0)],
            }),
            getChatsResponse
        );
    }
}
