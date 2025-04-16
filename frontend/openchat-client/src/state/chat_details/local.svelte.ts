import type {
    CommunityIdentifier,
    ExternalBotPermissions,
    Member,
    PublicApiKeyDetails,
    UserGroupDetails,
    VersionedRules,
} from "openchat-shared";
import { SvelteMap } from "svelte/reactivity";
import { LocalMap } from "../map";
import { LocalSet } from "../set";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class ChatDetailsLocalState {
    #rules = $state<VersionedRules | undefined>();

    readonly invitedUsers = new LocalSet<string>();
    readonly blockedUsers = new LocalSet<string>();
    readonly referrals = new LocalSet<string>();
    readonly lapsedMembers = new LocalSet<string>();
    readonly members = new LocalMap<string, Member>();
    readonly userGroups = new LocalMap<number, UserGroupDetails>();
    readonly bots = new LocalMap<string, ExternalBotPermissions>();
    readonly apiKeys = new LocalMap<string, PublicApiKeyDetails>();

    get rules() {
        return this.#rules;
    }
    set rules(val: VersionedRules | undefined) {
        this.#rules = val;
    }
}

export class ChatDetailsLocalStateManager {
    #data = new SvelteMap<string, ChatDetailsLocalState>();

    get(id: CommunityIdentifier): ChatDetailsLocalState | undefined {
        return this.#data.get(id.communityId);
    }

    #getOrCreate(id: CommunityIdentifier): ChatDetailsLocalState {
        let state = this.#data.get(id.communityId);
        if (state === undefined) {
            state = new ChatDetailsLocalState();
            this.#data.set(id.communityId, state);
        }
        return state;
    }

    updateMember(id: CommunityIdentifier, userId: string, member: Member) {
        return this.#getOrCreate(id).members.addOrUpdate(userId, member);
    }

    blockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).blockedUsers.add(userId);
    }

    unblockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).blockedUsers.remove(userId);
    }

    removeMember(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).members.remove(userId);
    }

    inviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        const invited = this.#getOrCreate(id).invitedUsers;
        const undos = userIds.map((u) => invited.add(u));
        return () => {
            undos.forEach((u) => {
                u();
            });
        };
    }

    uninviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        const invited = this.#getOrCreate(id).invitedUsers;
        const undos = userIds.map((u) => invited.remove(u));
        return () => {
            undos.forEach((u) => {
                u();
            });
        };
    }

    updateRules(id: CommunityIdentifier, rules: VersionedRules): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.rules;
        state.rules = rules;
        return scheduleUndo(() => {
            state.rules = previous;
        });
    }

    deleteUserGroup(id: CommunityIdentifier, userGroupId: number): UndoLocalUpdate {
        return this.#getOrCreate(id).userGroups.remove(userGroupId);
    }

    addOrUpdateUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): UndoLocalUpdate {
        return this.#getOrCreate(id).userGroups.addOrUpdate(userGroup.id, userGroup);
    }

    removeBot(id: CommunityIdentifier, botId: string): UndoLocalUpdate {
        return this.#getOrCreate(id).bots.remove(botId);
    }

    installBot(
        id: CommunityIdentifier,
        botId: string,
        perm: ExternalBotPermissions,
    ): UndoLocalUpdate {
        return this.#getOrCreate(id).bots.addOrUpdate(botId, perm);
    }
}

export const chatDetailsLocalUpdates = new ChatDetailsLocalStateManager();
