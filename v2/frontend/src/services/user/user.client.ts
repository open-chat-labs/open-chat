import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import idlFactory, { UserService } from "api-canisters/user/src/canister/app/idl";
import type { UpdatesResponse, MessagesResponse, UpdateArgs } from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import { getMessagesResponse, getUpdatesResponse } from "./mappers";
import type { IUserClient } from "./user.client.interface";

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;

    constructor(identity: Identity, userId: Principal) {
        super(identity);
        this.userService = this.createServiceClient<UserService>(idlFactory, userId.toString());
    }

    chatMessages(userId: string, fromIndex: number, toIndex: number): Promise<MessagesResponse> {
        return this.handleResponse(
            this.userService.messages({
                user_id: Principal.fromText(userId),
                to_index: toIndex,
                from_index: fromIndex,
            }),
            getMessagesResponse
        );
    }

    getUpdates(args: UpdateArgs): Promise<UpdatesResponse> {
        return this.handleResponse(
            this.userService.updates({
                groups: args.groups.map((g) => ({
                    last_updated: g.lastUpdated,
                    chat_id: Principal.fromText(g.chatId),
                })),
                last_updated: args.lastUpdated ? [args.lastUpdated] : [],
            }),
            getUpdatesResponse
        );
    }
}
