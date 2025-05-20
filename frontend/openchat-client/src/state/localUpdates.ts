import {
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
import { revokeObjectUrls } from "../utils/url";
import { chatDetailsLocalUpdates } from "./chat/detailsUpdates";
import { chatSummaryLocalUpdates } from "./chat/summaryUpdates";
import { communityLocalUpdates } from "./community/detailUpdates";
import { communitySummaryLocalUpdates } from "./community/summaryUpdates";
import { DraftMessages } from "./draft";
import {
    ChatMapStore,
    CommunityMapStore,
    LocalChatMapStore,
    LocalCommunityMapStore,
    LocalMapStore,
    MessageContextMapStore,
    SafeMapStore,
} from "./map";
import { messageLocalUpdates } from "./message/localUpdates";
import { LocalSetStore } from "./set";
import { scheduleUndo, type UndoLocalUpdate } from "./undo";
import { writable } from "./writable";

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
    readonly draftMessages = new DraftMessages();
    readonly chats = new LocalChatMapStore<ChatSummary>();
    readonly communities = new LocalCommunityMapStore<CommunitySummary>();
    readonly previewCommunities = new CommunityMapStore<CommunitySummary>();
    readonly directChatBots = new LocalMapStore<string, ExternalBotPermissions>();
    #walletConfig = writable<WalletConfig | undefined>(undefined);
    #streakInsurance = writable<StreakInsurance | undefined>(undefined);
    #messageActivityFeedReadUpTo = writable<bigint | undefined>(undefined);
    readonly favourites = new LocalSetStore<ChatIdentifier>(
        (k) => JSON.stringify(k),
        (k) => JSON.parse(String(k)),
    );
    #uninitialisedDirectChats = new ChatMapStore<DirectChatSummary>();
    #groupChatPreviews = new ChatMapStore<MultiUserChat>();

    // only used for testing
    clearAll() {
        this.#failedMessages.clear();
        this.#recentlySentMessages.clear();
        this.#ephemeral.clear();
        this.#unconfirmed.clear();
        this.chats.clear();
        this.communities.clear();
        this.previewCommunities.clear();
        this.directChatBots.clear();
        this.#walletConfig.set(undefined);
        this.#streakInsurance.set(undefined);
        this.#messageActivityFeedReadUpTo.set(undefined);
        this.favourites.clear();
        this.#uninitialisedDirectChats.clear();
        this.#groupChatPreviews.clear();
        messageLocalUpdates.clearAll();
        chatDetailsLocalUpdates.clearAll();
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
        this.#groupChatPreviews.set(chat.id, chat);
    }

    removeGroupPreview(chatId: ChatIdentifier) {
        if (this.#groupChatPreviews.has(chatId)) {
            this.#groupChatPreviews.delete(chatId);
        }
    }

    addUninitialisedDirectChat(chatId: DirectChatIdentifier) {
        this.#uninitialisedDirectChats.set(chatId, {
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
    }

    removeUninitialisedDirectChat(chatId: ChatIdentifier): boolean {
        if (this.#uninitialisedDirectChats.has(chatId)) {
            return this.#uninitialisedDirectChats.delete(chatId);
        }
        return false;
    }

    isPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.has(id);
    }

    getPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.get(id);
    }

    addCommunityPreview(val: CommunitySummary) {
        return this.previewCommunities.set(val.id, val);
    }

    removeChat(chatId: ChatIdentifier) {
        return this.chats.remove(chatId);
    }

    addChat(chat: ChatSummary) {
        return this.chats.addOrUpdate(chat.id, chat);
    }

    removeCommunityPreview(id: CommunityIdentifier) {
        return this.previewCommunities.delete(id);
    }

    addCommunity(val: CommunitySummary) {
        return this.communities.addOrUpdate(val.id, val);
    }

    get messageActivityFeedReadUpTo() {
        return this.#messageActivityFeedReadUpTo;
    }

    setMessageActivityFeedReadUpTo(val: bigint) {
        const prev = this.#messageActivityFeedReadUpTo.current;
        this.#messageActivityFeedReadUpTo.set(val);
        return scheduleUndo(() => {
            this.#messageActivityFeedReadUpTo.set(prev);
        });
    }

    get walletConfig() {
        return this.#walletConfig;
    }

    updateWalletConfig(val: WalletConfig) {
        const prev = this.#walletConfig.current;
        this.#walletConfig.set(val);
        return scheduleUndo(() => {
            this.#walletConfig.set(prev);
        });
    }

    get streakInsurance() {
        return this.#streakInsurance;
    }

    updateStreakInsurance(val: StreakInsurance) {
        const prev = this.#streakInsurance.current;
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

    updateNotificationsMuted(id: ChatIdentifier, muted: boolean): UndoLocalUpdate {
        return chatSummaryLocalUpdates.updateNotificationsMuted(id, muted);
    }

    updateArchived(id: ChatIdentifier, archived: boolean): UndoLocalUpdate {
        return chatSummaryLocalUpdates.updateArchived(id, archived);
    }

    updateLatestMessage(id: ChatIdentifier, message: EventWrapper<Message>): UndoLocalUpdate {
        return chatSummaryLocalUpdates.updateLatestMessage(id, message);
    }

    updateChatRulesAccepted(id: ChatIdentifier, rulesAccepted: boolean): UndoLocalUpdate {
        return chatSummaryLocalUpdates.updateRulesAccepted(id, rulesAccepted);
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
        return chatSummaryLocalUpdates.updateChatProperties(
            id,
            name,
            description,
            permissions,
            gateConfig,
            eventsTTL,
            isPublic,
        );
    }

    updateChatFrozen(id: ChatIdentifier, frozen: boolean): UndoLocalUpdate {
        return chatSummaryLocalUpdates.updateFrozen(id, frozen);
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
