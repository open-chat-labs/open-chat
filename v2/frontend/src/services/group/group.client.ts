import type { Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import { idlFactory, GroupService } from "./candid/idl";
import type { EventsResponse, GroupChatEvent } from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import { getEventsResponse } from "./mappers";
import type { IGroupClient } from "./group.client.interface";

export class GroupClient extends CandidService implements IGroupClient {
    private groupService: GroupService;

    constructor(identity: Identity, userId: Principal) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, userId.toString());
    }

    chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse<GroupChatEvent>> {
        return this.handleResponse(
            this.groupService.events({
                to_index: toIndex,
                from_index: fromIndex,
            }),
            getEventsResponse
        );
    }
}
