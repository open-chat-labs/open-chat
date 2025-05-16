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
import { SvelteMap } from "svelte/reactivity";
import { revokeObjectUrls } from "../../utils/chat";
import { chatDetailsLocalUpdates } from "../chat_details";
import { communityLocalUpdates } from "../community_details";
import {
    CommunityMapStore,
    LocalChatMap,
    LocalCommunityMapStore,
    LocalMap,
    ReactiveChatMap,
    ReactiveMessageContextMap,
} from "../map";
import { messageLocalUpdates } from "../message/local.svelte";
import { LocalSet } from "../set";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";
import { DraftMessages } from "./draft.svelte";

function emptyUnconfirmed(): UnconfirmedState {
    return new SvelteMap<bigint, UnconfirmedMessageEvent>();
}

type FailedMessageState = Map<bigint, EventWrapper<Message>>;
type EphemeralState = Map<bigint, EventWrapper<Message>>;

const noop = () => {};

// global local updates don't need the manager because they are not specific to a keyed entity (community, chat, message etc)
export class GlobalLocalState {
    #blockedDirectUsers = new LocalSet<string>();
    #failedMessages = $state<ReactiveMessageContextMap<FailedMessageState>>(
        new ReactiveMessageContextMap(),
    );
    #recentlySentMessages = new SvelteMap<bigint, bigint>();
    #ephemeral = $state<ReactiveMessageContextMap<EphemeralState>>(new ReactiveMessageContextMap());
    #unconfirmed = $state<ReactiveMessageContextMap<UnconfirmedState>>(
        new ReactiveMessageContextMap(),
    );
    #draftMessages = new DraftMessages();
    readonly chats = new LocalChatMap<ChatSummary>();
    // readonly communities = new LocalCommunityMap<CommunitySummary>();
    readonly communities = new LocalCommunityMapStore<CommunitySummary>();
    readonly previewCommunities = new CommunityMapStore<CommunitySummary>();
    readonly directChatBots = new LocalMap<string, ExternalBotPermissions>();
    #walletConfig = $state<WalletConfig | undefined>();
    #streakInsurance = $state<StreakInsurance | undefined>();
    #messageActivityFeedReadUpTo = $state<bigint | undefined>();
    readonly favourites = new LocalSet<ChatIdentifier>(
        (k) => JSON.stringify(k),
        (k) => JSON.parse(String(k)),
    );
    #uninitialisedDirectChats = new ReactiveChatMap<DirectChatSummary>();
    #groupChatPreviews = new ReactiveChatMap<MultiUserChat>();

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
        this.#walletConfig = undefined;
        this.#streakInsurance = undefined;
        this.#messageActivityFeedReadUpTo = undefined;
        this.favourites.clear();
        this.#uninitialisedDirectChats.clear();
        this.#groupChatPreviews.clear();
        messageLocalUpdates.clearAll();
        chatDetailsLocalUpdates.clearAll();
        communityLocalUpdates.clearAll();
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

    get draftMessages() {
        return this.#draftMessages;
    }

    get unconfirmed() {
        return this.#unconfirmed;
    }

    initialiseFailedMessages(messages: MessageContextMap<FailedMessageState>) {
        this.#failedMessages = new ReactiveMessageContextMap();
        for (const [k, v] of messages) {
            this.#failedMessages.set(k, v);
        }
    }

    addFailedMessage(key: MessageContext, message: EventWrapper<Message>) {
        const s = this.#failedMessages.get(key) ?? new SvelteMap<bigint, EventWrapper<Message>>();
        s.set(message.event.messageId, message);
        this.#failedMessages.set(key, s);
    }

    anyFailed(key: MessageContext): boolean {
        return (this.#failedMessages.get(key)?.size ?? 0) > 0;
    }

    isFailed(key: MessageContext, messageId: bigint): boolean {
        return this.#failedMessages.get(key)?.has(messageId) ?? false;
    }

    failedMessages(key: MessageContext): EventWrapper<Message>[] {
        const state = this.#failedMessages.get(key);
        return state ? [...state.values()] : [];
    }

    deleteFailedMessage(key: MessageContext, messageId: bigint) {
        return this.#deleteLocalMessage(this.#failedMessages, key, messageId);
    }

    addEphemeral(key: MessageContext, message: EventWrapper<Message>) {
        const s = this.#ephemeral.get(key) ?? new SvelteMap<bigint, EventWrapper<Message>>();
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

    ephemeralMessages(key: MessageContext): EventWrapper<Message>[] {
        const state = this.#ephemeral.get(key);
        return state ? [...state.values()] : [];
    }

    #deleteLocalMessage(
        container: ReactiveMessageContextMap<Map<bigint, EventWrapper<Message>>>,
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
        const msg = this.#unconfirmed.get(key)?.get(messageId);
        if (msg) {
            msg.accepted = true;
        }
    }

    // only used for testing
    clearUnconfirmed() {
        this.#unconfirmed = new ReactiveMessageContextMap();
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
        const prev = this.#messageActivityFeedReadUpTo;
        this.#messageActivityFeedReadUpTo = val;
        return scheduleUndo(() => {
            this.#messageActivityFeedReadUpTo = prev;
        });
    }

    get walletConfig() {
        return this.#walletConfig;
    }

    updateWalletConfig(val: WalletConfig) {
        const prev = this.#walletConfig;
        this.#walletConfig = val;
        return scheduleUndo(() => {
            this.#walletConfig = prev;
        });
    }

    get streakInsurance() {
        return this.#streakInsurance;
    }

    updateStreakInsurance(val: StreakInsurance) {
        const prev = this.#streakInsurance;
        this.#streakInsurance = val;
        return scheduleUndo(() => {
            this.#streakInsurance = prev;
        });
    }

    updateCommunityDisplayName(id: CommunityIdentifier, name?: string) {
        return communityLocalUpdates.updateDisplayName(id, name);
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
        return communityLocalUpdates.updateRulesAccepted(id, accepted);
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
        return communityLocalUpdates.updateIndex(id, index);
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
        return chatDetailsLocalUpdates.updateNotificationsMuted(id, muted);
    }

    updateArchived(id: ChatIdentifier, archived: boolean): UndoLocalUpdate {
        return chatDetailsLocalUpdates.updateArchived(id, archived);
    }

    updateLatestMessage(id: ChatIdentifier, message: EventWrapper<Message>): UndoLocalUpdate {
        return chatDetailsLocalUpdates.updateLatestMessage(id, message);
    }

    updateChatRulesAccepted(id: ChatIdentifier, rulesAccepted: boolean): UndoLocalUpdate {
        return chatDetailsLocalUpdates.updateRulesAccepted(id, rulesAccepted);
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
        return chatDetailsLocalUpdates.updateChatProperties(
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
        return chatDetailsLocalUpdates.updateFrozen(id, frozen);
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
