import type { Identity } from "@dfinity/agent";
import { idlFactory, GroupService } from "./candid/idl";
import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
} from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import { addParticipantsResponse, getEventsResponse } from "./mappers";
import type { IGroupClient } from "./group.client.interface";
import { CachingGroupClient } from "./group.caching.client";
import { GroupClientMock } from "./group.client.mock";
import type { Database } from "../../utils/caching";
import { Principal } from "@dfinity/principal";

export class GroupClient extends CandidService implements IGroupClient {
    private groupService: GroupService;

    constructor(identity: Identity, userId: string) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, userId);
    }

    static create(chatId: string, identity: Identity, db?: Database): IGroupClient {
        if (process.env.MOCK_SERVICES) {
            return db
                ? new CachingGroupClient(db, chatId, new GroupClientMock())
                : new GroupClientMock();
        }
        return db
            ? new CachingGroupClient(db, chatId, new GroupClient(identity, chatId))
            : new GroupClient(identity, chatId);
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

    addParticipants(userIds: string[]): Promise<AddParticipantsResponse> {
        return this.handleResponse(
            this.groupService.add_participants({
                user_ids: userIds.map(Principal.fromText),
            }),
            addParticipantsResponse
        );
    }
}
