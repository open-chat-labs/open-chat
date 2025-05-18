import {
    type CommunityIdentifier,
    type ExternalBotPermissions,
    type Member,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";
import { CommunityMapStore, LocalMap } from "../map";
import { LocalSet } from "../set";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class CommunityDetailsUpdatesManager {
    members = new CommunityLocalMapStore<string, Member>();
    invitedUsers = new CommunityLocalSetStore<string>();
    blockedUsers = new CommunityLocalSetStore<string>();
    userGroups = new CommunityLocalMapStore<number, UserGroupDetails>();
    bots = new CommunityLocalMapStore<string, ExternalBotPermissions>();
    rules = new CommunityMapStore<VersionedRules>();

    updateMember(id: CommunityIdentifier, userId: string, member: Member) {
        return this.members.addOrUpdate(id, userId, member);
    }

    removeMember(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.members.remove(id, userId);
    }

    inviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.invitedUsers.addMany(id, userIds);
    }

    uninviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.invitedUsers.removeMany(id, userIds);
    }

    blockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.blockedUsers.add(id, userId);
    }

    unblockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.blockedUsers.remove(id, userId);
    }

    deleteUserGroup(id: CommunityIdentifier, userGroupId: number): UndoLocalUpdate {
        return this.userGroups.remove(id, userGroupId);
    }

    addOrUpdateUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): UndoLocalUpdate {
        return this.userGroups.addOrUpdate(id, userGroup.id, userGroup);
    }

    removeBot(id: CommunityIdentifier, botId: string): UndoLocalUpdate {
        return this.bots.remove(id, botId);
    }

    installBot(
        id: CommunityIdentifier,
        botId: string,
        perm: ExternalBotPermissions,
    ): UndoLocalUpdate {
        return this.bots.addOrUpdate(id, botId, perm);
    }

    updateRules(id: CommunityIdentifier, rules: VersionedRules): UndoLocalUpdate {
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

    clear() {
        this.members.clear();
        this.invitedUsers.clear();
        this.blockedUsers.clear();
        this.userGroups.clear();
        this.bots.clear();
        this.rules.clear();
    }
}

export class CommunityLocalSetStore<V> extends CommunityMapStore<LocalSet<V>> {
    add(id: CommunityIdentifier, value: V) {
        return this.#withSet(id, (set) => set.add(value));
    }

    addMany(id: CommunityIdentifier, values: V[]) {
        return this.#withSet(id, (set) => {
            const undos = values.map((v) => set.add(v));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    removeMany(id: CommunityIdentifier, values: V[]) {
        return this.#withSet(id, (set) => {
            const undos = values.map((v) => set.remove(v));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    remove(id: CommunityIdentifier, value: V) {
        return this.#withSet(id, (set) => set.remove(value));
    }

    #withSet(id: CommunityIdentifier, fn: (map: LocalSet<V>) => UndoLocalUpdate) {
        const set = this.get(id) ?? new LocalSet();
        const undo = fn(set);
        this.set(id, set);
        return scheduleUndo(() => {
            undo();
            this.publish();
        });
    }
}

export class CommunityLocalMapStore<K, V> extends CommunityMapStore<LocalMap<K, V>> {
    addOrUpdate(id: CommunityIdentifier, key: K, value: V) {
        return this.#withMap(id, (map) => map.addOrUpdate(key, value));
    }

    remove(id: CommunityIdentifier, key: K) {
        return this.#withMap(id, (map) => map.remove(key));
    }

    #withMap(id: CommunityIdentifier, fn: (map: LocalMap<K, V>) => UndoLocalUpdate) {
        const map = this.get(id) ?? new LocalMap();
        const undo = fn(map);
        this.set(id, map);
        return scheduleUndo(() => {
            undo();
            this.publish();
        });
    }
}

export const communityLocalUpdates = new CommunityDetailsUpdatesManager();
