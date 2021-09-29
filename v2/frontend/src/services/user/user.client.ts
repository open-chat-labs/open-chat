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
    Message,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MessageIndexRange,
    MarkReadResponse,
    IndexRange,
    EventWrapper,
    ToggleReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
} from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import {
    blockResponse,
    createGroupResponse,
    deleteMessageResponse,
    editMessageResponse,
    getEventsResponse,
    getUpdatesResponse,
    joinGroupResponse,
    leaveGroupResponse,
    markReadResponse,
    searchAllMessageResponse,
    sendMessageResponse,
    setAvatarResponse,
    toggleReactionResponse,
} from "./mappers";
import type { IUserClient } from "./user.client.interface";
import { enoughVisibleMessages, mergeChatUpdates, nextIndex } from "../../domain/chat/chat.utils";
import type { Database } from "../../utils/caching";
import { CachingUserClient } from "./user.caching.client";
import { apiMessageContent, apiOptional } from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import type { BlobReference } from "../../domain/data/data";
import type { UserSummary } from "../../domain/user/user";
import type { SearchAllMessagesResponse } from "../../domain/search/search";

const MAX_RECURSION = 10;

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

    async chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean,
        previouslyLoadedEvents: EventWrapper<DirectChatEvent>[] = [],
        iterations = 0
    ): Promise<EventsResponse<DirectChatEvent>> {
        console.log("index range: ", eventIndexRange);
        console.log("loading messages from: ", startIndex, " : ", ascending);
        const resp = await this.handleResponse(
            this.userService.events({
                user_id: Principal.fromText(userId),
                max_messages: 20,
                max_events: 50,
                start_index: startIndex,
                ascending,
            }),
            getEventsResponse
        );
        if (resp === "chat_not_found") {
            return resp;
        }

        // merge the retrieved events with the events accumulated from the previous iteration(s)
        // todo - we also need to merge affected events
        const merged = ascending
            ? [...previouslyLoadedEvents, ...resp.events]
            : [...resp.events, ...previouslyLoadedEvents];

        // check whether we have accumulated enough messages to display
        if (enoughVisibleMessages(ascending, eventIndexRange, merged)) {
            console.log("we got enough visible messages to display now");
            return { ...resp, events: merged };
        } else if (iterations < MAX_RECURSION) {
            // recurse and get the next chunk since we don't yet have enough events
            console.log("we don't have enough message, recursing", resp.events);
            return this.chatEvents(
                eventIndexRange,
                userId,
                nextIndex(ascending, merged),
                ascending,
                merged,
                iterations + 1
            );
        } else {
            throw new Error(
                `Reached the maximum number of iterations of ${MAX_RECURSION} when trying to load events`
            );
        }
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
            (resp) => getUpdatesResponse(resp),
            args
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

    editMessage(recipientId: string, message: Message): Promise<EditMessageResponse> {
        return DataClient.create(this.identity, this.userId)
            .uploadData(message.content)
            .then(() => {
                const req = {
                    content: apiMessageContent(message.content),
                    user_id: Principal.fromText(recipientId),
                    message_id: message.messageId,
                };
                return this.handleResponse(this.userService.edit_message(req), editMessageResponse);
            });
    }

    sendMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string
    ): Promise<SendMessageResponse> {
        return DataClient.create(this.identity, this.userId)
            .uploadData(message.content)
            .then(() => {
                const req = {
                    content: apiMessageContent(message.content),
                    recipient: Principal.fromText(recipientId),
                    sender_name: sender.username,
                    message_id: message.messageId,
                    replies_to: apiOptional(
                        (replyContext) => ({
                            sender: Principal.fromText(sender.userId),
                            chat_id_if_other: apiOptional(
                                (id) => Principal.fromText(id),
                                replyingToChatId
                            ),
                            message_id: replyContext.messageId,
                        }),
                        message.repliesTo
                    ),
                };
                return this.handleResponse(this.userService.send_message(req), sendMessageResponse);
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

    joinGroup(chatId: string): Promise<JoinGroupResponse> {
        return this.handleResponse(
            this.userService.join_group({
                chat_id: Principal.fromText(chatId),
            }),
            joinGroupResponse
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

    toggleReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string
    ): Promise<ToggleReactionResponse> {
        return this.handleResponse(
            this.userService.toggle_reaction({
                user_id: Principal.fromText(otherUserId),
                message_id: messageId,
                reaction,
            }),
            toggleReactionResponse
        );
    }

    deleteMessage(otherUserId: string, messageId: bigint): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.userService.delete_messages({
                user_id: Principal.fromText(otherUserId),
                message_ids: [messageId],
            }),
            deleteMessageResponse
        );
    }

    searchAllMessages(searchTerm: string, maxResults = 10): Promise<SearchAllMessagesResponse> {
        return this.handleResponse(
            this.userService.search_all_messages({
                search_term: searchTerm,
                max_results: maxResults,
            }),
            searchAllMessageResponse
        );
    }
}
