import { dequal } from "dequal";
import {
    chatIdentifierToString,
    ChatMap,
    CommunityMap,
    emptyChatMetrics,
    MessageContextMap,
    MessageMap,
    nullMembership,
    ROLE_OWNER,
    SafeMap,
    type AccessGateConfig,
    type ChatIdentifier,
    type ChatListScope,
    type ChatSummary,
    type CommunityIdentifier,
    type CommunitySummary,
    type DirectChatIdentifier,
    type DirectChatSummary,
    type EventWrapper,
    type GrantedBotPermissions,
    type LocalPollVote,
    type LocalReaction,
    type Member,
    type Message,
    type MessageContent,
    type MessageContext,
    type MessageReminderCreatedContent,
    type MultiUserChat,
    type OptionalChatPermissions,
    type OptionUpdate,
    type P2PSwapStatus,
    type SenderContext,
    type StreakInsurance,
    type Tally,
    type ThreadSummary,
    type UnconfirmedMessageEvent,
    type UnconfirmedState,
    type UserGroupDetails,
    type VersionedRules,
    type WalletConfig,
    type WebhookDetails,
} from "openchat-shared";
import { writable } from "../utils/stores";
import { revokeObjectUrls } from "../utils/url";
import { chatDetailsLocalUpdates } from "./chat/detailsUpdates";
import { chatSummaryLocalUpdates, ChatSummaryUpdates } from "./chat/summaryUpdates";
import { communityLocalUpdates } from "./community/detailUpdates";
import { communitySummaryLocalUpdates, CommunitySummaryUpdates } from "./community/summaryUpdates";
import { createDraftMessagesStore } from "./draft";
import { LocalChatMap, LocalCommunityMap, LocalMap } from "./map";
import {
    MessageLocalUpdates,
    messageLocalUpdates,
    type MessageDeleted,
} from "./message/localUpdates";
import { ChatLocalSet, LocalSet } from "./set";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";
import {
    addToWritableLocalMap,
    addToWritableLocalSet,
    addToWritableMap,
    modifyWritable,
    modifyWritableMap,
    notEq,
    removeFromWritableLocalMap,
    removeFromWritableLocalSet,
    removeFromWritableMap,
} from "./utils";

function emptyUnconfirmed(): UnconfirmedState {
    return new Map<bigint, UnconfirmedMessageEvent>();
}

type FailedMessageState = Map<bigint, EventWrapper<Message>>;
type EphemeralState = Map<bigint, EventWrapper<Message>>;

// global local updates don't need the manager because they are not specific to a keyed entity (community, chat, message etc)
export class GlobalLocalState {
    #blockedDirectUsers = writable<LocalSet<string>>(new LocalSet(), undefined, notEq);
    #recentlySentMessages = writable<SafeMap<bigint, bigint>>(new SafeMap(), undefined, notEq);
    #ephemeral = writable<MessageContextMap<EphemeralState>>(
        new MessageContextMap(),
        undefined,
        notEq,
    );
    #unconfirmed = writable<MessageContextMap<UnconfirmedState>>(
        new MessageContextMap(),
        undefined,
        notEq,
    );
    #failedMessages = writable<MessageContextMap<FailedMessageState>>(
        new MessageContextMap(),
        undefined,
        notEq,
    );
    readonly draftMessages = createDraftMessagesStore();
    readonly chats = writable<LocalChatMap<ChatSummary>>(new LocalChatMap(), undefined, notEq);
    readonly communities = writable<LocalCommunityMap<CommunitySummary>>(
        new LocalCommunityMap(),
        undefined,
        notEq,
    );
    readonly previewCommunities = writable<CommunityMap<CommunitySummary>>(
        new CommunityMap(),
        undefined,
        notEq,
    );
    readonly directChatBots = writable<LocalMap<string, GrantedBotPermissions>>(
        new LocalMap(),
        undefined,
        notEq,
    );
    #walletConfig = writable<WalletConfig | undefined>(undefined);
    #streakInsurance = writable<StreakInsurance | undefined>(undefined);
    #messageActivityFeedReadUpTo = writable<bigint | undefined>(undefined);
    readonly favourites = writable<ChatLocalSet>(new ChatLocalSet(), undefined, notEq);
    #uninitialisedDirectChats = writable<ChatMap<DirectChatSummary>>(
        new ChatMap(),
        undefined,
        notEq,
    );
    #groupChatPreviews = writable<ChatMap<MultiUserChat>>(new ChatMap(), undefined, notEq);

    // only used for testing
    clearAll() {
        this.#blockedDirectUsers.set(new LocalSet());
        this.#failedMessages.set(new MessageContextMap());
        this.#recentlySentMessages.set(new SafeMap());
        this.#ephemeral.set(new MessageContextMap());
        this.#unconfirmed.set(new MessageContextMap());
        this.chats.set(new LocalChatMap());
        this.communities.set(new LocalCommunityMap());
        this.previewCommunities.set(new CommunityMap());
        this.directChatBots.set(new LocalMap());
        this.#walletConfig.set(undefined);
        this.#streakInsurance.set(undefined);
        this.#messageActivityFeedReadUpTo.set(undefined);
        this.favourites.set(new ChatLocalSet());
        this.#uninitialisedDirectChats.set(new ChatMap());
        this.#groupChatPreviews.set(new ChatMap());
        messageLocalUpdates.set(new MessageMap());
        chatDetailsLocalUpdates.clearAll();
        chatSummaryLocalUpdates.set(new ChatMap());
        communityLocalUpdates.clear();
        communitySummaryLocalUpdates.set(new CommunityMap());
    }

    blockDirectUser(userId: string) {
        return addToWritableLocalSet(userId, this.#blockedDirectUsers);
    }

    unblockDirectUser(userId: string) {
        return removeFromWritableLocalSet(userId, this.#blockedDirectUsers);
    }

    get blockedDirectUsers() {
        return this.#blockedDirectUsers;
    }

    get unconfirmed() {
        return this.#unconfirmed;
    }

    initialiseFailedMessages(messages: MessageContextMap<FailedMessageState>) {
        this.#failedMessages.set(messages);
    }

    addFailedMessage(key: MessageContext, message: EventWrapper<Message>) {
        this.#failedMessages.update((map) => {
            const state = map.get(key) ?? new Map<bigint, EventWrapper<Message>>();
            state.set(message.event.messageId, message);
            return map;
        });
    }

    anyFailed(key: MessageContext): boolean {
        return (this.#failedMessages.value.get(key)?.size ?? 0) > 0;
    }

    isFailed(key: MessageContext, messageId: bigint): boolean {
        return this.#failedMessages.value.get(key)?.has(messageId) ?? false;
    }

    get failedMessages() {
        return this.#failedMessages;
    }

    failedMessagesForContext(key: MessageContext): EventWrapper<Message>[] {
        const state = this.#failedMessages.value.get(key);
        return state ? [...state.values()] : [];
    }

    deleteFailedMessage(key: MessageContext, messageId: bigint) {
        let deleted = false;
        this.#failedMessages.update((map) => {
            const state = map.get(key);
            if (state !== undefined) {
                deleted = this.#deleteLocalMessage(state, messageId);
            }
            return map;
        });
        return deleted;
    }

    addEphemeral(key: MessageContext, message: EventWrapper<Message>) {
        this.#ephemeral.update((map) => {
            const s = map.get(key) ?? new Map<bigint, EventWrapper<Message>>();
            s.set(message.event.messageId, message);
            map.set(key, s);
            return map;
        });
        // TODO - I don't think that we want ephemeral messages to automatically disappear
        // but we also don't want them to stay here forever do we?
        // return scheduleUndo(() => {
        //     this.#deleteLocalMessage(this.#ephemeral, key, message.event.messageId);
        // });
    }

    isEphemeral(key: MessageContext, messageId: bigint): boolean {
        return this.#ephemeral.value.get(key)?.has(messageId) ?? false;
    }

    get ephemeral() {
        return this.#ephemeral;
    }

    ephemeralMessages(key: MessageContext): EventWrapper<Message>[] {
        const state = this.#ephemeral.value.get(key);
        return state ? [...state.values()] : [];
    }

    #deleteLocalMessage<T extends EventWrapper<Message>>(state: Map<bigint, T>, messageId: bigint) {
        const msg = state.get(messageId);
        if (msg !== undefined) {
            revokeObjectUrls(msg);
            state.delete(messageId);
            return true;
        }
        return false;
    }

    unconfirmedMessages(key: MessageContext): EventWrapper<Message>[] {
        const state = this.#unconfirmed.value.get(key);
        return state ? [...state.values()] : [];
    }

    addUnconfirmed(key: MessageContext, message: EventWrapper<Message>): UndoLocalUpdate {
        const messageId = message.event.messageId;
        return modifyWritableMap(
            key,
            (state) => {
                if (!state.has(messageId)) {
                    state.set(messageId, { ...message, accepted: false });
                    this.#recentlySentMessages.update((map) => {
                        map.set(messageId, message.timestamp);
                        return map;
                    });
                    return (state) => {
                        this.#deleteLocalMessage(state, messageId);
                        this.#recentlySentMessages.update((map) => {
                            map.delete(messageId);
                            return map;
                        });
                        return state;
                    };
                }
                return (state) => state;
            },
            this.#unconfirmed,
            emptyUnconfirmed,
            undefined,
            90_000,
        );
    }

    get recentlySentMessages() {
        return this.#recentlySentMessages;
    }

    overwriteUnconfirmedContent(
        key: MessageContext,
        messageId: bigint,
        content: MessageContent,
        senderContext?: SenderContext,
        blockLevelMarkdown?: boolean,
    ) {
        this.#unconfirmed.update((map) => {
            const state = map.get(key);
            if (state) {
                const msg = state.get(messageId);
                if (msg) {
                    state.set(messageId, {
                        ...msg,
                        event: {
                            ...msg.event,
                            content,
                            senderContext,
                            blockLevelMarkdown: blockLevelMarkdown ?? false,
                        },
                    });
                    map.set(key, state);
                }
            }
            return map;
        });
    }

    deleteUnconfirmed(key: MessageContext, messageId: bigint) {
        let deleted = false;
        if (this.#unconfirmed.value.get(key)?.has(messageId)) {
            this.#unconfirmed.update((map) => {
                const state = map.get(key);
                if (state !== undefined) {
                    deleted = this.#deleteLocalMessage(state, messageId);
                }
                return map;
            });
        }
        return deleted;
    }

    isUnconfirmed(key: MessageContext, messageId: bigint): boolean {
        return this.#unconfirmed.value.get(key)?.has(messageId) ?? false;
    }

    isPendingAcceptance(key: MessageContext, messageId: bigint): boolean {
        return this.#unconfirmed.value.get(key)?.get(messageId)?.accepted === false;
    }

    markUnconfirmedAccepted(key: MessageContext, messageId: bigint) {
        this.#unconfirmed.update((map) => {
            const state = map.get(key);
            if (state !== undefined) {
                const msg = state?.get(messageId);
                if (msg) {
                    msg.accepted = true;
                    map.set(key, state);
                }
            }
            return map;
        });
    }

    // only used for testing
    clearUnconfirmed() {
        this.#unconfirmed.set(new MessageContextMap());
    }

    get groupChatPreviews() {
        return this.#groupChatPreviews;
    }

    get uninitialisedDirectChats() {
        return this.#uninitialisedDirectChats;
    }

    addGroupPreview(chat: MultiUserChat) {
        // if we recently left the chat it *might* still be in the removed chats local updates
        // so we should remove it from there if it is in there
        modifyWritable((d) => d.undoRemove(chat.id), this.chats, "never");
        return addToWritableMap(chat.id, chat, this.#groupChatPreviews, "never");
    }

    removeGroupPreview(chatId: ChatIdentifier) {
        removeFromWritableMap(chatId, this.#groupChatPreviews, "never");
    }

    addUninitialisedDirectChat(chatId: DirectChatIdentifier) {
        this.#uninitialisedDirectChats.update((data) => {
            return data.set(chatId, {
                kind: "direct_chat",
                id: chatId,
                them: chatId,
                readByThemUpTo: undefined,
                latestMessage: undefined,
                latestEventIndex: 0,
                latestMessageIndex: undefined,
                lastUpdated: BigInt(Date.now()),
                dateCreated: BigInt(Date.now()),
                metrics: emptyChatMetrics(),
                eventsTTL: undefined,
                eventsTtlLastUpdated: BigInt(0),
                membership: {
                    ...nullMembership(),
                    role: ROLE_OWNER,
                },
            });
        });
        return scheduleUndo(() => {
            this.#uninitialisedDirectChats.update((data) => {
                data.delete(chatId);
                return data;
            });
        });
    }

    anyUninitialisedDirectChats(): boolean {
        return this.#uninitialisedDirectChats.value.size > 0;
    }

    removeUninitialisedDirectChat(chatId: ChatIdentifier): boolean {
        if (this.#uninitialisedDirectChats.value.has(chatId)) {
            this.#uninitialisedDirectChats.update((data) => {
                data.delete(chatId);
                return data;
            });
            return true;
        }
        return false;
    }

    anyCommunityPreviews(): boolean {
        return this.previewCommunities.value.size > 0;
    }

    isPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.value.has(id);
    }

    getPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.value.get(id);
    }

    addCommunityPreview(val: CommunitySummary) {
        return addToWritableMap(val.id, val, this.previewCommunities, "never");
    }

    removeChat(chatId: ChatIdentifier) {
        return removeFromWritableLocalMap(chatId, this.chats);
    }

    addChat(chat: ChatSummary) {
        this.removeGroupPreview(chat.id);
        return addToWritableLocalMap(chat.id, chat, this.chats);
    }

    removeCommunityPreview(id: CommunityIdentifier) {
        return removeFromWritableMap(id, this.previewCommunities, "never");
    }

    addCommunity(val: CommunitySummary) {
        this.removeCommunityPreview(val.id);
        return addToWritableLocalMap(val.id, val, this.communities);
    }

    get messageActivityFeedReadUpTo() {
        return this.#messageActivityFeedReadUpTo;
    }

    setMessageActivityFeedReadUpTo(val: bigint) {
        const prev = this.#messageActivityFeedReadUpTo.value;
        this.#messageActivityFeedReadUpTo.set(val);
        return scheduleUndo(() => {
            this.#messageActivityFeedReadUpTo.set(prev);
        });
    }

    get walletConfig() {
        return this.#walletConfig;
    }

    updateWalletConfig(val: WalletConfig) {
        const prev = this.#walletConfig.value;
        this.#walletConfig.set(val);
        return scheduleUndo(() => {
            this.#walletConfig.set(prev);
        });
    }

    get streakInsurance() {
        return this.#streakInsurance;
    }

    updateStreakInsurance(val: StreakInsurance) {
        const prev = this.#streakInsurance.value;
        this.#streakInsurance.set(val);
        return scheduleUndo(() => {
            this.#streakInsurance.set(prev);
        });
    }

    updateCommunityDisplayName(id: CommunityIdentifier, name?: string) {
        return this.#modifyCommunitySummaryUpdates(
            id,
            (upd) => {
                upd.displayName = name !== undefined ? { value: name } : "set_to_none";
                return (upd) => {
                    upd.displayName = undefined;
                    return upd;
                };
            },
            "updateCommunityDisplayName",
        );
    }

    updateCommunityMember(id: CommunityIdentifier, userId: string, member: Member) {
        return communityLocalUpdates.updateMember(id, userId, member);
    }

    blockCommunityUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return communityLocalUpdates.blockUser(id, userId);
    }

    unblockCommunityUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return communityLocalUpdates.unblockUser(id, userId);
    }

    removeCommunityMember(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return communityLocalUpdates.removeMember(id, userId);
    }

    inviteCommunityUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return communityLocalUpdates.inviteUsers(id, userIds);
    }

    uninviteCommunityUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return communityLocalUpdates.uninviteUsers(id, userIds);
    }

    updateCommunityRules(id: CommunityIdentifier, rules: VersionedRules): UndoLocalUpdate {
        return communityLocalUpdates.updateRules(id, rules);
    }

    updateCommunityRulesAccepted(id: CommunityIdentifier, accepted: boolean): UndoLocalUpdate {
        return this.#modifyCommunitySummaryUpdates(
            id,
            (upd) => {
                upd.rulesAccepted = accepted;
                return (upd) => {
                    upd.rulesAccepted = undefined;
                    return upd;
                };
            },
            "updateCommunityRulesAccepted",
        );
    }

    deleteUserGroup(id: CommunityIdentifier, userGroupId: number): UndoLocalUpdate {
        return communityLocalUpdates.deleteUserGroup(id, userGroupId);
    }

    addOrUpdateUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): UndoLocalUpdate {
        return communityLocalUpdates.addOrUpdateUserGroup(id, userGroup);
    }

    removeBotFromCommunity(id: CommunityIdentifier, botId: string): UndoLocalUpdate {
        return communityLocalUpdates.removeBot(id, botId);
    }

    favourite(id: ChatIdentifier): UndoLocalUpdate {
        return addToWritableLocalSet(id, this.favourites);
    }

    unfavourite(id: ChatIdentifier): UndoLocalUpdate {
        return removeFromWritableLocalSet(id, this.favourites);
    }

    installBotInCommunity(
        id: CommunityIdentifier,
        botId: string,
        perm: GrantedBotPermissions,
    ): UndoLocalUpdate {
        return communityLocalUpdates.installBot(id, botId, perm);
    }
    removeCommunity(id: CommunityIdentifier) {
        if (this.previewCommunities.value.get(id)) {
            return this.removeCommunityPreview(id);
        } else {
            return removeFromWritableLocalMap(id, this.communities);
        }
    }

    updateCommunityIndex(id: CommunityIdentifier, index: number): UndoLocalUpdate {
        return this.#modifyCommunitySummaryUpdates(
            id,
            (upd) => {
                upd.index = index;
                return (upd) => {
                    upd.index = undefined;
                    return upd;
                };
            },
            "updateCommunityIndex",
        );
    }

    // Chat stuff
    updateChatMember(
        id: ChatIdentifier,
        userId: string,
        existing: Member | undefined,
        updater: (m: Member) => Member,
    ) {
        return chatDetailsLocalUpdates.updateMember(id, userId, existing, updater);
    }

    blockChatUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return chatDetailsLocalUpdates.blockUser(id, userId);
    }

    unblockChatUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return chatDetailsLocalUpdates.unblockUser(id, userId);
    }

    removeChatMember(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return chatDetailsLocalUpdates.removeMember(id, userId);
    }

    addChatMember(id: ChatIdentifier, member: Member): UndoLocalUpdate {
        return chatDetailsLocalUpdates.addMember(id, member);
    }

    pinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return chatDetailsLocalUpdates.pinMessage(id, messageIndex);
    }

    unpinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return chatDetailsLocalUpdates.unpinMessage(id, messageIndex);
    }

    inviteChatUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        return chatDetailsLocalUpdates.inviteUsers(id, userIds);
    }

    uninviteChatUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        return chatDetailsLocalUpdates.uninviteUsers(id, userIds);
    }

    updateChatRules(id: ChatIdentifier, rules: VersionedRules): UndoLocalUpdate {
        return chatDetailsLocalUpdates.updateRules(id, rules);
    }

    removeBotFromChat(id: ChatIdentifier, botId: string): UndoLocalUpdate {
        return chatDetailsLocalUpdates.removeBot(id, botId);
    }

    installBotInChat(
        id: ChatIdentifier,
        botId: string,
        perm: GrantedBotPermissions,
    ): UndoLocalUpdate {
        return chatDetailsLocalUpdates.installBot(id, botId, perm);
    }

    addWebhookToChat(id: ChatIdentifier, webhook: WebhookDetails): UndoLocalUpdate {
        return chatDetailsLocalUpdates.addWebhook(id, webhook);
    }

    updateWebhook(id: ChatIdentifier, webhook: WebhookDetails): UndoLocalUpdate {
        return chatDetailsLocalUpdates.updateWebhook(id, webhook);
    }

    removeWebhookFromChat(id: ChatIdentifier, webhookId: string): UndoLocalUpdate {
        return chatDetailsLocalUpdates.removeWebhook(id, webhookId);
    }

    pinToScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return chatDetailsLocalUpdates.pinToScope(id, scope);
    }

    unpinFromScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return chatDetailsLocalUpdates.unpinFromScope(id, scope);
    }

    removeDirectChatBot(botId: string): UndoLocalUpdate {
        const undo1 = this.removeChat({ kind: "direct_chat", userId: botId });
        const undo2 = removeFromWritableLocalMap(botId, this.directChatBots);
        return () => {
            undo1();
            undo2();
        };
    }

    installDirectChatBot(botId: string, perm: GrantedBotPermissions): UndoLocalUpdate {
        return addToWritableLocalMap(botId, perm, this.directChatBots);
    }

    #modifyMessageUpdates(
        messageId: bigint,
        fn: (val: MessageLocalUpdates) => (v: MessageLocalUpdates) => MessageLocalUpdates,
        functionName: string,
    ): UndoLocalUpdate {
        return modifyWritableMap(
            messageId,
            fn,
            messageLocalUpdates,
            () => new MessageLocalUpdates(),
            `${functionName}_${messageId}`,
        );
    }

    #modifyCommunitySummaryUpdates(
        id: CommunityIdentifier,
        fn: (
            val: CommunitySummaryUpdates,
        ) => (v: CommunitySummaryUpdates) => CommunitySummaryUpdates,
        functionName: string,
    ): UndoLocalUpdate {
        return modifyWritableMap(
            id,
            fn,
            communitySummaryLocalUpdates,
            () => new CommunitySummaryUpdates(),
            `${functionName}_${id.communityId}`,
        );
    }

    #modifyChatSummaryUpdates(
        id: ChatIdentifier,
        fn: (val: ChatSummaryUpdates) => (v: ChatSummaryUpdates) => ChatSummaryUpdates,
        functionName: string,
    ): UndoLocalUpdate {
        return modifyWritableMap(
            id,
            fn,
            chatSummaryLocalUpdates,
            () => new ChatSummaryUpdates(),
            `${functionName}_${chatIdentifierToString(id)}`,
        );
    }

    updateNotificationsMuted(id: ChatIdentifier, muted: boolean): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(
            id,
            (upd) => {
                upd.notificationsMuted = muted;
                return (upd) => {
                    upd.notificationsMuted = undefined;
                    return upd;
                };
            },
            "updateNotificationsMuted",
        );
    }

    updateArchived(id: ChatIdentifier, archived: boolean): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(
            id,
            (upd) => {
                upd.archived = archived;
                return (upd) => {
                    upd.archived = undefined;
                    return upd;
                };
            },
            "updateArchived",
        );
    }

    updateLatestMessage(id: ChatIdentifier, message: EventWrapper<Message>): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(
            id,
            (upd) => {
                if (!dequal(upd.latestMessage, message)) {
                    upd.latestMessage = message;
                    return (upd) => {
                        if (upd.latestMessage !== undefined) {
                            revokeObjectUrls(upd.latestMessage);
                        }
                        upd.latestMessage = undefined;
                        return upd;
                    };
                }
                return (upd) => upd;
            },
            "updateLatestMessage",
        );
    }

    updateChatRulesAccepted(id: ChatIdentifier, rulesAccepted: boolean): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(
            id,
            (upd) => {
                upd.rulesAccepted = rulesAccepted;
                return (upd) => {
                    upd.rulesAccepted = undefined;
                    return upd;
                };
            },
            "updateChatRulesAccepted",
        );
    }

    updateDirectChatProperties(id: DirectChatIdentifier, eventsTTL?: OptionUpdate<bigint>) {
        return this.#modifyChatSummaryUpdates(
            id,
            (upd) => {
                upd.eventsTTL = eventsTTL;
                return (upd) => {
                    upd.eventsTTL = undefined;
                    return upd;
                };
            },
            "updateDirectChatProperties",
        );
    }

    updateChatProperties(
        id: ChatIdentifier,
        name?: string,
        description?: string,
        permissions?: OptionalChatPermissions,
        gateConfig?: AccessGateConfig,
        eventsTTL?: OptionUpdate<bigint>,
        isPublic?: boolean,
    ) {
        return this.#modifyChatSummaryUpdates(
            id,
            (upd) => {
                upd.name = name;
                upd.description = description;
                upd.permissions = permissions;
                upd.gateConfig = gateConfig;
                upd.eventsTTL = eventsTTL;
                upd.isPublic = isPublic;
                return (upd) => {
                    upd.name = undefined;
                    upd.description = undefined;
                    upd.permissions = undefined;
                    upd.gateConfig = undefined;
                    upd.eventsTTL = undefined;
                    upd.isPublic = undefined;
                    return upd;
                };
            },
            "updateChatProperties",
        );
    }

    updateChatFrozen(id: ChatIdentifier, frozen: boolean): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(
            id,
            (upd) => {
                upd.frozen = frozen;
                return (upd) => {
                    upd.frozen = undefined;
                    return upd;
                };
            },
            "updateChatFrozen",
        );
    }

    // message updates
    markMessageContentEdited(msg: Message, blockLevelMarkdown?: boolean): UndoLocalUpdate {
        return this.#modifyMessageUpdates(
            msg.messageId,
            (upd) => {
                upd.editedContent = msg.content;
                upd.blockLevelMarkdown = blockLevelMarkdown;
                upd.linkRemoved = false;
                return (upd) => {
                    upd.editedContent = undefined;
                    upd.blockLevelMarkdown = undefined;
                    upd.linkRemoved = false;
                    return upd;
                };
            },
            "markMessageContentEdited",
        );
    }

    markCancelledReminder(messageId: bigint, content: MessageReminderCreatedContent) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.cancelledReminder = content;
                return (upd) => {
                    upd.cancelledReminder = undefined;
                    return upd;
                };
            },
            "markCancelledReminder",
        );
    }

    markMessageDeleted(messageId: bigint, userId: string) {
        return this.#markMessageDeletedUndeleted(
            messageId,
            { deletedBy: userId, timestamp: BigInt(Date.now()) },
            undefined,
            undefined,
        );
    }

    markMessageUndeleted(messageId: bigint, content?: MessageContent) {
        return this.#markMessageDeletedUndeleted(messageId, undefined, content, undefined);
    }

    markMessageContentRevealed(messageId: bigint, content: MessageContent) {
        return this.#markMessageDeletedUndeleted(messageId, undefined, undefined, content);
    }

    markBlockedMessageRevealed(messageId: bigint) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.hiddenMessageRevealed = true;
                return (upd) => {
                    upd.hiddenMessageRevealed = undefined;
                    return upd;
                };
            },
            "markBlockedMessageRevealed",
        );
    }

    markLinkRemoved(messageId: bigint, content: MessageContent) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.editedContent = content;
                upd.linkRemoved = true;
                return (upd) => {
                    upd.editedContent = undefined;
                    upd.linkRemoved = false;
                    return upd;
                };
            },
            "markLinkRemoved",
        );
    }

    markReaction(messageId: bigint, reaction: LocalReaction) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.reactions.push(reaction);
                return (upd) => {
                    upd.reactions = [];
                    return upd;
                };
            },
            "markReaction",
        );
    }

    markTip(messageId: bigint, ledger: string, userId: string, amount: bigint) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                let map = upd.tips.get(ledger);
                if (map === undefined) {
                    map = new Map();
                    upd.tips.set(ledger, map);
                }

                const currentAmount = map.get(userId);
                if (currentAmount === undefined) {
                    map.set(userId, amount);
                } else {
                    map.set(userId, currentAmount + amount);
                }

                if ((map.get(userId) ?? 0) <= 0n) {
                    map.delete(userId);
                }

                if (map.size === 0) {
                    upd.tips.delete(ledger);
                }
                return (upd) => {
                    upd.tips = new Map();
                    return upd;
                };
            },
            "markTip",
        );
    }

    markPrizeClaimed(messageId: bigint) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.prizeClaimed = true;
                return (upd) => {
                    upd.prizeClaimed = undefined;
                    return upd;
                };
            },
            "markPrizeClaimed",
        );
    }

    markProposalTallyUpdated(messageId: bigint, tally: Tally) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.proposalTally = tally;
                return (upd) => {
                    upd.proposalTally = undefined;
                    return upd;
                };
            },
            "markProposalTallyUpdated"
        );
    }

    setP2PSwapStatus(messageId: bigint, status: P2PSwapStatus) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.p2pSwapStatus = status;
                return (upd) => {
                    upd.p2pSwapStatus = undefined;
                    return upd;
                };
            },
            "setP2PSwapStatus",
        );
    }

    markPollVote(messageId: bigint, vote: LocalPollVote) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.pollVotes.push(vote);
                return (upd) => {
                    upd.pollVotes = [];
                    return upd;
                };
            },
            "markPollVote",
        );
    }

    markThreadSummaryUpdated(messageId: bigint, summaryUpdates: Partial<ThreadSummary>) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.threadSummary = { ...upd.threadSummary, ...summaryUpdates };
                return (upd) => {
                    upd.threadSummary = undefined;
                    return upd;
                };
            },
            "markThreadSummaryUpdated",
        );
    }

    #markMessageDeletedUndeleted(
        messageId: bigint,
        deleted: MessageDeleted | undefined,
        undeletedContent: MessageContent | undefined,
        revealedContent: MessageContent | undefined,
    ) {
        return this.#modifyMessageUpdates(
            messageId,
            (upd) => {
                upd.deleted = deleted;
                upd.undeletedContent = undeletedContent;
                upd.revealedContent = revealedContent;
                return (upd) => {
                    upd.deleted = undefined;
                    upd.undeletedContent = undefined;
                    upd.revealedContent = undefined;
                    return upd;
                };
            },
            "markMessageDeletedUndeleted",
        );
    }
}

export const localUpdates = new GlobalLocalState();
