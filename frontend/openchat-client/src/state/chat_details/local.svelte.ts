import {
    type AccessGateConfig,
    type ChatIdentifier,
    type ChatListScope,
    type EventWrapper,
    type ExternalBotPermissions,
    type Member,
    type Message,
    type OptionalChatPermissions,
    type OptionUpdate,
    type PublicApiKeyDetails,
    type VersionedRules,
    type WebhookDetails,
} from "openchat-shared";
import { revokeObjectUrls } from "../../utils/chat";
import { LocalMap, ReactiveChatMap } from "../map";
import { LocalSet } from "../set";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class ChatDetailsLocalState {
    #rules = $state<VersionedRules | undefined>();
    #notificationsMuted = $state<boolean | undefined>();
    #archived = $state<boolean | undefined>();
    #latestMessage = $state<EventWrapper<Message> | undefined>();
    #rulesAccepted = $state<boolean | undefined>();
    #name = $state<string | undefined>();
    #description = $state<string | undefined>();
    #permissions = $state<OptionalChatPermissions | undefined>();
    #gateConfig = $state<AccessGateConfig | undefined>();
    #eventsTTL = $state<OptionUpdate<bigint> | undefined>();
    #frozen = $state<boolean | undefined>();

    readonly pinnedToScopes = new LocalSet<ChatListScope["kind"]>();
    readonly pinnedMessages = new LocalSet<number>();
    readonly invitedUsers = new LocalSet<string>();
    readonly blockedUsers = new LocalSet<string>();
    readonly members = new LocalMap<string, Member>();
    readonly bots = new LocalMap<string, ExternalBotPermissions>();
    readonly apiKeys = new LocalMap<string, PublicApiKeyDetails>();
    readonly webhooks = new LocalMap<string, WebhookDetails>();

    get rules() {
        return this.#rules;
    }
    set rules(val: VersionedRules | undefined) {
        this.#rules = val;
    }

    get notificationsMuted() {
        return this.#notificationsMuted;
    }

    set notificationsMuted(val: boolean | undefined) {
        this.#notificationsMuted = val;
    }

    get archived() {
        return this.#archived;
    }

    set archived(val: boolean | undefined) {
        this.#archived = val;
    }

    get name() {
        return this.#name;
    }

    set name(val: string | undefined) {
        this.#name = val;
    }

    get description() {
        return this.#description;
    }

    set description(val: string | undefined) {
        this.#description = val;
    }

    get permissions() {
        return this.#permissions;
    }

    set permissions(val: OptionalChatPermissions | undefined) {
        this.#permissions = val;
    }

    get gateConfig() {
        return this.#gateConfig;
    }

    set gateConfig(val: AccessGateConfig | undefined) {
        this.#gateConfig = val;
    }

    get eventsTTL() {
        return this.#eventsTTL;
    }

    set eventsTTL(val: OptionUpdate<bigint> | undefined) {
        this.#eventsTTL = val;
    }

    get rulesAccepted() {
        return this.#rulesAccepted;
    }

    set rulesAccepted(val: boolean | undefined) {
        this.#rulesAccepted = val;
    }

    get frozen() {
        return this.#frozen;
    }

    set frozen(val: boolean | undefined) {
        this.#frozen = val;
    }

    get latestMessage() {
        return this.#latestMessage;
    }

    set latestMessage(val: EventWrapper<Message> | undefined) {
        this.#latestMessage = val;
    }
}

const noop = () => {};

export class ChatDetailsLocalStateManager {
    #data = new ReactiveChatMap<ChatDetailsLocalState>();

    get(id: ChatIdentifier): ChatDetailsLocalState | undefined {
        return this.#data.get(id);
    }

    #getOrCreate(id: ChatIdentifier): ChatDetailsLocalState {
        let state = this.#data.get(id);
        if (state === undefined) {
            state = new ChatDetailsLocalState();
            this.#data.set(id, state);
        }
        return state;
    }

    entries(): IterableIterator<[ChatIdentifier, ChatDetailsLocalState]> {
        return this.#data.entries();
    }

    updateChatProperties(
        id: ChatIdentifier,
        name?: string,
        description?: string,
        permissions?: OptionalChatPermissions,
        gateConfig?: AccessGateConfig,
        eventsTTL?: OptionUpdate<bigint>,
    ) {
        const state = this.#getOrCreate(id);
        const prevName = state.name;
        const prevDescription = state.description;
        const prevPermissions = state.permissions;
        const prevGateConfig = state.gateConfig;
        const prevEventsTTL = state.eventsTTL;

        state.name = name;
        state.description = description;
        state.permissions = permissions;
        state.gateConfig = gateConfig;
        state.eventsTTL = eventsTTL;

        return scheduleUndo(() => {
            state.name = prevName;
            state.description = prevDescription;
            state.permissions = prevPermissions;
            state.gateConfig = prevGateConfig;
            state.eventsTTL = prevEventsTTL;
        });
    }

    updateMember(
        id: ChatIdentifier,
        userId: string,
        existing: Member | undefined,
        updater: (m: Member) => Member,
    ) {
        if (existing !== undefined) {
            return this.#getOrCreate(id).members.addOrUpdate(userId, updater(existing));
        }
        return noop;
    }

    updateLatestMessage(id: ChatIdentifier, message: EventWrapper<Message>): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.latestMessage;
        state.latestMessage = message;
        return scheduleUndo(() => {
            if (state.latestMessage !== undefined) {
                revokeObjectUrls(state.latestMessage);
            }
            state.latestMessage = previous;
        });
    }

    updateRulesAccepted(id: ChatIdentifier, rulesAccepted: boolean): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.rulesAccepted;
        state.rulesAccepted = rulesAccepted;
        return scheduleUndo(() => {
            state.rulesAccepted = previous;
        });
    }

    updateNotificationsMuted(id: ChatIdentifier, muted: boolean): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.notificationsMuted;
        state.notificationsMuted = muted;
        return scheduleUndo(() => {
            state.notificationsMuted = previous;
        });
    }

    updateFrozen(id: ChatIdentifier, frozen: boolean): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.frozen;
        state.frozen = frozen;
        return scheduleUndo(() => {
            state.frozen = previous;
        });
    }

    updateArchived(id: ChatIdentifier, archived: boolean): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.archived;
        state.archived = archived;
        return scheduleUndo(() => {
            state.archived = previous;
        });
    }

    blockUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).blockedUsers.add(userId);
    }

    unblockUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).blockedUsers.remove(userId);
    }

    removeMember(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).members.remove(userId);
    }

    addMember(id: ChatIdentifier, member: Member): UndoLocalUpdate {
        return this.#getOrCreate(id).members.addOrUpdate(member.userId, member);
    }

    pinToScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return this.#getOrCreate(id).pinnedToScopes.add(scope);
    }

    unpinFromScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return this.#getOrCreate(id).pinnedToScopes.remove(scope);
    }

    pinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return this.#getOrCreate(id).pinnedMessages.add(messageIndex);
    }

    unpinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return this.#getOrCreate(id).pinnedMessages.remove(messageIndex);
    }

    inviteUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        const invited = this.#getOrCreate(id).invitedUsers;
        const undos = userIds.map((u) => invited.add(u));
        return () => {
            undos.forEach((u) => {
                u();
            });
        };
    }

    uninviteUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        const invited = this.#getOrCreate(id).invitedUsers;
        const undos = userIds.map((u) => invited.remove(u));
        return () => {
            undos.forEach((u) => {
                u();
            });
        };
    }

    updateRules(id: ChatIdentifier, rules: VersionedRules): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.rules;
        state.rules = rules;
        return scheduleUndo(() => {
            state.rules = previous;
        });
    }

    removeBot(id: ChatIdentifier, botId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).bots.remove(botId);
    }

    installBot(id: ChatIdentifier, botId: string, perm: ExternalBotPermissions): UndoLocalUpdate {
        return this.#getOrCreate(id).bots.addOrUpdate(botId, perm);
    }

    addWebhook(id: ChatIdentifier, webhook: WebhookDetails): UndoLocalUpdate {
        return this.#getOrCreate(id).webhooks.addOrUpdate(webhook.id, webhook);
    }

    updateWebhook(id: ChatIdentifier, webhook: WebhookDetails): UndoLocalUpdate {
        return this.#getOrCreate(id).webhooks.addOrUpdate(webhook.id, webhook);
    }

    removeWebhook(id: ChatIdentifier, webhookId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).webhooks.remove(webhookId);
    }

    // Only used for testing
    clearAll() {
        this.#data = new ReactiveChatMap<ChatDetailsLocalState>();
    }
}

export const chatDetailsLocalUpdates = new ChatDetailsLocalStateManager();
