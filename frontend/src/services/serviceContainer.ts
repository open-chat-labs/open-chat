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
} from "../domain/user/user";
import type { IUserIndexClient } from "./userIndex/userIndex.client.interface";
import type { IUserClient } from "./user/user.client.interface";
import Identicon from "identicon.js";
import md5 from "md5";
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
    PendingICPWithdrawal,
    WithdrawCryptocurrencyResponse,
} from "../domain/chat/chat";
import type { IGroupClient } from "./group/group.client.interface";
import { Database, initDb } from "../utils/caching";
import type { IGroupIndexClient } from "./groupIndex/groupIndex.client.interface";
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
import { GroupIndexClient } from "./groupIndex/groupIndex.client";
import type { IMessageReadTracker, MarkMessagesRead } from "../stores/markRead";
import type { INotificationsClient } from "./notifications/notifications.client.interface";
import { NotificationsClient } from "./notifications/notifications.client";
import type { ToggleMuteNotificationResponse } from "../domain/notifications";
import type { IOnlineClient } from "./online/online.client.interface";
import { OnlineClient } from "./online/online.client";
import { DataClient } from "./data/data.client";
import { storageStore } from "../stores/storage";
import type { ILedgerClient } from "./ledger/ledger.client.interface";
import { LedgerClient } from "./ledger/ledger.client";
import type { ICP } from "../domain/crypto/crypto";
import { icpBalanceE8sStore } from "../stores/balance";

function buildIdenticonUrl(userId: string) {
    const identicon = new Identicon(md5(userId), {
        margin: 0,
        format: "svg",
    });
    return `data:image/svg+xml;base64,${identicon}`;
}

export const apiKey = Symbol();

export class ServiceContainer implements MarkMessagesRead {
    private _userIndexClient: IUserIndexClient;
    private _onlineClient: IOnlineClient;
    private _groupIndexClient: IGroupIndexClient;
    private _userClient?: IUserClient;
    private _notificationClient: INotificationsClient;
    private _ledgerClient: ILedgerClient;
    private _groupClients: Record<string, IGroupClient>;
    private db?: Database;

    constructor(private identity: Identity) {
        this.db = initDb(identity.getPrincipal().toString());
        this._onlineClient = OnlineClient.create(identity);
        this._userIndexClient = UserIndexClient.create(identity, this.db);
        this._groupIndexClient = GroupIndexClient.create(identity);
        this._notificationClient = NotificationsClient.create(identity);
        this._ledgerClient = LedgerClient.create(identity);
        this._groupClients = {};
    }

    createUserClient(userId: string): ServiceContainer {
        this._userClient = UserClient.create(userId, this.identity, this.db);
        return this;
    }

    private getGroupClient(chatId: string): IGroupClient {
        if (!this._groupClients[chatId]) {
            this._groupClients[chatId] = GroupClient.create(chatId, this.identity, this.db);
        }
        return this._groupClients[chatId];
    }

    private get userClient(): IUserClient {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to use the user client before it has been initialised");
    }

    editMessage(chat: ChatSummary, msg: Message): Promise<EditMessageResponse> {
        if (chat.kind === "group_chat") {
            return this.editGroupMessage(chat.chatId, msg);
        }
        if (chat.kind === "direct_chat") {
            return this.editDirectMessage(chat.them, msg);
        }
        throw new UnsupportedValueError("Unexpect chat type", chat);
    }

    sendMessage(
        chat: ChatSummary,
        user: UserSummary,
        mentioned: User[],
        msg: Message
    ): Promise<SendMessageResponse> {
        if (chat.kind === "group_chat") {
            return this.sendGroupMessage(chat.chatId, user.username, mentioned, msg);
        }
        if (chat.kind === "direct_chat") {
            const replyingToChatId =
                msg.repliesTo &&
                msg.repliesTo.kind === "rehydrated_reply_context" &&
                chat.chatId !== msg.repliesTo.chatId
                    ? msg.repliesTo.chatId
                    : undefined;
            return this.sendDirectMessage(chat.them, user, msg, replyingToChatId);
        }
        throw new UnsupportedValueError("Unexpect chat type", chat);
    }

    private sendGroupMessage(
        chatId: string,
        senderName: string,
        mentioned: User[],
        message: Message
    ): Promise<SendMessageResponse> {
        return this.getGroupClient(chatId).sendMessage(senderName, mentioned, message);
    }

    private editGroupMessage(chatId: string, message: Message): Promise<EditMessageResponse> {
        return this.getGroupClient(chatId).editMessage(message);
    }

    private sendDirectMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string
    ): Promise<SendMessageResponse> {
        return this.userClient.sendMessage(recipientId, sender, message, replyingToChatId);
    }

    private editDirectMessage(recipientId: string, message: Message): Promise<EditMessageResponse> {
        return this.userClient.editMessage(recipientId, message);
    }

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.userClient.createGroup(candidate);
    }

    updateGroup(
        chatId: string,
        name: string,
        desc: string,
        avatar?: Uint8Array,
        permissions?: GroupPermissions
    ): Promise<UpdateGroupResponse> {
        return this.getGroupClient(chatId).updateGroup(name, desc, avatar, permissions);
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

    directChatEvents(
        eventIndexRange: IndexRange,
        theirUserId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            "direct",
            theirUserId,
            this.userClient.chatEvents(eventIndexRange, theirUserId, startIndex, ascending)
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

    groupChatEvents(
        eventIndexRange: IndexRange,
        chatId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            "group",
            chatId,
            this.getGroupClient(chatId).chatEvents(eventIndexRange, startIndex, ascending)
        );
    }

    private rehydrateMessageContent(content: MessageContent): MessageContent {
        if (
            (content.kind === "file_content" ||
                content.kind === "image_content" ||
                content.kind === "audio_content") &&
            content.blobReference !== undefined
        ) {
            content = this.rehydrateDataContent(content, "blobs");
        }
        if (content.kind === "video_content") {
            content.videoData = this.rehydrateDataContent(content.videoData, "blobs");
            content.imageData = this.rehydrateDataContent(content.imageData, "blobs");
        }
        return content;
    }

    private reydrateEventList<T extends ChatEvent>(events: EventWrapper<T>[]): EventWrapper<T>[] {
        return events.map((e) => {
            if (e.event.kind === "message") {
                e.event.content = this.rehydrateMessageContent(e.event.content);
            }
            return e;
        });
    }

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
        events: EventWrapper<T>[]
    ): Promise<Record<string, EventWrapper<Message>[]>> {
        const missing = this.findMissingEventIndexesByChat(currentChatId, events);
        const missingMessages: Promise<[string, EventWrapper<Message>[]]>[] = [];

        // this looks horrendous but remember these things will *usually* come straight from the cache
        Object.entries(missing).forEach(([chatId, idxs]) => {
            if (chatId === currentChatId && chatType === "direct") {
                missingMessages.push(
                    this.userClient
                        .chatEventsByIndex(idxs, currentChatId)
                        .then((resp) => this.messagesFromEventsResponse(chatId, resp))
                );
            } else {
                // it must be a group chat
                const client = GroupClient.create(chatId, this.identity, this.db);
                missingMessages.push(
                    client
                        .chatEventsByIndex(idxs)
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
                    ev.event.repliesTo = {
                        kind: "rehydrated_reply_context",
                        content: this.rehydrateMessageContent(msg.content),
                        senderId: msg.sender,
                        messageId: msg.messageId,
                        messageIndex: msg.messageIndex,
                        eventIndex: idx,
                        chatId,
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
        eventsPromise: Promise<EventsResponse<T>>
    ): Promise<EventsResponse<T>> {
        const resp = await eventsPromise;

        if (resp === "events_failed") {
            return resp;
        }

        const missing = await this.resolveMissingIndexes(chatType, currentChatId, resp.events);
        resp.events = this.rehydrateMissingReplies(currentChatId, resp.events, missing);
        resp.events = this.reydrateEventList(resp.events);
        resp.affectedEvents = this.reydrateEventList(resp.affectedEvents);
        return resp;
    }

    rehydrateDataContent<T extends DataContent>(
        dataContent: T,
        blobType: "blobs" | "avatar",
        key?: string
    ): T {
        if (dataContent.blobReference !== undefined) {
            dataContent.blobData = undefined;
            dataContent.blobUrl = `${"process.env.BLOB_URL_PATTERN"
                .replace("{canisterId}", dataContent.blobReference.canisterId)
                .replace("{blobType}", blobType)}${dataContent.blobReference.blobId}`;
        } else {
            if (blobType === "avatar" && key) {
                dataContent.blobUrl = buildIdenticonUrl(key);
            }
        }
        return dataContent;
    }

    async rehydrateMessage(
        chatType: "direct" | "group",
        currentChatId: string,
        message: EventWrapper<Message>
    ): Promise<EventWrapper<Message>> {
        const missing = await this.resolveMissingIndexes(chatType, currentChatId, [message]);
        [message] = this.rehydrateMissingReplies(currentChatId, [message], missing);
        [message] = this.reydrateEventList([message]);
        return message;
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this._userIndexClient
            .searchUsers(searchTerm, maxResults)
            .then((users) => users.map((u) => this.rehydrateDataContent(u, "avatar", u.userId)));
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

    async getUser(userId: string): Promise<PartialUserSummary | undefined> {
        const response = await this.getUsers({
            userGroups: [
                {
                    users: [userId],
                    updatedSince: BigInt(0),
                },
            ],
        });

        if (response.users.length == 0) {
            return undefined;
        }

        return response.users[0];
    }

    getUsers(users: UsersArgs): Promise<UsersResponse> {
        return this._userIndexClient.getUsers(users).then((resp) => ({
            timestamp: resp.timestamp,
            users: resp.users.map((u) => this.rehydrateDataContent(u, "avatar", u.userId)),
        }));
    }

    private handleMergedUpdatesResponse(
        messagesRead: IMessageReadTracker,
        resp: MergedUpdatesResponse
    ): MergedUpdatesResponse {
        return {
            ...resp,
            chatSummaries: resp.chatSummaries.map((chat) => {
                messagesRead.syncWithServer(chat.chatId, chat.readByMe);
                return chat.kind === "direct_chat"
                    ? chat
                    : this.rehydrateDataContent(chat, "avatar");
            }),
        };
    }

    getInitialState(messagesRead: IMessageReadTracker): Promise<MergedUpdatesResponse> {
        return this.userClient.getInitialState().then((resp) => {
            return this.handleMergedUpdatesResponse(messagesRead, resp);
        });
    }

    getUpdates(
        chatSummaries: ChatSummary[],
        args: UpdateArgs,
        messagesRead: IMessageReadTracker
    ): Promise<MergedUpdatesResponse> {
        return this.userClient.getUpdates(chatSummaries, args).then((resp) => {
            return this.handleMergedUpdatesResponse(messagesRead, resp);
        });
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this._userIndexClient.getCurrentUser();
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

    setUsername(username: string): Promise<SetUsernameResponse> {
        return this._userIndexClient.setUsername(username);
    }

    differentIdentity(identity: Identity): boolean {
        return identity.getPrincipal().toText() !== this.identity.getPrincipal().toText();
    }

    changeRole(chatId: string, userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        return this.getGroupClient(chatId).changeRole(userId, newRole);
    }

    deleteGroup(chatId: string): Promise<DeleteGroupResponse> {
        return this.getGroupClient(chatId).deleteGroup();
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
        return this.userClient.leaveGroup(chatId);
    }

    joinGroup(chatId: string): Promise<JoinGroupResponse> {
        return this.userClient.joinGroup(chatId);
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
        reaction: string
    ): Promise<ToggleReactionResponse> {
        return this.getGroupClient(chatId).toggleReaction(messageId, reaction);
    }

    toggleDirectChatReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string
    ): Promise<ToggleReactionResponse> {
        return this.userClient.toggleReaction(otherUserId, messageId, reaction);
    }

    deleteGroupMessage(chatId: string, messageId: bigint): Promise<DeleteMessageResponse> {
        return this.getGroupClient(chatId).deleteMessage(messageId);
    }

    deleteDirectMessage(otherUserId: string, messageId: bigint): Promise<DeleteMessageResponse> {
        return this.userClient.deleteMessage(otherUserId, messageId);
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

    getGroupDetails(chatId: string): Promise<GroupChatDetailsResponse> {
        return this.getGroupClient(chatId).getGroupDetails();
    }

    async getGroupDetailsUpdates(
        chatId: string,
        previous: GroupChatDetails
    ): Promise<GroupChatDetails> {
        return this.getGroupClient(chatId).getGroupDetailsUpdates(previous);
    }

    previewChat(chatId: string): Promise<GroupChatSummary | undefined> {
        return this.getGroupClient(chatId).getPublicSummary();
    }

    getRecommendedGroups(): Promise<GroupChatSummary[]> {
        return this.userClient
            .getRecommendedGroups()
            .then((groups) => groups.map((g) => this.rehydrateDataContent(g, "avatar")));
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.userClient.dismissRecommendation(chatId);
    }

    getBio(userId?: string): Promise<string> {
        const userClient = userId ? UserClient.create(userId, this.identity) : this.userClient;
        return userClient.getBio();
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.userClient.setBio(bio);
    }

    createChallenge(): Promise<CreateChallengeResponse> {
        return this._userIndexClient.createChallenge();
    }

    registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt
    ): Promise<RegisterUserResponse> {
        return this._userIndexClient.registerUser(username, challengeAttempt);
    }

    getUserStorageLimits(): Promise<void> {
        // do we need to do something if this fails? Not sure there's much we can do
        return DataClient.create(this.identity).storageStatus().then(storageStore.set);
    }

    upgradeStorage(newLimitBytes: number): Promise<UpgradeStorageResponse> {
        return this._userIndexClient.upgradeStorage(newLimitBytes);
    }

    refreshAccountBalance(account: string, fake = BigInt(1345764648)): Promise<ICP> {
        if (process.env.NODE_ENV !== "production") {
            return new Promise((resolve) => {
                setTimeout(() => {
                    const fakeVal = {
                        e8s: fake,
                    };
                    icpBalanceE8sStore.set(fakeVal);
                    resolve(fakeVal);
                }, 1000);
            });
        }
        return this._ledgerClient
            .accountBalance(account)
            .then((val) => {
                icpBalanceE8sStore.set(val);
                return val;
            })
            .catch((err) => {
                icpBalanceE8sStore.set({ e8s: BigInt(0) });
                throw err;
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

    registerGroupChatPollVote(
        chatId: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete"
    ): Promise<RegisterPollVoteResponse> {
        return this.getGroupClient(chatId).registerPollVote(messageIdx, answerIdx, voteType);
    }

    registerDirectChatPollVote(
        otherUser: string,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete"
    ): Promise<RegisterPollVoteResponse> {
        return this.userClient.registerPollVote(otherUser, messageIdx, answerIdx, voteType);
    }

    withdrawICP(domain: PendingICPWithdrawal): Promise<WithdrawCryptocurrencyResponse> {
        return this.userClient.withdrawICP(domain);
    }
}
