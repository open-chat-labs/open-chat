import { dequal } from "dequal";
import {
    ChatMap,
    CommunityMap,
    emptyChatMetrics,
    MessageContextMap,
    nullMembership,
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
import { communitySummaryLocalUpdates } from "./community/summaryUpdates";
import { createDraftMessagesStore } from "./draft";
import { LocalChatMap } from "./map";
import { messageLocalUpdates } from "./message/localUpdates";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";
import {
    addToWritableLocalMap,
    addToWritableMap,
    modifyWritableMap,
    notEq,
    removeFromWritableLocalMap,
    removeFromWritableMap,
} from "./utils";

function emptyUnconfirmed(): UnconfirmedState {
    return new Map<bigint, UnconfirmedMessageEvent>();
}

type FailedMessageState = Map<bigint, EventWrapper<Message>>;
type EphemeralState = Map<bigint, EventWrapper<Message>>;

const noop = () => {};

// global local updates don't need the manager because they are not specific to a keyed entity (community, chat, message etc)
export class GlobalLocalState {
    #blockedDirectUsers = new LocalSetStore<string>();
    #recentlySentMessages = new SafeMapStore<bigint, bigint>();
    #ephemeral = new MessageContextMapStore<EphemeralState>();
    #unconfirmed = new MessageContextMapStore<UnconfirmedState>();
    #failedMessages = new MessageContextMapStore<FailedMessageState>();
    readonly draftMessages = createDraftMessagesStore();
    readonly chats = writable<LocalChatMap<ChatSummary>>(new LocalChatMap(), undefined, notEq);
    readonly communities = new LocalCommunityMapStore<CommunitySummary>();
    readonly previewCommunities = writable<CommunityMap<CommunitySummary>>(
        new CommunityMap(),
        undefined,
        notEq,
    );
    readonly directChatBots = new LocalMapStore<string, ExternalBotPermissions>();
    #walletConfig = writable<WalletConfig | undefined>(undefined);
    #streakInsurance = writable<StreakInsurance | undefined>(undefined);
    #messageActivityFeedReadUpTo = writable<bigint | undefined>(undefined);
    readonly favourites = new LocalSetStore<ChatIdentifier>(
        (k) => JSON.stringify(k),
        (k) => JSON.parse(String(k)),
    );
    #uninitialisedDirectChats = writable<ChatMap<DirectChatSummary>>(
        new ChatMap(),
        undefined,
        notEq,
    );
    #groupChatPreviews = writable<ChatMap<MultiUserChat>>(new ChatMap(), undefined, notEq);

    // only used for testing
    clearAll() {
        this.#failedMessages.clear();
        this.#recentlySentMessages.clear();
        this.#ephemeral.clear();
        this.#unconfirmed.clear();
        this.chats.set(new LocalChatMap());
        this.communities.clear();
        this.previewCommunities.set(new CommunityMap());
        this.directChatBots.clear();
        this.#walletConfig.set(undefined);
        this.#streakInsurance.set(undefined);
        this.#messageActivityFeedReadUpTo.set(undefined);
        this.favourites.clear();
        this.#uninitialisedDirectChats.set(new ChatMap());
        this.#groupChatPreviews.set(new ChatMap());
        messageLocalUpdates.clearAll();
        chatDetailsLocalUpdates.clearAll();
        chatSummaryLocalUpdates.set(new ChatMap());
        communityLocalUpdates.clear();
        communitySummaryLocalUpdates.clear();
    }

    blockDirectUser(userId: string) {
        return this.#blockedDirectUsers.add(userId);
    }

    unblockDirectUser(userId: string) {
        return this.#blockedDirectUsers.remove(userId);
    }

    get blockedDirectUsers() {
        return this.#blockedDirectUsers;
    }

    get unconfirmed() {
        return this.#unconfirmed;
    }

    initialiseFailedMessages(messages: MessageContextMap<FailedMessageState>) {
        this.#failedMessages.fromMap(messages);
    }

    addFailedMessage(key: MessageContext, message: EventWrapper<Message>) {
        const s = this.#failedMessages.get(key) ?? new Map<bigint, EventWrapper<Message>>();
        s.set(message.event.messageId, message);
        this.#failedMessages.set(key, s);
    }

    anyFailed(key: MessageContext): boolean {
        return (this.#failedMessages.get(key)?.size ?? 0) > 0;
    }

    isFailed(key: MessageContext, messageId: bigint): boolean {
        return this.#failedMessages.get(key)?.has(messageId) ?? false;
    }

    get failedMessages() {
        return this.#failedMessages;
    }

    failedMessagesForContext(key: MessageContext): EventWrapper<Message>[] {
        const state = this.#failedMessages.get(key);
        return state ? [...state.values()] : [];
    }

    deleteFailedMessage(key: MessageContext, messageId: bigint) {
        return this.#deleteLocalMessage(this.#failedMessages, key, messageId);
    }

    addEphemeral(key: MessageContext, message: EventWrapper<Message>) {
        const s = this.#ephemeral.get(key) ?? new Map<bigint, EventWrapper<Message>>();
        s.set(message.event.messageId, message);
        this.#ephemeral.set(key, s);
        // TODO - I don't think that we want ephemeral messages to automatically disappear
        // but we also don't want them to stay here forever do we?
        // return scheduleUndo(() => {
        //     this.#deleteLocalMessage(this.#ephemeral, key, message.event.messageId);
        // });
    }

    isEphemeral(key: MessageContext, messageId: bigint): boolean {
        return this.#ephemeral.get(key)?.has(messageId) ?? false;
    }

    get ephemeral() {
        return this.#ephemeral;
    }

    ephemeralMessages(key: MessageContext): EventWrapper<Message>[] {
        const state = this.#ephemeral.get(key);
        return state ? [...state.values()] : [];
    }

    #deleteLocalMessage<T extends EventWrapper<Message>>(
        container: MessageContextMapStore<Map<bigint, T>>,
        key: MessageContext,
        messageId: bigint,
    ) {
        const state = container.get(key);
        const msg = state?.get(messageId);
        if (msg !== undefined) {
            revokeObjectUrls(msg);
            state?.delete(messageId);
            if (state?.size === 0) {
                container.delete(key);
            } else {
                container.publish();
            }
            return true;
        }
        return false;
    }

    unconfirmedMessages(key: MessageContext): EventWrapper<Message>[] {
        const state = this.#unconfirmed.get(key);
        return state ? [...state.values()] : [];
    }

    addUnconfirmed(key: MessageContext, message: EventWrapper<Message>): UndoLocalUpdate {
        const s = this.#unconfirmed.get(key) ?? emptyUnconfirmed();
        if (!s.has(message.event.messageId)) {
            s.set(message.event.messageId, { ...message, accepted: false });
            this.#unconfirmed.set(key, s);
            this.#recentlySentMessages.set(message.event.messageId, message.timestamp);
            return scheduleUndo(() => {
                this.#deleteLocalMessage(this.#unconfirmed, key, message.event.messageId);
                this.#recentlySentMessages.delete(message.event.messageId);
            }, 60_000);
        }
        return noop;
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
        const state = this.#unconfirmed.get(key);
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
                this.#unconfirmed.set(key, state);
            }
        }
    }

    deleteUnconfirmed(key: MessageContext, messageId: bigint) {
        return this.#deleteLocalMessage(this.#unconfirmed, key, messageId);
    }

    isUnconfirmed(key: MessageContext, messageId: bigint): boolean {
        return this.#unconfirmed.get(key)?.has(messageId) ?? false;
    }

    isPendingAcceptance(key: MessageContext, messageId: bigint): boolean {
        return this.#unconfirmed.get(key)?.get(messageId)?.accepted === false;
    }

    markUnconfirmedAccepted(key: MessageContext, messageId: bigint) {
        const state = this.#unconfirmed.get(key);
        if (state !== undefined) {
            const msg = state?.get(messageId);
            if (msg) {
                msg.accepted = true;
                this.#unconfirmed.set(key, state);
            }
        }
    }

    // only used for testing
    clearUnconfirmed() {
        this.#unconfirmed.clear();
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
        return this.communities.addOrUpdate(val.id, val);
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
        return communitySummaryLocalUpdates.updateDisplayName(id, name);
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
        return communitySummaryLocalUpdates.updateRulesAccepted(id, accepted);
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
        return this.favourites.add(id);
    }

    unfavourite(id: ChatIdentifier): UndoLocalUpdate {
        return this.favourites.remove(id);
    }

    installBotInCommunity(
        id: CommunityIdentifier,
        botId: string,
        perm: ExternalBotPermissions,
    ): UndoLocalUpdate {
        return communityLocalUpdates.installBot(id, botId, perm);
    }
    removeCommunity(id: CommunityIdentifier) {
        if (!this.removeCommunityPreview(id)) {
            return this.communities.remove(id);
        }
    }

    updateCommunityIndex(id: CommunityIdentifier, index: number): UndoLocalUpdate {
        return communitySummaryLocalUpdates.updateIndex(id, index);
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
        const undo2 = this.directChatBots.remove(botId);
        return () => {
            undo1();
            undo2();
        };
    }

    installDirectChatBot(botId: string, perm: ExternalBotPermissions): UndoLocalUpdate {
        return this.directChatBots.addOrUpdate(botId, perm);
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
        return messageLocalUpdates.markContentEdited(msg, blockLevelMarkdown);
    }

    markCancelledReminder(messageId: bigint, content: MessageReminderCreatedContent) {
        return messageLocalUpdates.markCancelledReminder(messageId, content);
    }

    markMessageDeleted(messageId: bigint, userId: string) {
        return messageLocalUpdates.markDeleted(messageId, userId);
    }

    markMessageUndeleted(messageId: bigint, content?: MessageContent) {
        return messageLocalUpdates.markUndeleted(messageId, content);
    }

    markMessageContentRevealed(messageId: bigint, content: MessageContent) {
        return messageLocalUpdates.markContentRevealed(messageId, content);
    }

    markBlockedMessageRevealed(messageId: bigint) {
        return messageLocalUpdates.markBlockedMessageRevealed(messageId);
    }

    markLinkRemoved(messageId: bigint, content: MessageContent) {
        return messageLocalUpdates.markLinkRemoved(messageId, content);
    }

    markReaction(messageId: bigint, reaction: LocalReaction) {
        return messageLocalUpdates.markReaction(messageId, reaction);
    }

    markTip(messageId: bigint, ledger: string, userId: string, amount: bigint) {
        return messageLocalUpdates.markTip(messageId, ledger, userId, amount);
    }

    markPrizeClaimed(messageId: bigint, userId: string) {
        return messageLocalUpdates.markPrizeClaimed(messageId, userId);
    }

    setP2PSwapStatus(messageId: bigint, status: P2PSwapStatus) {
        return messageLocalUpdates.setP2PSwapStatus(messageId, status);
    }

    markPollVote(messageId: bigint, vote: LocalPollVote) {
        return messageLocalUpdates.markPollVote(messageId, vote);
    }

    markThreadSummaryUpdated(messageId: bigint, summaryUpdates: Partial<ThreadSummary>) {
        return messageLocalUpdates.markThreadSummaryUpdated(messageId, summaryUpdates);
    }
}

export const localUpdates = new GlobalLocalState();
