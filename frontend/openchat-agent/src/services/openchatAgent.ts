import type { Identity } from "@dfinity/agent";
import type { IUserIndexClient } from "./userIndex/userIndex.client.interface";
import type { IUserClient } from "./user/user.client.interface";
import type { IGroupClient } from "./group/group.client.interface";
import {
    Database,
    getCachedChatsV2,
    initDb,
    loadFailedMessages,
    removeFailedMessage,
    setCachedChatsV2,
    setCachedMessageIfNotExists,
} from "../utils/caching";
import { getAllUsers } from "../utils/userCache";
import { UserIndexClient } from "./userIndex/userIndex.client";
import { UserClient } from "./user/user.client";
import { GroupClient } from "./group/group.client";
import type { ILocalUserIndexClient } from "./localUserIndex/localUserIndex.client.interface";
import { LocalUserIndexClient } from "./localUserIndex/localUserIndex.client";
import type { INotificationsClient } from "./notifications/notifications.client.interface";
import { NotificationsClient } from "./notifications/notifications.client";
import type { IOnlineClient } from "./online/online.client.interface";
import { OnlineClient } from "./online/online.client";
import { DataClient } from "./data/data.client";
import type { ILedgerClient } from "./ledger/ledger.client.interface";
import { LedgerClient } from "./ledger/ledger.client";
import type { IGroupIndexClient } from "./groupIndex/groupIndex.client.interface";
import { GroupIndexClient } from "./groupIndex/groupIndex.client";
import { toRecord } from "../utils/list";
import { measure } from "./common/profiling";
import {
    buildBlobUrl,
    buildUserAvatarUrl,
    getAffectedEvents,
    isSuccessfulGroupSummaryResponse,
    isSuccessfulGroupSummaryUpdatesResponse,
    mergeDirectChatUpdates,
    mergeGroupChats,
    mergeGroupChatUpdates,
} from "../utils/chat";
import { SnsGovernanceClient } from "./snsGovernance/sns.governance.client";
import type { AgentConfig } from "../config";
import {
    Logger,
    AddMembersResponse,
    AddRemoveReactionResponse,
    ArchiveChatResponse,
    BlobReference,
    BlockUserResponse,
    CandidateGroupChat,
    ChallengeAttempt,
    ChangeRoleResponse,
    ChatEvent,
    CheckUsernameResponse,
    CreateChallengeResponse,
    CreatedUser,
    CreateGroupResponse,
    Cryptocurrency,
    CurrentUserResponse,
    DataContent,
    DeleteFrozenGroupResponse,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DirectChatEvent,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventsResponse,
    EventWrapper,
    GroupChatDetails,
    GroupChatDetailsResponse,
    GroupChatEvent,
    GroupChatSummary,
    GroupInvite,
    GroupPermissions,
    GroupRules,
    GroupSearchResponse,
    IndexRange,
    InviteCodeResponse,
    JoinGroupResponse,
    LeaveGroupResponse,
    ListNervousSystemFunctionsResponse,
    MakeGroupPrivateResponse,
    MarkReadRequest,
    MarkReadResponse,
    MemberRole,
    Message,
    MessageContent,
    MigrateUserPrincipalResponse,
    PartialUserSummary,
    PendingCryptocurrencyWithdrawal,
    PinChatResponse,
    PinMessageResponse,
    PublicProfile,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    RegisterUserResponse,
    RemoveMemberResponse,
    ResetInviteCodeResponse,
    SearchDirectChatResponse,
    SearchGroupChatResponse,
    SendMessageResponse,
    SetBioResponse,
    SetUsernameResponse,
    StorageStatus,
    SuspendUserResponse,
    ThreadPreview,
    ThreadPreviewsResponse,
    ThreadSyncDetails,
    ToggleMuteNotificationResponse,
    Tokens,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnpinChatResponse,
    UnpinMessageResponse,
    UnsupportedValueError,
    UpdateGroupResponse,
    User,
    UserLookup,
    UsersArgs,
    UsersResponse,
    UserSummary,
    WithdrawCryptocurrencyResponse,
    FreezeGroupResponse,
    UnfreezeGroupResponse,
    UnsuspendUserResponse,
    MarkSuspectedBotResponse,
    ChatStateFull,
    ChatSummary,
    UpdatesResult,
    DeletedGroupMessageResponse,
    DeletedDirectMessageResponse,
    ClaimPrizeResponse,
    DiamondMembershipDuration,
    PayForDiamondMembershipResponse,
} from "openchat-shared";
import type { Principal } from "@dfinity/principal";
import { applyOptionUpdate } from "../utils/mapping";
import { waitAll } from "../utils/promise";

export const apiKey = Symbol();

export class OpenChatAgent extends EventTarget {
    private _userIndexClient: IUserIndexClient;
    private _onlineClient: IOnlineClient;
    private _groupIndexClient: IGroupIndexClient;
    private _userClient?: IUserClient;
    private _notificationClient: INotificationsClient;
    private _ledgerClients: Record<Cryptocurrency, ILedgerClient>;
    private _groupClients: Record<string, IGroupClient>;
    private _groupInvite: GroupInvite | undefined;
    private db: Database;
    private _logger: Logger;

    constructor(private identity: Identity, private config: AgentConfig) {
        super();
        this._logger = config.logger;
        this.db = initDb(this.principal);
        this._onlineClient = OnlineClient.create(identity, config);
        this._userIndexClient = UserIndexClient.create(identity, config);
        this._groupIndexClient = GroupIndexClient.create(identity, config);
        this._notificationClient = NotificationsClient.create(identity, config);
        this._ledgerClients = {
            icp: LedgerClient.create(identity, config, this.config.ledgerCanisterICP),
            sns1: LedgerClient.create(identity, config, this.config.ledgerCanisterSNS1),
            ckbtc: LedgerClient.create(identity, config, this.config.ledgerCanisterBTC),
            chat: LedgerClient.create(identity, config, this.config.ledgerCanisterCHAT),
        };
        this._groupClients = {};
    }

    private get principal(): Principal {
        return this.identity.getPrincipal();
    }

    getAllCachedUsers(): Promise<UserLookup> {
        return measure("getAllUsers", () => getAllUsers()).then((users) => {
            const lookup = toRecord(
                users.map((user) => this.rehydrateUserSummary(user)),
                (u) => u.userId
            );
            return lookup;
        });
    }

    logError(message?: unknown, ...optionalParams: unknown[]): void {
        this._logger.error(message, optionalParams);
    }

    public set groupInvite(value: GroupInvite) {
        this._groupInvite = value;
    }

    createUserClient(userId: string): OpenChatAgent {
        this._userClient = UserClient.create(userId, this.identity, this.config, this.db);
        return this;
    }

    private getGroupClient(chatId: string): IGroupClient {
        if (!this._groupClients[chatId]) {
            const inviteCode = this.getProvidedInviteCode(chatId);
            this._groupClients[chatId] = GroupClient.create(
                chatId,
                this.identity,
                this.config,
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

    private createLocalUserIndexClient(canisterId: string): ILocalUserIndexClient {
        return LocalUserIndexClient.create(this.identity, this.config, canisterId);
    }

    private getProvidedInviteCode(chatId: string): string | undefined {
        return this._groupInvite?.chatId === chatId ? this._groupInvite.code : undefined;
    }

    editMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        msg: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse> {
        if (chatType === "group_chat") {
            return this.editGroupMessage(chatId, msg, threadRootMessageIndex);
        }
        if (chatType === "direct_chat") {
            return this.editDirectMessage(chatId, msg, threadRootMessageIndex);
        }
        throw new UnsupportedValueError("Unexpect chat type", chatType);
    }

    sendMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        user: CreatedUser,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        if (chatType === "group_chat") {
            if (event.event.content.kind === "crypto_content") {
                return this.userClient.sendGroupICPTransfer(
                    chatId,
                    event.event.content.transfer.recipient,
                    user,
                    event,
                    threadRootMessageIndex
                );
            }
            return this.sendGroupMessage(
                chatId,
                user.username,
                mentioned,
                event,
                threadRootMessageIndex
            );
        }
        if (chatType === "direct_chat") {
            const replyingToChatId =
                event.event.repliesTo &&
                event.event.repliesTo.kind === "rehydrated_reply_context" &&
                chatId !== event.event.repliesTo.chatId
                    ? event.event.repliesTo.chatId
                    : undefined;
            return this.sendDirectMessage(
                chatId,
                user,
                event,
                replyingToChatId,
                threadRootMessageIndex
            );
        }
        throw new UnsupportedValueError("Unexpect chat type", chatType);
    }

    private sendGroupMessage(
        chatId: string,
        senderName: string,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.getGroupClient(chatId).sendMessage(
            senderName,
            mentioned,
            event,
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
        sender: CreatedUser,
        event: EventWrapper<Message>,
        replyingToChatId?: string,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.userClient.sendMessage(
            recipientId,
            sender,
            event,
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
        name?: string,
        desc?: string,
        rules?: GroupRules,
        permissions?: Partial<GroupPermissions>,
        avatar?: Uint8Array
    ): Promise<UpdateGroupResponse> {
        return this.getGroupClient(chatId).updateGroup(name, desc, rules, permissions, avatar);
    }

    addMembers(
        chatId: string,
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddMembersResponse> {
        if (!userIds.length) {
            return Promise.resolve<AddMembersResponse>({ kind: "add_members_success" });
        }
        return this.getGroupClient(chatId).addMembers(userIds, myUsername, allowBlocked);
    }

    directChatEventsWindow(
        eventIndexRange: IndexRange,
        theirUserId: string,
        messageIndex: number,
        latestClientMainEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            "direct_chat",
            theirUserId,
            this.userClient.chatEventsWindow(
                eventIndexRange,
                theirUserId,
                messageIndex,
                latestClientMainEventIndex
            ),
            undefined,
            latestClientMainEventIndex
        );
    }

    chatEvents(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<ChatEvent>> {
        return chatType === "group_chat"
            ? this.groupChatEvents(
                  eventIndexRange,
                  chatId,
                  startIndex,
                  ascending,
                  threadRootMessageIndex,
                  latestClientEventIndex
              )
            : this.directChatEvents(
                  eventIndexRange,
                  chatId,
                  startIndex,
                  ascending,
                  threadRootMessageIndex,
                  latestClientEventIndex
              );
    }

    private directChatEvents(
        eventIndexRange: IndexRange,
        theirUserId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            "direct_chat",
            theirUserId,
            this.userClient.chatEvents(
                eventIndexRange,
                theirUserId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestClientEventIndex
            ),
            threadRootMessageIndex,
            latestClientEventIndex
        );
    }

    directChatEventsByEventIndex(
        theirUserId: string,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            "direct_chat",
            theirUserId,
            this.userClient.chatEventsByIndex(
                eventIndexes,
                theirUserId,
                threadRootMessageIndex,
                latestClientEventIndex
            ),
            threadRootMessageIndex,
            latestClientEventIndex
        );
    }

    groupChatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: string,
        messageIndex: number,
        latestClientMainEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            "group_chat",
            chatId,
            this.getGroupClient(chatId).chatEventsWindow(
                eventIndexRange,
                messageIndex,
                latestClientMainEventIndex
            ),
            undefined,
            latestClientMainEventIndex
        );
    }

    private groupChatEvents(
        eventIndexRange: IndexRange,
        chatId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            "group_chat",
            chatId,
            this.getGroupClient(chatId).chatEvents(
                eventIndexRange,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestClientEventIndex
            ),
            threadRootMessageIndex,
            latestClientEventIndex
        );
    }

    groupChatEventsByEventIndex(
        chatId: string,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            "group_chat",
            chatId,
            this.getGroupClient(chatId).chatEventsByIndex(
                eventIndexes,
                threadRootMessageIndex,
                latestClientEventIndex
            ),
            threadRootMessageIndex,
            latestClientEventIndex
        );
    }

    async getDeletedGroupMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeletedGroupMessageResponse> {
        const response = await this.getGroupClient(chatId).getDeletedMessage(
            messageId,
            threadRootMessageIndex
        );
        if (response.kind === "success") {
            response.content = this.rehydrateMessageContent(response.content);
        }
        return response;
    }

    async getDeletedDirectMessage(
        userId: string,
        messageId: bigint
    ): Promise<DeletedDirectMessageResponse> {
        const response = await this.userClient.getDeletedMessage(userId, messageId);
        if (response.kind === "success") {
            response.content = this.rehydrateMessageContent(response.content);
        }
        return response;
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
        chatType: "direct_chat" | "group_chat",
        currentChatId: string,
        events: EventWrapper<T>[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<Record<string, EventWrapper<Message>[]>> {
        const missing = this.findMissingEventIndexesByChat(currentChatId, events);
        const missingMessages: Promise<[string, EventWrapper<Message>[]]>[] = [];

        // this looks horrendous but remember these things will *usually* come straight from the cache
        Object.entries(missing).forEach(([chatId, idxs]) => {
            if (chatId === currentChatId && chatType === "direct_chat") {
                missingMessages.push(
                    this.userClient
                        .chatEventsByIndex(
                            idxs,
                            currentChatId,
                            threadRootMessageIndex,
                            latestClientEventIndex
                        )
                        .then((resp) => this.messagesFromEventsResponse(chatId, resp))
                );
            } else {
                // it must be a group chat
                const client = this.getGroupClient(chatId);
                missingMessages.push(
                    client
                        .chatEventsByIndex(idxs, threadRootMessageIndex, latestClientEventIndex)
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

    private rehydrateEvent<T extends ChatEvent>(
        ev: EventWrapper<T>,
        defaultChatId: string,
        missingReplies: Record<string, EventWrapper<Message>[]>
    ): EventWrapper<T> {
        if (ev.event.kind === "message") {
            const originalContent = ev.event.content;
            const rehydratedContent = this.rehydrateMessageContent(originalContent);

            const originalReplyContext = ev.event.repliesTo;
            let rehydratedReplyContext = undefined;
            if (ev.event.repliesTo && ev.event.repliesTo.kind === "raw_reply_context") {
                const chatId = ev.event.repliesTo.chatIdIfOther ?? defaultChatId;
                const messageEvents = missingReplies[chatId];
                const idx = ev.event.repliesTo.eventIndex;
                const msg = messageEvents.find((me) => me.index === idx)?.event;
                if (msg) {
                    rehydratedReplyContext = {
                        kind: "rehydrated_reply_context",
                        content: structuredClone(this.rehydrateMessageContent(msg.content)),
                        senderId: msg.sender,
                        messageId: msg.messageId,
                        messageIndex: msg.messageIndex,
                        eventIndex: idx,
                        chatId,
                        edited: msg.edited,
                        isThreadRoot: msg.thread !== undefined,
                    };
                } else {
                    this._logger.error(
                        "Reply context not found, this should never happen",
                        defaultChatId,
                        chatId
                    );
                }
            }

            if (originalContent !== rehydratedContent || rehydratedReplyContext !== undefined) {
                return {
                    ...ev,
                    event: {
                        ...ev.event,
                        content: rehydratedContent,
                        repliesTo: rehydratedReplyContext ?? originalReplyContext,
                    },
                };
            }
        }
        return ev;
    }

    private async rehydrateEventResponse<T extends ChatEvent>(
        chatType: "direct_chat" | "group_chat",
        currentChatId: string,
        eventsPromise: Promise<EventsResponse<T>>,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<T>> {
        const resp = await eventsPromise;

        if (resp === "events_failed") {
            return resp;
        }

        const missing = await this.resolveMissingIndexes(
            chatType,
            currentChatId,
            resp.events.concat(resp.affectedEvents),
            threadRootMessageIndex,
            latestClientEventIndex
        );
        resp.events = resp.events.map((e) => this.rehydrateEvent(e, currentChatId, missing));
        resp.affectedEvents = resp.affectedEvents.map((e) =>
            this.rehydrateEvent(e, currentChatId, missing)
        );
        return resp;
    }

    rehydrateUserSummary<T extends UserSummary | PartialUserSummary>(userSummary: T): T {
        const ref = userSummary.blobReference;
        return {
            ...userSummary,
            blobData: undefined,
            blobUrl: buildUserAvatarUrl(
                this.config.blobUrlPattern,
                userSummary.userId,
                ref?.blobId ?? undefined
            ),
        };
    }

    private rehydrateDataContent<T extends DataContent>(
        dataContent: T,
        blobType: "blobs" | "avatar" = "blobs"
    ): T {
        const ref = dataContent.blobReference;
        return ref !== undefined
            ? {
                  ...dataContent,
                  blobData: undefined,
                  blobUrl: buildBlobUrl(
                      this.config.blobUrlPattern,
                      ref.canisterId,
                      ref.blobId,
                      blobType
                  ),
              }
            : dataContent;
    }

    async rehydrateMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        message: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventWrapper<Message>> {
        const missing = await this.resolveMissingIndexes(
            chatType,
            chatId,
            [message],
            threadRootMessageIndex,
            latestClientEventIndex
        );
        return this.rehydrateEvent(message, chatId, missing);
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

    searchGroupChat(
        chatId: string,
        searchTerm: string,
        userIds: string[],
        maxResults = 10
    ): Promise<SearchGroupChatResponse> {
        return this.getGroupClient(chatId).searchGroupChat(searchTerm, userIds, maxResults);
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

    async getInitialStateV2(): Promise<UpdatesResult> {
        const cached = await getCachedChatsV2(this.db, this.principal);
        if (cached !== undefined) {
            return await this.getUpdatesV2(cached).then((result) => {
                return {
                    ...result,
                    anyUpdates: true,
                };
            });
        }

        let state: ChatStateFull;
        let anyErrors: boolean;
        const userResponse = await this.userClient.getInitialStateV2();
        if (userResponse.cacheTimestamp === undefined) {
            const groupPromises = userResponse.groupChatsAdded.map((g) =>
                this.getGroupClient(g.chatId).summary()
            );

            const groupPromiseResults = await waitAll(groupPromises);
            const groupChats = groupPromiseResults.success.filter(isSuccessfulGroupSummaryResponse);

            state = {
                timestamp: userResponse.timestamp,
                directChats: userResponse.directChats,
                groupChats: mergeGroupChats(userResponse.groupChatsAdded, groupChats),
                avatarId: userResponse.avatarId,
                blockedUsers: userResponse.blockedUsers,
                pinnedChats: userResponse.pinnedChats,
            };
            anyErrors = groupPromiseResults.errors.length > 0;
        } else {
            const groupPromises = userResponse.groupChatsAdded.map((g) =>
                this.getGroupClient(g.chatId).summary()
            );
            const groupUpdatePromises = userResponse.cachedGroupChatSummaries.map((g) =>
                this.getGroupClient(g.chatId).summaryUpdates(g.lastUpdated)
            );

            const groupPromiseResults = await waitAll(groupPromises);
            const groupUpdatePromiseResults = await waitAll(groupUpdatePromises);

            const groups = groupPromiseResults.success.filter(isSuccessfulGroupSummaryResponse);
            const groupUpdates = groupUpdatePromiseResults.success.filter(
                isSuccessfulGroupSummaryUpdatesResponse
            );

            const groupChats = mergeGroupChats(userResponse.groupChatsAdded, groups).concat(
                mergeGroupChatUpdates(userResponse.cachedGroupChatSummaries, [], groupUpdates)
            );

            state = {
                timestamp: userResponse.timestamp,
                directChats: userResponse.directChats,
                groupChats,
                avatarId: userResponse.avatarId,
                blockedUsers: userResponse.blockedUsers,
                pinnedChats: userResponse.pinnedChats,
            };
            anyErrors =
                groupPromiseResults.errors.length > 0 ||
                groupUpdatePromiseResults.errors.length > 0;
        }

        await setCachedChatsV2(this.db, this.principal, state, {});

        return await this.hydrateChatState(state).then((s) => ({
            state: s,
            affectedEvents: {},
            anyUpdates: true,
            anyErrors,
        }));
    }

    async getUpdatesV2(current: ChatStateFull): Promise<UpdatesResult> {
        const userResponse = await this.userClient.getUpdatesV2(current.timestamp);
        const groupChatIds = current.groupChats
            .map((g) => g.chatId)
            .concat(userResponse.groupChatsAdded.map((g) => g.chatId));
        const groupIndexResponse = await this._groupIndexClient.filterGroups(
            groupChatIds,
            current.timestamp
        );

        const activeGroups = new Set(groupIndexResponse.activeGroups);

        const groupPromises = userResponse.groupChatsAdded.map((g) =>
            this.getGroupClient(g.chatId).summary()
        );
        const groupUpdatePromises = current.groupChats
            .filter((g) => activeGroups.has(g.chatId))
            .map((g) => this.getGroupClient(g.chatId).summaryUpdates(g.lastUpdated));

        const groupPromiseResults = await waitAll(groupPromises);
        const groupUpdatePromiseResults = await waitAll(groupUpdatePromises);

        const groups = groupPromiseResults.success.filter(isSuccessfulGroupSummaryResponse);
        const groupUpdates = groupUpdatePromiseResults.success.filter(
            isSuccessfulGroupSummaryUpdatesResponse
        );

        const anyUpdates =
            userResponse.directChatsAdded.length > 0 ||
            userResponse.directChatsUpdated.length > 0 ||
            userResponse.groupChatsAdded.length > 0 ||
            userResponse.groupChatsUpdated.length > 0 ||
            userResponse.chatsRemoved.length > 0 ||
            userResponse.avatarId !== undefined ||
            userResponse.blockedUsers !== undefined ||
            userResponse.pinnedChats !== undefined ||
            groups.length > 0 ||
            groupUpdates.length > 0;

        const anyErrors =
            groupPromiseResults.errors.length > 0 || groupUpdatePromiseResults.errors.length > 0;

        const directChats = userResponse.directChatsAdded.concat(
            mergeDirectChatUpdates(current.directChats, userResponse.directChatsUpdated)
        );

        const chatsRemoved = new Set(
            userResponse.chatsRemoved.concat(groupIndexResponse.deletedGroups.map((g) => g.id))
        );

        const groupChats = mergeGroupChats(userResponse.groupChatsAdded, groups)
            .concat(
                mergeGroupChatUpdates(
                    current.groupChats,
                    userResponse.groupChatsUpdated,
                    groupUpdates
                )
            )
            .filter((g) => !chatsRemoved.has(g.chatId));

        const state = {
            timestamp: userResponse.timestamp,
            directChats,
            groupChats,
            avatarId: applyOptionUpdate(current.avatarId, userResponse.avatarId),
            blockedUsers: userResponse.blockedUsers ?? current.blockedUsers,
            pinnedChats: userResponse.pinnedChats ?? current.pinnedChats,
        };
        const affectedEvents = getAffectedEvents(userResponse.directChatsUpdated, groupUpdates);

        return await this.hydrateChatState(state).then((s) => {
            if (anyUpdates) {
                setCachedChatsV2(this.db, this.principal, s, affectedEvents);
            }

            return {
                state: s,
                affectedEvents,
                anyUpdates,
                anyErrors,
            };
        });
    }

    async hydrateChatState(state: ChatStateFull): Promise<ChatStateFull> {
        const directChatPromises = state.directChats.map((c) => this.hydrateChatSummary(c));
        const groupChatPromises = state.groupChats.map((c) => this.hydrateChatSummary(c));

        const directChats = await Promise.all(directChatPromises);
        const groupChats = await Promise.all(groupChatPromises);

        return {
            ...state,
            directChats,
            groupChats,
        };
    }

    async hydrateChatSummary<T extends ChatSummary>(chat: T): Promise<T> {
        const latestMessage =
            chat.latestMessage !== undefined
                ? await this.rehydrateMessage(
                      chat.kind,
                      chat.chatId,
                      chat.latestMessage,
                      undefined,
                      chat.latestEventIndex
                  )
                : undefined;

        if (chat.kind === "group_chat") {
            return {
                ...(this.rehydrateDataContent(chat as GroupChatSummary, "avatar") as T),
                latestMessage,
            };
        } else {
            return {
                ...chat,
                latestMessage,
            };
        }
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this._userIndexClient.getCurrentUser();
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

    removeMember(chatId: string, userId: string): Promise<RemoveMemberResponse> {
        return this.getGroupClient(chatId).removeMember(userId);
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

    async joinGroup(chatId: string): Promise<JoinGroupResponse> {
        const inviteCode = this.getProvidedInviteCode(chatId);
        const localUserIndex = await this.getGroupClient(chatId).localUserIndex();
        return this.createLocalUserIndexClient(localUserIndex).joinGroup(chatId, inviteCode);
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.userClient.markMessagesRead(request);
    }

    setUserAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.userClient.setAvatar(data);
    }

    addGroupChatReaction(
        chatId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.getGroupClient(chatId).addReaction(
            messageId,
            reaction,
            username,
            threadRootMessageIndex
        );
    }

    removeGroupChatReaction(
        chatId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.getGroupClient(chatId).removeReaction(
            messageId,
            reaction,
            threadRootMessageIndex
        );
    }

    addDirectChatReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.userClient.addReaction(
            otherUserId,
            messageId,
            reaction,
            username,
            threadRootMessageIndex
        );
    }

    removeDirectChatReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.userClient.removeReaction(
            otherUserId,
            messageId,
            reaction,
            threadRootMessageIndex
        );
    }

    deleteMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return chatType === "group_chat"
            ? this.deleteGroupMessage(chatId, messageId, threadRootMessageIndex)
            : this.deleteDirectMessage(chatId, messageId, threadRootMessageIndex);
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

    undeleteMessage(
        chatType: "direct_chat" | "group_chat",
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return chatType === "group_chat"
            ? this.undeleteGroupMessage(chatId, messageId, threadRootMessageIndex)
            : this.undeleteDirectMessage(chatId, messageId, threadRootMessageIndex);
    }

    private undeleteGroupMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return this.getGroupClient(chatId).undeleteMessage(messageId, threadRootMessageIndex);
    }

    private undeleteDirectMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return this.userClient.undeleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }

    lastOnline(userIds: string[]): Promise<Record<string, number>> {
        return this._onlineClient.lastOnline(userIds);
    }

    markAsOnline(): Promise<void> {
        return this._onlineClient.markAsOnline();
    }

    subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this._notificationClient.subscriptionExists(p256dh_key);
    }

    pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this._notificationClient.pushSubscription(subscription);
    }

    removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this._notificationClient.removeSubscription(subscription);
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

    getGroupRules(chatId: string): Promise<GroupRules | undefined> {
        return this.getGroupClient(chatId).getRules();
    }

    getRecommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]> {
        return this._groupIndexClient
            .recommendedGroups(exclusions)
            .then((groups) => groups.map((g) => this.rehydrateDataContent(g, "avatar")));
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.userClient.dismissRecommendation(chatId);
    }

    getBio(userId?: string): Promise<string> {
        const userClient = userId
            ? UserClient.create(userId, this.identity, this.config, this.db)
            : this.userClient;
        return userClient.getBio();
    }

    getPublicProfile(userId?: string): Promise<PublicProfile> {
        const userClient = userId
            ? UserClient.create(userId, this.identity, this.config, this.db)
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

    getUserStorageLimits(): Promise<StorageStatus> {
        return DataClient.create(this.identity, this.config).storageStatus();
    }

    refreshAccountBalance(crypto: Cryptocurrency, principal: string): Promise<Tokens> {
        return this._ledgerClients[crypto].accountBalance(principal);
    }

    getGroupMessagesByMessageIndex(
        chatId: string,
        messageIndexes: Set<number>,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        return this.rehydrateEventResponse(
            "group_chat",
            chatId,
            this.getGroupClient(chatId).getMessagesByMessageIndex(
                messageIndexes,
                latestClientEventIndex
            ),
            undefined,
            latestClientEventIndex
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

    archiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.userClient.archiveChat(chatId);
    }

    unarchiveChat(chatId: string): Promise<ArchiveChatResponse> {
        return this.userClient.unarchiveChat(chatId);
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
        const userClient = UserClient.create(userId, this.identity, this.config, this.db);
        return userClient.migrateUserPrincipal();
    }

    listNervousSystemFunctions(
        snsGovernanceCanisterId: string
    ): Promise<ListNervousSystemFunctionsResponse> {
        return SnsGovernanceClient.create(
            this.identity,
            this.config,
            snsGovernanceCanisterId
        ).listNervousSystemFunctions();
    }

    async threadPreviews(
        threadsByChat: Record<string, [ThreadSyncDetails[], number | undefined]>
    ): Promise<ThreadPreview[]> {
        function latestMessageTimestamp(messages: EventWrapper<Message>[]): bigint {
            return messages[messages.length - 1]?.timestamp ?? BigInt(0);
        }

        return Promise.all(
            Object.entries(threadsByChat).map(
                ([chatId, [threadSyncs, latestClientMainEventIndex]]) => {
                    const latestClientThreadUpdate = threadSyncs.reduce(
                        (curr, next) => (next.lastUpdated > curr ? next.lastUpdated : curr),
                        BigInt(0)
                    );

                    return this.getGroupClient(chatId)
                        .threadPreviews(
                            threadSyncs.map((t) => t.threadRootMessageIndex),
                            latestClientThreadUpdate
                        )
                        .then(
                            (response) =>
                                [response, latestClientMainEventIndex] as [
                                    ThreadPreviewsResponse,
                                    number | undefined
                                ]
                        );
                }
            )
        ).then((responses) =>
            Promise.all(
                responses.map(([r, latestClientMainEventIndex]) => {
                    return r.kind === "thread_previews_success"
                        ? Promise.all(
                              r.threads.map((t) =>
                                  this.rehydrateThreadPreview(t, latestClientMainEventIndex)
                              )
                          )
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

    private async rehydrateThreadPreview(
        thread: ThreadPreview,
        latestClientMainEventIndex: number | undefined
    ): Promise<ThreadPreview> {
        const threadMissing = await this.resolveMissingIndexes(
            "group_chat",
            thread.chatId,
            thread.latestReplies,
            thread.rootMessage.event.messageIndex,
            thread.rootMessage.event.thread?.latestEventIndex
        );

        const rootMissing = await this.resolveMissingIndexes(
            "group_chat",
            thread.chatId,
            [thread.rootMessage],
            undefined,
            latestClientMainEventIndex
        );

        const latestReplies = thread.latestReplies.map((r) =>
            this.rehydrateEvent(r, thread.chatId, threadMissing)
        );
        const rootMessage = this.rehydrateEvent(thread.rootMessage, thread.chatId, rootMissing);

        return {
            ...thread,
            rootMessage,
            latestReplies,
        };
    }

    setCachedMessageFromNotification(
        chatId: string,
        threadRootMessageIndex: number | undefined,
        message: EventWrapper<Message>
    ): Promise<void> {
        return setCachedMessageIfNotExists(this.db, chatId, message, threadRootMessageIndex);
    }

    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse> {
        return this._groupIndexClient.freezeGroup(chatId, reason);
    }

    unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse> {
        return this._groupIndexClient.unfreezeGroup(chatId);
    }

    deleteFrozenGroup(chatId: string): Promise<DeleteFrozenGroupResponse> {
        return this._groupIndexClient.deleteFrozenGroup(chatId);
    }

    suspendUser(userId: string, reason: string): Promise<SuspendUserResponse> {
        return this._userIndexClient.suspendUser(userId, reason);
    }

    unsuspendUser(userId: string): Promise<UnsuspendUserResponse> {
        return this._userIndexClient.unsuspendUser(userId);
    }

    markSuspectedBot(): Promise<MarkSuspectedBotResponse> {
        return this._userIndexClient.markSuspectedBot();
    }

    loadFailedMessages(): Promise<Record<string, Record<number, EventWrapper<Message>>>> {
        return loadFailedMessages(this.db);
    }

    deleteFailedMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<void> {
        return removeFailedMessage(this.db, chatId, messageId, threadRootMessageIndex);
    }

    claimPrize(chatId: string, messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.getGroupClient(chatId).claimPrize(messageId);
    }

    payForDiamondMembership(
        userId: string,
        token: Cryptocurrency,
        duration: DiamondMembershipDuration,
        recurring: boolean,
        expectedPriceE8s: bigint
    ): Promise<PayForDiamondMembershipResponse> {
        return this._userIndexClient.payForDiamondMembership(
            userId,
            token,
            duration,
            recurring,
            expectedPriceE8s
        );
    }
}
