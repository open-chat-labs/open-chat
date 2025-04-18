import type {
    ChatIdentifier,
    ExternalBotPermissions,
    Member,
    PublicApiKeyDetails,
    VersionedRules,
} from "openchat-shared";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { LocalMap } from "../map";
import { LocalSet } from "../set";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class ChatDetailsLocalState {
    #rules = $state<VersionedRules | undefined>();

    // Should these index props really be handled by the same merging mechanism? There *is no* server state in this case - only local state. I guess that makes sense still.
    #focusMessageIndex = $state<number | undefined>();
    #focusThreadMessageIndex = $state<number | undefined>();

    readonly userIds = new SvelteSet<string>();
    readonly pinnedMessages = new LocalSet<number>();
    readonly invitedUsers = new LocalSet<string>();
    readonly blockedUsers = new LocalSet<string>();
    readonly members = new LocalMap<string, Member>();
    readonly bots = new LocalMap<string, ExternalBotPermissions>();
    readonly apiKeys = new LocalMap<string, PublicApiKeyDetails>();

    get rules() {
        return this.#rules;
    }
    set rules(val: VersionedRules | undefined) {
        this.#rules = val;
    }

    get focusMessageIndex() {
        return this.#focusMessageIndex;
    }

    get focusThreadMessageIndex() {
        return this.#focusThreadMessageIndex;
    }

    set focusMessageIndex(val: number | undefined) {
        this.#focusMessageIndex = val;
    }

    set focusThreadMessageIndex(val: number | undefined) {
        this.#focusThreadMessageIndex = val;
    }
}

const noop = () => {};

export class ChatDetailsLocalStateManager {
    #data = new SvelteMap<string, ChatDetailsLocalState>();

    get(id: ChatIdentifier): ChatDetailsLocalState | undefined {
        return this.#data.get(JSON.stringify(id));
    }

    #getOrCreate(id: ChatIdentifier): ChatDetailsLocalState {
        const key = JSON.stringify(id);
        let state = this.#data.get(key);
        if (state === undefined) {
            state = new ChatDetailsLocalState();
            this.#data.set(key, state);
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

    setFocusMessageIndex(id: ChatIdentifier, val?: number) {
        const state = this.#getOrCreate(id);
        const previous = state.focusMessageIndex;
        state.focusMessageIndex = val;

        // in this case we don't want to schedule an automatic undo of this state
        return () => {
            state.focusMessageIndex = previous;
        };
    }

    setFocusThreadMessageIndex(id: ChatIdentifier, val?: number) {
        const state = this.#getOrCreate(id);
        const previous = state.focusThreadMessageIndex;
        state.focusThreadMessageIndex = val;

        // in this case we don't want to schedule an automatic undo of this state
        return () => {
            state.focusThreadMessageIndex = previous;
        };
    }

    addUserIds(id: ChatIdentifier, userIds: string[]) {
        const current = this.#getOrCreate(id).userIds;
        userIds.forEach((u) => current.add(u));
    }
}

export const chatDetailsLocalUpdates = new ChatDetailsLocalStateManager();
