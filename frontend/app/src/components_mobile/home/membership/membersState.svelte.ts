import { i18nKey } from "@src/i18n/i18n";
import { toastStore } from "@src/stores/toast";
import {
    compareRoles,
    publish,
    roleAsText,
    selectedChatBotsStore,
    selectedChatMembersStore,
    selectedChatWebhooksStore,
    selectedCommunityBotsStore,
    selectedCommunityMembersStore,
    type CommunitySummary,
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
    type WebhookDetails,
} from "openchat-client";

export class MemberManagement {
    #members = $state<ReadonlyMap<string, Member>>(new Map());
    #bots = $state<ReadonlyMap<string, GrantedBotPermissions>>(new Map());
    #webhooks = $state<ReadonlyMap<string, WebhookDetails>>(new Map());

    destroy: () => void;

    constructor(
        private client: OpenChat,
        private collection: MultiUserChat | CommunitySummary,
    ) {
        const membersStore =
            collection.kind === "community"
                ? selectedCommunityMembersStore
                : selectedChatMembersStore;

        const botsStore =
            collection.kind === "community" ? selectedCommunityBotsStore : selectedChatBotsStore;

        const unsubs = [
            membersStore.subscribe((m) => (this.#members = m)),
            botsStore.subscribe((b) => (this.#bots = b)),
        ];

        if (collection.kind !== "community") {
            unsubs.push(selectedChatWebhooksStore.subscribe((h) => (this.#webhooks = h)));
        }

        this.destroy = () => {
            unsubs.forEach((u) => u());
        };
    }

    get members() {
        return this.#members;
    }

    get bots() {
        return this.#bots;
    }

    get webhooks() {
        return this.#webhooks;
    }

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
        let success = false;
        if (this.collection.kind === "community") {
            success = await this.client.blockCommunityUser(this.collection.id, userId);
        } else {
            success = await this.client.blockUser(this.collection.id, userId);
        }
        if (success) {
            toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
        } else {
            toastStore.showFailureToast(i18nKey("blockUserFailed"));
        }
    }

    async onUnblockUser(userId: string) {
        let success = false;
        if (this.collection.kind === "community") {
            success = await this.client.unblockCommunityUser(this.collection.id, userId);
        } else {
            success = await this.client.unblockUser(this.collection.id, userId);
        }
        if (success) {
            toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
        } else {
            toastStore.showFailureToast(i18nKey("unblockUserFailed"));
        }
    }

    onChangeRole(args: { userId: string; newRole: MemberRole; oldRole: MemberRole }): void {
        const { userId, newRole, oldRole } = args;
        (this.collection.kind === "community"
            ? this.client.changeCommunityRole(this.collection.id, userId, newRole, oldRole)
            : this.client.changeRole(this.collection.id, userId, newRole, oldRole)
        ).then((success) => {
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

    inviteUser(userId: string) {
        this.client
            .inviteUsers(this.collection.id, [userId])
            .then((resp) => {
                if (resp) {
                    if (this.collection?.public ?? false) {
                        toastStore.showSuccessToast(i18nKey("group.usersInvited"));
                    }
                } else {
                    toastStore.showFailureToast(
                        i18nKey("group.inviteUsersFailed", undefined, this.collection.level, true),
                    );
                }
            })
            .catch(() => {
                toastStore.showFailureToast(
                    i18nKey("group.inviteUsersFailed", undefined, this.collection.level, true),
                );
            });
    }

    cancelInvites(userIds: string[]) {
        return this.client.cancelInvites(this.collection.id, userIds);
    }

    canUninvite() {
        return this.client.canInviteUsers(this.collection.id);
    }

    canInvite() {
        return this.client.canInviteUsers(this.collection.id);
    }

    canBlockUsers() {
        return this.client.canBlockUsers(this.collection.id);
    }

    canUnblockUsers() {
        return this.client.canUnblockUsers(this.collection.id);
    }

    canRemoveMembers() {
        return this.client.canRemoveMembers(this.collection.id);
    }

    canPromote(from: MemberRole, to: MemberRole) {
        return this.client.canPromote(this.collection.id, from, to);
    }

    canDemote(from: MemberRole, to: MemberRole) {
        return this.client.canDemote(this.collection.id, from, to);
    }

    canManageBots() {
        return this.client.canManageBots(this.collection.id);
    }

    onRemoveMember(userId: string): void {
        (this.collection.kind === "community"
            ? this.client.removeCommunityMember(this.collection.id, userId)
            : this.client.removeMember(this.collection.id, userId)
        )
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

    showAllMembers() {
        if (this.collection.kind === "community") {
            console.log("Open community members");
        } else {
            publish("groupMembers", { chat: this.collection, view: "members" });
        }
    }

    inviteUsers() {
        if (this.collection.kind === "community") {
            console.log("Open invite community members");
        } else {
            publish("groupMembers", { chat: this.collection, view: "invite" });
        }
    }
}
