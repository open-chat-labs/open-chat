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
    createGroupResponse,
    getEventsResponse,
    getUpdatesResponse,
    leaveGroupResponse,
    markReadResponse,
    sendMessageResponse,
    setAvatarResponse,
} from "./mappers";
import type { IUserClient } from "./user.client.interface";
import { mergeChatUpdates } from "../../domain/chat/chat.utils";
import type { Database } from "../../utils/caching";
import { CachingUserClient } from "./user.caching.client";
import { apiMessageContent, apiOptional } from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import type { BlobReference } from "../../domain/data/data";

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;
    private userId: string;

    constructor(identity: Identity, userId: string) {
        super(identity);
        this.userId = userId;
        this.userService = this.createServiceClient<UserService>(idlFactory, userId);
    }

    static create(userId: string, identity: Identity, db?: Database): IUserClient {
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
                avatar: apiOptional((data) => {
                    return {
                        id: DataClient.newBlobId(),
                        data: Array.from(data),
                        mime_type: "image/jpg",
                    };
                }, group.avatar?.blobData),
            }),
            createGroupResponse
        );
    }

    chatEvents(
        userId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.handleResponse(
            this.userService.events({
                user_id: Principal.fromText(userId),
                max_messages: 20,
                max_events: 50,
                start_index: startIndex,
                ascending,
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

    setAvatar(bytes: Uint8Array): Promise<BlobReference> {
        const blobId = DataClient.newBlobId();
        return this.handleResponse(
            this.userService.set_avatar({
                id: blobId,
                data: Array.from(bytes),
                mime_type: "image/jpg",
            }),
            setAvatarResponse
        ).then((resp) => {
            if (resp === "success") {
                return {
                    blobId,
                    canisterId: this.userId,
                };
            }
            throw new Error("Unable to set avatar");
        });
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
                            (replyContext) => ({
                                chat_id_if_other:
                                    replyContext.kind === "direct_private_reply_context"
                                        ? [Principal.fromText(replyContext.chatId)]
                                        : [],
                                message_id: replyContext.messageId,
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
            this.userService.unblock_user({
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
