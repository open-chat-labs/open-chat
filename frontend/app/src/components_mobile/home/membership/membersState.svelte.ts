import { i18nKey } from "@src/i18n/i18n";
import { toastStore } from "@src/stores/toast";
import {
    compareRoles,
    currentUserIdStore,
    publish,
    roleAsText,
    routeForChatIdentifier,
    selectedChatBlockedUsersStore,
    selectedChatBotsStore,
    selectedChatInvitedUsersStore,
    selectedChatLapsedMembersStore,
    selectedChatMembersStore,
    selectedChatWebhooksStore,
    selectedCommunityBlockedUsersStore,
    selectedCommunityBotsStore,
    selectedCommunityInvitedUsersStore,
    selectedCommunityLapsedMembersStore,
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
    #lapsed = $state<ReadonlySet<string>>(new Set());
    #blocked = $state<ReadonlySet<string>>(new Set());
    #invited = $state<ReadonlySet<string>>(new Set());
    #bots = $state<ReadonlyMap<string, GrantedBotPermissions>>(new Map());
    #webhooks = $state<ReadonlyMap<string, WebhookDetails>>(new Map());
    #togglingSharingLink = $state(false);
    #sharingLinkEnabled = $state(false);
    #sharingLinkCode = $state<string>();

    destroy: () => void;

    constructor(
        private client: OpenChat,
        private collection: MultiUserChat | CommunitySummary,
    ) {
        const membersStore =
            collection.kind === "community"
                ? selectedCommunityMembersStore
                : selectedChatMembersStore;

        const lapsedStore =
            collection.kind === "community"
                ? selectedCommunityLapsedMembersStore
                : selectedChatLapsedMembersStore;

        const blockedStore =
            collection.kind === "community"
                ? selectedCommunityBlockedUsersStore
                : selectedChatBlockedUsersStore;

        const invitedStore =
            collection.kind === "community"
                ? selectedCommunityInvitedUsersStore
                : selectedChatInvitedUsersStore;

        const botsStore =
            collection.kind === "community" ? selectedCommunityBotsStore : selectedChatBotsStore;

        const unsubs = [
            membersStore.subscribe((m) => (this.#members = m)),
            lapsedStore.subscribe((m) => (this.#lapsed = m)),
            blockedStore.subscribe((m) => (this.#blocked = m)),
            invitedStore.subscribe((m) => (this.#invited = m)),
            botsStore.subscribe((b) => (this.#bots = b)),
        ];

        if (collection.kind !== "community") {
            unsubs.push(selectedChatWebhooksStore.subscribe((h) => (this.#webhooks = h)));
        }

        this.destroy = () => {
            unsubs.forEach((u) => u());
        };
    }

    get togglingSharingLink() {
        return this.#togglingSharingLink;
    }

    get sharingLinkEnabled() {
        return this.#sharingLinkEnabled;
    }

    get sharingLinkCode() {
        return this.#sharingLinkCode;
    }

    get invited() {
        return this.#invited;
    }

    get blocked() {
        return this.#blocked;
    }

    get lapsed() {
        return this.#lapsed;
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

    get isPublic() {
        return this.collection.public;
    }

    initialiseSharing() {
        if (this.collection.public || this.collection.kind === "channel") {
            return;
        }
        this.client
            .getInviteCode(this.collection.id)
            .then((resp) => {
                if (resp.kind === "success") {
                    this.#sharingLinkEnabled = resp.code !== undefined;
                    this.#sharingLinkCode = resp.code;
                }
            })
            .catch((err) => {
                console.error("Unable to get invite code: ", err);
            });
    }

    toggleInviteLink() {
        if (this.collection.kind === "channel") return;
        if (this.#togglingSharingLink) return;

        this.#togglingSharingLink = true;
        this.#sharingLinkEnabled = !this.#sharingLinkEnabled;
        if (this.#sharingLinkEnabled) {
            this.client
                .enableInviteCode(this.collection.id)
                .then((resp) => {
                    if (resp.kind === "success") {
                        this.#sharingLinkCode = resp.code;
                    } else {
                        this.#sharingLinkEnabled = false;
                        console.error("Unauthorized response calling enableInviteCode");
                    }
                })
                .catch((err) => {
                    this.#sharingLinkEnabled = false;
                    console.error("Unable to enable invite code: ", err);
                })
                .finally(() => {
                    this.#togglingSharingLink = false;
                });
        } else {
            this.client
                .disableInviteCode(this.collection.id)
                .catch((err) => {
                    this.#sharingLinkCode = undefined;
                    this.#sharingLinkEnabled = true;
                    console.error("Unable to disable invite code: ", err);
                })
                .finally(() => {
                    this.#togglingSharingLink = false;
                });
        }
    }

    shareLink(url: string): void {
        const share = {
            url,
            files: [],
        };
        navigator.share(share).catch((e: DOMException) => {
            if (e.name !== "AbortError") {
                const errorMessage = `Failed to share link ${url}`;
                console.log(`${errorMessage}: ${e}`);
                toastStore.showFailureToast(i18nKey("failedToShareLink"));
            }
        });
    }

    getSharingLink() {
        const qs =
            `/?ref=${currentUserIdStore.value}` +
            (!this.collection.public ? `&code=${this.#sharingLinkCode}` : "");
        switch (this.collection.id.kind) {
            case "community":
                return `${window.location.origin}/community/${this.collection.id.communityId}${qs}`;
            case "channel":
                return `${window.location.origin}${routeForChatIdentifier(
                    "community",
                    this.collection.id,
                )}${qs}`;
            case "group_chat":
                return `${window.location.origin}${routeForChatIdentifier(
                    "chats",
                    this.collection.id,
                )}${qs}`;
        }
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
        publish("showMembers", { collection: this.collection, view: "members" });
    }

    inviteUsers() {
        publish("inviteAndShare", { collection: this.collection, view: "invite" });
    }
}
