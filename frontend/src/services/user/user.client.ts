import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { ApiSendMessageArgs, idlFactory, UserService } from "./candid/idl";
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
    MarkReadResponse,
    IndexRange,
    EventWrapper,
    ToggleReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    MarkReadRequest,
    GroupChatSummary,
    RegisterPollVoteResponse,
    PendingICPWithdrawal,
    WithdrawCryptocurrencyResponse,
} from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import {
    blockResponse,
    createGroupResponse,
    deleteMessageResponse,
    editMessageResponse,
    getEventsResponse,
    getUpdatesResponse,
    initialStateResponse,
    joinGroupResponse,
    leaveGroupResponse,
    markReadResponse,
    recommendedGroupsResponse,
    searchDirectChatResponse,
    searchAllMessagesResponse,
    sendMessageResponse,
    setAvatarResponse,
    setBioResponse,
    toggleReactionResponse,
    unblockResponse,
    withdrawCryptoResponse,
} from "./mappers";
import type { IUserClient } from "./user.client.interface";
import {
    compareChats,
    enoughVisibleMessages,
    mergeChatUpdates,
    nextIndex,
} from "../../domain/chat/chat.utils";
import type { Database } from "../../utils/caching";
import { CachingUserClient } from "./user.caching.client";
import {
    apiGroupPermissions,
    apiMessageContent,
    apiOptional,
    apiPendingICPWithdrawal,
    apiReplyContextArgs,
    registerPollVoteResponse,
} from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import type { BlobReference } from "../../domain/data/data";
import type { SetBioResponse, UserSummary } from "../../domain/user/user";
import type {
    SearchAllMessagesResponse,
    SearchDirectChatResponse,
} from "../../domain/search/search";
import type { ToggleMuteNotificationResponse } from "../../domain/notifications";
import { muteNotificationsResponse } from "../notifications/mappers";
import { identity, toVoid } from "../../utils/mapping";

const MAX_RECURSION = 10;

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;
    userId: string;

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
                permissions: [apiGroupPermissions(group.permissions)],
            }),
            createGroupResponse
        );
    }

    chatEventsByIndex(
        eventIndexes: number[],
        userId: string
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.handleResponse(
            this.userService.events_by_index({
                user_id: Principal.fromText(userId),
                events: eventIndexes,
            }),
            getEventsResponse
        );
    }

    async chatEventsWindow(
        _eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.handleResponse(
            this.userService.events_window({
                user_id: Principal.fromText(userId),
                max_messages: 30,
                max_events: 200,
                mid_point: messageIndex,
            }),
            getEventsResponse
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
        const resp = await this.handleResponse(
            this.userService.events({
                user_id: Principal.fromText(userId),
                max_messages: 30,
                max_events: 50,
                start_index: startIndex,
                ascending,
            }),
            getEventsResponse
        );
        if (resp === "events_failed") {
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
            const idx = nextIndex(ascending, merged);
            if (idx === undefined) {
                // this will happen if we didn't get any events.
                return { ...resp, events: merged };
            } else {
                // recurse and get the next chunk since we don't yet have enough events
                console.log("we don't have enough message, recursing", resp.events);
                return this.chatEvents(
                    eventIndexRange,
                    userId,
                    idx,
                    ascending,
                    merged,
                    iterations + 1
                );
            }
        } else {
            throw new Error(
                `Reached the maximum number of iterations of ${MAX_RECURSION} when trying to load events: ascending (${ascending}), range (${eventIndexRange}), so far (${previouslyLoadedEvents.length})`
            );
        }
    }

    async getInitialState(): Promise<MergedUpdatesResponse> {
        const resp = await this.handleResponse(
            this.userService.initial_state({}),
            initialStateResponse
        );

        return {
            wasUpdated: true,
            chatSummaries: resp.chats.sort(compareChats),
            timestamp: resp.timestamp,
            blockedUsers: resp.blockedUsers,
            avatarIdUpdate: undefined,
            affectedEvents: {},
        };
    }

    async getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs
    ): Promise<MergedUpdatesResponse> {
        const updatesResponse = await this.handleResponse(
            this.userService.updates({
                updates_since: {
                    timestamp: args.updatesSince.timestamp,
                    group_chats: args.updatesSince.groupChats.map((g) => ({
                        chat_id: Principal.fromText(g.chatId),
                        updates_since: g.lastUpdated,
                    })),
                },
            }),
            (resp) => getUpdatesResponse(resp),
            args
        );

        const anyUpdates =
            updatesResponse.blockedUsers.size > 0 ||
            updatesResponse.chatsUpdated.length > 0 ||
            updatesResponse.chatsAdded.length > 0 ||
            updatesResponse.chatsRemoved.size > 0 ||
            updatesResponse.avatarIdUpdate !== undefined ||
            updatesResponse.cyclesBalance !== undefined ||
            updatesResponse.transactions.length > 0 ||
            updatesResponse.alerts.length > 0;

        return {
            wasUpdated: anyUpdates,
            chatSummaries: anyUpdates
                ? mergeChatUpdates(chatSummaries, updatesResponse)
                : chatSummaries,
            timestamp: updatesResponse.timestamp,
            blockedUsers: updatesResponse.blockedUsers,
            avatarIdUpdate: updatesResponse.avatarIdUpdate,
            affectedEvents: updatesResponse.chatsUpdated.reduce((result, chatSummary) => {
                if (chatSummary.affectedEvents.length > 0) {
                    result[chatSummary.chatId] = chatSummary.affectedEvents;
                }
                return result;
            }, {} as Record<string, number[]>),
        };
    }

    setAvatar(bytes: Uint8Array): Promise<BlobReference> {
        const blobId = DataClient.newBlobId();
        return this.handleResponse(
            this.userService.set_avatar({
                avatar: apiOptional(identity, {
                    id: blobId,
                    data: Array.from(bytes),
                    mime_type: "image/jpg",
                }),
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
        return DataClient.create(this.identity)
            .uploadData(message.content, [this.userId, recipientId])
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
        return DataClient.create(this.identity)
            .uploadData(message.content, [this.userId, recipientId])
            .then(() => {
                const req: ApiSendMessageArgs = {
                    content: apiMessageContent(message.content),
                    recipient: Principal.fromText(recipientId),
                    sender_name: sender.username,
                    message_id: message.messageId,
                    replies_to: apiOptional(
                        (replyContext) => apiReplyContextArgs(replyContext, replyingToChatId),
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
            unblockResponse
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
            this.userService.join_group_v2({
                as_super_admin: false,
                chat_id: Principal.fromText(chatId),
            }),
            joinGroupResponse
        );
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.handleResponse(
            this.userService.mark_read({
                messages_read: request.map(({ chatId, ranges }) => ({
                    chat_id: Principal.fromText(chatId),
                    message_ranges: ranges.subranges().map((r) => ({
                        from: r.low,
                        to: r.high,
                    })),
                })),
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
            searchAllMessagesResponse
        );
    }

    searchDirectChat(
        userId: string,
        searchTerm: string,
        maxResults: number
    ): Promise<SearchDirectChatResponse> {
        return this.handleResponse(
            this.userService.search_messages({
                user_id: Principal.fromText(userId),
                search_term: searchTerm,
                max_results: maxResults,
            }),
            searchDirectChatResponse
        );
    }

    toggleMuteNotifications(
        chatId: string,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse> {
        if (muted) {
            return this.handleResponse(
                this.userService.mute_notifications({
                    chat_id: Principal.fromText(chatId),
                }),
                muteNotificationsResponse
            );
        } else {
            return this.handleResponse(
                this.userService.unmute_notifications({
                    chat_id: Principal.fromText(chatId),
                }),
                muteNotificationsResponse
            );
        }
    }

    getRecommendedGroups(): Promise<GroupChatSummary[]> {
        return this.handleResponse(
            this.userService.recommended_groups({
                count: 20,
            }),
            recommendedGroupsResponse
        );
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.handleResponse(
            this.userService.add_recommended_group_exclusions({
                duration: [],
                groups: [Principal.fromText(chatId)],
            }),
            toVoid
        );
    }

    getBio(): Promise<string> {
        return this.handleResponse(this.userService.bio({}), (candid) => candid.Success);
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.handleResponse(this.userService.set_bio({ text: bio }), setBioResponse);
    }

    registerPollVote(
        otherUser: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete"
    ): Promise<RegisterPollVoteResponse> {
        return this.handleResponse(
            this.userService.register_poll_vote({
                user_id: Principal.fromText(otherUser),
                poll_option: answerIdx,
                operation: voteType === "register" ? { RegisterVote: null } : { DeleteVote: null },
                message_index: messageIdx,
            }),
            registerPollVoteResponse
        );
    }

    withdrawICP(domain: PendingICPWithdrawal): Promise<WithdrawCryptocurrencyResponse> {
        const req = {
            withdrawal: {
                ICP: apiPendingICPWithdrawal(domain),
            },
        };
        return this.handleResponse(
            this.userService.withdraw_cryptocurrency(req),
            withdrawCryptoResponse
        );
    }
}
