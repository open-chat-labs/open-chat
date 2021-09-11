import type { Identity } from "@dfinity/agent";
import { idlFactory, GroupService } from "./candid/idl";
import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    GroupMessage,
    ChangeAdminResponse,
    SendMessageResponse,
    RemoveParticipantResponse,
} from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import {
    addParticipantsResponse,
    getEventsResponse,
    changeAdminResponse,
    sendMessageResponse,
    removeParticipantResponse,
} from "./mappers";
import type { IGroupClient } from "./group.client.interface";
import { CachingGroupClient } from "./group.caching.client";
import { GroupClientMock } from "./group.client.mock";
import type { Database } from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import { apiMessageContent, apiOptional } from "../common/chatMappers";
import { DataClient } from "../data/data.client";

export class GroupClient extends CandidService implements IGroupClient {
    private groupService: GroupService;

    constructor(identity: Identity, private chatId: string) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, chatId);
    }

    static create(chatId: string, identity: Identity, db?: Database): IGroupClient {
        if (process.env.MOCK_SERVICES) {
            return db
                ? new CachingGroupClient(db, chatId, new GroupClientMock())
                : new GroupClientMock();
        }
        return db && process.env.CLIENT_CACHING
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
                user_ids: userIds.map((u) => Principal.fromText(u)),
            }),
            addParticipantsResponse
        );
    }

    makeAdmin(userId: string): Promise<ChangeAdminResponse> {
        return this.handleResponse(
            this.groupService.make_admin({
                user_id: Principal.fromText(userId),
            }),
            changeAdminResponse
        );
    }

    dismissAsAdmin(userId: string): Promise<ChangeAdminResponse> {
        return this.handleResponse(
            this.groupService.remove_admin({
                user_id: Principal.fromText(userId),
            }),
            changeAdminResponse
        );
    }

    removeParticipant(userId: string): Promise<RemoveParticipantResponse> {
        return this.handleResponse(
            this.groupService.remove_participant({
                user_id: Principal.fromText(userId),
            }),
            removeParticipantResponse
        );
    }

    sendMessage(senderName: string, message: GroupMessage): Promise<SendMessageResponse> {
        return DataClient.create(this.identity, this.chatId)
            .uploadData(message.content)
            .then(() => {
                return this.handleResponse(
                    this.groupService.send_message({
                        content: apiMessageContent(message.content),
                        message_id: message.messageId,
                        sender_name: senderName,
                        replies_to: apiOptional(
                            // todo - this is a problem - reply context does not contain messageId.
                            (_replyContext) => ({ message_id: BigInt(0) }),
                            message.repliesTo
                        ),
                    }),
                    sendMessageResponse
                );
            });
    }
}
