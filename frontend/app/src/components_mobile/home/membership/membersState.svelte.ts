import { i18nKey } from "@src/i18n/i18n";
import { toastStore } from "@src/stores/toast";
import {
    compareRoles,
    currentUserIdStore,
    inviteLinkUrl,
    publish,
    roleAsText,
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
    selectedCommunitySummaryStore,
    type ChannelIdentifier,
    type CommunitySummary,
    type EnhancedExternalBot,
    type ExternalBot,
    type FullMember,
    type GrantedBotPermissions,
    type InviteLink,
    type InviteLinkOutcome,
    type Member,
    type MemberRole,
    type MultiUserChat,
    type OpenChat,
    type ReadonlyMap,
    type ReadonlySet,
    type UserOrUserGroup,
    type UserSummary,
    type WebhookDetails,
} from "@client";

export class MemberManagement {
    #usersToAddOrInvite = $state<UserSummary[]>([]);
    #inviting = $state(false);
    #members = $state<ReadonlyMap<string, Member>>(new Map());
    #lapsed = $state<ReadonlySet<string>>(new Set());
    #blocked = $state<ReadonlySet<string>>(new Set());
    #invited = $state<ReadonlySet<string>>(new Set());
    #bots = $state<ReadonlyMap<string, GrantedBotPermissions>>(new Map());
    #webhooks = $state<ReadonlyMap<string, WebhookDetails>>(new Map());
    #togglingSharingLink = $state(false);
    // undefined until the link has loaded
    #inviteLink = $state<InviteLink>();
    #confirmingResetLink = $state(false);

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
            collection.kind === "community" || collection.kind === "channel"
                ? selectedCommunityBotsStore
                : selectedChatBotsStore;

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

    get inviting() {
        return this.#inviting;
    }

    get confirmingResetLink() {
        return this.#confirmingResetLink;
    }

    get togglingSharingLink() {
        return this.#togglingSharingLink;
    }

    get inviteLink() {
        return this.#inviteLink;
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

    get level() {
        return this.collection.level;
    }

    get usersToAddOrInvite() {
        return this.#usersToAddOrInvite;
    }

    deleteInvited(user: UserOrUserGroup): void {
        if (user.kind !== "user") return;
        this.#usersToAddOrInvite = this.#usersToAddOrInvite.filter((m) => m.userId !== user.userId);
    }

    addInvited(user: UserSummary): void {
        const u = this.#usersToAddOrInvite.find((u) => u.userId === user.userId);
        if (u === undefined) {
            this.#usersToAddOrInvite.push(user);
        }
    }

    async confirmResetLinkResponse(yes: boolean): Promise<void> {
        try {
            if (yes) {
                this.#applyInviteLink(await this.client.resetInviteLink(this.collection));
            }
        } finally {
            this.#confirmingResetLink = false;
        }
    }

    confirmResetLink() {
        this.#confirmingResetLink = true;
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

    addUsers(): Promise<boolean> {
        if (this.collection.kind !== "channel") return Promise.resolve(false);

        this.#inviting = true;

        const userIds = this.#usersToAddOrInvite.map((u) => u.userId);

        return this.client
            .addMembersToChannel(this.collection.id as ChannelIdentifier, userIds)
            .then((resp) => {
                switch (resp.kind) {
                    case "success": {
                        return true;
                    }
                    case "add_to_channel_partial_success": {
                        toastStore.showSuccessToast(i18nKey("group.addMembersPartialSuccess"));
                        return true;
                    }
                    default: {
                        toastStore.showFailureToast(i18nKey("group.addMembersFailed"));
                        return false;
                    }
                }
            })
            .catch(() => {
                toastStore.showFailureToast(i18nKey("group.addMembersFailed"));
                return false;
            })
            .finally(() => (this.#inviting = false));
    }

    inviteUsers() {
        if (this.#usersToAddOrInvite.length === 0) return;

        this.#inviting = true;
        this.client
            .inviteUsers(
                this.collection.id,
                this.#usersToAddOrInvite.map((u) => u.userId),
            )
            .then((resp) => {
                if (resp) {
                    this.#usersToAddOrInvite = [];
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
            })
            .finally(() => (this.#inviting = false));
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

    canAdd() {
        const community = selectedCommunitySummaryStore.value;
        return (
            community !== undefined &&
            !community.public &&
            this.collection.kind === "channel" &&
            this.client.canAddMembers(this.collection.id)
        );
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

    async initialiseSharing() {
        this.#applyInviteLink(await this.client.getInviteLink(this.collection));
    }

    async toggleInviteLink() {
        const link = this.#inviteLink;
        if (this.#togglingSharingLink || (link?.kind !== "enabled" && link?.kind !== "disabled")) {
            return;
        }
        this.#togglingSharingLink = true;
        try {
            this.#applyInviteLink(
                await this.client.setInviteLinkEnabled(this.collection, link.kind === "disabled"),
            );
        } finally {
            this.#togglingSharingLink = false;
        }
    }

    #applyInviteLink(outcome: InviteLinkOutcome) {
        if (outcome.kind === "failed") {
            toastStore.showFailureToast(outcome.message);
        } else {
            this.#inviteLink = outcome;
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

    /** The URL to share, once the link has loaded and if it is public or enabled */
    get sharingLink(): string | undefined {
        return inviteLinkUrl(
            this.client.canonicalOrigin(),
            this.collection.id,
            currentUserIdStore.value,
            this.#inviteLink,
        );
    }

    canManageBots() {
        return this.client.canManageBots(this.collection.id);
    }

    canRegisterWebhook() {
        if (this.collection.kind === "community") return false;
        return this.client.canRegisterWebhook(this.collection.id);
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

    showAllMembers(view: "members" | "blocked" | "lapsed" | "add" = "members") {
        publish("showMembers", { collection: this.collection, view });
    }

    showInviteUsers() {
        publish("inviteAndShare", { collection: this.collection, view: "invite" });
    }
}
