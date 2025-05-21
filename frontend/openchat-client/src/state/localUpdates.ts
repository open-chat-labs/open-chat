import { dequal } from "dequal";
import {
    ChatMap,
    CommunityMap,
    emptyChatMetrics,
    MessageContextMap,
    MessageMap,
    nullMembership,
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
    type ExternalBotPermissions,
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
import { MessageLocalUpdates, messageLocalUpdates } from "./message/localUpdates";
import { ChatLocalSet, LocalSet } from "./set";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";
import {
    addToWritableLocalMap,
    addToWritableLocalSet,
    addToWritableMap,
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
    readonly directChatBots = writable<LocalMap<string, ExternalBotPermissions>>(
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
        return modifyWritableMap(
            key,
            (state) => {
                if (!state.has(message.event.messageId)) {
                    state.set(message.event.messageId, { ...message, accepted: false });
                    this.#recentlySentMessages.update((map) => {
                        map.set(message.event.messageId, message.timestamp);
                        return map;
                    });
                    return (state) => {
                        this.#deleteLocalMessage(state, message.event.messageId);
                        this.#recentlySentMessages.update((map) => {
                            map.delete(message.event.messageId);
                            return map;
                        });
                        return state;
                    };
                }
                return (state) => state;
            },
            this.#unconfirmed,
            emptyUnconfirmed,
            60_000,
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
        this.#unconfirmed.update((map) => {
            const state = map.get(key);
            if (state !== undefined) {
                deleted = this.#deleteLocalMessage(state, messageId);
            }
            return map;
        });
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
        this.#groupChatPreviews.update((data) => data.set(chat.id, chat));
        return scheduleUndo(() => {
            this.#groupChatPreviews.update((data) => {
                data.delete(chat.id);
                return data;
            });
        });
    }

    removeGroupPreview(chatId: ChatIdentifier) {
        if (this.#groupChatPreviews.value.has(chatId)) {
            this.#groupChatPreviews.update((data) => {
                data.delete(chatId);
                return data;
            });
        }
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
                    role: "owner",
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

    isPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.value.has(id);
    }

    getPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.value.get(id);
    }

    addCommunityPreview(val: CommunitySummary) {
        return addToWritableMap(val.id, val, this.previewCommunities);
    }

    removeChat(chatId: ChatIdentifier) {
        return removeFromWritableLocalMap(chatId, this.chats);
    }

    addChat(chat: ChatSummary) {
        return addToWritableLocalMap(chat.id, chat, this.chats);
    }

    removeCommunityPreview(id: CommunityIdentifier) {
        return removeFromWritableMap(id, this.previewCommunities);
    }

    addCommunity(val: CommunitySummary) {
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
        return this.#modifyCommunitySummaryUpdates(id, (upd) => {
            const prev = upd.displayName;
            upd.displayName = name !== undefined ? { value: name } : "set_to_none";
            return (upd) => ({
                ...upd,
                displayName: prev,
            });
        });
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
        return this.#modifyCommunitySummaryUpdates(id, (upd) => {
            const prev = upd.rulesAccepted;
            upd.rulesAccepted = accepted;
            return (upd) => ({
                ...upd,
                rulesAccepted: prev,
            });
        });
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
        perm: ExternalBotPermissions,
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
        return this.#modifyCommunitySummaryUpdates(id, (upd) => {
            const prev = upd.index;
            upd.index = index;
            return (upd) => ({
                ...upd,
                index: prev,
            });
        });
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
        perm: ExternalBotPermissions,
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

    installDirectChatBot(botId: string, perm: ExternalBotPermissions): UndoLocalUpdate {
        return addToWritableLocalMap(botId, perm, this.directChatBots);
    }

    #modifyMessageUpdates(
        messageId: bigint,
        fn: (val: MessageLocalUpdates) => (v: MessageLocalUpdates) => MessageLocalUpdates,
    ): UndoLocalUpdate {
        return modifyWritableMap(
            messageId,
            fn,
            messageLocalUpdates,
            () => new MessageLocalUpdates(),
        );
    }

    #modifyCommunitySummaryUpdates(
        id: CommunityIdentifier,
        fn: (
            val: CommunitySummaryUpdates,
        ) => (v: CommunitySummaryUpdates) => CommunitySummaryUpdates,
    ): UndoLocalUpdate {
        return modifyWritableMap(
            id,
            fn,
            communitySummaryLocalUpdates,
            () => new CommunitySummaryUpdates(),
        );
    }

    #modifyChatSummaryUpdates(
        id: ChatIdentifier,
        fn: (val: ChatSummaryUpdates) => (v: ChatSummaryUpdates) => ChatSummaryUpdates,
    ): UndoLocalUpdate {
        return modifyWritableMap(id, fn, chatSummaryLocalUpdates, () => new ChatSummaryUpdates());
    }

    updateNotificationsMuted(id: ChatIdentifier, muted: boolean): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(id, (upd) => {
            const prev = upd.notificationsMuted;
            upd.notificationsMuted = muted;
            return (upd) => ({
                ...upd,
                notificationsMuted: prev,
            });
        });
    }

    updateArchived(id: ChatIdentifier, archived: boolean): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(id, (upd) => {
            const prev = upd.archived;
            upd.archived = archived;
            return (upd) => ({
                ...upd,
                archived: prev,
            });
        });
    }

    updateLatestMessage(id: ChatIdentifier, message: EventWrapper<Message>): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(id, (upd) => {
            const prev = upd.latestMessage;
            if (!dequal(upd.latestMessage, message)) {
                upd.latestMessage = message;
                return (upd) => {
                    if (upd.latestMessage !== undefined) {
                        revokeObjectUrls(upd.latestMessage);
                    }
                    return {
                        ...upd,
                        latestMessage: prev,
                    };
                };
            }
            return (upd) => upd;
        });
    }

    updateChatRulesAccepted(id: ChatIdentifier, rulesAccepted: boolean): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(id, (upd) => {
            const prev = upd.rulesAccepted;
            upd.rulesAccepted = rulesAccepted;
            return (upd) => ({
                ...upd,
                rulesAccepted: prev,
            });
        });
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
        return this.#modifyChatSummaryUpdates(id, (upd) => {
            const prevName = upd.name;
            const prevDescription = upd.description;
            const prevPermissions = upd.permissions;
            const prevGateConfig = upd.gateConfig;
            const prevEventsTTL = upd.eventsTTL;
            const prevIsPublic = upd.isPublic;
            upd.name = name;
            upd.description = description;
            upd.permissions = permissions;
            upd.gateConfig = gateConfig;
            upd.eventsTTL = eventsTTL;
            upd.isPublic = isPublic;
            return (upd) => ({
                ...upd,
                name: prevName,
                description: prevDescription,
                permissions: prevPermissions,
                gateConfig: prevGateConfig,
                eventsTTL: prevEventsTTL,
                isPublic: prevIsPublic,
            });
        });
    }

    updateChatFrozen(id: ChatIdentifier, frozen: boolean): UndoLocalUpdate {
        return this.#modifyChatSummaryUpdates(id, (upd) => {
            const prev = upd.frozen;
            upd.frozen = frozen;
            return (upd) => ({
                ...upd,
                frozen: prev,
            });
        });
    }

    // message updates
    markMessageContentEdited(msg: Message, blockLevelMarkdown?: boolean): UndoLocalUpdate {
        return this.#modifyMessageUpdates(msg.messageId, (upd) => {
            const prev = {
                editedContent: upd.editedContent,
                blockLevelMarkdown: upd.blockLevelMarkdown,
                linkRemoved: upd.linkRemoved,
            };
            upd.editedContent = msg.content;
            upd.blockLevelMarkdown = blockLevelMarkdown;
            upd.linkRemoved = false;
            return (upd) => ({
                ...upd,
                ...prev,
            });
        });
    }

    markCancelledReminder(messageId: bigint, content: MessageReminderCreatedContent) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = upd.cancelledReminder;
            upd.cancelledReminder = content;
            return (upd) => ({
                ...upd,
                cancelledReminder: prev,
            });
        });
    }

    markMessageDeleted(messageId: bigint, userId: string) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = upd.deleted;
            upd.deleted = { deletedBy: userId, timestamp: BigInt(Date.now()) };
            return (upd) => ({
                ...upd,
                deleted: prev,
            });
        });
    }

    markMessageUndeleted(messageId: bigint, content?: MessageContent) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = {
                deleted: upd.deleted,
                undeletedContent: upd.undeletedContent,
                revealedContent: upd.revealedContent,
            };
            upd.deleted = undefined;
            upd.undeletedContent = content;
            upd.revealedContent = undefined;
            return (upd) => ({
                ...upd,
                ...prev,
            });
        });
    }

    markMessageContentRevealed(messageId: bigint, content: MessageContent) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = {
                deleted: upd.deleted,
                revealedContent: upd.revealedContent,
            };
            upd.deleted = undefined;
            upd.revealedContent = content;
            return (upd) => ({
                ...upd,
                ...prev,
            });
        });
    }

    markBlockedMessageRevealed(messageId: bigint) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = upd.hiddenMessageRevealed;
            upd.hiddenMessageRevealed = true;
            return (upd) => ({
                ...upd,
                hiddenMessageRevealed: prev,
            });
        });
    }

    markLinkRemoved(messageId: bigint, content: MessageContent) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = {
                editedContent: upd.editedContent,
                linkRemoved: upd.linkRemoved,
            };
            upd.editedContent = content;
            upd.linkRemoved = true;
            return (upd) => ({
                ...upd,
                ...prev,
            });
        });
    }

    markReaction(messageId: bigint, reaction: LocalReaction) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            upd.reactions.push(reaction);
            return (upd) => ({
                ...upd,
                reactions: upd.reactions.filter((r) => r !== reaction),
            });
        });
    }

    markTip(messageId: bigint, ledger: string, userId: string, amount: bigint) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = upd.tips;

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
            return (upd) => ({
                ...upd,
                tips: prev,
            });
        });
    }

    markPrizeClaimed(messageId: bigint, userId: string) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = upd.prizeClaimed;
            upd.prizeClaimed = userId;
            return (upd) => ({
                ...upd,
                prizeClaimed: prev,
            });
        });
    }

    setP2PSwapStatus(messageId: bigint, status: P2PSwapStatus) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = upd.p2pSwapStatus;
            upd.p2pSwapStatus = status;
            return (upd) => ({
                ...upd,
                p2pSwapStatus: prev,
            });
        });
    }

    markPollVote(messageId: bigint, vote: LocalPollVote) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            upd.pollVotes.push(vote);
            return (upd) => ({
                ...upd,
                pollVotes: upd.pollVotes.filter((v) => v !== vote),
            });
        });
    }

    markThreadSummaryUpdated(messageId: bigint, summaryUpdates: Partial<ThreadSummary>) {
        return this.#modifyMessageUpdates(messageId, (upd) => {
            const prev = upd.threadSummary;
            upd.threadSummary = { ...upd.threadSummary, ...summaryUpdates };
            return (upd) => ({
                ...upd,
                threadSummary: prev,
            });
        });
    }
}

export const localUpdates = new GlobalLocalState();
