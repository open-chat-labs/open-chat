import type { Identity } from "@dfinity/agent";
import type {
    CheckUsernameResponse,
    CurrentUserResponse,
    SetUsernameResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersArgs,
    UsersResponse,
    UserSummary,
    User,
    SetBioResponse,
    RegisterUserResponse,
    UpgradeStorageResponse,
    PartialUserSummary,
    ChallengeAttempt,
    CreateChallengeResponse,
    PublicProfile,
    PinChatResponse,
    UnpinChatResponse,
    MigrateUserPrincipalResponse,
} from "../domain/user/user";
import type { IUserIndexClient } from "./userIndex/userIndex.client.interface";
import type { IUserClient } from "./user/user.client.interface";
import type {
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    DirectChatEvent,
    GroupChatEvent,
    ChatEvent,
    ChatSummary,
    MergedUpdatesResponse,
    AddParticipantsResponse,
    Message,
    SendMessageResponse,
    RemoveParticipantResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    UpdateGroupResponse,
    ToggleReactionResponse,
    IndexRange,
    EventWrapper,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    MarkReadRequest,
    ChangeRoleResponse,
    GroupChatDetailsResponse,
    GroupChatDetails,
    DeleteGroupResponse,
    MessageContent,
    GroupChatSummary,
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    GroupPermissions,
    PendingCryptocurrencyWithdrawal,
    WithdrawCryptocurrencyResponse,
    MakeGroupPrivateResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    UpdatePermissionsResponse,
    CurrentChatState,
    ThreadPreview,
    ThreadSyncDetails,
    RegisterProposalVoteResponse,
    ListNervousSystemFunctionsResponse,
} from "../domain/chat/chat";
import type { IGroupClient } from "./group/group.client.interface";
import { Database, getAllUsers, initDb } from "../utils/caching";
import { UserIndexClient } from "./userIndex/userIndex.client";
import { UserClient } from "./user/user.client";
import { GroupClient } from "./group/group.client";
import type { BlobReference, DataContent } from "../domain/data/data";
import { UnsupportedValueError } from "../utils/error";
import type {
    GroupSearchResponse,
    SearchAllMessagesResponse,
    SearchDirectChatResponse,
    SearchGroupChatResponse,
} from "../domain/search/search";
import { MarkMessagesRead, messagesRead } from "../stores/markRead";
import type { INotificationsClient } from "./notifications/notifications.client.interface";
import { NotificationsClient } from "./notifications/notifications.client";
import type { ToggleMuteNotificationResponse } from "../domain/notifications";
import type { IOnlineClient } from "./online/online.client.interface";
import { OnlineClient } from "./online/online.client";
import { DataClient } from "./data/data.client";
import { storageStore } from "../stores/storage";
import type { ILedgerClient } from "./ledger/ledger.client.interface";
import { LedgerClient } from "./ledger/ledger.client";
import type { Cryptocurrency, Tokens } from "../domain/crypto";
import { cryptoBalance } from "../stores/crypto";
import type { IGroupIndexClient } from "./groupIndex/groupIndex.client.interface";
import { GroupIndexClient } from "./groupIndex/groupIndex.client";
import type { ServiceRetryInterrupt } from "./candidService";
import { userStore } from "../stores/user";
import { toRecord } from "../utils/list";
import { measure } from "./common/profiling";
import { buildBlobUrl, buildUserAvatarUrl, threadsReadFromChat } from "../domain/chat/chat.utils";
import { SnsGovernanceClient } from "./snsGovernance/sns.governance.client";
import { snsFunctions } from "../stores/snsFunctions";
import { userCreatedStore } from "../stores/settings";

export const apiKey = Symbol();

export type GroupInvite = {
    chatId: string;
    code: string;
};

export class ServiceContainer implements MarkMessagesRead {
    private _userIndexClient: IUserIndexClient;
    private _onlineClient: IOnlineClient;
    private _groupIndexClient: IGroupIndexClient;
    private _userClient?: IUserClient;
    private _notificationClient: INotificationsClient;
    private _ledgerClients: Record<Cryptocurrency, ILedgerClient>;
    private _groupClients: Record<string, IGroupClient>;
    private _groupInvite: GroupInvite | undefined;
    private db?: Database;

    constructor(private identity: Identity) {
        this.db = initDb(identity.getPrincipal().toString());
        this._onlineClient = OnlineClient.create(identity);
        this._userIndexClient = UserIndexClient.create(identity, this.db);
        this._groupIndexClient = GroupIndexClient.create(identity);
        this._notificationClient = NotificationsClient.create(identity);
        this._ledgerClients = {
            icp: LedgerClient.create(identity, "process.env.LEDGER_CANISTER_ICP"),
            btc: LedgerClient.create(identity, "process.env.LEDGER_CANISTER_BTC"),
            chat: LedgerClient.create(identity, "process.env.LEDGER_CANISTER_CHAT"),
        };
        this._groupClients = {};
        if (this.db) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            measure("getAllUsers", () => getAllUsers(this.db!)).then((users) => {
                const lookup = toRecord(
                    users.map((user) => this.rehydrateUserSummary(user)),
                    (u) => u.userId
                );
                userStore.set(lookup);
            });
        }
    }

    public set groupInvite(value: GroupInvite) {
        this._groupInvite = value;
    }

    createUserClient(userId: string): ServiceContainer {
        this._userClient = UserClient.create(userId, this.identity, this.db, this._groupInvite);
        return this;
    }

    private getGroupClient(chatId: string): IGroupClient {
        if (!this._groupClients[chatId]) {
            const inviteCode = this.getProvidedInviteCode(chatId);
            this._groupClients[chatId] = GroupClient.create(
                chatId,
                this.identity,
                this.db,
                inviteCode
            );
        }
        return this._groupClients[chatId];
    }

    private get userClient(): IUserClient {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to use the user client before it has been initialised");
    }

    private getProvidedInviteCode(chatId: string): string | undefined {
        return this._groupInvite?.chatId === chatId ? this._groupInvite.code : undefined;
    }

    editMessage(
        chat: ChatSummary,
        msg: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse> {
        if (chat.kind === "group_chat") {
            return this.editGroupMessage(chat.chatId, msg, threadRootMessageIndex);
        }
        if (chat.kind === "direct_chat") {
            return this.editDirectMessage(chat.them, msg, threadRootMessageIndex);
        }
        throw new UnsupportedValueError("Unexpect chat type", chat);
    }

    sendMessage(
        chat: ChatSummary,
        user: UserSummary,
        mentioned: User[],
        msg: Message,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        if (chat.kind === "group_chat") {
            if (msg.content.kind === "crypto_content") {
                // TODO - this doesn't look like it's going to work in threads
                return this.userClient.sendGroupICPTransfer(
                    chat.chatId,
                    msg.content.transfer.recipient,
                    user,
                    msg
                );
            }
            return this.sendGroupMessage(
                chat.chatId,
                user.username,
                mentioned,
                msg,
                threadRootMessageIndex
            );
        }
        if (chat.kind === "direct_chat") {
            const replyingToChatId =
                msg.repliesTo &&
                msg.repliesTo.kind === "rehydrated_reply_context" &&
                chat.chatId !== msg.repliesTo.chatId
                    ? msg.repliesTo.chatId
                    : undefined;
            return this.sendDirectMessage(
                chat.them,
                user,
                msg,
                replyingToChatId,
                threadRootMessageIndex
            );
        }
        throw new UnsupportedValueError("Unexpect chat type", chat);
    }

    private sendGroupMessage(
        chatId: string,
        senderName: string,
        mentioned: User[],
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.getGroupClient(chatId).sendMessage(
            senderName,
            mentioned,
            message,
            threadRootMessageIndex
        );
    }

    private editGroupMessage(
        chatId: string,
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse> {
        return this.getGroupClient(chatId).editMessage(message, threadRootMessageIndex);
    }

    private sendDirectMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.userClient.sendMessage(
            recipientId,
            sender,
            message,
            replyingToChatId,
            threadRootMessageIndex
        );
    }

    private editDirectMessage(
        recipientId: string,
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse> {
        return this.userClient.editMessage(recipientId, message, threadRootMessageIndex);
    }

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.userClient.createGroup(candidate);
    }

    updateGroup(
        chatId: string,
        name: string,
        desc: string,
        avatar?: Uint8Array
    ): Promise<UpdateGroupResponse> {
        return this.getGroupClient(chatId).updateGroup(name, desc, avatar);
    }

    updatePermissions(
        chatId: string,
        permissions: Partial<GroupPermissions>
    ): Promise<UpdatePermissionsResponse> {
        return this.getGroupClient(chatId).updatePermissions(permissions);
    }

    addParticipants(
        chatId: string,
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddParticipantsResponse> {
        if (!userIds.length) {
            return Promise.resolve<AddParticipantsResponse>({ kind: "add_participants_success" });
        }
        return this.getGroupClient(chatId).addParticipants(userIds, myUsername, allowBlocked);
    }

    directChatEventsWindow(
        eventIndexRange: IndexRange,
        theirUserId: string,
        messageIndex: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            "direct",
            theirUserId,
            this.userClient.chatEventsWindow(eventIndexRange, theirUserId, messageIndex)
        );
    }

    chatEvents(
        chat: ChatSummary,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<ChatEvent>> {
        return chat.kind === "group_chat"
            ? this.groupChatEvents(
                  eventIndexRange,
                  chat.chatId,
                  startIndex,
                  ascending,
                  threadRootMessageIndex
              )
            : this.directChatEvents(
                  eventIndexRange,
                  chat.them,
                  startIndex,
                  ascending,
                  threadRootMessageIndex
              );
    }

    private directChatEvents(
        eventIndexRange: IndexRange,
        theirUserId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            "direct",
            theirUserId,
            this.userClient.chatEvents(
                eventIndexRange,
                theirUserId,
                startIndex,
                ascending,
                threadRootMessageIndex
            ),
            threadRootMessageIndex
        );
    }

    directChatEventsByEventIndex(
        theirUserId: string,
        eventIndexes: number[],
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            "direct",
            theirUserId,
            this.userClient.chatEventsByIndex(eventIndexes, theirUserId, threadRootMessageIndex),
            threadRootMessageIndex
        );
    }

    groupChatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: string,
        messageIndex: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            "group",
            chatId,
            this.getGroupClient(chatId).chatEventsWindow(eventIndexRange, messageIndex)
        );
    }

    private groupChatEvents(
        eventIndexRange: IndexRange,
        chatId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            "group",
            chatId,
            this.getGroupClient(chatId).chatEvents(
                eventIndexRange,
                startIndex,
                ascending,
                threadRootMessageIndex
            ),
            threadRootMessageIndex
        );
    }

    groupChatEventsByEventIndex(
        chatId: string,
        eventIndexes: number[],
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            "group",
            chatId,
            this.getGroupClient(chatId).chatEventsByIndex(eventIndexes, threadRootMessageIndex),
            threadRootMessageIndex
        );
    }

    private rehydrateMessageContent(content: MessageContent): MessageContent {
        if (
            (content.kind === "file_content" ||
                content.kind === "image_content" ||
                content.kind === "audio_content") &&
            content.blobReference !== undefined
        ) {
            content = this.rehydrateDataContent(content);
        }
        if (content.kind === "video_content") {
            return {
                ...content,
                videoData: this.rehydrateDataContent(content.videoData),
                imageData: this.rehydrateDataContent(content.imageData),
            };
        }
        return content;
    }

    private reydrateEventList<T extends ChatEvent>(events: EventWrapper<T>[]): EventWrapper<T>[] {
        return events.map((e) => {
            if (e.event.kind === "message") {
                return {
                    ...e,
                    event: {
                        ...e.event,
                        content: this.rehydrateMessageContent(e.event.content),
                    },
                };
            }
            return e;
        });
    }

    /**
     * Given a list of events, identify all eventIndexes which we may need to look up
     * In practice this means the event indexes of embedded reply contexts
     */
    private findMissingEventIndexesByChat<T extends ChatEvent>(
        defaultChatId: string,
        events: EventWrapper<T>[]
    ): Record<string, number[]> {
        return events.reduce<Record<string, number[]>>((result, ev) => {
            if (
                ev.event.kind === "message" &&
                ev.event.repliesTo &&
                ev.event.repliesTo.kind === "raw_reply_context"
            ) {
                const chatId = ev.event.repliesTo.chatIdIfOther ?? defaultChatId;
                if (result[chatId] === undefined) {
                    result[chatId] = [];
                }
                result[chatId].push(ev.event.repliesTo.eventIndex);
            }
            return result;
        }, {});
    }

    private messagesFromEventsResponse<T extends ChatEvent>(
        chatId: string,
        resp: EventsResponse<T>
    ): [string, EventWrapper<Message>[]] {
        if (resp !== "events_failed") {
            return [
                chatId,
                resp.events.reduce((msgs, ev) => {
                    if (ev.event.kind === "message") {
                        msgs.push(ev as EventWrapper<Message>);
                    }
                    return msgs;
                }, [] as EventWrapper<Message>[]),
            ];
        } else {
            return [chatId, []];
        }
    }

    private async resolveMissingIndexes<T extends ChatEvent>(
        chatType: "direct" | "group",
        currentChatId: string,
        events: EventWrapper<T>[],
        threadRootMessageIndex?: number
    ): Promise<Record<string, EventWrapper<Message>[]>> {
        const missing = this.findMissingEventIndexesByChat(currentChatId, events);
        const missingMessages: Promise<[string, EventWrapper<Message>[]]>[] = [];

        // this looks horrendous but remember these things will *usually* come straight from the cache
        Object.entries(missing).forEach(([chatId, idxs]) => {
            if (chatId === currentChatId && chatType === "direct") {
                missingMessages.push(
                    this.userClient
                        .chatEventsByIndex(idxs, currentChatId, threadRootMessageIndex)
                        .then((resp) => this.messagesFromEventsResponse(chatId, resp))
                );
            } else {
                // it must be a group chat
                const client = this.getGroupClient(chatId);
                missingMessages.push(
                    client
                        .chatEventsByIndex(idxs, threadRootMessageIndex)
                        .then((resp) => this.messagesFromEventsResponse(chatId, resp))
                );
            }
        });

        const result = await Promise.all(missingMessages);
        return result.reduce<Record<string, EventWrapper<Message>[]>>((res, [chatId, messages]) => {
            if (!res[chatId]) {
                res[chatId] = [];
            }
            res[chatId] = res[chatId].concat(messages);
            return res;
        }, {});
    }

    private rehydrateMissingReplies<T extends ChatEvent>(
        defaultChatId: string,
        events: EventWrapper<T>[],
        missing: Record<string, EventWrapper<Message>[]>
    ): EventWrapper<T>[] {
        return events.map((ev) => {
            if (
                ev.event.kind === "message" &&
                ev.event.repliesTo &&
                ev.event.repliesTo.kind === "raw_reply_context"
            ) {
                const chatId = ev.event.repliesTo.chatIdIfOther ?? defaultChatId;
                const messageEvents = missing[chatId];
                const idx = ev.event.repliesTo.eventIndex;
                const msg = messageEvents.find((me) => me.index === idx)?.event;
                if (msg) {
                    return {
                        ...ev,
                        event: {
                            ...ev.event,
                            repliesTo: {
                                kind: "rehydrated_reply_context",
                                content: this.rehydrateMessageContent(msg.content),
                                senderId: msg.sender,
                                messageId: msg.messageId,
                                messageIndex: msg.messageIndex,
                                eventIndex: idx,
                                chatId,
                                edited: msg.edited,
                            },
                        },
                    };
                }
                return ev;
            }
            return ev;
        });
    }

    private async rehydrateEventResponse<T extends ChatEvent>(
        chatType: "direct" | "group",
        currentChatId: string,
        eventsPromise: Promise<EventsResponse<T>>,
        threadRootMessageIndex?: number
    ): Promise<EventsResponse<T>> {
        const resp = await eventsPromise;

        if (resp === "events_failed") {
            return resp;
        }

        const missing = await this.resolveMissingIndexes(
            chatType,
            currentChatId,
            resp.events,
            threadRootMessageIndex
        );
        resp.events = this.rehydrateMissingReplies(currentChatId, resp.events, missing);
        resp.events = this.reydrateEventList(resp.events);
        resp.affectedEvents = this.reydrateEventList(resp.affectedEvents);
        return resp;
    }

    rehydrateUserSummary<T extends UserSummary | PartialUserSummary>(userSummary: T): T {
        const ref = userSummary.blobReference;
        return {
            ...userSummary,
            blobData: undefined,
            blobUrl: buildUserAvatarUrl(userSummary.userId, ref?.blobId ?? undefined),
        };
    }

    rehydrateDataContent<T extends DataContent>(
        dataContent: T,
        blobType: "blobs" | "avatar" = "blobs"
    ): T {
        const ref = dataContent.blobReference;
        return ref !== undefined
            ? {
                  ...dataContent,
                  blobData: undefined,
                  blobUrl: buildBlobUrl(ref.canisterId, ref.blobId, blobType),
              }
            : dataContent;
    }

    async rehydrateMessage(
        chatType: "direct" | "group",
        currentChatId: string,
        message: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<EventWrapper<Message>> {
        const missing = await this.resolveMissingIndexes(
            chatType,
            currentChatId,
            [message],
            threadRootMessageIndex
        );
        [message] = this.rehydrateMissingReplies(currentChatId, [message], missing);
        [message] = this.reydrateEventList([message]);
        return message;
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this._userIndexClient
            .searchUsers(searchTerm, maxResults)
            .then((users) => users.map((u) => this.rehydrateUserSummary(u)));
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this._groupIndexClient.search(searchTerm, maxResults).then((res) => {
            if (res.kind === "success") {
                return {
                    ...res,
                    matches: res.matches.map((match) => this.rehydrateDataContent(match, "avatar")),
                };
            }
            return res;
        });
    }

    searchAllMessages(searchTerm: string, maxResults = 10): Promise<SearchAllMessagesResponse> {
        return this.userClient.searchAllMessages(searchTerm, maxResults);
    }

    searchGroupChat(
        chatId: string,
        searchTerm: string,
        maxResults = 10
    ): Promise<SearchGroupChatResponse> {
        return this.getGroupClient(chatId).searchGroupChat(searchTerm, maxResults);
    }

    searchDirectChat(
        userId: string,
        searchTerm: string,
        maxResults = 10
    ): Promise<SearchDirectChatResponse> {
        return this.userClient.searchDirectChat(userId, searchTerm, maxResults);
    }

    async getUser(userId: string, allowStale = false): Promise<PartialUserSummary | undefined> {
        const response = await this.getUsers(
            {
                userGroups: [
                    {
                        users: [userId],
                        updatedSince: BigInt(0),
                    },
                ],
            },
            allowStale
        );

        if (response.users.length == 0) {
            return undefined;
        }

        return response.users[0];
    }

    getUsers(users: UsersArgs, allowStale = false): Promise<UsersResponse> {
        return this._userIndexClient.getUsers(users, allowStale).then((resp) => ({
            ...resp,
            users: resp.users.map((u) => this.rehydrateUserSummary(u)),
        }));
    }

    private async handleMergedUpdatesResponse(
        resp: MergedUpdatesResponse,
        rehydrateLastMessage = true
    ): Promise<MergedUpdatesResponse> {
        const chatSummaries = await Promise.all(
            resp.chatSummaries.map(async (chat) => {
                messagesRead.syncWithServer(chat.chatId, chat.readByMe, threadsReadFromChat(chat));

                if (chat.latestMessage !== undefined && rehydrateLastMessage) {
                    const chatType = chat.kind === "direct_chat" ? "direct" : "group";
                    const latestMessage = await this.rehydrateMessage(
                        chatType,
                        chat.chatId,
                        chat.latestMessage
                    );
                    chat = {
                        ...chat,
                        latestMessage,
                    };
                }

                return chat.kind === "direct_chat"
                    ? chat
                    : this.rehydrateDataContent(chat, "avatar");
            })
        );

        return {
            ...resp,
            chatSummaries,
        };
    }

    getInitialState(selectedChatId: string | undefined): Promise<MergedUpdatesResponse> {
        return this.userClient.getInitialState(selectedChatId).then((resp) => {
            return this.handleMergedUpdatesResponse(resp, false);
        });
    }

    getUpdates(
        currentState: CurrentChatState,
        args: UpdateArgs,
        selectedChatId: string | undefined
    ): Promise<MergedUpdatesResponse> {
        return this.userClient.getUpdates(currentState, args, selectedChatId).then((resp) => {
            return this.handleMergedUpdatesResponse(resp);
        });
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this._userIndexClient.getCurrentUser().then((response) => {
            if (response.kind === "created_user") {
                userCreatedStore.set(true);
            }
            return response;
        });
    }

    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return this._userIndexClient.submitPhoneNumber(phoneNumber);
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return this._userIndexClient.resendRegistrationCode();
    }

    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this._userIndexClient.confirmPhoneNumber(code);
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        return this._userIndexClient.checkUsername(username);
    }

    setUsername(userId: string, username: string): Promise<SetUsernameResponse> {
        return this._userIndexClient.setUsername(userId, username);
    }

    changeRole(chatId: string, userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        return this.getGroupClient(chatId).changeRole(userId, newRole);
    }

    deleteGroup(chatId: string): Promise<DeleteGroupResponse> {
        return this.userClient.deleteGroup(chatId);
    }

    makeGroupPrivate(chatId: string): Promise<MakeGroupPrivateResponse> {
        return this.getGroupClient(chatId).makeGroupPrivate();
    }

    removeParticipant(chatId: string, userId: string): Promise<RemoveParticipantResponse> {
        return this.getGroupClient(chatId).removeParticipant(userId);
    }

    blockUserFromDirectChat(userId: string): Promise<BlockUserResponse> {
        return this.userClient.blockUser(userId);
    }

    blockUserFromGroupChat(chatId: string, userId: string): Promise<BlockUserResponse> {
        return this.getGroupClient(chatId).blockUser(userId);
    }

    unblockUserFromGroupChat(chatId: string, userId: string): Promise<UnblockUserResponse> {
        return this.getGroupClient(chatId).unblockUser(userId);
    }

    unblockUserFromDirectChat(userId: string): Promise<UnblockUserResponse> {
        return this.userClient.unblockUser(userId);
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        if (this._groupInvite?.chatId === chatId) {
            this._groupInvite = undefined;
        }

        return this.userClient.leaveGroup(chatId);
    }

    joinGroup(chatId: string): Promise<JoinGroupResponse> {
        const inviteCode = this.getProvidedInviteCode(chatId);
        return this.userClient.joinGroup(chatId, inviteCode);
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.userClient.markMessagesRead(request);
    }

    setUserAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.userClient.setAvatar(data);
    }

    toggleGroupChatReaction(
        chatId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<ToggleReactionResponse> {
        return this.getGroupClient(chatId).toggleReaction(
            messageId,
            reaction,
            threadRootMessageIndex
        );
    }

    toggleDirectChatReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<ToggleReactionResponse> {
        return this.userClient.toggleReaction(
            otherUserId,
            messageId,
            reaction,
            threadRootMessageIndex
        );
    }

    deleteMessage(
        chat: ChatSummary,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return chat.kind === "group_chat"
            ? this.deleteGroupMessage(chat.chatId, messageId, threadRootMessageIndex)
            : this.deleteDirectMessage(chat.them, messageId, threadRootMessageIndex);
    }

    private deleteGroupMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return this.getGroupClient(chatId).deleteMessage(messageId, threadRootMessageIndex);
    }

    private deleteDirectMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return this.userClient.deleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }

    markAsOnline(): Promise<void> {
        return this._onlineClient.markAsOnline();
    }

    subscriptionExists(userId: string, p256dh_key: string): Promise<boolean> {
        return this._notificationClient.subscriptionExists(userId, p256dh_key);
    }

    pushSubscription(userId: string, subscription: PushSubscription): Promise<void> {
        return this._notificationClient.pushSubscription(userId, subscription);
    }

    removeSubscription(userId: string, subscription: PushSubscription): Promise<void> {
        return this._notificationClient.removeSubscription(userId, subscription);
    }

    toggleMuteNotifications(
        chatId: string,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse> {
        return this.userClient.toggleMuteNotifications(chatId, muted);
    }

    getGroupDetails(chatId: string, latestEventIndex: number): Promise<GroupChatDetailsResponse> {
        return this.getGroupClient(chatId).getGroupDetails(latestEventIndex);
    }

    async getGroupDetailsUpdates(
        chatId: string,
        previous: GroupChatDetails
    ): Promise<GroupChatDetails> {
        return this.getGroupClient(chatId).getGroupDetailsUpdates(previous);
    }

    getPublicGroupSummary(chatId: string): Promise<GroupChatSummary | undefined> {
        return this.getGroupClient(chatId).getPublicSummary();
    }

    getRecommendedGroups(interrupt: ServiceRetryInterrupt): Promise<GroupChatSummary[]> {
        return this.userClient
            .getRecommendedGroups(interrupt)
            .then((groups) => groups.map((g) => this.rehydrateDataContent(g, "avatar")));
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.userClient.dismissRecommendation(chatId);
    }

    getBio(userId?: string): Promise<string> {
        const userClient = userId
            ? UserClient.create(userId, this.identity, undefined, undefined)
            : this.userClient;
        return userClient.getBio();
    }

    getPublicProfile(userId?: string): Promise<PublicProfile> {
        const userClient = userId
            ? UserClient.create(userId, this.identity, undefined, undefined)
            : this.userClient;
        return userClient.getPublicProfile();
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.userClient.setBio(bio);
    }

    createChallenge(): Promise<CreateChallengeResponse> {
        return this._userIndexClient.createChallenge();
    }

    registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt,
        referredBy: string | undefined
    ): Promise<RegisterUserResponse> {
        return this._userIndexClient.registerUser(username, challengeAttempt, referredBy);
    }

    getUserStorageLimits(): Promise<void> {
        // do we need to do something if this fails? Not sure there's much we can do
        return DataClient.create(this.identity).storageStatus().then(storageStore.set);
    }

    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse> {
        return this._userIndexClient.upgradeStorage(newLimitBytes);
    }

    refreshAccountBalance(crypto: Cryptocurrency, account: string): Promise<Tokens> {
        return this._ledgerClients[crypto].accountBalance(account).then((val) => {
            cryptoBalance.set(crypto, val);
            return val;
        });
    }

    getGroupMessagesByMessageIndex(
        chatId: string,
        messageIndexes: Set<number>
    ): Promise<EventsResponse<Message>> {
        return this.rehydrateEventResponse(
            "group",
            chatId,
            this.getGroupClient(chatId).getMessagesByMessageIndex(messageIndexes)
        );
    }

    pinMessage(chatId: string, messageIndex: number): Promise<PinMessageResponse> {
        return this.getGroupClient(chatId).pinMessage(messageIndex);
    }

    unpinMessage(chatId: string, messageIndex: number): Promise<UnpinMessageResponse> {
        return this.getGroupClient(chatId).unpinMessage(messageIndex);
    }

    registerPollVote(
        chatId: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse> {
        return this.getGroupClient(chatId).registerPollVote(
            messageIdx,
            answerIdx,
            voteType,
            threadRootMessageIndex
        );
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse> {
        return this.userClient.withdrawCryptocurrency(domain);
    }

    getInviteCode(chatId: string): Promise<InviteCodeResponse> {
        return this.getGroupClient(chatId).getInviteCode();
    }

    enableInviteCode(chatId: string): Promise<EnableInviteCodeResponse> {
        return this.getGroupClient(chatId).enableInviteCode();
    }

    disableInviteCode(chatId: string): Promise<DisableInviteCodeResponse> {
        return this.getGroupClient(chatId).disableInviteCode();
    }

    resetInviteCode(chatId: string): Promise<ResetInviteCodeResponse> {
        return this.getGroupClient(chatId).resetInviteCode();
    }

    pinChat(chatId: string): Promise<PinChatResponse> {
        return this.userClient.pinChat(chatId);
    }

    unpinChat(chatId: string): Promise<UnpinChatResponse> {
        return this.userClient.unpinChat(chatId);
    }

    registerProposalVote(
        chatId: string,
        messageIndex: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.getGroupClient(chatId).registerProposalVote(messageIndex, adopt);
    }

    initUserPrincipalMigration(newPrincipal: string): Promise<void> {
        return this.userClient.initUserPrincipalMigration(newPrincipal);
    }

    migrateUserPrincipal(userId: string): Promise<MigrateUserPrincipalResponse> {
        const userClient = UserClient.create(userId, this.identity, undefined, undefined);
        return userClient.migrateUserPrincipal();
    }

    listNervousSystemFunctions(
        snsGovernanceCanisterId: string
    ): Promise<ListNervousSystemFunctionsResponse> {
        return SnsGovernanceClient.create(this.identity, snsGovernanceCanisterId)
            .listNervousSystemFunctions()
            .then((val) => {
                snsFunctions.set(snsGovernanceCanisterId, val.functions);
                return val;
            });
    }

    async threadPreviews(
        threadsByChat: Record<string, ThreadSyncDetails[]>
    ): Promise<ThreadPreview[]> {
        function latestMessageTimestamp(messages: EventWrapper<Message>[]): bigint {
            return messages[messages.length - 1]?.timestamp ?? BigInt(0);
        }

        return Promise.all(
            Object.entries(threadsByChat).map(([chatId, threadSyncs]) =>
                this.getGroupClient(chatId).threadPreviews(
                    threadSyncs.map((t) => t.threadRootMessageIndex)
                )
            )
        ).then((responses) =>
            Promise.all(
                responses.map((r) => {
                    return r.kind === "thread_previews_success"
                        ? Promise.all(r.threads.map((t) => this.rehydrateThreadPreview(t)))
                        : [];
                })
            ).then((threads) =>
                threads
                    .flat()
                    .sort((a, b) =>
                        Number(
                            latestMessageTimestamp(b.latestReplies) -
                                latestMessageTimestamp(a.latestReplies)
                        )
                    )
            )
        );
    }

    private async rehydrateThreadPreview(thread: ThreadPreview): Promise<ThreadPreview> {
        const threadMissing = await this.resolveMissingIndexes(
            "group",
            thread.chatId,
            thread.latestReplies,
            thread.rootMessage.event.messageIndex
        );

        const rootMissing = await this.resolveMissingIndexes("group", thread.chatId, [
            thread.rootMessage,
        ]);

        const replies = this.reydrateEventList(
            this.rehydrateMissingReplies(thread.chatId, thread.latestReplies, threadMissing)
        );

        const [rootMsg] = this.reydrateEventList(
            this.rehydrateMissingReplies(thread.chatId, [thread.rootMessage], rootMissing)
        );

        return {
            ...thread,
            rootMessage: {
                ...rootMsg,
                event: {
                    ...rootMsg.event,
                    content: this.rehydrateMessageContent(rootMsg.event.content),
                },
            },
            latestReplies: replies.map((r) => ({
                ...r,
                event: {
                    ...r.event,
                    content: this.rehydrateMessageContent(r.event.content),
                },
            })),
        };
    }
}
