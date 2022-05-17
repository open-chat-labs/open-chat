import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import {
    ApiSendMessageArgs,
    ApiTransferCryptocurrencyWithinGroupArgs,
    idlFactory,
    UserService,
} from "./candid/idl";
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
    ToggleReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    MarkReadRequest,
    GroupChatSummary,
    RegisterPollVoteResponse,
    PendingICPWithdrawal,
    WithdrawCryptocurrencyResponse,
    CryptocurrencyContent,
    Alert,
} from "../../domain/chat/chat";
import { CandidService, ServiceRetryInterrupt } from "../candidService";
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
    transferWithinGroupResponse,
} from "./mappers";
import type { IUserClient } from "./user.client.interface";
import {
    compareChats,
    MAX_EVENTS,
    MAX_MESSAGES,
    mergeChatUpdates,
} from "../../domain/chat/chat.utils";
import { cachingLocallyDisabled, Database } from "../../utils/caching";
import { CachingUserClient } from "./user.caching.client";
import {
    apiCryptoContent,
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
import { getChatEventsInLoop } from "../common/chatEvents";
import { profile } from "../common/profiling";
import type { IMessageReadTracker } from "../../stores/markRead";
import { base64ToBigint } from "../../utils/base64";
import type { GroupInvite } from "../../services/serviceContainer";
import { dedupe } from "utils/list";

export class UserClient extends CandidService implements IUserClient {
    private userService: UserService;
    userId: string;

    constructor(identity: Identity, userId: string) {
        super(identity);
        this.userId = userId;
        this.userService = this.createServiceClient<UserService>(idlFactory, userId);
    }

    static create(
        userId: string,
        identity: Identity,
        db: Database | undefined,
        groupInvite: GroupInvite | undefined
    ): IUserClient {
        return db && process.env.CLIENT_CACHING && !cachingLocallyDisabled()
            ? new CachingUserClient(db, identity, new UserClient(identity, userId), groupInvite)
            : new UserClient(identity, userId);
    }

    @profile("userClient")
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

    @profile("userClient")
    chatEventsByIndex(
        eventIndexes: number[],
        userId: string
    ): Promise<EventsResponse<DirectChatEvent>> {
        const args = {
            user_id: Principal.fromText(userId),
            events: eventIndexes,
        };
        return this.handleQueryResponse(
            () => this.userService.events_by_index(args),
            getEventsResponse,
            args
        );
    }

    @profile("userClient")
    async chatEventsWindow(
        _eventIndexRange: IndexRange,
        userId: string,
        messageIndex: number,
        interrupt: ServiceRetryInterrupt
    ): Promise<EventsResponse<DirectChatEvent>> {
        const args = {
            user_id: Principal.fromText(userId),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
        };
        return this.handleQueryResponse(
            () => this.userService.events_window(args),
            getEventsResponse,
            args,
            interrupt
        );
    }

    @profile("userClient")
    chatEvents(
        eventIndexRange: IndexRange,
        userId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<DirectChatEvent>> {
        const getChatEventsFunc = (index: number, asc: boolean) => {
            const args = {
                user_id: Principal.fromText(userId),
                max_messages: MAX_MESSAGES,
                max_events: MAX_EVENTS,
                start_index: index,
                ascending: asc,
            };

            return this.handleQueryResponse(
                () => this.userService.events(args),
                getEventsResponse,
                args
            );
        };

        return getChatEventsInLoop(getChatEventsFunc, eventIndexRange, startIndex, ascending);
    }

    @profile("userClient")
    async getInitialState(
        _: IMessageReadTracker,
        _selectedChatId?: string
    ): Promise<MergedUpdatesResponse> {
        const resp = await this.handleQueryResponse(
            () => this.userService.initial_state({}),
            initialStateResponse
        );

        return {
            wasUpdated: true,
            chatSummaries: resp.chats.sort(compareChats),
            timestamp: resp.timestamp,
            blockedUsers: resp.blockedUsers,
            avatarIdUpdate: undefined,
            affectedEvents: {},
            alerts: resp.alerts,
        };
    }

    @profile("userClient")
    async getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs,
        alerts: Alert[],
        _: IMessageReadTracker,
        _selectedChatId?: string
    ): Promise<MergedUpdatesResponse> {
        const updatesResponse = await this.handleQueryResponse(
            () =>
                this.userService.updates({
                    updates_since: {
                        timestamp: args.updatesSince.timestamp,
                        group_chats: args.updatesSince.groupChats.map((g) => ({
                            chat_id: Principal.fromText(g.chatId),
                            updates_since: g.lastUpdated,
                        })),
                    },
                }),
            getUpdatesResponse,
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
            alerts: dedupe((a, b) => a.id === b.id, [...alerts, ...updatesResponse.alerts]),
        };
    }

    @profile("userClient")
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

    @profile("userClient")
    editMessage(recipientId: string, message: Message): Promise<EditMessageResponse> {
        return DataClient.create(this.identity)
            .uploadData(message.content, [this.userId, recipientId])
            .then(({ content }) => {
                const req = {
                    content: apiMessageContent(content ?? message.content),
                    user_id: Principal.fromText(recipientId),
                    message_id: message.messageId,
                };
                return this.handleResponse(this.userService.edit_message(req), editMessageResponse);
            });
    }

    @profile("userClient")
    sendMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string
    ): Promise<SendMessageResponse> {
        return DataClient.create(this.identity)
            .uploadData(message.content, [this.userId, recipientId])
            .then(({ content }) => {
                const req: ApiSendMessageArgs = {
                    content: apiMessageContent(content ?? message.content),
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

    @profile("userClient")
    sendGroupICPTransfer(
        groupId: string,
        recipientId: string,
        sender: UserSummary,
        message: Message
    ): Promise<SendMessageResponse> {
        const req: ApiTransferCryptocurrencyWithinGroupArgs = {
            content: apiCryptoContent(message.content as CryptocurrencyContent),
            recipient: Principal.fromText(recipientId),
            sender_name: sender.username,
            mentioned: [],
            message_id: message.messageId,
            group_id: Principal.fromText(groupId),
            replies_to: apiOptional(
                (replyContext) => apiReplyContextArgs(replyContext),
                message.repliesTo
            ),
        };
        return this.handleResponse(
            this.userService.transfer_cryptocurrency_within_group(req),
            transferWithinGroupResponse
        );
    }

    @profile("userClient")
    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.userService.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockResponse
        );
    }

    @profile("userClient")
    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.userService.unblock_user({
                user_id: Principal.fromText(userId),
            }),
            unblockResponse
        );
    }

    @profile("userClient")
    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.handleResponse(
            this.userService.leave_group({
                chat_id: Principal.fromText(chatId),
            }),
            leaveGroupResponse
        );
    }

    @profile("userClient")
    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse> {
        return this.handleResponse(
            this.userService.join_group_v2({
                as_super_admin: false,
                chat_id: Principal.fromText(chatId),
                invite_code: apiOptional(base64ToBigint, inviteCode),
            }),
            joinGroupResponse
        );
    }

    @profile("userClient")
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

    @profile("userClient")
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

    @profile("userClient")
    deleteMessage(otherUserId: string, messageId: bigint): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.userService.delete_messages({
                user_id: Principal.fromText(otherUserId),
                message_ids: [messageId],
            }),
            deleteMessageResponse
        );
    }

    @profile("userClient")
    searchAllMessages(searchTerm: string, maxResults = 10): Promise<SearchAllMessagesResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(
            () => this.userService.search_all_messages(args),
            searchAllMessagesResponse,
            args
        );
    }

    @profile("userClient")
    searchDirectChat(
        userId: string,
        searchTerm: string,
        maxResults: number
    ): Promise<SearchDirectChatResponse> {
        const args = {
            user_id: Principal.fromText(userId),
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(
            () => this.userService.search_messages(args),
            searchDirectChatResponse,
            args
        );
    }

    @profile("userClient")
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

    @profile("userClient")
    getRecommendedGroups(interrupt: ServiceRetryInterrupt): Promise<GroupChatSummary[]> {
        const args = {
            count: 20,
        };
        return this.handleQueryResponse(
            () => this.userService.recommended_groups(args),
            recommendedGroupsResponse,
            args,
            interrupt
        );
    }

    @profile("userClient")
    dismissRecommendation(chatId: string): Promise<void> {
        return this.handleResponse(
            this.userService.add_recommended_group_exclusions({
                duration: [],
                groups: [Principal.fromText(chatId)],
            }),
            toVoid
        );
    }

    @profile("userClient")
    getBio(): Promise<string> {
        return this.handleQueryResponse(
            () => this.userService.bio({}),
            (candid) => candid.Success
        );
    }

    @profile("userClient")
    setBio(bio: string): Promise<SetBioResponse> {
        return this.handleResponse(this.userService.set_bio({ text: bio }), setBioResponse);
    }

    @profile("userClient")
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

    @profile("userClient")
    withdrawICP(domain: PendingICPWithdrawal): Promise<WithdrawCryptocurrencyResponse> {
        const req = {
            withdrawal: apiPendingICPWithdrawal(domain),
        };
        return this.handleResponse(
            this.userService.withdraw_cryptocurrency(req),
            withdrawCryptoResponse
        );
    }
}
