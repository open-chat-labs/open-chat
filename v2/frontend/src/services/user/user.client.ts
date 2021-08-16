import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import idlFactory, { UserService } from "./candid/idl";
import type {
    UpdatesResponse,
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
} from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import {
    chunkResponse,
    createGroupResponse,
    getEventsResponse,
    getUpdatesResponse,
} from "./mappers";
import type { IUserClient } from "./user.client.interface";
import type { ChunkResponse } from "../../domain/data/data";

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;

    constructor(identity: Identity, userId: Principal) {
        super(identity);
        this.userService = this.createServiceClient<UserService>(idlFactory, userId.toString());
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.handleResponse(
            this.userService.create_group({
                is_public: group.isPublic,
                name: group.name,
            }),
            createGroupResponse
        );
    }

    chatEvents(userId: string, fromIndex: number, toIndex: number): Promise<EventsResponse> {
        return this.handleResponse(
            this.userService.events({
                user_id: Principal.fromText(userId),
                to_index: toIndex,
                from_index: fromIndex,
            }),
            getEventsResponse
        );
    }

    chatEventsByIndex(userId: string, indexes: Set<number>): Promise<EventsResponse> {
        return this.handleResponse(
            this.userService.events_by_index({
                user_id: Principal.fromText(userId),
                events: [...indexes],
            }),
            getEventsResponse
        );
    }

    getUpdates(userId: string, args: UpdateArgs): Promise<UpdatesResponse> {
        return this.handleResponse(
            this.userService.updates({
                groups: args.groups.map((g) => ({
                    last_updated: g.lastUpdated,
                    chat_id: Principal.fromText(g.chatId),
                })),
                last_updated: args.lastUpdated ? [args.lastUpdated] : [],
            }),
            (resp) => getUpdatesResponse(userId, resp)
        );
    }

    async getData(blobId: bigint, totalBytes?: number, chunkSize?: number): Promise<ChunkResponse> {
        if (!totalBytes || !chunkSize) {
            return this.getChunk(blobId, 0);
        }
        return undefined;
    }

    private async getChunk(blobId: bigint, chunkIndex: number): Promise<ChunkResponse> {
        return this.handleResponse(
            this.userService.chunk({
                blob_id: blobId,
                index: chunkIndex,
            }),
            chunkResponse
        );
    }
}
