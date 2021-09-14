import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, UserService } from "./candid/idl";
import type {
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    DirectChatEvent,
    MergedUpdatesResponse,
    ChatSummary,
    DirectMessage,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MessageIndexRange,
    MarkReadResponse,
} from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import {
    blockResponse,
    chunkResponse,
    createGroupResponse,
    getEventsResponse,
    getUpdatesResponse,
    leaveGroupResponse,
    markReadResponse,
    sendMessageResponse,
} from "./mappers";
import type { IUserClient } from "./user.client.interface";
import type { ChunkResponse } from "../../domain/data/data";
import { mergeChatUpdates } from "../../domain/chat/chat.utils";
import type { Database } from "../../utils/caching";
import { UserClientMock } from "./user.client.mock";
import { CachingUserClient } from "./user.caching.client";
import { apiMessageContent, apiOptional } from "../common/chatMappers";
import { DataClient } from "../data/data.client";

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;
    private userId: string;

    constructor(identity: Identity, userId: string) {
        super(identity);
        this.userId = userId;
        this.userService = this.createServiceClient<UserService>(idlFactory, userId);
    }

    static create(userId: string, identity: Identity, db?: Database): IUserClient {
        if (process.env.MOCK_SERVICES) {
            return db ? new CachingUserClient(db, new UserClientMock()) : new UserClientMock();
        }
        return db && process.env.CLIENT_CACHING
            ? new CachingUserClient(db, new UserClient(identity, userId))
            : new UserClient(identity, userId);
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.handleResponse(
            this.userService.create_group({
                is_public: group.isPublic,
                name: group.name,
                description: group.description,
                history_visible_to_new_joiners: group.historyVisible,
            }),
            createGroupResponse
        );
    }

    chatEvents(
        userId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.handleResponse(
            this.userService.events({
                user_id: Principal.fromText(userId),
                to_index: toIndex,
                from_index: fromIndex,
            }),
            getEventsResponse
        );
    }

    async getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs
    ): Promise<MergedUpdatesResponse> {
        const updatesResponse = await this.handleResponse(
            this.userService.updates({
                updates_since: args.updatesSince
                    ? [
                          {
                              timestamp: args.updatesSince.timestamp,
                              group_chats: args.updatesSince.groupChats.map((g) => ({
                                  chat_id: Principal.fromText(g.chatId),
                                  updates_since: g.lastUpdated,
                              })),
                          },
                      ]
                    : [],
            }),
            (resp) => getUpdatesResponse(resp)
        );
        return {
            chatSummaries: mergeChatUpdates(chatSummaries, updatesResponse),
            timestamp: updatesResponse.timestamp,
            blockedUsers: updatesResponse.blockedUsers,
        };
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

    sendMessage(
        recipientId: string,
        senderName: string,
        message: DirectMessage
    ): Promise<SendMessageResponse> {
        return DataClient.create(this.identity, this.userId)
            .uploadData(message.content)
            .then(() => {
                return this.handleResponse(
                    this.userService.send_message({
                        content: apiMessageContent(message.content),
                        recipient: Principal.fromText(recipientId),
                        sender_name: senderName,
                        message_id: message.messageId,
                        replies_to: apiOptional(
                            // todo - this is all kinds of wrong at the moment
                            (_replyContext) => ({
                                chat_id_if_other: [],
                                message_index: 0,
                            }),
                            message.repliesTo
                        ),
                    }),
                    sendMessageResponse
                );
            });
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.userService.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockResponse
        );
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.userService.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockResponse
        );
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.handleResponse(
            this.userService.leave_group({
                chat_id: Principal.fromText(chatId),
            }),
            leaveGroupResponse
        );
    }

    markMessagesRead(userId: string, ranges: MessageIndexRange[]): Promise<MarkReadResponse> {
        return this.handleResponse(
            this.userService.mark_read({
                user_id: Principal.fromText(userId),
                message_ranges: ranges,
            }),
            markReadResponse
        );
    }
}
