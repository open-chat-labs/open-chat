import {
    ChatMap,
    NOOP,
    type ChatIdentifier,
    type ChatListScope,
    type GrantedBotPermissions,
    type Member,
    NOOP,
    type VersionedRules,
    type WebhookDetails,
} from "openchat-shared";
import { writable, type Writable } from "../../utils/stores";
import { LocalMap } from "../map";
import { LocalSet } from "../set";
import { type UndoLocalUpdate } from "../undo";
import { modifyWritable, notEq } from "../utils";

const localMap = <K, V>() => new LocalMap<K, V>();
const localSet = <V>() => new LocalSet<V>();

export class ChatDetailsUpdatesManager {
    members = writable<ChatMap<LocalMap<string, Member>>>(new ChatMap(), undefined, notEq);
    blockedUsers = writable<ChatMap<LocalSet<string>>>(new ChatMap(), undefined, notEq);
    pinnedMessages = writable<ChatMap<LocalSet<number>>>(new ChatMap(), undefined, notEq);
    invitedUsers = writable<ChatMap<LocalSet<string>>>(new ChatMap(), undefined, notEq);
    bots = writable<ChatMap<LocalMap<string, GrantedBotPermissions>>>(
        new ChatMap(),
        undefined,
        notEq,
    );
    webhooks = writable<ChatMap<LocalMap<string, WebhookDetails>>>(new ChatMap(), undefined, notEq);
    rules = writable<ChatMap<VersionedRules>>(new ChatMap(), undefined, notEq);
    pinnedToScopes = writable<ChatMap<LocalSet<ChatListScope["kind"]>>>(
        new ChatMap(),
        undefined,
        notEq,
    );

    #updateForChat<T>(
        id: ChatIdentifier,
        store: Writable<ChatMap<T>>,
        notFound: () => T,
        updater: (val: T) => UndoLocalUpdate,
    ): UndoLocalUpdate {
        return modifyWritable((chatMap) => {
            let val = chatMap.get(id);
            if (val === undefined) {
                val = notFound();
                chatMap.set(id, val);
            }
            return updater(val);
        }, store);
    }

    updateMember(
        id: ChatIdentifier,
        userId: string,
        existing: Member | undefined,
        updater: (m: Member) => Member,
    ) {
        if (existing !== undefined) {
            this.#updateForChat(id, this.members, localMap, (map) =>
                map.addOrUpdate(userId, updater(existing)),
            );
        }
        return NOOP;
    }

    blockUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return this.#updateForChat(id, this.blockedUsers, localSet, (set) => set.add(userId));
    }

    unblockUser(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return this.#updateForChat(id, this.blockedUsers, localSet, (set) => set.remove(userId));
    }

    removeMember(id: ChatIdentifier, userId: string): UndoLocalUpdate {
        return this.#updateForChat(id, this.members, localMap, (map) => map.remove(userId));
    }

    addMember(id: ChatIdentifier, member: Member): UndoLocalUpdate {
        return this.#updateForChat(id, this.members, localMap, (map) =>
            map.addOrUpdate(member.userId, member),
        );
    }

    pinToScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return this.#updateForChat(id, this.pinnedToScopes, localSet, (set) => set.add(scope));
    }

    unpinFromScope(id: ChatIdentifier, scope: ChatListScope["kind"]): UndoLocalUpdate {
        return this.#updateForChat(id, this.pinnedToScopes, localSet, (set) => set.remove(scope));
    }

    pinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return this.#updateForChat(id, this.pinnedMessages, localSet, (set) =>
            set.add(messageIndex),
        );
    }

    unpinMessage(id: ChatIdentifier, messageIndex: number): UndoLocalUpdate {
        return this.#updateForChat(id, this.pinnedMessages, localSet, (set) =>
            set.remove(messageIndex),
        );
    }

    inviteUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.#updateForChat(id, this.invitedUsers, localSet, (set) => {
            const undos = userIds.map((u) => set.add(u));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    uninviteUsers(id: ChatIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.#updateForChat(id, this.invitedUsers, localSet, (set) => {
            const undos = userIds.map((u) => set.remove(u));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    updateRules(id: ChatIdentifier, rules: VersionedRules): UndoLocalUpdate {
        return modifyWritable((map) => {
            const prev = map.get(id);
            map.set(id, rules);
            return () => {
                if (prev !== undefined) {
                    map.set(id, prev);
                } else {
                    map.delete(id);
                }
            };
        }, this.rules);
    }

    removeBot(id: ChatIdentifier, botId: string): UndoLocalUpdate {
        return this.#updateForChat(id, this.bots, localMap, (map) => map.remove(botId));
    }

    installBot(id: ChatIdentifier, botId: string, perm: GrantedBotPermissions): UndoLocalUpdate {
        return this.#updateForChat(id, this.bots, localMap, (map) => map.addOrUpdate(botId, perm));
    }

    addWebhook(id: ChatIdentifier, webhook: WebhookDetails): UndoLocalUpdate {
        return this.#updateForChat(id, this.webhooks, localMap, (map) =>
            map.addOrUpdate(webhook.id, webhook),
        );
    }

    updateWebhook(id: ChatIdentifier, webhook: WebhookDetails): UndoLocalUpdate {
        return this.#updateForChat(id, this.webhooks, localMap, (map) =>
            map.addOrUpdate(webhook.id, webhook),
        );
    }

    removeWebhook(id: ChatIdentifier, webhookId: string): UndoLocalUpdate {
        return this.#updateForChat(id, this.webhooks, localMap, (map) => map.remove(webhookId));
    }

    // Only used for testing
    clearAll() {
        this.pinnedToScopes.set(new ChatMap());
        this.pinnedMessages.set(new ChatMap());
        this.invitedUsers.set(new ChatMap());
        this.blockedUsers.set(new ChatMap());
        this.members.set(new ChatMap());
        this.bots.set(new ChatMap());
        this.webhooks.set(new ChatMap());
        this.rules.set(new ChatMap());
    }
}

export const chatDetailsLocalUpdates = new ChatDetailsUpdatesManager();
