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
    PutChunkResponse,
} from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import {
    chunkResponse,
    createGroupResponse,
    getEventsResponse,
    getUpdatesResponse,
    putChunkResponse,
    sendMessageResponse,
} from "./mappers";
import type { IUserClient } from "./user.client.interface";
import type { ChunkResponse } from "../../domain/data/data";
import { mergeChatUpdates } from "../../domain/chat/chat.utils";
import type { Database } from "../../utils/caching";
import { UserClientMock } from "./user.client.mock";
import { CachingUserClient } from "./user.caching.client";
import { apiMessageContent, apiOptional } from "../common/chatMappers";
import { v1 as uuidv1 } from "uuid";

const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

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

    putChunk(blobId: bigint, bytes: Uint8Array, index: number): Promise<PutChunkResponse> {
        console.log("puting a chunk");
        return this.handleResponse(
            this.userService.put_chunk({
                blob_id: blobId,
                bytes: Array.from(bytes),
                index,
            }),
            putChunkResponse
        );
    }

    private newBlobId(): bigint {
        return BigInt(parseInt(uuidv1().replace(/-/g, ""), 16));
    }

    private async uploadData(message: DirectMessage): Promise<boolean> {
        if (message.content.kind === "file_content" || message.content.kind === "media_content") {
            console.log("got a media message");
            if (message.content.blobData) {
                console.log("got some blobdata");
                const data = await message.content.blobData;
                const blobId = this.newBlobId();
                if (data) {
                    console.log("blobdata is not undefined");
                    const size = data.byteLength;
                    const chunks = [];
                    for (let byteStart = 0; byteStart < size; byteStart += CHUNK_SIZE_BYTES) {
                        const byteEnd = Math.min(size, byteStart + CHUNK_SIZE_BYTES);
                        const slice = data.slice(byteStart, byteEnd);
                        chunks.push(slice);
                    }

                    // todo - are we supposed to create the blob ref here?
                    // how do we know the canisterId? Is it either the user's
                    // canister or the group canister?
                    message.content.blobReference = {
                        blobId,
                        chunkSize: CHUNK_SIZE_BYTES,
                        blobSize: size,
                        canisterId: this.userId,
                    };

                    await Promise.all(
                        chunks.map((chunk, i) => {
                            return this.putChunk(blobId, chunk, i);
                        })
                    );
                }
            }
        }

        return Promise.resolve(true);
    }

    sendMessage(
        recipientId: string,
        senderName: string,
        message: DirectMessage
    ): Promise<SendMessageResponse> {
        return this.uploadData(message).then(() => {
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
}
