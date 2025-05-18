import {
    type CommunityIdentifier,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";
import { CommunityMapStore, LocalMap } from "../map";
import { LocalSet } from "../set";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class CommunityDetailUpdates {
    rules?: VersionedRules;
    invitedUsers = new LocalSet<string>();
    blockedUsers = new LocalSet<string>();
    referrals = new LocalSet<string>();
    lapsedMembers = new LocalSet<string>();
    members = new LocalMap<string, Member>();
    userGroups = new LocalMap<number, UserGroupDetails>();
    bots = new LocalMap<string, ExternalBotPermissions>();
    apiKeys = new LocalMap<string, PublicApiKeyDetails>();
}

export class CommunityDetailsUpdatesManager extends CommunityMapStore<CommunityDetailUpdates> {
    #getOrCreate(id: CommunityIdentifier): CommunityDetailUpdates {
        return this.get(id) ?? new CommunityDetailUpdates();
    }

    #withState(id: CommunityIdentifier, fn: (state: CommunityDetailUpdates) => UndoLocalUpdate) {
        const state = this.#getOrCreate(id);
        const undo = fn(state);
        this.set(id, state);
        return scheduleUndo(() => {
            undo();
            this.publish();
        });
    }

    updateMember(id: CommunityIdentifier, userId: string, member: Member) {
        return this.#withState(id, (state) => {
            return state.members.addOrUpdate(userId, member);
        });
    }

    blockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            return state.blockedUsers.add(userId);
        });
    }

    unblockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            return state.blockedUsers.remove(userId);
        });
    }

    removeMember(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            return state.members.remove(userId);
        });
    }

    inviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            const undos = userIds.map((u) => state.invitedUsers.add(u));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    uninviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            const undos = userIds.map((u) => state.invitedUsers.remove(u));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    updateRules(id: CommunityIdentifier, rules: VersionedRules): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.rules;
        state.rules = rules;
        this.set(id, state);
        return scheduleUndo(() => {
            this.update(id, (val) => ({ ...val, rules: previous }));
        });
    }

    deleteUserGroup(id: CommunityIdentifier, userGroupId: number): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            return state.userGroups.remove(userGroupId);
        });
    }

    addOrUpdateUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            return state.userGroups.addOrUpdate(userGroup.id, userGroup);
        });
    }

    removeBot(id: CommunityIdentifier, botId: string): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            return state.bots.remove(botId);
        });
    }

    installBot(
        id: CommunityIdentifier,
        botId: string,
        perm: ExternalBotPermissions,
    ): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            return state.bots.addOrUpdate(botId, perm);
        });
    }
}

export const communityLocalUpdates = new CommunityDetailsUpdatesManager();
