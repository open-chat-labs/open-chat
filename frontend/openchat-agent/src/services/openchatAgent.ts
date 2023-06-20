import type { Identity } from "@dfinity/agent";
import {
    Database,
    getCachedChats,
    initDb,
    loadFailedMessages,
    removeFailedMessage,
    setCachedChats,
    setCachedMessageIfNotExists,
} from "../utils/caching";
import { getAllUsers } from "../utils/userCache";
import { UserIndexClient } from "./userIndex/userIndex.client";
import { UserClient } from "./user/user.client";
import { GroupClient } from "./group/group.client";
import { LocalUserIndexClient } from "./localUserIndex/localUserIndex.client";
import { NotificationsClient } from "./notifications/notifications.client";
import { OnlineClient } from "./online/online.client";
import { DataClient } from "./data/data.client";
import { LedgerClient } from "./ledger/ledger.client";
import { GroupIndexClient } from "./groupIndex/groupIndex.client";
import { MarketMakerClient } from "./marketMaker/marketMaker.client";
import { toRecord } from "../utils/list";
import { measure } from "./common/profiling";
import {
    buildBlobUrl,
    buildUserAvatarUrl,
    getUpdatedEvents,
    isSuccessfulGroupSummaryResponse,
    isSuccessfulGroupSummaryUpdatesResponse,
    mergeDirectChatUpdates,
    mergeGroupChats,
    mergeGroupChatUpdates,
} from "../utils/chat";
import { NnsGovernanceClient } from "./nnsGovernance/nns.governance.client";
import { SnsGovernanceClient } from "./snsGovernance/sns.governance.client";
import type { AgentConfig } from "../config";
import {
    Logger,
    AddRemoveReactionResponse,
    ArchiveChatResponse,
    BlobReference,
    BlockUserResponse,
    CandidateGroupChat,
    ChangeRoleResponse,
    ChatEvent,
    CheckUsernameResponse,
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
    ChatPermissions,
    AccessRules,
    SearchResponse,
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
    AddHotGroupExclusionResponse,
    RemoveHotGroupExclusionResponse,
    SetGroupUpgradeConcurrencyResponse,
    SetUserUpgradeConcurrencyResponse,
    UpdateMarketMakerConfigArgs,
    UpdateMarketMakerConfigResponse,
    ProposalVoteDetails,
    SetMessageReminderResponse,
    ReferralLeaderboardRange,
    ReferralLeaderboardResponse,
    ReportMessageResponse,
    InviteUsersResponse,
    DeclineInvitationResponse,
    UpdatesSuccessResponse,
    AccessGate,
    SearchScope,
    JoinCommunityResponse,
    GroupSearchResponse,
    emptyUpdatesSuccessResponse,
    ChatIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
    ChatMap,
    UpdatedEvent,
    chatIdentifierToString,
    MessageContext,
    MessageContextMap,
} from "openchat-shared";
import type { Principal } from "@dfinity/principal";
import { applyOptionUpdate } from "../utils/mapping";
import { waitAll } from "../utils/promise";
import { AsyncMessageContextMap } from "../utils/messageContext";
import { CommunityClient } from "./community/community.client";

export class OpenChatAgent extends EventTarget {
    private _userIndexClient: UserIndexClient;
    private _onlineClient: OnlineClient;
    private _groupIndexClient: GroupIndexClient;
    private _userClient?: UserClient;
    private _notificationClient: NotificationsClient;
    private _marketMakerClient: MarketMakerClient;
    private _ledgerClients: Record<Cryptocurrency, LedgerClient>;
    private _groupClients: Record<string, GroupClient>;
    private _communityClients: Record<string, CommunityClient>;
    private _groupInvite: GroupInvite | undefined;
    private db: Database;
    private _logger: Logger;

    constructor(private identity: Identity, private config: AgentConfig) {
        super();
        this._logger = config.logger;
        this.db = initDb(this.principal);
        this._onlineClient = OnlineClient.create(identity, config);
        this._userIndexClient = new UserIndexClient(identity, config);
        this._groupIndexClient = GroupIndexClient.create(identity, config);
        this._notificationClient = NotificationsClient.create(identity, config);
        this._marketMakerClient = MarketMakerClient.create(identity, config);
        this._ledgerClients = {
            icp: LedgerClient.create(identity, config, this.config.ledgerCanisterICP),
            sns1: LedgerClient.create(identity, config, this.config.ledgerCanisterSNS1),
            ckbtc: LedgerClient.create(identity, config, this.config.ledgerCanisterBTC),
            chat: LedgerClient.create(identity, config, this.config.ledgerCanisterCHAT),
            kinic: LedgerClient.create(identity, config, this.config.ledgerCanisterKINIC),
        };
        this._groupClients = {};
        this._communityClients = {};
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

    communityClient(communityId: string): CommunityClient {
        if (!this._communityClients[communityId]) {
            this._communityClients[communityId] = CommunityClient.create(
                communityId,
                this.identity,
                this.config
            );
        }
        return this._communityClients[communityId];
    }

    getGroupClient(chatId: string): GroupClient {
        if (!this._groupClients[chatId]) {
            const inviteCode = this.getProvidedInviteCode(chatId);
            this._groupClients[chatId] = GroupClient.create(
                { kind: "group_chat", groupId: chatId },
                this.identity,
                this.config,
                this.db,
                inviteCode
            );
        }
        return this._groupClients[chatId];
    }

    get userClient(): UserClient {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to use the user client before it has been initialised");
    }

    private createLocalUserIndexClient(canisterId: string): LocalUserIndexClient {
        return LocalUserIndexClient.create(this.identity, this.config, canisterId);
    }

    private getProvidedInviteCode(chatId: string): string | undefined {
        return this._groupInvite?.chatId === chatId ? this._groupInvite.code : undefined;
    }

    editMessage(
        chatId: ChatIdentifier,
        msg: Message,
        threadRootMessageIndex?: number
    ): Promise<EditMessageResponse> {
        if (chatId.kind === "group_chat") {
            return this.editGroupMessage(chatId.toString(), msg, threadRootMessageIndex);
        }
        if (chatId.kind === "direct_chat") {
            return this.editDirectMessage(chatId.toString(), msg, threadRootMessageIndex);
        }
        if (chatId.kind === "channel") {
            throw new Error("TODO Not implemented");
        }
        throw new UnsupportedValueError("Unexpect chat type", chatId);
    }

    sendMessage(
        chatId: ChatIdentifier,
        user: CreatedUser,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        if (chatId.kind === "group_chat") {
            if (event.event.content.kind === "crypto_content") {
                return this.userClient.sendMessageWithTransferToGroup(
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
        if (chatId.kind === "direct_chat") {
            return this.sendDirectMessage(chatId, user, event, threadRootMessageIndex);
        }
        throw new Error("TODO - send channel message not implemented");
    }

    private sendGroupMessage(
        chatId: GroupChatIdentifier,
        senderName: string,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.getGroupClient(chatId.groupId).sendMessage(
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
        chatId: DirectChatIdentifier,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        return this.userClient.sendMessage(chatId, sender, event, threadRootMessageIndex);
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
        chatId: GroupChatIdentifier,
        name?: string,
        desc?: string,
        rules?: AccessRules,
        permissions?: Partial<ChatPermissions>,
        avatar?: Uint8Array,
        gate?: AccessGate
    ): Promise<UpdateGroupResponse> {
        return this.getGroupClient(chatId.groupId).updateGroup(
            name,
            desc,
            rules,
            permissions,
            avatar,
            undefined,
            gate
        );
    }

    async inviteUsers(
        chatId: GroupChatIdentifier,
        userIds: string[]
    ): Promise<InviteUsersResponse> {
        if (!userIds.length) {
            return Promise.resolve<InviteUsersResponse>("success");
        }

        const localUserIndex = await this.getGroupClient(chatId.groupId).localUserIndex();
        return this.createLocalUserIndexClient(localUserIndex).inviteUsersToGroup(
            chatId.groupId,
            userIds
        );
    }

    directChatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
        messageIndex: number,
        latestClientMainEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.userClient.chatEventsWindow(
                eventIndexRange,
                chatId,
                messageIndex,
                latestClientMainEventIndex
            ),
            undefined,
            latestClientMainEventIndex
        );
    }

    chatEvents(
        chatId: ChatIdentifier,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<ChatEvent>> {
        if (chatId.kind === "group_chat") {
            return this.groupChatEvents(
                eventIndexRange,
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestClientEventIndex
            );
        } else if (chatId.kind === "direct_chat") {
            return this.directChatEvents(
                eventIndexRange,
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestClientEventIndex
            );
        } else if (chatId.kind === "channel") {
            throw new Error("TODO Not implemented");
        }
        throw new UnsupportedValueError("Unexpect chat type", chatId);
    }

    private directChatEvents(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.userClient.chatEvents(
                eventIndexRange,
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestClientEventIndex
            ),
            threadRootMessageIndex,
            latestClientEventIndex
        );
    }

    private directChatEventsByEventIndex(
        chatId: DirectChatIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.userClient.chatEventsByIndex(
                eventIndexes,
                chatId,
                threadRootMessageIndex,
                latestClientEventIndex
            ),
            threadRootMessageIndex,
            latestClientEventIndex
        );
    }

    groupChatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: ChatIdentifier,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestClientMainEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        if (chatId.kind !== "group_chat") {
            throw new Error("groupChatEventsWindow called with unexpected chatId kind");
        }
        return this.rehydrateEventResponse(
            chatId,
            this.getGroupClient(chatId.groupId).chatEventsWindow(
                eventIndexRange,
                messageIndex,
                threadRootMessageIndex,
                latestClientMainEventIndex
            ),
            threadRootMessageIndex,
            latestClientMainEventIndex
        );
    }

    private groupChatEvents(
        eventIndexRange: IndexRange,
        chatId: GroupChatIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.getGroupClient(chatId.groupId).chatEvents(
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

    chatEventsByEventIndex(
        chatId: ChatIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<ChatEvent>> {
        switch (chatId.kind) {
            case "group_chat":
                return this.groupChatEventsByEventIndex(
                    chatId,
                    eventIndexes,
                    threadRootMessageIndex,
                    latestClientEventIndex
                );
            case "direct_chat":
                return this.directChatEventsByEventIndex(
                    chatId,
                    eventIndexes,
                    threadRootMessageIndex,
                    latestClientEventIndex
                );
            case "channel":
                throw new Error("TODO - chatEventsByEventIndex not implemented for channels");
        }
    }

    private groupChatEventsByEventIndex(
        chatId: GroupChatIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        // If threadRootMessageIndex is defined, then this should be the latest event index for that thread
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateEventResponse(
            chatId,
            this.getGroupClient(chatId.groupId).chatEventsByIndex(
                eventIndexes,
                threadRootMessageIndex,
                latestClientEventIndex
            ),
            threadRootMessageIndex,
            latestClientEventIndex
        );
    }

    async getDeletedGroupMessage(
        chatId: GroupChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeletedGroupMessageResponse> {
        const response = await this.getGroupClient(chatId.groupId).getDeletedMessage(
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
        defaultChatId: ChatIdentifier,
        events: EventWrapper<T>[],
        threadRootMessageIndex: number | undefined
    ): AsyncMessageContextMap<number> {
        return events.reduce<AsyncMessageContextMap<number>>((result, ev) => {
            if (
                ev.event.kind === "message" &&
                ev.event.repliesTo &&
                ev.event.repliesTo.kind === "raw_reply_context"
            ) {
                result.insert(
                    ev.event.repliesTo.sourceContext ?? {
                        chatId: defaultChatId,
                        threadRootMessageIndex,
                    },
                    ev.event.repliesTo.eventIndex
                );
            }
            return result;
        }, new AsyncMessageContextMap());
    }

    private messagesFromEventsResponse<T extends ChatEvent>(
        context: MessageContext,
        resp: EventsResponse<T>
    ): [MessageContext, EventWrapper<Message>[]] {
        if (resp !== "events_failed") {
            return [
                context,
                resp.events.reduce((msgs, ev) => {
                    if (ev.event.kind === "message") {
                        msgs.push(ev as EventWrapper<Message>);
                    }
                    return msgs;
                }, [] as EventWrapper<Message>[]),
            ];
        } else {
            return [context, []];
        }
    }

    private async resolveMissingIndexes<T extends ChatEvent>(
        currentChatId: ChatIdentifier,
        events: EventWrapper<T>[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<AsyncMessageContextMap<EventWrapper<Message>>> {
        const contextMap = this.findMissingEventIndexesByChat(
            currentChatId,
            events,
            threadRootMessageIndex
        );

        if (contextMap.length === 0) return Promise.resolve(new AsyncMessageContextMap());

        return contextMap.asyncMap((ctx, idxs) => {
            const chatId = ctx.chatId;
            const chatKind = chatId.kind;

            // Note that the latestClientEventIndex relates to the *currentChat*, not necessarily the chat for this messageContext
            // So only include it if the context matches the current chat
            // And yes - this is probably trying to tell us something
            const latestIndex = chatId === currentChatId ? latestClientEventIndex : undefined;

            if (chatKind === "direct_chat") {
                return this.userClient
                    .chatEventsByIndex(idxs, chatId, ctx.threadRootMessageIndex, latestIndex)
                    .then((resp) => this.messagesFromEventsResponse(ctx, resp));
            } else if (chatKind === "group_chat") {
                const client = this.getGroupClient(chatId.groupId);
                return client
                    .chatEventsByIndex(idxs, ctx.threadRootMessageIndex, latestIndex)
                    .then((resp) => this.messagesFromEventsResponse(ctx, resp));
            } else if (chatKind === "channel") {
                throw new Error("TODO - Not implemented");
            } else {
                throw new UnsupportedValueError("unknown chatid kind supplied", chatId);
            }
        });
    }

    private rehydrateEvent<T extends ChatEvent>(
        ev: EventWrapper<T>,
        defaultChatId: ChatIdentifier,
        missingReplies: AsyncMessageContextMap<EventWrapper<Message>>,
        threadRootMessageIndex: number | undefined
    ): EventWrapper<T> {
        if (ev.event.kind === "message") {
            const originalContent = ev.event.content;
            const rehydratedContent = this.rehydrateMessageContent(originalContent);

            const originalReplyContext = ev.event.repliesTo;
            let rehydratedReplyContext = undefined;
            if (ev.event.repliesTo && ev.event.repliesTo.kind === "raw_reply_context") {
                const messageContext = ev.event.repliesTo.sourceContext ?? {
                    chatId: defaultChatId,
                    threadRootMessageIndex,
                };
                const messageEvents = missingReplies.lookup(messageContext);
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
                        edited: msg.edited,
                        isThreadRoot: msg.thread !== undefined,
                        sourceContext: ev.event.repliesTo.sourceContext ?? {
                            chatId: defaultChatId,
                        },
                    };
                } else {
                    this._logger.log(
                        "Reply context not found, this should only happen if we failed to load the reply context message",
                        {
                            chatId: defaultChatId,
                            messageContext,
                            messageEvents,
                            repliesTo: ev.event.repliesTo,
                        }
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
        currentChatId: ChatIdentifier,
        eventsPromise: Promise<EventsResponse<T>>,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<T>> {
        const resp = await eventsPromise;

        if (resp === "events_failed") {
            return resp;
        }

        const missing = await this.resolveMissingIndexes(
            currentChatId,
            resp.events,
            threadRootMessageIndex,
            latestClientEventIndex
        );

        resp.events = resp.events.map((e) =>
            this.rehydrateEvent(e, currentChatId, missing, threadRootMessageIndex)
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
        blobType: "blobs" | "avatar" | "banner" = "blobs"
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
        chatId: ChatIdentifier,
        message: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventWrapper<Message>> {
        const missing = await this.resolveMissingIndexes(
            chatId,
            [message],
            threadRootMessageIndex,
            latestClientEventIndex
        );
        return this.rehydrateEvent(message, chatId, missing, threadRootMessageIndex);
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this._userIndexClient
            .searchUsers(searchTerm, maxResults)
            .then((users) => users.map((u) => this.rehydrateUserSummary(u)));
    }

    search(searchTerm: string, maxResults = 10, scope: SearchScope): Promise<SearchResponse> {
        return this._groupIndexClient.search(searchTerm, maxResults, scope).then((res) => {
            if (res.kind === "success") {
                return {
                    ...res,
                    groupMatches: res.groupMatches.map((match) =>
                        this.rehydrateDataContent(match, "avatar")
                    ),
                    communityMatches: res.communityMatches.map((match) => ({
                        ...match,
                        avatar: this.rehydrateDataContent(match.avatar, "avatar"),
                        banner: this.rehydrateDataContent(match.banner, "banner"),
                    })),
                };
            }
            return res;
        });
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this._groupIndexClient.searchGroups(searchTerm, maxResults).then((res) => {
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
        chatId: GroupChatIdentifier,
        searchTerm: string,
        userIds: string[],
        maxResults = 10
    ): Promise<SearchGroupChatResponse> {
        return this.getGroupClient(chatId.groupId).searchGroupChat(searchTerm, userIds, maxResults);
    }

    searchDirectChat(
        chatId: DirectChatIdentifier,
        searchTerm: string,
        maxResults = 10
    ): Promise<SearchDirectChatResponse> {
        return this.userClient.searchDirectChat(chatId, searchTerm, maxResults);
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

    async getUpdates(): Promise<UpdatesResult> {
        const current = await getCachedChats(this.db, this.principal);
        if (current === undefined) {
            return await this.getInitialState().then((result) => {
                return {
                    ...result,
                    anyUpdates: true,
                };
            });
        }

        const userResponse = await this.userClient.getUpdates(current.latestUserCanisterUpdates);

        // Convert "success_no_updates" to a UpdatesSuccessResponse with the previous timestamp and everything else set
        // to empty. This allows us to have a single path through the rest of this function.
        const updates: UpdatesSuccessResponse =
            userResponse.kind === "success_no_updates"
                ? emptyUpdatesSuccessResponse(current.latestUserCanisterUpdates)
                : userResponse;

        const addedGroupChatIds = current.groupChats
            .map((g) => g.id.groupId)
            .concat(updates.groupChats.added.map((g) => g.id.groupId));

        const groupIndexResponse = await this._groupIndexClient.filterGroups(
            addedGroupChatIds,
            current.latestActiveGroupsCheck
        );

        const groupsToCheckForUpdates = new Set(
            groupIndexResponse.activeGroups.concat(
                updates.groupChats.updated.map((g) => g.id.groupId)
            )
        );

        const addedGroupPromises = updates.groupChats.added.map((g) =>
            this.getGroupClient(g.id.groupId).summary()
        );

        const updatedGroupPromises = current.groupChats
            .filter((g) => groupsToCheckForUpdates.has(g.id.groupId))
            .map((g) => this.getGroupClient(g.id.groupId).summaryUpdates(g.lastUpdated));

        const groupPromiseResults = await waitAll(addedGroupPromises);

        const groupUpdatePromiseResults = await waitAll(updatedGroupPromises);

        const groups = groupPromiseResults.success.filter(isSuccessfulGroupSummaryResponse);

        const groupUpdates = groupUpdatePromiseResults.success.filter(
            isSuccessfulGroupSummaryUpdatesResponse
        );

        const anyUpdates = userResponse.kind === "success" || groupUpdates.length > 0;

        const anyErrors =
            groupPromiseResults.errors.length > 0 || groupUpdatePromiseResults.errors.length > 0;

        const directChats = updates.directChats.added.concat(
            mergeDirectChatUpdates(current.directChats, updates.directChats.updated)
        );

        const chatsRemoved = new Set(
            updates.groupChats.removed.concat(groupIndexResponse.deletedGroups.map((g) => g.id))
        );

        const groupChats = mergeGroupChats(updates.groupChats.added, groups)
            .concat(
                mergeGroupChatUpdates(current.groupChats, updates.groupChats.updated, groupUpdates)
            )
            .filter((g) => !chatsRemoved.has(g.id.groupId));

        const state = {
            latestUserCanisterUpdates: updates.timestamp,
            latestActiveGroupsCheck: groupIndexResponse.timestamp,
            directChats,
            groupChats,
            avatarId: applyOptionUpdate(current.avatarId, updates.avatarId),
            blockedUsers: updates.blockedUsers ?? current.blockedUsers,
            pinnedChats: updates.favouriteChats.chats ?? [],
        };
        const updatedEvents = getUpdatedEvents(updates.directChats.updated, groupUpdates);

        return await this.hydrateChatState(state).then((s) => {
            if (!anyErrors) {
                setCachedChats(this.db, this.principal, s, updatedEvents);
            }

            return {
                state: s,
                updatedEvents,
                anyUpdates,
            };
        });
    }

    private async getInitialState(): Promise<UpdatesResult> {
        let state: ChatStateFull;
        let anyErrors: boolean;
        const userResponse = await this.userClient.getInitialState();
        if (userResponse.timestamp === undefined) {
            const groupPromises = userResponse.groupChats.summaries.map((g) =>
                this.getGroupClient(g.id.groupId).summary()
            );

            const groupPromiseResults = await waitAll(groupPromises);
            const groupChats = groupPromiseResults.success.filter(isSuccessfulGroupSummaryResponse);

            state = {
                latestUserCanisterUpdates: userResponse.timestamp,
                latestActiveGroupsCheck: userResponse.timestamp,
                directChats: userResponse.directChats.summaries,
                groupChats: mergeGroupChats(userResponse.groupChats.summaries, groupChats),
                avatarId: userResponse.avatarId,
                blockedUsers: userResponse.blockedUsers,
                pinnedChats: userResponse.favouriteChats.chats ?? [],
            };
            anyErrors = groupPromiseResults.errors.length > 0;
        } else {
            const groupPromises = userResponse.groupChats.summaries.map((g) =>
                this.getGroupClient(g.id.groupId).summary()
            );
            const groupUpdatePromises = (userResponse.groupChats.cached?.summaries ?? []).map((g) =>
                this.getGroupClient(g.id.groupId).summaryUpdates(g.lastUpdated)
            );

            const groupPromiseResults = await waitAll(groupPromises);
            const groupUpdatePromiseResults = await waitAll(groupUpdatePromises);

            const groups = groupPromiseResults.success.filter(isSuccessfulGroupSummaryResponse);
            const groupUpdates = groupUpdatePromiseResults.success.filter(
                isSuccessfulGroupSummaryUpdatesResponse
            );

            const groupChats = mergeGroupChats(userResponse.groupChats.summaries, groups).concat(
                mergeGroupChatUpdates(
                    userResponse.groupChats.cached?.summaries ?? [],
                    [],
                    groupUpdates
                )
            );

            state = {
                latestUserCanisterUpdates: userResponse.timestamp,
                latestActiveGroupsCheck: userResponse.timestamp,
                directChats: userResponse.directChats.summaries,
                groupChats,
                avatarId: userResponse.avatarId,
                blockedUsers: userResponse.blockedUsers,
                pinnedChats: userResponse.favouriteChats.chats ?? [],
            };
            anyErrors =
                groupPromiseResults.errors.length > 0 ||
                groupUpdatePromiseResults.errors.length > 0;
        }

        const updatedEvents = new ChatMap<UpdatedEvent[]>();

        return await this.hydrateChatState(state).then((s) => {
            if (!anyErrors) {
                setCachedChats(this.db, this.principal, state, updatedEvents);
            }

            return {
                state: s,
                updatedEvents,
                anyUpdates: true,
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
                      chat.id,
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

    changeRole(
        chatId: GroupChatIdentifier,
        userId: string,
        newRole: MemberRole
    ): Promise<ChangeRoleResponse> {
        return this.getGroupClient(chatId.groupId).changeRole(userId, newRole);
    }

    deleteGroup(chatId: GroupChatIdentifier): Promise<DeleteGroupResponse> {
        return this.userClient.deleteGroup(chatId.groupId);
    }

    makeGroupPrivate(chatId: GroupChatIdentifier): Promise<MakeGroupPrivateResponse> {
        return this.getGroupClient(chatId.groupId).makeGroupPrivate();
    }

    removeMember(chatId: GroupChatIdentifier, userId: string): Promise<RemoveMemberResponse> {
        return this.getGroupClient(chatId.groupId).removeMember(userId);
    }

    blockUserFromDirectChat(userId: string): Promise<BlockUserResponse> {
        return this.userClient.blockUser(userId);
    }

    blockUserFromGroupChat(
        chatId: GroupChatIdentifier,
        userId: string
    ): Promise<BlockUserResponse> {
        return this.getGroupClient(chatId.groupId).blockUser(userId);
    }

    unblockUserFromGroupChat(
        chatId: GroupChatIdentifier,
        userId: string
    ): Promise<UnblockUserResponse> {
        return this.getGroupClient(chatId.groupId).unblockUser(userId);
    }

    unblockUserFromDirectChat(userId: string): Promise<UnblockUserResponse> {
        return this.userClient.unblockUser(userId);
    }

    leaveGroup(chatId: GroupChatIdentifier): Promise<LeaveGroupResponse> {
        if (this._groupInvite?.chatId === chatId.groupId) {
            this._groupInvite = undefined;
        }

        return this.userClient.leaveGroup(chatId.groupId);
    }

    async joinGroup(chatId: GroupChatIdentifier): Promise<JoinGroupResponse> {
        const inviteCode = this.getProvidedInviteCode(chatId.groupId);
        const localUserIndex = await this.getGroupClient(chatId.groupId).localUserIndex();
        return this.createLocalUserIndexClient(localUserIndex).joinGroup(
            chatId.groupId,
            inviteCode
        );
    }

    async joinCommunity(communityId: string): Promise<JoinCommunityResponse> {
        // TODO - we need to capture invide code somehow here, but it doesn't really fit at the moment
        // const inviteCode = this.getProvidedInviteCode(chatId);
        const localUserIndex = await this.communityClient(communityId).localUserIndex();
        return this.createLocalUserIndexClient(localUserIndex).joinCommunity(
            communityId,
            undefined
        );
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.userClient.markMessagesRead(request);
    }

    setUserAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.userClient.setAvatar(data);
    }

    addReaction(
        chatId: ChatIdentifier,
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).addReaction(
                    messageId,
                    reaction,
                    username,
                    threadRootMessageIndex
                );

            case "direct_chat":
                return this.userClient.addReaction(
                    chatId.userId,
                    messageId,
                    reaction,
                    username,
                    threadRootMessageIndex
                );

            case "channel":
                return this.communityClient(chatId.communityId).addReaction(
                    chatId,
                    username,
                    messageId,
                    reaction,
                    threadRootMessageIndex
                );
        }
    }

    removeReaction(
        chatId: ChatIdentifier,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        switch (chatId.kind) {
            case "group_chat":
                return this.getGroupClient(chatId.groupId).removeReaction(
                    messageId,
                    reaction,
                    threadRootMessageIndex
                );

            case "direct_chat":
                return this.userClient.removeReaction(
                    chatId.userId,
                    messageId,
                    reaction,
                    threadRootMessageIndex
                );

            case "channel":
                throw new Error("TODO - remove channel reaction not implemented");
        }
    }

    deleteMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
        asPlatformModerator?: boolean
    ): Promise<DeleteMessageResponse> {
        if (chatId.kind === "group_chat") {
            return this.deleteGroupMessage(
                chatId.groupId,
                messageId,
                threadRootMessageIndex,
                asPlatformModerator
            );
        } else if (chatId.kind === "direct_chat") {
            return this.deleteDirectMessage(chatId.userId, messageId, threadRootMessageIndex);
        }
        throw new Error("TODO - delete channel message not implemented");
    }

    private deleteGroupMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
        asPlatformModerator?: boolean
    ): Promise<DeleteMessageResponse> {
        return this.getGroupClient(chatId).deleteMessage(
            messageId,
            threadRootMessageIndex,
            asPlatformModerator
        );
    }

    private deleteDirectMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return this.userClient.deleteMessage(otherUserId, messageId, threadRootMessageIndex);
    }

    undeleteMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        if (chatId.kind === "group_chat") {
            this.undeleteGroupMessage(chatId.groupId, messageId, threadRootMessageIndex);
        } else if (chatId.kind === "direct_chat") {
            this.undeleteDirectMessage(chatId.userId, messageId, threadRootMessageIndex);
        }
        throw new Error("TODO - undelete channel message not implemented");
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
        chatId: ChatIdentifier,
        muted: boolean
    ): Promise<ToggleMuteNotificationResponse> {
        if (chatId.kind === "channel") {
            throw new Error("TODO - not implemented");
        }
        return this.userClient.toggleMuteNotifications(chatIdentifierToString(chatId), muted);
    }

    getGroupDetails(
        chatId: GroupChatIdentifier,
        latestEventIndex: number
    ): Promise<GroupChatDetailsResponse> {
        return this.getGroupClient(chatId.groupId).getGroupDetails(latestEventIndex);
    }

    async getGroupDetailsUpdates(
        chatId: GroupChatIdentifier,
        previous: GroupChatDetails
    ): Promise<GroupChatDetails> {
        return this.getGroupClient(chatId.groupId).getGroupDetailsUpdates(previous);
    }

    getPublicGroupSummary(chatId: GroupChatIdentifier): Promise<GroupChatSummary | undefined> {
        return this.getGroupClient(chatId.groupId).getPublicSummary();
    }

    getGroupRules(chatId: GroupChatIdentifier): Promise<AccessRules | undefined> {
        return this.getGroupClient(chatId.groupId).getRules();
    }

    getRecommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]> {
        return this._groupIndexClient
            .recommendedGroups(exclusions)
            .then((groups) => groups.map((g) => this.rehydrateDataContent(g, "avatar")));
    }

    dismissRecommendation(chatId: GroupChatIdentifier): Promise<void> {
        return this.userClient.dismissRecommendation(chatId.groupId);
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

    async registerUser(
        username: string,
        referralCode: string | undefined
    ): Promise<RegisterUserResponse> {
        const localUserIndex = await this._userIndexClient.userRegistrationCanister();
        return this.createLocalUserIndexClient(localUserIndex).registerUser(username, referralCode);
    }

    getUserStorageLimits(): Promise<StorageStatus> {
        return DataClient.create(this.identity, this.config).storageStatus();
    }

    refreshAccountBalance(crypto: Cryptocurrency, principal: string): Promise<Tokens> {
        return this._ledgerClients[crypto].accountBalance(principal);
    }

    getGroupMessagesByMessageIndex(
        chatId: GroupChatIdentifier,
        messageIndexes: Set<number>,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        return this.rehydrateEventResponse(
            chatId,
            this.getGroupClient(chatId.groupId).getMessagesByMessageIndex(
                messageIndexes,
                latestClientEventIndex
            ),
            undefined,
            latestClientEventIndex
        );
    }

    pinMessage(chatId: GroupChatIdentifier, messageIndex: number): Promise<PinMessageResponse> {
        return this.getGroupClient(chatId.groupId).pinMessage(messageIndex);
    }

    unpinMessage(chatId: GroupChatIdentifier, messageIndex: number): Promise<UnpinMessageResponse> {
        return this.getGroupClient(chatId.groupId).unpinMessage(messageIndex);
    }

    registerPollVote(
        chatId: ChatIdentifier,
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse> {
        if (chatId.kind === "group_chat") {
            return this.getGroupClient(chatId.groupId).registerPollVote(
                messageIdx,
                answerIdx,
                voteType,
                threadRootMessageIndex
            );
        }
        throw new Error("TODO - channel & direct poll votes not implemented");
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal
    ): Promise<WithdrawCryptocurrencyResponse> {
        return this.userClient.withdrawCryptocurrency(domain);
    }

    getInviteCode(chatId: GroupChatIdentifier): Promise<InviteCodeResponse> {
        return this.getGroupClient(chatId.groupId).getInviteCode();
    }

    enableInviteCode(chatId: GroupChatIdentifier): Promise<EnableInviteCodeResponse> {
        return this.getGroupClient(chatId.groupId).enableInviteCode();
    }

    disableInviteCode(chatId: GroupChatIdentifier): Promise<DisableInviteCodeResponse> {
        return this.getGroupClient(chatId.groupId).disableInviteCode();
    }

    resetInviteCode(chatId: GroupChatIdentifier): Promise<ResetInviteCodeResponse> {
        return this.getGroupClient(chatId.groupId).resetInviteCode();
    }

    pinChat(chatId: ChatIdentifier): Promise<PinChatResponse> {
        if (chatId.kind === "channel") {
            throw new Error("TODO - not implemented");
        }
        return this.userClient.pinChat(chatIdentifierToString(chatId));
    }

    unpinChat(chatId: ChatIdentifier): Promise<UnpinChatResponse> {
        if (chatId.kind === "channel") {
            throw new Error("TODO - not implemented");
        }
        return this.userClient.unpinChat(chatIdentifierToString(chatId));
    }

    archiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        if (chatId.kind === "channel") {
            throw new Error("TODO - not implemented");
        }
        return this.userClient.archiveChat(chatIdentifierToString(chatId));
    }

    unarchiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        if (chatId.kind === "channel") {
            throw new Error("TODO - not implemented");
        }
        return this.userClient.unarchiveChat(chatIdentifierToString(chatId));
    }

    registerProposalVote(
        chatId: GroupChatIdentifier,
        messageIndex: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.getGroupClient(chatId.groupId).registerProposalVote(messageIndex, adopt);
    }

    initUserPrincipalMigration(newPrincipal: string): Promise<void> {
        return this.userClient.initUserPrincipalMigration(newPrincipal);
    }

    migrateUserPrincipal(userId: string): Promise<MigrateUserPrincipalResponse> {
        const userClient = UserClient.create(userId, this.identity, this.config, this.db);
        return userClient.migrateUserPrincipal();
    }

    getProposalVoteDetails(
        governanceCanisterId: string,
        proposalId: bigint,
        isNns: boolean
    ): Promise<ProposalVoteDetails> {
        if (isNns) {
            return NnsGovernanceClient.create(
                this.identity,
                this.config,
                governanceCanisterId
            ).getProposalVoteDetails(proposalId);
        } else {
            return SnsGovernanceClient.create(
                this.identity,
                this.config,
                governanceCanisterId
            ).getProposalVoteDetails(proposalId);
        }
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
            thread.chatId,
            thread.latestReplies,
            thread.rootMessage.event.messageIndex,
            thread.rootMessage.event.thread?.latestEventIndex
        );

        const rootMissing = await this.resolveMissingIndexes(
            thread.chatId,
            [thread.rootMessage],
            undefined,
            latestClientMainEventIndex
        );

        const latestReplies = thread.latestReplies.map((r) =>
            this.rehydrateEvent(
                r,
                thread.chatId,
                threadMissing,
                thread.rootMessage.event.messageIndex
            )
        );
        const rootMessage = this.rehydrateEvent(
            thread.rootMessage,
            thread.chatId,
            rootMissing,
            undefined
        );

        return {
            ...thread,
            rootMessage,
            latestReplies,
        };
    }

    setCachedMessageFromNotification(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        message: EventWrapper<Message>
    ): Promise<void> {
        if (chatId.kind === "channel") {
            throw new Error(
                "TODO - setCachedMessageFromNotification not implemented for channel messages"
            );
        }
        return setCachedMessageIfNotExists(this.db, chatId, message, threadRootMessageIndex);
    }

    freezeGroup(
        chatId: GroupChatIdentifier,
        reason: string | undefined
    ): Promise<FreezeGroupResponse> {
        return this._groupIndexClient.freezeGroup(chatId.groupId, reason);
    }

    unfreezeGroup(chatId: GroupChatIdentifier): Promise<UnfreezeGroupResponse> {
        return this._groupIndexClient.unfreezeGroup(chatId.groupId);
    }

    deleteFrozenGroup(chatId: GroupChatIdentifier): Promise<DeleteFrozenGroupResponse> {
        return this._groupIndexClient.deleteFrozenGroup(chatId.groupId);
    }

    addHotGroupExclusion(chatId: GroupChatIdentifier): Promise<AddHotGroupExclusionResponse> {
        return this._groupIndexClient.addHotGroupExclusion(chatId.groupId);
    }

    removeHotGroupExclusion(chatId: GroupChatIdentifier): Promise<RemoveHotGroupExclusionResponse> {
        return this._groupIndexClient.removeHotGroupExclusion(chatId.groupId);
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

    loadFailedMessages(): Promise<MessageContextMap<Record<number, EventWrapper<Message>>>> {
        return loadFailedMessages(this.db);
    }

    deleteFailedMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<void> {
        if (chatId.kind === "channel") {
            throw new Error("TODO - deleteFailedMessage not implemented for channel messages");
        }
        return removeFailedMessage(this.db, chatId, messageId, threadRootMessageIndex);
    }

    claimPrize(chatId: GroupChatIdentifier, messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.getGroupClient(chatId.groupId).claimPrize(messageId);
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

    setGroupUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this._groupIndexClient.setGroupUpgradeConcurrency(value);
    }

    setUserUpgradeConcurrency(value: number): Promise<SetUserUpgradeConcurrencyResponse> {
        return this._userIndexClient.setUserUpgradeConcurrency(value);
    }

    updateMarketMakerConfig(
        config: UpdateMarketMakerConfigArgs
    ): Promise<UpdateMarketMakerConfigResponse> {
        return this._marketMakerClient.updateConfig(config);
    }

    setMessageReminder(
        chatId: ChatIdentifier,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number
    ): Promise<SetMessageReminderResponse> {
        if (chatId.kind === "channel") {
            throw new Error("TODO - setMessageReminder not implemented for channel messages");
        }
        return this.userClient.setMessageReminder(
            chatIdentifierToString(chatId),
            eventIndex,
            remindAt,
            notes,
            threadRootMessageIndex
        );
    }

    cancelMessageReminder(reminderId: bigint): Promise<boolean> {
        return this.userClient.cancelMessageReminder(reminderId);
    }

    getReferralLeaderboard(req?: ReferralLeaderboardRange): Promise<ReferralLeaderboardResponse> {
        return this._userIndexClient.getReferralLeaderboard(req);
    }

    async reportMessage(
        chatId: ChatIdentifier,
        eventIndex: number,
        reasonCode: number,
        notes: string | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<ReportMessageResponse> {
        if (chatId.kind === "channel") {
            throw new Error("TODO - reportMessage not implemented for channel messages");
        }
        const modGroupId = await this._userIndexClient.getPlatformModeratorGroup();
        const localUserIndex = await this.getGroupClient(modGroupId).localUserIndex();
        return this.createLocalUserIndexClient(localUserIndex).reportMessage(
            chatIdentifierToString(chatId),
            eventIndex,
            reasonCode,
            notes,
            threadRootMessageIndex
        );
    }
    declineInvitation(chatId: GroupChatIdentifier): Promise<DeclineInvitationResponse> {
        return this.getGroupClient(chatId.groupId).declineInvitation();
    }
}
