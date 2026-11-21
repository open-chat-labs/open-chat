import {
    CommunityMap,
    type CommunityIdentifier,
    type GrantedBotPermissions,
    type Member,
    type UserGroupDetails,
    type VersionedRules,
} from "@shared";
import { writable, type Writable } from "../../utils/stores";
import { LocalMap } from "../map";
import { LocalSet } from "../set";
import { type UndoLocalUpdate } from "../undo";
import { modifyWritable, notEq } from "../utils";

const localMap = <K, V>() => new LocalMap<K, V>();
const localSet = <V>() => new LocalSet<V>();

export class CommunityDetailsUpdatesManager {
    members = writable<CommunityMap<LocalMap<string, Member>>>(
        new CommunityMap(),
        undefined,
        notEq,
    );
    invitedUsers = writable<CommunityMap<LocalSet<string>>>(new CommunityMap(), undefined, notEq);
    blockedUsers = writable<CommunityMap<LocalSet<string>>>(new CommunityMap(), undefined, notEq);
    userGroups = writable<CommunityMap<LocalMap<number, UserGroupDetails>>>(
        new CommunityMap(),
        undefined,
        notEq,
    );
    bots = writable<CommunityMap<LocalMap<string, GrantedBotPermissions>>>(
        new CommunityMap(),
        undefined,
        notEq,
    );
    rules = writable<CommunityMap<VersionedRules>>(new CommunityMap(), undefined, notEq);

    #updateForCommunity<T>(
        id: CommunityIdentifier,
        store: Writable<CommunityMap<T>>,
        notFound: () => T,
        updater: (val: T) => UndoLocalUpdate,
    ): UndoLocalUpdate {
        return modifyWritable((map) => {
            let val = map.get(id);
            if (val === undefined) {
                val = notFound();
                map.set(id, val);
            }
            return updater(val);
        }, store);
    }

    updateMember(id: CommunityIdentifier, userId: string, member: Member) {
        return this.#updateForCommunity(id, this.members, localMap, (m) =>
            m.addOrUpdate(userId, member),
        );
    }

    removeMember(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#updateForCommunity(id, this.members, localMap, (m) => m.remove(userId));
    }

    inviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.#updateForCommunity(id, this.invitedUsers, localSet, (set) => {
            const undos = userIds.map((u) => set.add(u));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    uninviteUsers(id: CommunityIdentifier, userIds: string[]): UndoLocalUpdate {
        return this.#updateForCommunity(id, this.invitedUsers, localSet, (set) => {
            const undos = userIds.map((u) => set.remove(u));
            return () => {
                undos.forEach((u) => u());
            };
        });
    }

    blockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#updateForCommunity(id, this.blockedUsers, localSet, (s) => s.add(userId));
    }

    unblockUser(id: CommunityIdentifier, userId: string): UndoLocalUpdate {
        return this.#updateForCommunity(id, this.blockedUsers, localSet, (s) => s.remove(userId));
    }

    deleteUserGroup(id: CommunityIdentifier, userGroupId: number): UndoLocalUpdate {
        return this.#updateForCommunity(id, this.userGroups, localMap, (s) =>
            s.remove(userGroupId),
        );
    }

    addOrUpdateUserGroup(id: CommunityIdentifier, userGroup: UserGroupDetails): UndoLocalUpdate {
        return this.#updateForCommunity(id, this.userGroups, localMap, (s) =>
            s.addOrUpdate(userGroup.id, userGroup),
        );
    }

    removeBot(id: CommunityIdentifier, botId: string): UndoLocalUpdate {
        return this.#updateForCommunity(id, this.bots, localMap, (s) => s.remove(botId));
    }

    installBot(
        id: CommunityIdentifier,
        botId: string,
        perm: GrantedBotPermissions,
    ): UndoLocalUpdate {
        return this.#updateForCommunity(id, this.bots, localMap, (s) => s.addOrUpdate(botId, perm));
    }

    // The undo takes off only these rules, and only while they're still the ones held: a later
    // update's rules stay, and nothing earlier is put back. Putting back the rules this replaced
    // let two saves inside the undo's timeout leave the first save's rules in place for good, once
    // both undos had run, over the newer ones the server's details held (as for a chat's rules).
    updateRules(id: CommunityIdentifier, rules: VersionedRules): UndoLocalUpdate {
        return modifyWritable((map) => {
            map.set(id, rules);
            return () => {
                if (map.get(id) === rules) {
                    map.delete(id);
                }
            };
        }, this.rules);
    }

    clear() {
        this.members.set(new CommunityMap());
        this.invitedUsers.set(new CommunityMap());
        this.blockedUsers.set(new CommunityMap());
        this.userGroups.set(new CommunityMap());
        this.bots.set(new CommunityMap());
        this.rules.set(new CommunityMap());
    }
}

export const communityLocalUpdates = new CommunityDetailsUpdatesManager();
