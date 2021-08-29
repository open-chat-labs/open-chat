import type { Identity } from "@dfinity/agent";
import { idlFactory, GroupService } from "./candid/idl";
import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    GroupMessage,
    SendMessageResponse,
    PutChunkResponse,
} from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import {
    addParticipantsResponse,
    getEventsResponse,
    putChunkResponse,
    sendMessageResponse,
} from "./mappers";
import type { IGroupClient } from "./group.client.interface";
import { CachingGroupClient } from "./group.caching.client";
import { GroupClientMock } from "./group.client.mock";
import type { Database } from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import { v1 as uuidv1 } from "uuid";
import { apiMessageContent, apiOptional } from "../common/chatMappers";

const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB

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

    putChunk(blobId: bigint, bytes: Uint8Array, index: number): Promise<PutChunkResponse> {
        console.log("puting a chunk");
        return this.handleResponse(
            this.groupService.put_chunk({
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

    // todo - ideally we would like to push this data into the indexdb cache on the way through the caching
    // proxy. Not going to worry about this becuase this data may well end up not being cached in indexdb at all
    private async uploadData(message: GroupMessage): Promise<boolean> {
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

    sendMessage(senderName: string, message: GroupMessage): Promise<SendMessageResponse> {
        return this.uploadData(message).then(() => {
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
