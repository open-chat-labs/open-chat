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

    #withState(
        id: CommunityIdentifier,
        fn: (state: CommunityDetailUpdates) => CommunityDetailUpdates,
    ) {
        const state = this.#getOrCreate(id);
        this.set(id, fn(state));
        return scheduleUndo(() => {
            this.publish();
        });
    }

    updateMember(id: CommunityIdentifier, userId: string, member: Member) {
        return this.#withState(id, (state) => {
            state.members.addOrUpdate(userId, member);
            return state;
        });
    }

    blockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            state.blockedUsers.add(userId);
            return state;
        });
    }

    unblockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            state.blockedUsers.remove(userId);
            return state;
        });
    }

    removeMember(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            state.members.remove(userId);
            return state;
        });
    }

    inviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            userIds.forEach((u) => state.invitedUsers.add(u));
            return state;
        });
    }

    uninviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            userIds.forEach((u) => state.invitedUsers.remove(u));
            return state;
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
            state.userGroups.remove(userGroupId);
            return state;
        });
    }

    addOrUpdateUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            state.userGroups.addOrUpdate(userGroup.id, userGroup);
            return state;
        });
    }

    removeBot(id: CommunityIdentifier, botId: string): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            state.bots.remove(botId);
            return state;
        });
    }

    installBot(
        id: CommunityIdentifier,
        botId: string,
        perm: ExternalBotPermissions,
    ): UndoLocalUpdate {
        return this.#withState(id, (state) => {
            state.bots.addOrUpdate(botId, perm);
            return state;
        });
    }
}

export const communityLocalUpdates = new CommunityDetailsUpdatesManager();
