import type {
    ChatIdentifier,
    ChatListScope,
    ExternalBotPermissions,
    Member,
    PublicApiKeyDetails,
    VersionedRules,
    WebhookDetails,
} from "openchat-shared";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

const noop = () => {};

export class ChatDetailsUpdatesManager {
    members = new ChatLocalMapStore<string, Member>();
    blockedUsers = new ChatLocalSetStore<string>();
    pinnedMessages = new ChatLocalSetStore<number>();
    invitedUsers = new ChatLocalSetStore<string>();
    bots = new ChatLocalMapStore<string, ExternalBotPermissions>();
    apiKeys = new ChatLocalMapStore<string, PublicApiKeyDetails>();
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
        this.apiKeys.clear();
        this.webhooks.clear();
        this.rules.clear();
    }
}

export const chatDetailsLocalUpdates = new ChatDetailsUpdatesManager();
