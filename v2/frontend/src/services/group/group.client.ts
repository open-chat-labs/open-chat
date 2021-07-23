import type { Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import idlFactory, { GroupService } from "api-canisters/group/src/canister/app/idl";
import type { MessagesResponse } from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import { getMessagesResponse } from "./mappers";
import type { IGroupClient } from "./group.client.interface";

export class GroupClient extends CandidService implements IGroupClient {
    private groupService: GroupService;

    constructor(identity: Identity, userId: Principal) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, userId.toString());
    }

    chatMessages(fromIndex: number, toIndex: number): Promise<MessagesResponse> {
        return this.handleResponse(
            this.groupService.get_messages({
                to_index: toIndex,
                from_index: fromIndex,
            }),
            getMessagesResponse
        );
    }
}
