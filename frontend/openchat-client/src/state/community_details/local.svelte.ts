import {
    identity,
    type CommunityIdentifier,
    type ExternalBotPermissions,
    type Member,
    type OptionUpdate,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type VersionedRules,
} from "openchat-shared";
import { LocalMap, ReactiveCommunityMap } from "../map";
import { LocalSet } from "../set";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class CommunityLocalState {
    #rules = $state<VersionedRules | undefined>();
    #displayName = $state<OptionUpdate<string>>();

    readonly invitedUsers = new LocalSet<string>(identity);
    readonly blockedUsers = new LocalSet<string>(identity);
    readonly referrals = new LocalSet<string>(identity);
    readonly lapsedMembers = new LocalSet<string>(identity);
    readonly members = new LocalMap<string, Member, string>(identity, identity);
    readonly userGroups = new LocalMap<number, UserGroupDetails, number>(identity, identity);
    readonly bots = new LocalMap<string, ExternalBotPermissions, string>(identity, identity);
    readonly apiKeys = new LocalMap<string, PublicApiKeyDetails, string>(identity, identity);

    get rules() {
        return this.#rules;
    }
    set rules(val: VersionedRules | undefined) {
        this.#rules = val;
    }

    get displayName() {
        return this.#displayName;
    }

    set displayName(val: OptionUpdate<string>) {
        this.#displayName = val;
    }
}

// TODO - get rid of this and change CommunityLocalState so that it contains things like:
// invitedUsers = new CommunityMap<LocalSet<string>>
// this would be more efficient and simpler, but we need a reactive version of CommunityMap
export class CommunityLocalStateManager {
    #data = new ReactiveCommunityMap<CommunityLocalState>();

    get(id: CommunityIdentifier): CommunityLocalState | undefined {
        return this.#data.get(id);
    }

    #getOrCreate(id: CommunityIdentifier): CommunityLocalState {
        let state = this.#data.get(id);
        if (state === undefined) {
            state = new CommunityLocalState();
            this.#data.set(id, state);
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

    updateDisplayName(id: CommunityIdentifier, name?: string) {
        const state = this.#getOrCreate(id);
        const previous = state.displayName;
        state.displayName = name !== undefined ? { value: name } : "set_to_none";
        return scheduleUndo(() => {
            state.displayName = previous;
        });
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

export const communityLocalUpdates = new CommunityLocalStateManager();
