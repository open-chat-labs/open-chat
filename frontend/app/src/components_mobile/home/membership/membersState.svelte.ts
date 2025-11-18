import { i18nKey } from "@src/i18n/i18n";
import { toastStore } from "@src/stores/toast";
import {
    compareRoles,
    roleAsText,
    type ChatIdentifier,
    type CommunityIdentifier,
    type EnhancedExternalBot,
    type ExternalBot,
    type FullMember,
    type GrantedBotPermissions,
    type Member,
    type MemberRole,
    type MultiUserChat,
    type OpenChat,
    type ReadonlyMap,
    type ReadonlySet,
    type UserSummary,
} from "openchat-client";

export class MemberManagement {
    constructor(
        private client: OpenChat,
        private chat: MultiUserChat,
    ) {}

    getUsersFromSet(userLookup: Map<string, UserSummary>, ids: ReadonlySet<string>) {
        return Array.from<string>(ids).reduce((matching, id) => {
            const user = userLookup.get(id);
            if (user) {
                matching.push(user);
            }
            return matching;
        }, [] as UserSummary[]);
    }

    getKnownUsers(userLookup: Map<string, UserSummary>, members: Member[]): FullMember[] {
        const users: FullMember[] = [];
        members.forEach((m) => {
            const user = userLookup.get(m.userId);
            if (user) {
                users.push({
                    ...user,
                    ...m,
                    displayName: m.displayName ?? user.displayName,
                });
            }
        });
        return users;
    }

    async onBlockUser(userId: string) {
        const success = await this.client.blockUser(this.chat.id, userId);
        if (success) {
            toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
        } else {
            toastStore.showFailureToast(i18nKey("blockUserFailed"));
        }
    }

    async onUnblockUser(userId: string) {
        const success = await this.client.unblockUser(this.chat.id, userId);
        if (success) {
            toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
        } else {
            toastStore.showFailureToast(i18nKey("unblockUserFailed"));
        }
    }

    onChangeRole(args: { userId: string; newRole: MemberRole; oldRole: MemberRole }): void {
        const { userId, newRole, oldRole } = args;
        this.client.changeRole(this.chat.id, userId, newRole, oldRole).then((success) => {
            if (!success) {
                const roleText = roleAsText(newRole);
                const promotion = compareRoles(newRole, oldRole) > 0;
                const message = i18nKey(promotion ? "promoteFailed" : "demoteFailed", {
                    role: roleText,
                });
                toastStore.showFailureToast(message);
            }
        });
    }

    canBlockUsers() {
        return this.client.canBlockUsers(this.chat.id);
    }

    canUnblockUsers() {
        return this.client.canUnblockUsers(this.chat.id);
    }

    canRemoveMembers() {
        return this.client.canRemoveMembers(this.chat.id);
    }

    canPromote(from: MemberRole, to: MemberRole) {
        return this.client.canPromote(this.chat.id, from, to);
    }

    canDemote(from: MemberRole, to: MemberRole) {
        return this.client.canDemote(this.chat.id, from, to);
    }

    canManageBots(id: ChatIdentifier | CommunityIdentifier) {
        return this.client.canManageBots(id);
    }

    onRemoveMember(userId: string): void {
        this.client
            .removeMember(this.chat.id, userId)
            .then((resp) => {
                if (resp.kind !== "success") {
                    toastStore.showFailureToast(i18nKey("removeMemberFailed"));
                }
            })
            .catch(() => {
                toastStore.showFailureToast(i18nKey("removeMemberFailed"));
            });
    }

    compareMembers(a: FullMember, b: FullMember): number {
        return b.role - a.role;
    }

    matchesSearch(searchTermLower: string, user: UserSummary | ExternalBot): boolean {
        if (searchTermLower === "") return true;
        if (user.kind === "external_bot") {
            return (
                user.name.toLowerCase().includes(searchTermLower) ||
                (user.definition.description !== undefined &&
                    user.definition.description.toLocaleLowerCase().includes(searchTermLower))
            );
        }

        if (user.username === undefined) return true;
        return (
            user.username.toLowerCase().includes(searchTermLower) ||
            (user.displayName !== undefined &&
                user.displayName.toLowerCase().includes(searchTermLower))
        );
    }

    hydrateBots(
        bots: ReadonlyMap<string, GrantedBotPermissions>,
        allBots: Map<string, ExternalBot>,
    ): EnhancedExternalBot[] {
        return [...bots.entries()].reduce((bots, [id, perm]) => {
            const bot = allBots.get(id);
            if (bot !== undefined) {
                bots.push({
                    ...bot,
                    grantedPermissions: perm,
                });
            }
            return bots;
        }, [] as EnhancedExternalBot[]);
    }
}
