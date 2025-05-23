import type {
    ChatIdentifier,
    ChatListScope,
    ExternalBotPermissions,
    Member,
    VersionedRules,
    WebhookDetails,
} from "openchat-shared";
import { ChatMapStore, LocalMap } from "../map";
import { LocalSet } from "../set";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

const noop = () => {};

export class ChatDetailsUpdatesManager {
    members = new ChatLocalMapStore<string, Member>();
    blockedUsers = new ChatLocalSetStore<string>();
    pinnedMessages = new ChatLocalSetStore<number>();
    invitedUsers = new ChatLocalSetStore<string>();
    bots = new ChatLocalMapStore<string, ExternalBotPermissions>();
    webhooks = new ChatLocalMapStore<string, WebhookDetails>();

    rules = new ChatMapStore<VersionedRules>();

    // TODO - come back to this fellow
    pinnedToScopes = new ChatLocalSetStore<ChatListScope["kind"]>();

    updateMember(
        id: ChatIdentifier,
        userId: string,
        existing: Member | undefined,
        updater: (m: Member) => Member,
    ) {
        if (existing !== undefined) {
            return this.members.addOrUpdate(id, userId, updater(existing));
        }
        return noop;
    }

    blockUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return this.blockedUsers.add(id, userId);
    }

    unblockUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return this.blockedUsers.remove(id, userId);
    }

    removeMember(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return this.members.remove(id, userId);
    }

    addMember(id: ChatIdentifier, member: Member): UndoLocalUpdate {
        return this.members.addOrUpdate(id, member.userId, member);
    }

    pinToScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return this.pinnedToScopes.add(id, scope);
    }

    unpinFromScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return this.pinnedToScopes.remove(id, scope);
    }

    pinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return this.pinnedMessages.add(id, messageIndex);
    }

    unpinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return this.pinnedMessages.remove(id, messageIndex);
    }

    inviteUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.invitedUsers.addMany(id, userIds);
    }

    uninviteUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.invitedUsers.removeMany(id, userIds);
    }

    updateRules(id: ChatIdentifier, rules: VersionedRules): UndoLocalUpdate {
        const previous = this.rules.get(id);
        this.rules.set(id, rules);
        return scheduleUndo(() => {
            if (previous === undefined) {
                this.rules.delete(id);
            } else {
                this.rules.set(id, previous);
            }
        });
    }

    removeBot(id: ChatIdentifier, botId: string): UndoLocalUpdate {
        return this.bots.remove(id, botId);
    }

    installBot(id: ChatIdentifier, botId: string, perm: ExternalBotPermissions): UndoLocalUpdate {
        return this.bots.addOrUpdate(id, botId, perm);
    }

    addWebhook(id: ChatIdentifier, webhook: WebhookDetails): UndoLocalUpdate {
        return this.webhooks.addOrUpdate(id, webhook.id, webhook);
    }

    updateWebhook(id: ChatIdentifier, webhook: WebhookDetails): UndoLocalUpdate {
        return this.webhooks.addOrUpdate(id, webhook.id, webhook);
    }

    removeWebhook(id: ChatIdentifier, webhookId: string): UndoLocalUpdate {
        return this.webhooks.remove(id, webhookId);
    }

    // Only used for testing
    clearAll() {
        this.pinnedToScopes.clear();
        this.pinnedMessages.clear();
        this.invitedUsers.clear();
        this.blockedUsers.clear();
        this.members.clear();
        this.bots.clear();
        this.webhooks.clear();
        this.rules.clear();
    }
}

export class ChatLocalSetStore<V> extends ChatMapStore<LocalSet<V>> {
    add(id: ChatIdentifier, value: V) {
        return this.#withSet(id, (set) => set.add(value));
    }

    addMany(id: ChatIdentifier, values: V[]) {
        return this.#withSet(id, (set) => {
            const undos = values.map((v) => set.add(v));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    removeMany(id: ChatIdentifier, values: V[]) {
        return this.#withSet(id, (set) => {
            const undos = values.map((v) => set.remove(v));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    remove(id: ChatIdentifier, value: V) {
        return this.#withSet(id, (set) => set.remove(value));
    }

    #withSet(id: ChatIdentifier, fn: (map: LocalSet<V>) => UndoLocalUpdate) {
        const set = this.get(id) ?? new LocalSet();
        const undo = fn(set);
        this.set(id, set);
        return scheduleUndo(() => {
            undo();
            this.publish();
        });
    }
}

export class ChatLocalMapStore<K, V> extends ChatMapStore<LocalMap<K, V>> {
    addOrUpdate(id: ChatIdentifier, key: K, value: V) {
        return this.#withMap(id, (map) => map.addOrUpdate(key, value));
    }

    remove(id: ChatIdentifier, key: K) {
        return this.#withMap(id, (map) => map.remove(key));
    }

    #withMap(id: ChatIdentifier, fn: (map: LocalMap<K, V>) => UndoLocalUpdate) {
        const map = this.get(id) ?? new LocalMap();
        const undo = fn(map);
        this.set(id, map);
        return scheduleUndo(() => {
            undo();
            this.publish();
        });
    }
}

export const chatDetailsLocalUpdates = new ChatDetailsUpdatesManager();
