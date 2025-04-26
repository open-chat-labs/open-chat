import {
    identity,
    type ChatIdentifier,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type VersionedRules,
} from "openchat-shared";
import { LocalMap, ReactiveChatMap } from "../map";
import { LocalSet } from "../set";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class ChatDetailsLocalState {
    #rules = $state<VersionedRules | undefined>();

    readonly pinnedMessages = new LocalSet<number>();
    readonly invitedUsers = new LocalSet<string>();
    readonly blockedUsers = new LocalSet<string>();
    readonly members = new LocalMap<string, Member, string>(identity, identity);
    readonly bots = new LocalMap<string, ExternalBotPermissions, string>(identity, identity);
    readonly apiKeys = new LocalMap<string, PublicApiKeyDetails, string>(identity, identity);

    get rules() {
        return this.#rules;
    }
    set rules(val: VersionedRules | undefined) {
        this.#rules = val;
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
}

export const chatDetailsLocalUpdates = new ChatDetailsLocalStateManager();
